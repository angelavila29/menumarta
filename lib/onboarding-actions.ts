"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { geocode, nearbyChains, reverseGeocode, type GeoPoint, type NearbyChain, type Store } from "@/lib/geo";
import { currentWeekStart, loadSlots, getOrCreateMenu } from "@/lib/menu";
import { generateWeekFor } from "@/lib/menu-actions";

export type LocateResult =
  | { ok: true; point: GeoPoint; chains: NearbyChain[]; stores: Store[]; withPrices: string[] }
  | { ok: false; error: string };

async function chainsWithPrices(): Promise<string[]> {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("supermarkets").select("id").eq("has_prices", true);
  return (data ?? []).map((r) => r.id as string);
}

async function finish(point: GeoPoint): Promise<LocateResult> {
  const withPrices = await chainsWithPrices();
  try {
    const { chains, stores } = await nearbyChains(point.lat, point.lng);
    return { ok: true, point, chains, stores, withPrices };
  } catch {
    // Overpass caído o lento: dejamos elegir a mano entre las cadenas con precios
    return { ok: true, point, chains: [], stores: [], withPrices };
  }
}

export async function locateByAddress(query: string): Promise<LocateResult> {
  await requireUser();
  const q = query.trim();
  if (q.length < 3) return { ok: false, error: "Escribe tu código postal o tu dirección." };
  const point = await geocode(q).catch(() => null);
  if (!point) return { ok: false, error: "No encuentro esa dirección. Prueba con el código postal o añade la ciudad." };
  return finish(point);
}

export async function locateByCoords(lat: number, lng: number): Promise<LocateResult> {
  await requireUser();
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { ok: false, error: "Ubicación no válida." };
  const label = await reverseGeocode(lat, lng).catch(() => `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
  return finish({ lat, lng, label });
}

export type ChainChoice = { id: string; name: string };

export type OnboardingInput = {
  point: GeoPoint;
  postalCode: string | null;
  chains: ChainChoice[];
  displayName?: string;
  householdSize: number;
  planningMeals: string[];
  mainSupermarket: string | null;
  compareMode: string | null;
  diet: string | null;
  allergies: string[];
  avoidFoods: string[];
  goals: string[];
  cookSessions: number | null;
  weeklyBudget: number | null;
  maxRecipeMinutes: number | null;
};

/** Guarda todo el onboarding y, si la semana está vacía, genera el primer menú. */
export async function saveOnboarding(input: OnboardingInput): Promise<{ to: string }> {
  const { supabase, user } = await requireUser();
  if (input.chains.length === 0) throw new Error("Elige al menos un supermercado.");

  for (const c of input.chains) {
    const { error } = await supabase.rpc("ensure_supermarket", { p_id: c.id, p_name: c.name });
    if (error) throw new Error(error.message);
  }

  const { error: pErr } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      lat: input.point.lat,
      lng: input.point.lng,
      address: input.point.label,
      postal_code: input.postalCode,
      display_name: input.displayName?.trim() || null,
      household_size: Math.min(12, Math.max(1, Math.round(input.householdSize || 2))),
      planning_meals: input.planningMeals.length ? input.planningMeals : ["comida", "cena"],
      main_supermarket: input.mainSupermarket,
      compare_mode: input.compareMode,
      diet: input.diet,
      allergies: input.allergies,
      avoid_foods: input.avoidFoods.map((s) => s.trim().toLowerCase()).filter(Boolean),
      goals: input.goals,
      cook_sessions: input.cookSessions != null && Number.isFinite(input.cookSessions) ? Math.min(14, Math.max(1, Math.round(input.cookSessions))) : null,
      weekly_budget: input.weeklyBudget != null && input.weeklyBudget > 0 ? Math.min(2000, Math.round(input.weeklyBudget)) : null,
      max_recipe_minutes: input.maxRecipeMinutes != null && input.maxRecipeMinutes > 0 ? Math.round(input.maxRecipeMinutes) : null,
      onboarded_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (pErr) throw new Error(pErr.message);

  await supabase.from("user_supermarkets").delete().eq("user_id", user.id);
  const { error: sErr } = await supabase
    .from("user_supermarkets")
    .insert(input.chains.map((c) => ({ user_id: user.id, supermarket_id: c.id })));
  if (sErr) throw new Error(sErr.message);

  // Primer menú: solo si la semana actual está vacía
  const week = currentWeekStart();
  const menu = await getOrCreateMenu(supabase, user.id, week, input.householdSize || 2);
  const slots = await loadSlots(supabase, menu.id);
  if (!slots.some((s) => s.recipe_id !== null)) {
    await supabase.from("weekly_menus").update({ servings: input.householdSize || 2 }).eq("id", menu.id);
    await generateWeekFor(supabase, user.id, week);
  }

  revalidatePath("/", "layout");
  const inviteCode = (await cookies()).get("invite_code")?.value;
  // Devolvemos la ruta en vez de redirect(): el cliente la usa con router.push.
  // Un redirect() dentro de una acción llamada desde el cliente llega como error "NEXT_REDIRECT".
  return { to: inviteCode ? `/amigos?codigo=${inviteCode}` : "/menu" };
}
