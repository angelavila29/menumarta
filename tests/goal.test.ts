import assert from "node:assert/strict";
import { test } from "node:test";
import { judge, targetsFor } from "../lib/goal";

test("objetivos diarios: hombre 22 años, 72 kg, 176 cm, actividad media, mantener", () => {
  const t = targetsFor({ sex: "hombre", age: 22, weightKg: 72, heightCm: 176, activity: "media", bodyGoal: "mantener" });
  // BMR ≈ 1715 · 1.55 ≈ 2658
  assert.ok(t.kcalDay > 2550 && t.kcalDay < 2750, String(t.kcalDay));
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
