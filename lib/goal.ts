/**
 * Objetivo corporal y necesidades diarias aproximadas. Es orientativo, no consejo médico:
 * gasto diario con las ecuaciones de las Dietary Reference Intakes for Energy (National Academies,
 * 2023), ajustadas con mediciones reales de agua doblemente marcada, y un ajuste por objetivo.
 */
export type Body = {
  sex: "mujer" | "hombre" | null;
  age: number | null;
  weightKg: number | null;
  heightCm: number | null;
  activity: "baja" | "media" | "alta" | null;
  bodyGoal: "perder" | "mantener" | "ganar" | null;
  /** plan para perder: peso al que se quiere llegar y ritmo en kg por semana */
  targetWeightKg?: number | null;
  paceKgWeek?: number | null;
};

export type Targets = {
  /** kcal y proteína al día */
  kcalDay: number;
  proteinDay: number;
  /** lo que corresponde a comidas y cenas (el menú no planifica desayunos ni meriendas) */
  kcalMeals: number;
  proteinMeals: number;
  /** raciones de verdura entre comida y cena, al día */
  vegMeals: number;
  /** si faltan datos, se usan valores medios y se avisa */
  estimated: boolean;
  /** reparto del día en gramos: grasa ≈ 30 % de las kcal, hidratos el resto */
  fatDay: number;
  carbsDay: number;
  /** gasto diario estimado y, si se pierde peso, kg por semana que supone el déficit */
  tee: number;
  kgPerWeek: number;
};

export const GOAL_LABEL: Record<NonNullable<Body["bodyGoal"]>, string> = { perder: "Perder peso", mantener: "Mantenerme", ganar: "Ganar músculo" };
export const ACTIVITY_LABEL: Record<NonNullable<Body["activity"]>, string> = { baja: "Poca (sentado casi todo el día)", media: "Media (ando bastante o deporte 2-3 días)", alta: "Alta (deporte 4+ días o trabajo físico)" };

// Gasto total diario (kcal) = a − b·edad + c·altura(cm) + d·peso(kg). Tabla 5-5 del informe DRI 2023.
// "baja" = inactive (PAL < 1.53), "media" = low active (1.53-1.68), "alta" = active (1.68-1.85).
const TEE: Record<"hombre" | "mujer", Record<"baja" | "media" | "alta", [number, number, number, number]>> = {
  hombre: { baja: [753.07, 10.83, 6.5, 14.1], media: [581.47, 10.83, 8.3, 14.94], alta: [1004.82, 10.83, 6.52, 15.91] },
  mujer: { baja: [584.9, 7.01, 5.72, 11.71], media: [575.77, 7.01, 6.6, 12.14], alta: [710.25, 7.01, 6.54, 12.34] },
};
// Reparto habitual en España: desayuno ~20-25 %, media mañana y merienda ~10-15 %, comida ~35 % y
// cena ~30 %. Comida + cena ≈ 65 % del día; el resto lo pone lo que el menú no planifica.
const MEALS_SHARE_KCAL = 0.65;

/** Cómo se reparte el objetivo diario. `menu` = lo planifica el menú semanal. */
export const DAY_PARTS = [
  { key: "desayuno", label: "Desayuno", emoji: "☕", share: 0.22, menu: false },
  { key: "picoteo", label: "Media mañana y merienda", emoji: "🍎", share: 0.13, menu: false },
  { key: "comida", label: "Comida", emoji: "🍲", share: 0.35, menu: true },
  { key: "cena", label: "Cena", emoji: "🌙", share: 0.3, menu: true },
] as const;

export function dayBreakdown(kcalDay: number) {
  return DAY_PARTS.map((p) => ({ ...p, kcal: Math.round((kcalDay * p.share) / 10) * 10 }));
}
const MEALS_SHARE_PROTEIN = 0.6; // el desayuno (leche, yogur, huevos) también aporta proteína

export function hasBodyData(b: Body): boolean {
  return b.age != null && b.weightKg != null && b.heightCm != null && b.sex != null;
}

/** 1 kg de grasa corporal ≈ 7.700 kcal. */
export const KCAL_PER_KG = 7700;
const kcalFloor = (sex: "mujer" | "hombre") => (sex === "hombre" ? 1500 : 1200);
/** Ritmo máximo sensato: un 1 % del peso por semana, sin pasar de 1 kg. */
export const maxPace = (weightKg: number) => Math.min(1, weightKg * 0.01);

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}
export function bmiLabel(v: number): string {
  return v < 18.5 ? "por debajo del peso saludable" : v < 25 ? "peso saludable" : v < 30 ? "sobrepeso" : "obesidad";
}
/** Rango de peso saludable para una altura (IMC 18,5-24,9, criterio de la OMS). */
export function healthyWeight(heightCm: number): { min: number; max: number } {
  const m2 = (heightCm / 100) ** 2;
  return { min: Math.ceil(18.5 * m2), max: Math.floor(24.9 * m2) };
}

