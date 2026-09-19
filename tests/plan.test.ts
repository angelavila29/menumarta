import assert from "node:assert/strict";
import { test } from "node:test";
import { choiceFor, recommendedPlan, summarize, type PlanRow } from "../lib/plan";
import { nutritionPerServing } from "../lib/nutrition";
import { familyOf } from "../lib/categories";
import { stem, unaccent, wordRegex } from "../lib/search";

const product = (id: number, chain: string, price: number) => ({
  id, supermarket_id: chain, name: `p${id}`, brand: null, category: null, price, unit_price: price, unit: "kg", pack_size: "1 kg", image_url: null, product_url: null,
});
const rows: PlanRow[] = [
  { key: "a|g", need: { ingredient: "a", qty: 100, unit: "g" }, inPantry: false, remembered: false,
    options: { mercadona: { product: product(1, "mercadona", 3), packs: 1, cost: 3 }, dia: { product: product(2, "dia", 2), packs: 1, cost: 2 } } },
  { key: "b|g", need: { ingredient: "b", qty: 100, unit: "g" }, inPantry: false, remembered: false,
    options: { mercadona: { product: product(3, "mercadona", 1), packs: 1, cost: 1 }, dia: null } },
  { key: "c|g", need: { ingredient: "c", qty: 100, unit: "g" }, inPantry: true, remembered: false,
    options: { mercadona: { product: product(4, "mercadona", 9), packs: 1, cost: 9 }, dia: { product: product(5, "dia", 9), packs: 1, cost: 9 } } },
];

test("lo que ya hay en la despensa no cuenta y el plan repartido coge lo más barato de cada uno", () => {
  const plans = summarize(rows, ["mercadona", "dia"]);
  assert.equal(plans.find((p) => p.id === "mercadona")!.total, 4);
  assert.equal(plans.find((p) => p.id === "dia")!.missing, 1);
  const mixed = plans.find((p) => p.id === "mixed")!;
  assert.equal(mixed.total, 3); // 2 en Dia + 1 en Mercadona
  assert.equal(mixed.stores, 2);
  assert.equal(choiceFor(rows[0], "mixed")!.product.supermarket_id, "dia");
});

test("la recomendación respeta la estrategia elegida", () => {
  const plans = summarize(rows, ["mercadona", "dia"]);
  assert.equal(recommendedPlan(plans, "barato", "mercadona"), "mixed");
  assert.equal(recommendedPlan(plans, "habitual", "mercadona"), "mercadona");
  // "avisar": se queda en el habitual porque el ahorro es pequeño
  assert.equal(recommendedPlan(plans, "avisar", "mercadona"), "mercadona");
});

test("la nutrición por ración usa las cantidades reales", () => {
  const n = nutritionPerServing([{ ingredient_name: "arroz", qty: 400, unit: "g" }, { ingredient_name: "huevo", qty: 2, unit: "ud" }], 4);
  assert.equal(n.covered, 2);
  assert.equal(n.kcal, Math.round((360 * 4 + 143 * 1.1) / 4));
});

test("las familias de producto agrupan por categoría de cada cadena", () => {
  assert.equal(familyOf("Huevos, leche y mantequilla").id, "lacteos");
  assert.equal(familyOf("huevos-leche-y-mantequilla > huevos").id, "lacteos");
  assert.equal(familyOf("Fruta y verdura").id, "fruta");
  assert.equal(familyOf(null).id, "otros");
});

test("la búsqueda ignora tildes y plurales", () => {
  assert.equal(unaccent("Champiñón"), "champinon");
  assert.equal(stem("champiñones"), "champinon");
  assert.match("champinones laminados", new RegExp(wordRegex("champiñón").replace(/\\m|\\M/g, "\\b")));
});
