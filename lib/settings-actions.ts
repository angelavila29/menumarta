"use server";

import { revalidatePath } from "next/cache";
import { requireUser, userSupermarketIds } from "@/lib/auth";

export type SettingsInput = {
  displayName: string;
  phone: string;
  householdSize: number;
  planningMeals: string[];
  diet: string;
  allergies: string[];
  avoidFoods: string[];
  weeklyBudget: number | null;
  maxRecipeMinutes: number | null;
  cookSessions: number | null;
  goals: string[];
  compareMode: string;
  mainSupermarket: string | null;
  notifyMenu: boolean;
  notifySavings: boolean;
  notifyPriceDrops: boolean;
  notifySummary: boolean;
};

const MEALS = ["comida", "cena", "desayuno", "merienda"];
const DIETS = ["todo", "vegetariano", "vegano", "pescetariano", "otro"];
const ALLERGIES = ["gluten", "lactosa", "frutos secos", "huevo", "marisco", "soja"];
const GOALS = ["ahorrar", "organizar", "saludable", "variado", "tiempo", "todo"];
const COMPARE = ["avisar", "habitual", "barato"];
const MINUTES = [15, 20, 30, 45, 60, 90];

/** Guarda la configuración del perfil. Todo se valida aquí: el cliente no es de fiar. */
export async function saveSettings(input: SettingsInput) {
  const { supabase, user } = await requireUser();
  const mine = await userSupermarketIds(supabase, user.id);

  const meals = input.planningMeals.filter((m) => MEALS.includes(m));
  const avoid = Array.from(new Set(input.avoidFoods.map((a) => a.trim().toLowerCase()).filter(Boolean))).slice(0, 20);
  const budget = Number(input.weeklyBudget);

  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      display_name: input.displayName.trim().slice(0, 40) || null,
      phone: input.phone.trim().slice(0, 20) || null,
      household_size: Math.min(12, Math.max(1, Math.round(Number(input.householdSize) || 2))),
      planning_meals: meals.length > 0 ? meals : ["comida", "cena"],
      diet: DIETS.includes(input.diet) ? input.diet : "todo",
      allergies: input.allergies.filter((a) => ALLERGIES.includes(a)),
      avoid_foods: avoid,
      weekly_budget: Number.isFinite(budget) && budget > 0 ? Math.round(Math.min(budget, 2000)) : null,
      max_recipe_minutes: input.maxRecipeMinutes !== null && MINUTES.includes(input.maxRecipeMinutes) ? input.maxRecipeMinutes : null,
      cook_sessions: input.cookSessions != null && Number.isFinite(input.cookSessions) ? Math.min(14, Math.max(1, Math.round(input.cookSessions))) : null,
      goals: input.goals.filter((g) => GOALS.includes(g)).slice(0, 2),
      compare_mode: COMPARE.includes(input.compareMode) ? input.compareMode : "avisar",
      main_supermarket: input.mainSupermarket && mine.includes(input.mainSupermarket) ? input.mainSupermarket : null,
      notify_menu: !!input.notifyMenu,
      notify_savings: !!input.notifySavings,
      notify_price_drops: !!input.notifyPriceDrops,
      notify_summary: !!input.notifySummary,
    },
    { onConflict: "id" }
  );
  if (error) throw new Error(error.message);
  await supabase.from("recipes").update({ author_name: input.displayName.trim().slice(0, 40) || null }).eq("owner_id", user.id);
  revalidatePath("/", "layout");
}
