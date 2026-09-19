"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Apunta un error de pantalla para poder mirarlo después. Nunca lanza:
 * si falla el registro, el usuario ya tiene bastante con el error original.
 */
export async function reportError(input: { path: string; message: string; digest?: string }) {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    await supabase.from("app_errors").insert({
      user_id: data.user.id,
      path: input.path.slice(0, 200),
      message: input.message.slice(0, 500),
      digest: input.digest?.slice(0, 100) ?? null,
    });
  } catch {
    /* sin ruido */
  }
}
