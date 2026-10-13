/**
 * Objetivo corporal y necesidades diarias aproximadas. Es orientativo, no consejo médico:
 * fórmula de Mifflin-St Jeor para el gasto en reposo, factor de actividad y un ajuste por objetivo.
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

const ACTIVITY_FACTOR = { baja: 1.35, media: 1.55, alta: 1.75 };
// Reparto habitual en España: desayuno ~20-25 %, media mañana y merienda ~10-15 %, comida ~35 % y
// cena ~30 %. Comida + cena ≈ 65 % del día; el resto lo pone lo que el menú no planifica.
const MEALS_SHARE_KCAL = 0.65;
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
  // Mifflin-St Jeor
  const bmr = 10 * w + 6.25 * h - 5 * age + (sex === "hombre" ? 5 : -161);
  const tdee = bmr * ACTIVITY_FACTOR[b.activity ?? "media"];
  // Para perder, un 15 % menos del gasto (no una cifra fija, que en personas pequeñas y
  // sedentarias deja objetivos imposibles); para ganar, un pequeño superávit.
  const kcalDay = Math.round(Math.max(1200, goal === "perder" ? tdee * 0.85 : goal === "ganar" ? tdee + 250 : tdee));
  const gPerKg = goal === "ganar" ? 1.7 : goal === "perder" ? 1.4 : 1.2;
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
