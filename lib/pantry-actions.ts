"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getOrCreateActiveList } from "@/lib/lists";

export async function setPantryItem(ingredient: string, has: boolean) {
  const { supabase, user } = await requireUser();
  const name = ingredient.trim().toLowerCase().slice(0, 60);
  if (!name) return;
  if (has) {
    await supabase.from("pantry_items").upsert({ user_id: user.id, ingredient_name: name }, { onConflict: "user_id,ingredient_name" });
  } else {
    await supabase.from("pantry_items").delete().eq("user_id", user.id).eq("ingredient_name", name);
  }
  revalidatePath("/despensa");
  revalidatePath("/cocinar");
  revalidatePath("/menu");
}

export async function setStaple(productId: number, quantity: number) {
  const { supabase, user } = await requireUser();
  if (!Number.isInteger(productId)) return;
  if (quantity <= 0) {
    await supabase.from("staple_items").delete().eq("user_id", user.id).eq("product_id", productId);
  } else {
    await supabase
      .from("staple_items")
      .upsert({ user_id: user.id, product_id: productId, quantity: Math.min(20, Math.round(quantity)) }, { onConflict: "user_id,product_id" });
  }
  revalidatePath("/despensa");
}

/** Añade todos mis básicos a la lista activa (sin duplicar los que ya estén). */
export async function addStaplesToList(): Promise<number> {
  const { supabase, user } = await requireUser();
  const listId = await getOrCreateActiveList(supabase, user.id);
  const [{ data: staples }, { data: existing }] = await Promise.all([
    supabase.from("staple_items").select("product_id,quantity").eq("user_id", user.id),
    supabase.from("shopping_list_items").select("product_id").eq("list_id", listId),
  ]);
  const inList = new Set((existing ?? []).map((e) => e.product_id as number));
  const rows = (staples ?? [])
    .filter((s) => !inList.has(s.product_id as number))
    .map((s) => ({ list_id: listId, product_id: s.product_id as number, quantity: Number(s.quantity) }));
  if (rows.length > 0) await supabase.from("shopping_list_items").insert(rows);
  revalidatePath("/lista");
  return rows.length;
}
