import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { currentWeekStart, defaultCookSessions, generateWeek, MAX_PORTIONS, packsNeeded, parsePackSize, toProductUnit, weekOffsetFrom, type Recipe } from "../lib/menu";

const raw = JSON.parse(readFileSync("data/recipes.json", "utf8")) as { name: string; meal: Recipe["meal"]; servings: number; tags: string[] }[];
const recipes: Recipe[] = raw.map((r, i) => ({ id: i + 1, name: r.name, meal: r.meal, servings: r.servings, tags: r.tags, owner_id: null, author_name: null }));
const byId = new Map(recipes.map((r) => [r.id, r]));

test("la semana empieza en lunes y avanza de siete en siete", () => {
  const start = currentWeekStart();
  assert.match(start, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(new Date(`${start}T12:00:00Z`).getUTCDay(), 1);
  const next = new Date(`${currentWeekStart(1)}T12:00:00Z`).getTime() - new Date(`${start}T12:00:00Z`).getTime();
  assert.equal(next, 7 * 24 * 3600 * 1000);
});

test("el parámetro de semana acepta 'siguiente', números y basura", () => {
  assert.equal(weekOffsetFrom("siguiente"), 1);
  assert.equal(weekOffsetFrom("-2"), -2);
  assert.equal(weekOffsetFrom("999"), 12); // se limita
  assert.equal(weekOffsetFrom("abc"), 0);
  assert.equal(weekOffsetFrom(undefined), 0);
});

test("quien vive solo cocina menos veces de las que come", () => {
  assert.ok(defaultCookSessions(1, 14) < 14);
  assert.equal(defaultCookSessions(4, 14), 14);
});

test("el menú cocina las veces pedidas, respeta los huecos fuera y no alarga las sobras", () => {
  const blocked = new Set(["5-comida", "5-cena", "6-comida", "6-cena"]);
  for (let run = 0; run < 200; run++) {
    const slots = generateWeek(recipes, { sessions: 5, blocked });
    assert.equal(slots.length, 14);
    const days = new Map<number, number[]>();
    for (const s of slots) {
      const key = `${s.day}-${s.meal}`;
      if (blocked.has(key)) {
        assert.equal(s.kind, "out");
        assert.equal(s.recipe_id, null);
        continue;
      }
      assert.equal(s.kind, "meal");
      assert.notEqual(s.recipe_id, null);
      const recipe = byId.get(s.recipe_id!)!;
      assert.ok(recipe.meal === "ambas" || recipe.meal === s.meal, "receta en el momento del día correcto");
      days.set(s.recipe_id!, [...(days.get(s.recipe_id!) ?? []), s.day]);
    }
    assert.ok(days.size <= 5, "no cocina más veces de las pedidas");
    for (const d of days.values()) {
      assert.ok(d.length <= MAX_PORTIONS, "como mucho tres raciones por receta");
      assert.ok(Math.max(...d) - Math.min(...d) <= 3, "las sobras no duran más de tres días");
    }
  }
});

test("los envases se cuentan enteros y por unidad de venta", () => {
  assert.deepEqual(toProductUnit(500, "g"), { qty: 0.5, unit: "kg" });
  assert.deepEqual(toProductUnit(250, "ml"), { qty: 0.25, unit: "l" });
  assert.deepEqual(parsePackSize("500 g"), { amount: 0.5, unit: "kg" });
  assert.deepEqual(parsePackSize("33 cl"), { amount: 0.33, unit: "l" });
  assert.equal(parsePackSize("sin formato"), null);
  const product = { id: 1, supermarket_id: "dia", name: "Arroz 1 Kg", brand: null, category: null, price: 1.2, unit_price: 1.2, unit: "kg", pack_size: "1 kg", image_url: null, product_url: null };
  assert.equal(packsNeeded({ ingredient: "arroz", qty: 1500, unit: "g" }, product), 2);
  assert.equal(packsNeeded({ ingredient: "arroz", qty: 200, unit: "g" }, product), 1);
});
