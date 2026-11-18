import type { createClient } from "@/lib/supabase/server";
import type { ExtraNutrition } from "@/lib/nutrition";

/** Calorías de los platos preparados que la gente ha dado de alta con los datos de su etiqueta. */
export async function loadExtraNutrition(supabase: Awaited<ReturnType<typeof createClient>>): Promise<ExtraNutrition> {
  const { data } = await supabase.from("ingredient_nutrition").select("ingredient_name,kcal,protein,carbs,unit_grams");
  const out: ExtraNutrition = {};
  for (const r of data ?? []) {
    out[r.ingredient_name as string] = {
      kcal: Number(r.kcal),
      protein: Number(r.protein),
      carbs: Number(r.carbs),
      ...(r.unit_grams != null ? { unitGrams: Number(r.unit_grams) } : {}),
    };
  }
  return out;
}
