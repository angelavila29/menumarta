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
