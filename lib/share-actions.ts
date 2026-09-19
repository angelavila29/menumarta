"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getOrCreateOwnList } from "@/lib/lists";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Comparte MI lista con un amigo (las políticas exigen que lo sea). */
export async function shareListWith(friendId: string): Promise<string | null> {
  const { supabase, user } = await requireUser();
  if (!UUID.test(friendId)) return "Persona no válida.";
  const listId = await getOrCreateOwnList(supabase, user.id);
  const { error } = await supabase.from("list_members").upsert({ list_id: listId, user_id: friendId }, { onConflict: "list_id,user_id" });
  revalidatePath("/lista");
  return error ? "Solo puedes compartir la lista con tus amigos." : null;
}

/** El dueño quita a alguien, o un miembro se sale. */
export async function removeFromList(listId: string, userId: string) {
  const { supabase } = await requireUser();
  if (!UUID.test(listId) || !UUID.test(userId)) return;
  await supabase.from("list_members").delete().eq("list_id", listId).eq("user_id", userId);
  revalidatePath("/lista");
  revalidatePath("/");
}
