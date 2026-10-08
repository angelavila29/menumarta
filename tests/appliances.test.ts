import assert from "node:assert/strict";
import { test } from "node:test";
import { canCook, requiredAppliances } from "../lib/appliances";

test("deduce lo que pide cada receta por sus pasos", () => {
  assert.deepEqual(requiredAppliances(["Gratina 8 minutos a 220 °C."]), ["horno"]);
  assert.deepEqual(requiredAppliances(["Sofríe la cebolla.", "Tritura con la nata."]), ["batidora", "fuego"]);
  assert.deepEqual(requiredAppliances(["Mezcla todo y aliña."]), []);
});

test("filtra según lo que hay en casa", () => {
  const lasana = ["Sofríe la carne.", "Hornea 25 minutos."];
  assert.equal(canCook(lasana, null), true); // no lo ha dicho: no se filtra
  assert.equal(canCook(lasana, ["fuego"]), false);
  assert.equal(canCook(lasana, ["fuego", "horno"]), true);
  assert.equal(canCook(lasana, ["fuego", "freidora"]), true); // la freidora de aire hace de horno
  assert.equal(canCook(["Mezcla y sirve."], []), true);
});
