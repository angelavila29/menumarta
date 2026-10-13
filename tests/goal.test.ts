import assert from "node:assert/strict";
import { test } from "node:test";
import { judge, targetsFor } from "../lib/goal";

test("objetivos diarios: hombre 22 años, 72 kg, 176 cm, actividad media, mantener", () => {
  const t = targetsFor({ sex: "hombre", age: 22, weightKg: 72, heightCm: 176, activity: "media", bodyGoal: "mantener" });
  // DRI 2023, low active: 581.47 − 10.83·22 + 8.30·176 + 14.94·72 ≈ 2880
  assert.ok(t.kcalDay > 2830 && t.kcalDay < 2930, String(t.kcalDay));
  assert.equal(t.proteinDay, 86);
  assert.equal(t.estimated, false);
});

test("perder peso baja kcal y sube proteína; ganar músculo sube ambas", () => {
  const base = { sex: "mujer" as const, age: 24, weightKg: 60, heightCm: 165, activity: "media" as const };
  const m = targetsFor({ ...base, bodyGoal: "mantener" });
  const p = targetsFor({ ...base, bodyGoal: "perder" });
  const g = targetsFor({ ...base, bodyGoal: "ganar" });
  assert.ok(p.kcalDay < m.kcalDay && g.kcalDay > m.kcalDay);
  assert.ok(p.proteinDay > m.proteinDay && g.proteinDay > m.proteinDay);
});

test("sin datos se estima y se avisa", () => {
  const t = targetsFor({ sex: null, age: null, weightKg: null, heightCm: null, activity: null, bodyGoal: null });
  assert.equal(t.estimated, true);
  assert.ok(t.kcalDay > 1500);
});

test("veredicto con margen del 12 %", () => {
  assert.equal(judge(1000, 1000), "ok");
  assert.equal(judge(900, 1000), "ok");
  assert.equal(judge(850, 1000), "bajo");
  assert.equal(judge(1150, 1000), "alto");
});

test("mujer pequeña y sedentaria que quiere perder: objetivo diario realista", () => {
  // 22 años, 55 kg, 155 cm, inactiva: gasto ≈ 1960, perder (−20 %) ≈ 1570
  const t = targetsFor({ sex: "mujer", age: 22, weightKg: 55, heightCm: 155, activity: "baja", bodyGoal: "perder" });
  assert.ok(t.kcalDay > 1520 && t.kcalDay < 1620, String(t.kcalDay));
  assert.ok(t.kcalMeals > 980 && t.kcalMeals < 1060, String(t.kcalMeals));
});

test("perder nunca baja del mínimo ni quita más de 500 kcal", () => {
  const big = targetsFor({ sex: "hombre", age: 24, weightKg: 86, heightCm: 170, activity: "media", bodyGoal: "perder" });
  const keep = targetsFor({ sex: "hombre", age: 24, weightKg: 86, heightCm: 170, activity: "media", bodyGoal: "mantener" });
  assert.equal(keep.kcalDay - big.kcalDay, 500);
  const tiny = targetsFor({ sex: "mujer", age: 70, weightKg: 40, heightCm: 145, activity: "baja", bodyGoal: "perder" });
  assert.ok(tiny.kcalDay >= 1200);
});
