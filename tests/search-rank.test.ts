import assert from "node:assert/strict";
import { test } from "node:test";
import { rankByRelevance } from "../lib/search";

const p = (name: string, unit_price: number) => ({ name, unit_price });

test("leche: la leche antes que las cápsulas de café con leche aunque sean más baratas por unidad", () => {
  const r = rankByRelevance(
    [p("Cápsulas de café con leche Dia Cafetería 16 unidades", 0.2), p("Café con leche en cápsula Hacendado", 0.204), p("Leche desnatada Hacendado", 0.82), p("Leche entera Dia Láctea 1 L", 0.85), p("Arroz con leche Hacendado", 2.5)],
    "leche"
  );
  assert.deepEqual(r.slice(0, 2).map((x) => x.name), ["Leche desnatada Hacendado", "Leche entera Dia Láctea 1 L"]);
  assert.equal(r[r.length - 1].name.startsWith("Café con leche") || r[r.length - 1].name.startsWith("Cápsulas"), true);
});

test("palabra propia gana a palabra dentro de otra: 'pan' antes que 'empanada'", () => {
  const r = rankByRelevance([p("Empanada de atún", 5), p("Barra de pan", 2), p("Pan de molde", 1.4), p("Panceta", 6)], "pan");
  assert.deepEqual(r.slice(0, 2).map((x) => x.name), ["Pan de molde", "Barra de pan"]);
});

test("sin tildes y con varias palabras", () => {
  const r = rankByRelevance([p("Atún claro en aceite Hacendado", 9), p("Ensalada de atún", 4), p("Atún en aceite de oliva", 12)], "atun aceite");
  assert.equal(r[0].name, "Atún claro en aceite Hacendado");
});
