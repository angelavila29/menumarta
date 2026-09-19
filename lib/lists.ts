import type { createClient } from "@/lib/supabase/server";

type Supa = Awaited<ReturnType<typeof createClient>>;

/**
 * La lista activa del usuario. Si alguien comparte su lista con él (piso compartido), esa es la
 * activa; si no, la suya propia (la más antigua), que se crea si no existe.
 */
export async function getOrCreateActiveList(supabase: Supa, userId: string): Promise<string> {
  const { data: shared } = await supabase
    .from("list_members")
    .select("list_id")
    .eq("user_id", userId)
    .order("joined_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (shared) return shared.list_id as string;
  return getOrCreateOwnList(supabase, userId);
}

export async function getOrCreateOwnList(supabase: Supa, userId: string): Promise<string> {
  const { data: existing } = await supabase
    .from("shopping_lists")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id as string;

  const { data: created, error } = await supabase
    .from("shopping_lists")
    .insert({ user_id: userId, name: "Mi lista" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return created.id as string;
}
