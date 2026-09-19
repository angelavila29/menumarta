"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type FriendResult = { ok: true; message: string } | { ok: false; error: string };

/** Envía una solicitud a quien tenga ese código. Si esa persona ya me la había enviado, la acepta. */
export async function requestFriend(code: string): Promise<FriendResult> {
  const { supabase, user } = await requireUser();
  const clean = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{6,12}$/.test(clean)) return { ok: false, error: "Ese código no es válido." };

  (await cookies()).delete("invite_code");
  const { data: found } = await supabase.rpc("profile_by_friend_code", { p_code: clean });
  const other = (found ?? [])[0] as { id: string; display_name: string } | undefined;
  if (!other) return { ok: false, error: "No encuentro a nadie con ese código." };
  if (other.id === user.id) return { ok: false, error: "Ese es tu propio código. Compártelo con tus amigos." };

  const { data: existing } = await supabase
    .from("friendships")
    .select("requester_id,addressee_id,status")
    .or(`and(requester_id.eq.${user.id},addressee_id.eq.${other.id}),and(requester_id.eq.${other.id},addressee_id.eq.${user.id})`);
  const row = (existing ?? [])[0];
  if (row?.status === "accepted") return { ok: true, message: `${other.display_name} y tú ya sois amigos.` };
  if (row && row.requester_id === user.id) return { ok: true, message: `Ya le habías enviado una solicitud a ${other.display_name}.` };
  if (row && row.requester_id === other.id) {
    await supabase.from("friendships").update({ status: "accepted" }).eq("requester_id", other.id).eq("addressee_id", user.id);
    revalidatePath("/amigos");
    return { ok: true, message: `¡Hecho! ${other.display_name} y tú ya sois amigos.` };
  }

  const { error } = await supabase.from("friendships").insert({ requester_id: user.id, addressee_id: other.id });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/amigos");
  return { ok: true, message: `Solicitud enviada a ${other.display_name}. Verás sus recetas cuando la acepte.` };
}

export async function acceptFriend(otherId: string) {
  const { supabase, user } = await requireUser();
  if (!UUID.test(otherId)) return;
  await supabase.from("friendships").update({ status: "accepted" }).eq("requester_id", otherId).eq("addressee_id", user.id);
  revalidatePath("/amigos");
  revalidatePath("/recetas");
}

/** Rechaza una solicitud, cancela la mía o deja de ser amigo. */
export async function removeFriend(otherId: string) {
  const { supabase, user } = await requireUser();
  if (!UUID.test(otherId)) return;
  await supabase
    .from("friendships")
    .delete()
    .or(`and(requester_id.eq.${user.id},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${user.id})`);
  revalidatePath("/amigos");
  revalidatePath("/recetas");
}

/** Qué recetas de amigos usa "Generar semana": todas o solo las guardadas. */
export async function setFriendRecipesMode(mode: "all" | "saved") {
  const { supabase, user } = await requireUser();
  const value = mode === "saved" ? "saved" : "all";
  const { error } = await supabase.from("profiles").update({ friend_recipes_mode: value }).eq("id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/amigos");
  revalidatePath("/recetas");
}
