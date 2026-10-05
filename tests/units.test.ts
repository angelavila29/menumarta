import assert from "node:assert/strict";
import { test } from "node:test";
import { formatMeasure, toBase, unitDef } from "../lib/units";
import { formatUnits } from "../lib/qty";
import { parseRecipeText } from "../lib/recipe-parse";

test("medidas de casa a g/ml/ud", () => {
  assert.deepEqual(toBase(2, "cucharada"), { qty: 30, unit: "ml" });
  assert.deepEqual(toBase(1, "cucharadita"), { qty: 5, unit: "ml" });
  assert.deepEqual(toBase(1, "vaso"), { qty: 200, unit: "ml" });
  assert.deepEqual(toBase(1, "puñado", "arroz"), { qty: 40, unit: "g" });
  assert.deepEqual(toBase(1, "puñado", "espinacas"), { qty: 20, unit: "g" });
  assert.deepEqual(toBase(2, "diente"), { qty: 2, unit: "ud" });
  assert.deepEqual(toBase(0.5, "kg"), { qty: 500, unit: "g" });
  assert.deepEqual(toBase(3, "cdas"), { qty: 45, unit: "ml" });
  assert.equal(unitDef("Cucharadas")?.id, "cucharada");
});

test("se muestran como se escribieron", () => {
  assert.equal(formatMeasure(2, "cucharada", formatUnits), "2 cucharadas");
  assert.equal(formatMeasure(1, "vaso", formatUnits), "1 vaso");
  assert.equal(formatMeasure(0.5, "diente", formatUnits), "½ diente");
  assert.equal(formatMeasure(1.5, "cucharada", formatUnits), "1 ½ cucharadas");
  assert.equal(formatMeasure(150, "g", formatUnits), "150 g");
});

test("el texto pegado conserva cucharadas y vasos", () => {
  const r = parseRecipeText("Ingredientes\n2 cucharadas de aceite de oliva\n1 vaso de arroz\n200 g de tomate frito\n1 kg de patatas", ["aceite de oliva", "arroz", "tomate frito", "patata"]);
  const by = Object.fromEntries(r.ingredients.map((i) => [i.name, i]));
  assert.deepEqual([by["aceite de oliva"].qty, by["aceite de oliva"].unit], [2, "cucharada"]);
  assert.deepEqual([by["arroz"].qty, by["arroz"].unit], [1, "vaso"]);
  assert.deepEqual([by["tomate frito"].qty, by["tomate frito"].unit], [200, "g"]);
  assert.deepEqual([by["patata"].qty, by["patata"].unit], [1000, "g"]);
});
