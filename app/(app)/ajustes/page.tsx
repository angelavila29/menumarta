import { signOut } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import type { SettingsInput } from "@/lib/settings-actions";
import { AccountSection } from "./account-section";
import { SettingsForm, type Chain } from "./settings-form";

export default async function SettingsPage() {
  const { supabase, user } = await requireUser();
  const [{ data: p }, { data: mine }] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "display_name,phone,address,postal_code,lat,lng,household_size,planning_meals,diet,allergies,avoid_foods,weekly_budget,max_recipe_minutes,goals,compare_mode,main_supermarket,notify_menu,notify_savings,notify_price_drops,notify_summary"
      )
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("user_supermarkets").select("supermarket:supermarkets(id,name,has_prices)").eq("user_id", user.id),
  ]);

  const chains: Chain[] = (mine ?? [])
    .map((m) => m.supermarket as unknown as Chain | null)
    .filter((c): c is Chain => c !== null)
    .sort((a, b) => Number(b.has_prices) - Number(a.has_prices) || a.name.localeCompare(b.name, "es"));

  const initial: SettingsInput = {
    displayName: p?.display_name ?? "",
    phone: p?.phone ?? "",
    householdSize: p?.household_size ?? 2,
    planningMeals: p?.planning_meals ?? ["comida", "cena"],
    diet: p?.diet ?? "todo",
    allergies: p?.allergies ?? [],
    avoidFoods: p?.avoid_foods ?? [],
    weeklyBudget: p?.weekly_budget ?? null,
    maxRecipeMinutes: p?.max_recipe_minutes ?? null,
    goals: p?.goals ?? [],
    compareMode: p?.compare_mode ?? "avisar",
    mainSupermarket: p?.main_supermarket ?? null,
    notifyMenu: p?.notify_menu ?? true,
    notifySavings: p?.notify_savings ?? true,
    notifyPriceDrops: p?.notify_price_drops ?? false,
    notifySummary: p?.notify_summary ?? true,
  };

  return (
    <main>
      <SettingsForm
        initial={initial}
        email={user.email ?? ""}
        chains={chains}
        location={{ label: p?.address ?? p?.postal_code ?? null, lat: p?.lat ?? null, lng: p?.lng ?? null }}
      />
      <AccountSection />
      <form action={signOut} className="mt-8 border-t border-cream-dark pt-4">
        <button type="submit" className="text-sm font-medium text-red-700 hover:underline">
          Cerrar sesión
        </button>
      </form>
    </main>
  );
}
