import assert from "node:assert/strict";
import { test } from "node:test";
import { bmi, dayBreakdown, healthyWeight, judge, paceOptions, targetsFor } from "../lib/goal";

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

test("peso saludable e IMC para 170 cm", () => {
  assert.deepEqual(healthyWeight(170), { min: 54, max: 71 });
  assert.ok(Math.abs(bmi(86, 170) - 29.76) < 0.01);
});

test("ritmos para perder: calorías, semanas y cuál se recomienda", () => {
  const b = { sex: "hombre" as const, age: 24, weightKg: 86, heightCm: 170, activity: "media" as const, bodyGoal: "perder" as const, targetWeightKg: 71 };
  const o = paceOptions(b);
  assert.deepEqual(o.map((x) => x.pace), [0.25, 0.5, 0.75, 1]);
  // gasto ≈ 3017; medio kilo por semana son 550 kcal menos
  assert.ok(Math.abs(o[1].kcalDay - 2467) <= 2, String(o[1].kcalDay));
  assert.equal(o[1].weeks, 30);
  assert.equal(o[1].recommended, true);
  assert.equal(o[3].allowed, false); // 1 kg/semana es más del 1 % de 86 kg
  const t = targetsFor({ ...b, paceKgWeek: 0.5 });
  assert.equal(t.kcalDay, o[1].kcalDay);
  assert.equal(t.kgPerWeek, 0.5);
  assert.ok(Math.abs(t.proteinDay * 4 + t.carbsDay * 4 + t.fatDay * 9 - t.kcalDay) < 12);
});

test("un ritmo que deja por debajo del mínimo no se ofrece", () => {
  const o = paceOptions({ sex: "mujer", age: 22, weightKg: 55, heightCm: 155, activity: "baja", bodyGoal: "perder" });
  assert.equal(o.find((x) => x.pace === 0.75)!.allowed, false);
  assert.equal(o.find((x) => x.pace === 0.25)!.recommended, true);
});

test("sin desayuno, sus calorías pasan a las demás comidas", () => {
  const b = { sex: "hombre" as const, age: 24, weightKg: 86, heightCm: 170, activity: "media" as const, bodyGoal: "mantener" as const };
  const all = targetsFor(b);
  const noBreakfast = targetsFor({ ...b, skipMeals: ["desayuno"] });
  assert.equal(noBreakfast.kcalDay, all.kcalDay);
  assert.ok(noBreakfast.kcalMeals > all.kcalMeals);
  assert.equal(targetsFor({ ...b, skipMeals: ["desayuno", "picoteo"] }).kcalMeals, all.kcalDay);
  const parts = dayBreakdown(2000, ["desayuno"]);
  assert.equal(parts[0].kcal, 0);
  assert.ok(Math.abs(parts.reduce((a, p) => a + p.kcal, 0) - 2000) <= 20);
});
