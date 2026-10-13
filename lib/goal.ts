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

export function targetsFor(b: Body): Targets {
  const estimated = !hasBodyData(b);
  const sex = b.sex ?? "mujer";
  const age = b.age ?? 22;
  const w = b.weightKg ?? (sex === "hombre" ? 72 : 62);
  const h = b.heightCm ?? (sex === "hombre" ? 176 : 164);
  const goal = b.bodyGoal ?? "mantener";
  const [a, bAge, cH, dW] = TEE[sex][b.activity ?? "media"];
  const tee = a - bAge * age + cH * h + dW * w;
  // Perder: déficit del 20 % sin pasar de 500 kcal (pauta habitual de 500-750; así nadie baja de golpe)
  // y nunca por debajo de 1.200 (mujer) / 1.500 (hombre). Ganar: superávit pequeño, +10 %, para
  // que lo ganado sea sobre todo músculo. Proteína: 1,6 g/kg ganando (meta-análisis de Morton 2018),
  // 1,4 perdiendo para conservar músculo y 1,2 manteniendo.
  const deficit = Math.min(500, tee * 0.2);
  const floor = sex === "hombre" ? 1500 : 1200;
  const kcalDay = Math.round(goal === "perder" ? Math.max(floor, tee - deficit) : goal === "ganar" ? tee * 1.1 : tee);
  const gPerKg = goal === "ganar" ? 1.6 : goal === "perder" ? 1.4 : 1.2;
  const proteinDay = Math.round(w * gPerKg);
  return {
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
