import { requireUser } from "@/lib/auth";
import { FOODS, mergeFoods } from "@/lib/foods";
import { Onboarding, type Initial } from "./onboarding";

export default async function OnboardingPage() {
  const { supabase, user } = await requireUser();
  const [{ data: profile }, { data: mine }, { data: ings }] = await Promise.all([
    supabase
      .from("profiles")
      .select("address,postal_code,display_name,household_size,planning_meals,main_supermarket,compare_mode,diet,allergies,avoid_foods,goals,cook_sessions,weekly_budget,max_recipe_minutes")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("user_supermarkets").select("supermarket_id").eq("user_id", user.id),
    supabase.from("recipe_ingredients").select("ingredient_name"),
  ]);
  const initial: Initial = {
    address: profile?.address ?? profile?.postal_code ?? "",
    name: profile?.display_name ?? "",
    chains: (mine ?? []).map((m) => m.supermarket_id as string),
    householdSize: profile?.household_size ?? 2,
    planningMeals: profile?.planning_meals ?? ["comida", "cena"],
    mainSupermarket: profile?.main_supermarket ?? null,
    compareMode: profile?.compare_mode ?? "avisar",
    diet: profile?.diet ?? "todo",
    allergies: profile?.allergies ?? [],
    avoidFoods: profile?.avoid_foods ?? [],
    goals: profile?.goals ?? [],
    cookSessions: profile?.cook_sessions ?? null,
    weeklyBudget: profile?.weekly_budget ?? null,
    maxRecipeMinutes: profile?.max_recipe_minutes ?? null,
    foods: mergeFoods(FOODS, (ings ?? []).map((i) => i.ingredient_name as string)),
    isFirstTime: (mine ?? []).length === 0,
  };
  return (
    <main className="min-h-screen">
      <Onboarding initial={initial} />
    </main>
  );
}
