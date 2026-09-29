/** Equilibrio del menú semanal frente al objetivo de la persona. */
import { judge, type Targets, type Verdict } from "@/lib/goal";
import type { Slot } from "@/lib/menu";
import { nutritionPerServing, type Nutrition } from "@/lib/nutrition";

export type RecipeNutrition = Pick<Nutrition, "kcal" | "protein" | "veg"> & { covered: number; total: number };
export type IngredientRow = { recipe_id: number; ingredient_name: string; qty: number; unit: string };

/** Nutrición por ración de cada receta a partir de sus ingredientes y raciones base. */
export function nutritionByRecipe(rows: IngredientRow[], servingsById: Map<number, number>): Map<number, RecipeNutrition> {
  const byRecipe = new Map<number, IngredientRow[]>();
  for (const r of rows) byRecipe.set(r.recipe_id, [...(byRecipe.get(r.recipe_id) ?? []), r]);
  const out = new Map<number, RecipeNutrition>();
  for (const [id, ings] of byRecipe) {
    const n = nutritionPerServing(ings, servingsById.get(id) ?? 4);
    // veg viene en gramos por ración; una ración de verdura son ~150 g
    out.set(id, { kcal: n.kcal, protein: n.protein, veg: Math.round((n.veg / 150) * 10) / 10, covered: n.covered, total: n.total });
  }
  return out;
}

export type DayBalance = { day: number; kcal: number; protein: number; veg: number; meals: number };
export type WeekBalance = {
  days: DayBalance[];
  /** media diaria contando solo los días con algún plato */
  avgKcal: number;
  avgProtein: number;
  avgVeg: number;
  daysWithMeals: number;
  /** cuántos huecos con receta no se han podido calcular (receta sin ingredientes conocidos) */
  unknownSlots: number;
};

/** `portion` = raciones del menú entre personas de casa: 1,5 si alguien come ración y media. */
export function weekBalance(slots: Slot[], nutrition: Map<number, RecipeNutrition>, portion = 1): WeekBalance {
  const days: DayBalance[] = [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, kcal: 0, protein: 0, veg: 0, meals: 0 }));
  let unknownSlots = 0;
  for (const s of slots) {
    if (s.recipe_id == null) continue;
    const n = nutrition.get(s.recipe_id);
    if (!n || n.covered === 0) {
      unknownSlots++;
      continue;
    }
    const d = days[s.day];
    d.kcal += n.kcal * portion;
    d.protein += n.protein * portion;
    d.veg += n.veg * portion;
    d.meals++;
  }
  const active = days.filter((d) => d.meals > 0);
  const avg = (f: (d: DayBalance) => number) => (active.length ? Math.round(active.reduce((a, d) => a + f(d), 0) / active.length) : 0);
  return { days, avgKcal: avg((d) => d.kcal), avgProtein: avg((d) => d.protein), avgVeg: Math.round(avg((d) => d.veg * 10)) / 10, daysWithMeals: active.length, unknownSlots };
}

export type Assessment = {
  kcal: Verdict;
  protein: Verdict;
  veg: Verdict;
  /** frase corta para la cabecera: "Cuadra con tu objetivo", "Te falta proteína"… */
  headline: string;
  /** consejos concretos, de más a menos importante */
  tips: string[];
  score: number; // 0-3 cosas bien
};

export function assess(w: WeekBalance, t: Targets, goal: "perder" | "mantener" | "ganar" | null): Assessment {
  if (w.daysWithMeals === 0) return { kcal: "ok", protein: "ok", veg: "ok", headline: "Genera el menú para ver si cuadra", tips: [], score: 0 };
  const kcal = judge(w.avgKcal, t.kcalMeals, 0.2); // las recetas no cuentan pan, postre ni bebida: margen ancho
  const protein = w.avgProtein < t.proteinMeals * 0.88 ? "bajo" : "ok"; // pasarse de proteína no es problema
  const veg = w.avgVeg < t.vegMeals * 0.75 ? "bajo" : "ok";
  const tips: string[] = [];
  if (protein === "bajo") tips.push(goal === "ganar" ? "Para ganar músculo te falta proteína: mete más pollo, huevo, legumbre, atún o pescado en comidas y cenas." : "Vas corto de proteína: un plato con pollo, huevo, legumbre o pescado más a la semana lo arregla.");
  if (goal === "ganar" && kcal === "bajo") tips.push("Para ganar músculo hay que comer más de lo que sale aquí: sírvete ración y media de lo que cocines y añade pan, fruta y lácteos entre horas.");
  if (kcal === "bajo") tips.push(goal === "perder" ? "Te quedas por debajo incluso para perder peso. Un menú demasiado escaso se abandona: añade raciones de arroz, pasta o pan." : "Hay pocas calorías para tu gasto: raciones más generosas o un plato más contundente.");
  if (kcal === "alto") tips.push(goal === "perder" ? "Se pasa de calorías para perder peso: cambia un plato de pasta, empanados o fritos por una crema, ensalada o pescado." : "Se pasa un poco de calorías: cambia uno de los platos más pesados por verdura o pescado.");
  if (veg === "bajo") tips.push("Poca verdura: una crema, una ensalada o un pisto más a la semana.");
  const score = [kcal, protein, veg].filter((v) => v === "ok").length;
  const headline =
    score === 3
      ? goal === "ganar" ? "Cuadra con ganar músculo" : goal === "perder" ? "Cuadra con perder peso" : "Semana equilibrada"
      : protein === "bajo" ? "Te falta proteína"
        : kcal === "alto" ? "Se pasa de calorías"
          : kcal === "bajo" ? "Le faltan calorías"
            : "Poca verdura";
  return { kcal, protein, veg, headline, tips, score };
}
