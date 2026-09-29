import assert from "node:assert/strict";
import { test } from "node:test";
import { targetsFor } from "../lib/goal";
import { assess, nutritionByRecipe, weekBalance } from "../lib/menu-nutrition";
import type { Slot } from "../lib/menu";

const rows = [
  { recipe_id: 1, ingredient_name: "pechuga de pollo", qty: 600, unit: "g" },
  { recipe_id: 1, ingredient_name: "arroz", qty: 300, unit: "g" },
  { recipe_id: 2, ingredient_name: "lechuga", qty: 1, unit: "ud" },
  { recipe_id: 2, ingredient_name: "tomate", qty: 2, unit: "ud" },
];
const nutrition = nutritionByRecipe(rows, new Map([[1, 4], [2, 4]]));

test("nutrición por receta y balance semanal", () => {
  const pollo = nutrition.get(1)!;
  assert.ok(pollo.protein > 30 && pollo.kcal > 400, JSON.stringify(pollo));
  const slots: Slot[] = [
    { day: 0, meal: "comida", recipe_id: 1, kind: "meal" },
    { day: 0, meal: "cena", recipe_id: 2, kind: "meal" },
    { day: 1, meal: "comida", recipe_id: 1, kind: "meal" },
  ];
  const w = weekBalance(slots, nutrition);
  assert.equal(w.daysWithMeals, 2);
  assert.equal(w.days[0].meals, 2);
  assert.ok(w.avgProtein > 30);
});

test("valoración: solo ensaladas para ganar músculo → falta proteína", () => {
  const slots: Slot[] = [0, 1, 2, 3, 4, 5, 6].flatMap((day) => [
    { day, meal: "comida" as const, recipe_id: 2, kind: "meal" as const },
    { day, meal: "cena" as const, recipe_id: 2, kind: "meal" as const },
  ]);
  const t = targetsFor({ sex: "hombre", age: 22, weightKg: 75, heightCm: 178, activity: "alta", bodyGoal: "ganar" });
  const a = assess(weekBalance(slots, nutrition), t, "ganar");
  assert.equal(a.protein, "bajo");
  assert.equal(a.kcal, "bajo");
  assert.equal(a.headline, "Te falta proteína");
  assert.ok(a.tips.length >= 2);
});