export type PaceOption = {
  pace: number;
  label: string;
  kcalDay: number;
  /** semanas hasta el peso objetivo (null si no hay objetivo o ya se ha llegado) */
  weeks: number | null;
  allowed: boolean;
  recommended: boolean;
  why?: string;
};

/** Ritmos posibles para perder peso con las calorías que supone cada uno. */
export function paceOptions(b: Body): PaceOption[] {
  if (!hasBodyData(b)) return [];
  const w = b.weightKg!;
  const sex = b.sex!;
  const base = targetsFor({ ...b, bodyGoal: "mantener" });
  const toLose = b.targetWeightKg != null ? w - b.targetWeightKg : null;
  const opts = ([[0.25, "Suave"], [0.5, "Moderado"], [0.75, "Rápido"], [1, "Muy rápido"]] as const).map(([pace, label]) => {
    const kcalDay = Math.round(base.tee - (pace * KCAL_PER_KG) / 7);
    const tooFast = pace > maxPace(w) + 0.001;
    const tooLow = kcalDay < kcalFloor(sex);
    return {
      pace,
      label,
      kcalDay,
      weeks: toLose != null && toLose > 0 ? Math.ceil(toLose / pace) : null,
      allowed: !tooFast && !tooLow,
      recommended: false,
      why: tooLow ? `te dejaría por debajo de ${kcalFloor(sex).toLocaleString("es-ES")} kcal al día` : tooFast ? "es más del 1 % de tu peso por semana" : undefined,
    };
  });
  // Lo recomendado: en torno al 0,6 % del peso por semana (pauta habitual de 0,5-1 %)
  const ok = opts.filter((o) => o.allowed);
  if (ok.length > 0) {
    const ideal = w * 0.006;
    ok.reduce((best, o) => (Math.abs(o.pace - ideal) < Math.abs(best.pace - ideal) ? o : best)).recommended = true;
  }
  return opts;
}

export function targetsFor(b: Body): Targets {
  const estimated = !hasBodyData(b);
  const sex = b.sex ?? "mujer";
  const age = b.age ?? 22;
  const w = b.weightKg ?? (sex === "hombre" ? 72 : 62);
  const h = b.heightCm ?? (sex === "hombre" ? 176 : 164);
  const goal = b.bodyGoal ?? "mantener";
  const [a, bAge, cH, dW] = TEE[sex][b.activity ?? "media"];
  const tee = a - bAge * age + cH * h + dW * w;
  // Perder: si la persona ha elegido ritmo, el déficit sale de él (1 kg de grasa ≈ 7.700 kcal);
  // si no, un 20 % sin pasar de 500 kcal. Nunca por debajo de 1.200 (mujer) / 1.500 (hombre).
  // Ganar: superávit pequeño, +10 %, para que lo ganado sea sobre todo músculo. Proteína: 1,6 g/kg
  // ganando (meta-análisis de Morton 2018), 1,4 perdiendo para conservar músculo y 1,2 manteniendo.
  const pace = goal === "perder" && b.paceKgWeek ? Math.min(b.paceKgWeek, maxPace(w)) : null;
  const deficit = pace ? (pace * KCAL_PER_KG) / 7 : Math.min(500, tee * 0.2);
  const floor = kcalFloor(sex);
  const kcalDay = Math.round(goal === "perder" ? Math.max(floor, tee - deficit) : goal === "ganar" ? tee * 1.1 : tee);
  const gPerKg = goal === "ganar" ? 1.6 : goal === "perder" ? 1.4 : 1.2;
  const proteinDay = Math.round(w * gPerKg);
  const fatDay = Math.round((kcalDay * 0.3) / 9);
  const carbsDay = Math.max(0, Math.round((kcalDay - proteinDay * 4 - fatDay * 9) / 4));
  return {
    fatDay,
    carbsDay,
    tee: Math.round(tee),
    kgPerWeek: goal === "perder" ? Math.round((((tee - kcalDay) * 7) / KCAL_PER_KG) * 100) / 100 : 0,
    kcalDay,
    proteinDay,
    kcalMeals: Math.round(kcalDay * MEALS_SHARE_KCAL),
    proteinMeals: Math.round(proteinDay * MEALS_SHARE_PROTEIN),
    vegMeals: 2,
    estimated,
  };
}

export type Verdict = "ok" | "bajo" | "alto";

/** Compara lo que aporta el menú (media diaria de comida+cena) con el objetivo. Margen del 12 %. */
export function judge(actual: number, target: number, tolerance = 0.12): Verdict {
  if (target <= 0) return "ok";
  const r = actual / target;
  if (r < 1 - tolerance) return "bajo";
  if (r > 1 + tolerance) return "alto";
  return "ok";
}
