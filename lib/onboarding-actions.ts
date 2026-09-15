"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { geocode, nearbyChains, reverseGeocode, type GeoPoint, type NearbyChain } from "@/lib/geo";

export type LocateResult =
  | { ok: true; point: GeoPoint; chains: NearbyChain[]; withPrices: string[] }
  | { ok: false; error: string };

async function chainsWithPrices(): Promise<string[]> {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("supermarkets").select("id").eq("has_prices", true);
  return (data ?? []).map((r) => r.id as string);
}

async function finish(point: GeoPoint): Promise<LocateResult> {
  try {
    const [chains, withPrices] = await Promise.all([nearbyChains(point.lat, point.lng), chainsWithPrices()]);
    return { ok: true, point, chains, withPrices };
  } catch {
    // Overpass caído o lento: dejamos elegir a mano entre las cadenas con precios
    const withPrices = await chainsWithPrices();
    return { ok: true, point, chains: [], withPrices };
  }
}

export async function locateByAddress(query: string): Promise<LocateResult> {
  await requireUser();
  const q = query.trim();
  if (q.length < 3) return { ok: false, error: "Escribe tu código postal o tu dirección." };
  const point = await geocode(q);
  if (!point) return { ok: false, error: "No encuentro esa dirección. Prueba con el código postal o añade la ciudad." };
  return finish(point);
}

export async function locateByCoords(lat: number, lng: number): Promise<LocateResult> {
  await requireUser();
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { ok: false, error: "Ubicación no válida." };
  const label = await reverseGeocode(lat, lng);
  return finish({ lat, lng, label });
}

export type ChainChoice = { id: string; name: string };

export async function saveOnboarding(input: { point: GeoPoint; postalCode: string | null; chains: ChainChoice[]; displayName?: string }) {
  const { supabase, user } = await requireUser();
  if (input.chains.length === 0) throw new Error("Elige al menos un supermercado.");

  // Cadenas nuevas vistas en el mapa: alta en supermarkets (función security definer)
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

  revalidatePath("/", "layout");
  redirect("/");
}
