import assert from "node:assert/strict";
import { test } from "node:test";
import { parseRecipeText } from "../lib/recipe-parse";

const known = ["arroz", "huevo", "ajo", "aceite de oliva", "pechuga de pollo", "cebolla", "tomate frito"];

test("lee una receta pegada con cantidades, unidades y pasos", () => {
  const r = parseRecipeText(
    `Arroz con pollo de mi madre
Para 4 personas · 40 min

Ingredientes:
- 300 g de arroz
- 2 pechugas de pollo
- 1 cebolla grande
- 2 dientes de ajo
- 1/2 vaso de tomate frito
- 3 cucharadas de AOVE
- Sal

Preparación
1. Dora el pollo con el aceite.
2. Añade la cebolla y el ajo y sofríe cinco minutos.`,
    known
  );
  assert.equal(r.name, "Arroz con pollo de mi madre");
  assert.equal(r.servings, 4);
  assert.equal(r.timeMinutes, 40);
  assert.equal(r.steps.length, 2);
  const arroz = r.ingredients.find((i) => i.name === "arroz");
  assert.deepEqual(arroz, { name: "arroz", qty: 300, unit: "g" });
  assert.equal(r.ingredients.find((i) => i.name === "pechuga de pollo")?.qty, 2);
  assert.equal(r.ingredients.find((i) => i.name === "aceite de oliva")?.qty, 45); // 3 cucharadas
  assert.equal(r.ingredients.find((i) => i.name === "tomate frito")?.qty, 100); // medio vaso
  assert.ok(!r.ingredients.some((i) => i.name === "sal"), "los ingredientes sin cantidad se omiten");
});

test("un texto sin formato no revienta", () => {
  const r = parseRecipeText("Tortilla\nBate dos huevos y cuájalos en la sartén con un poco de aceite.", known);
  assert.equal(r.name, "Tortilla");
  assert.equal(r.steps.length, 1);
});
