"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, userSupermarketIds } from "@/lib/auth";
import { getOrCreateActiveList } from "@/lib/lists";
import { unaccent } from "@/lib/search";
import { PRODUCT_COLUMNS, type Product } from "@/lib/types";

export async function signOut() {
  const { supabase } = await requireUser();
  await supabase.auth.signOut();
  redirect("/login");
}

// ---------------------------------------------------------------------------
// Búsqueda
// ---------------------------------------------------------------------------
export async function searchProducts(query: string): Promise<Product[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const { supabase, user } = await requireUser();
  const supers = await userSupermarketIds(supabase, user.id);
  if (supers.length === 0) return [];

  let req = supabase.from("products").select(PRODUCT_COLUMNS).in("supermarket_id", supers);
  // Cada palabra debe aparecer en el nombre, sin distinguir tildes (índice pg_trgm sobre name_norm)
  for (const word of q.split(/\s+/).filter(Boolean)) {
    req = req.ilike("name_norm", `%${unaccent(word)}%`);
  }
  const { data, error } = await req
    .order("unit_price", { ascending: true, nullsFirst: false })
    .limit(30);
  if (error) throw new Error(error.message);
  return (data ?? []) as Product[];
}

// ---------------------------------------------------------------------------
// Favoritos
// ---------------------------------------------------------------------------
export async function toggleFavorite(productId: number, makeFavorite: boolean) {
  const { supabase, user } = await requireUser();
  if (makeFavorite) {
    const { error } = await supabase
      .from("favorites")
      .upsert({ user_id: user.id, product_id: productId }, { onConflict: "user_id,product_id" });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("product_id", productId);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/favoritos");
}

// ---------------------------------------------------------------------------
// Lista de la compra
// ---------------------------------------------------------------------------
export async function addToList(productId: number, quantity = 1) {
  const { supabase, user } = await requireUser();
  const listId = await getOrCreateActiveList(supabase, user.id);

  const { data: existing } = await supabase
    .from("shopping_list_items")
    .select("id,quantity")
    .eq("list_id", listId)
    .eq("product_id", productId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("shopping_list_items")
      .update({ quantity: Number(existing.quantity) + quantity, checked: false })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("shopping_list_items")
      .insert({ list_id: listId, product_id: productId, quantity });
    if (error) throw new Error(error.message);
  }
  revalidatePath("/lista");
}

// ---------------------------------------------------------------------------
// Edición de la lista
// ---------------------------------------------------------------------------
export async function setItemQuantity(itemId: number, quantity: number) {
  const { supabase } = await requireUser();
  if (quantity <= 0) {
    await supabase.from("shopping_list_items").delete().eq("id", itemId);
  } else {
    await supabase.from("shopping_list_items").update({ quantity }).eq("id", itemId);
  }
  revalidatePath("/lista");
}

export async function setItemChecked(itemId: number, checked: boolean) {
  const { supabase } = await requireUser();
  await supabase.from("shopping_list_items").update({ checked }).eq("id", itemId);
  revalidatePath("/lista");
}

export async function removeItem(itemId: number) {
  const { supabase } = await requireUser();
  await supabase.from("shopping_list_items").delete().eq("id", itemId);
  revalidatePath("/lista");
}

export async function clearChecked() {
  const { supabase, user } = await requireUser();
  const listId = await getOrCreateActiveList(supabase, user.id);
  await supabase.from("shopping_list_items").delete().eq("list_id", listId).eq("checked", true);
  revalidatePath("/lista");
}

// ---------------------------------------------------------------------------
// Perfil
// ---------------------------------------------------------------------------
export async function saveDisplayName(formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("display_name") ?? "").trim().slice(0, 40) || null;
  const { error } = await supabase.from("profiles").upsert({ id: user.id, display_name: name }, { onConflict: "id" });
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
  redirect("/ajustes?guardado=1");
}
