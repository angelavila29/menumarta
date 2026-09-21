import assert from "node:assert/strict";
import { test } from "node:test";
import { rankRecipes, type CookRecipe } from "../lib/cook";
import type { Product } from "../lib/types";

const recipe = (id: number, name: string, ings: [string, number, string][]): CookRecipe => ({
  id, name, tags: [], minutes: 20, photoUrl: null, author: null,
  ingredients: ings.map(([n, qty, unit]) => ({ name: n, qty, unit })),
});
const product = (id: number, price: number, pack: string): Product =>
  ({ id, name: `p${id}`, price, pack_size: pack, unit: "kg", unit_price: price, supermarket_id: "mercadona" }) as Product;

const recipes = [
  recipe(1, "Tortilla", [["huevo", 4, "ud"], ["patata", 500, "g"], ["cebolla", 1, "ud"]]),
  recipe(2, "Arroz con pollo", [["arroz", 200, "g"], ["muslo de pollo", 400, "g"], ["cebolla", 1, "ud"]]),
  recipe(3, "Salmón al horno", [["salmón", 300, "g"], ["limón", 1, "ud"], ["sal", 5, "g"]]),
];
const products = new Map<string, Product | null>([
  ["muslo de pollo", product(1, 3.5, "1 kg")],
  ["salmón", product(2, 9, "250 g")],
  ["limón", product(3, 1.2, "1 kg")],
  ["arroz", product(4, 1.3, "1 kg")],
]);

test("lo que puedes cocinar ya sale primero y cuesta cero", () => {
  const { results } = rankRecipes(recipes, new Set(["huevo", "patata", "cebolla", "arroz"]), products, null);
  assert.equal(results[0].recipe.name, "Tortilla");
  assert.equal(results[0].missing.length, 0);
  assert.equal(results[0].cost, 0);
  assert.equal(results[1].recipe.name, "Arroz con pollo");
  assert.deepEqual(results[1].missing.map((m) => m.name), ["muslo de pollo"]);
  assert.equal(results[1].cost, 3.5);
});

test("se paga el envase entero y la sal nunca falta", () => {
  const { results } = rankRecipes(recipes, new Set(), products, null);
  const salmon = results.find((r) => r.recipe.id === 3)!;
  assert.deepEqual(salmon.missing.map((m) => m.name), ["salmón", "limón"]);
  assert.equal(salmon.cost, 9 * 2 + 1.2); // 300 g en bandejas de 250 g = 2 bandejas
});

test("el presupuesto aparta lo que se pasa y lo cuenta", () => {
  const { results, overBudget } = rankRecipes(recipes, new Set(["huevo", "patata", "cebolla", "arroz"]), products, 5);
  assert.deepEqual(results.map((r) => r.recipe.id), [1, 2]);
  assert.equal(overBudget, 1);
});

test("un ingrediente sin producto no suma pero se avisa", () => {
  const { results } = rankRecipes(recipes, new Set(["patata", "cebolla"]), products, null);
  const tortilla = results.find((r) => r.recipe.id === 1)!;
  assert.equal(tortilla.unpriced, 1);
  assert.equal(tortilla.cost, 0);
});
