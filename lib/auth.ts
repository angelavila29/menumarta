import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Devuelve el cliente y el usuario logueado, o redirige a /login. */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

/** Ids de los supermercados elegidos por el usuario. */
export async function userSupermarketIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string[]> {
  const { data } = await supabase
    .from("user_supermarkets")
    .select("supermarket_id")
    .eq("user_id", userId);
  return (data ?? []).map((r) => r.supermarket_id as string);
}
