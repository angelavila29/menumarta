"use server";

import { revalidatePath } from "next/cache";
import { APPLIANCES } from "@/lib/appliances";
import { requireUser, userSupermarketIds } from "@/lib/auth";

const APPLIANCE_IDS = new Set<string>(APPLIANCES.map((a) => a.id));

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
  sex: string | null;
  age: number | null;
  weightKg: number | null;
  heightCm: number | null;
  activity: string | null;
  bodyGoal: string | null;
  appliances: string[] | null;
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

function numIn(v: number | null | undefined, min: number, max: number): number | null {
  const n = Number(v);
  return v != null && Number.isFinite(n) && n >= min && n <= max ? Math.round(n * 10) / 10 : null;
}

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
      sex: input.sex === "mujer" || input.sex === "hombre" ? input.sex : null,
      age: numIn(input.age, 10, 110),
      weight_kg: numIn(input.weightKg, 25, 300),
      height_cm: numIn(input.heightCm, 100, 250),
      activity: ["baja", "media", "alta"].includes(input.activity ?? "") ? input.activity : null,
      body_goal: ["perder", "mantener", "ganar"].includes(input.bodyGoal ?? "") ? input.bodyGoal : null,
      appliances: input.appliances ? input.appliances.filter((a) => APPLIANCE_IDS.has(a)) : null,
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
