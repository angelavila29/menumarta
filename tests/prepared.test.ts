import { test } from "node:test";
import assert from "node:assert/strict";
import { genericName, guessMainTag, PREPARED_CATEGORY } from "../lib/prepared";

test("nombre genérico sin marca ni tamaño", () => {
  assert.equal(genericName("Arroz negro Dia Al Punto 330 g", "Dia Al Punto"), "Arroz negro");
  assert.equal(genericName("Gyozas de pollo y verduras Hacendado 600 g", "Hacendado"), "Gyozas de pollo y verduras");
  assert.equal(genericName("lasaña boloñesa 2 x 300 g", null), "Lasaña boloñesa");
});

test("tipo de plato a partir del nombre", () => {
  assert.equal(guessMainTag("Arroz negro"), "arroz");
  assert.equal(guessMainTag("Lasaña boloñesa"), "pasta");
  assert.equal(guessMainTag("Gyozas de pollo"), "carne");
  assert.equal(guessMainTag("Croquetas de jamón"), "guiso");
});

test("categorías de comida ya hecha", () => {
  assert.ok(PREPARED_CATEGORY.test("congelados-y-helados > arroces-y-pasta"));
  assert.ok(PREPARED_CATEGORY.test("Pizzas y platos preparados > Listo para Comer"));
  assert.ok(!PREPARED_CATEGORY.test("Fruta y verdura > Fruta"));
});
