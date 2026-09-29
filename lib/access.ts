import type { User } from "@supabase/supabase-js";
import type { createClient } from "@/lib/supabase/server";

type Supa = Awaited<ReturnType<typeof createClient>>;

/** ¿Tiene esta persona acceso a una función en pruebas? La lista vive en `feature_access`. */
export async function hasFeature(supabase: Supa, user: User, feature: string): Promise<boolean> {
  const email = user.email?.toLowerCase();
  if (!email) return false;
  const { data } = await supabase.from("feature_access").select("email").eq("feature", feature).eq("email", email).maybeSingle();
  return !!data;
}

/**
 * Fondo personal, si lo hay: una fila "fondo_<nombre>" en feature_access. La imagen vive en
 * Storage (recipe-photos/fondos/<nombre>.jpg), no en el repo, que es público.
 */
export async function backgroundFor(supabase: Supa, user: User): Promise<string | null> {
  const email = user.email?.toLowerCase();
  if (!email) return null;
  const { data } = await supabase.from("feature_access").select("feature").eq("email", email).like("feature", "fondo_%").limit(1).maybeSingle();
  const name = data?.feature?.replace(/^fondo_/, "");
  if (!name || !/^[a-z0-9-]+$/.test(name)) return null;
  return supabase.storage.from("recipe-photos").getPublicUrl(`fondos/${name}.jpg`).data.publicUrl;
}
