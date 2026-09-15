import { requireUser } from "@/lib/auth";
import { Onboarding, type Initial } from "./onboarding";

export default async function OnboardingPage() {
  const { supabase, user } = await requireUser();
  const [{ data: profile }, { data: mine }] = await Promise.all([
    supabase
      .from("profiles")
      .select("address,postal_code,display_name,household_size,planning_meals,main_supermarket,compare_mode,diet,allergies,avoid_foods,goals")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("user_supermarkets").select("supermarket_id").eq("user_id", user.id),
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
    isFirstTime: (mine ?? []).length === 0,
  };
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-8 pt-4">
      <Onboarding initial={initial} />
    </main>
  );
}
