"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, userSupermarketIds } from "@/lib/auth";
import { getOrCreateActiveList } from "@/lib/lists";
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
  // Cada palabra debe aparecer en el nombre (usa el índice pg_trgm)
  for (const word of q.split(/\s+/).filter(Boolean)) {
    req = req.ilike("name", `%${word}%`);
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
// Ajustes
// ---------------------------------------------------------------------------
export async function saveSettings(formData: FormData) {
  const { supabase, user } = await requireUser();
  const postalCode = String(formData.get("postal_code") ?? "").trim() || null;
  const supers = formData.getAll("supermarkets").map(String);

  const { error: pErr } = await supabase
    .from("profiles")
    .upsert({ id: user.id, postal_code: postalCode }, { onConflict: "id" });
  if (pErr) throw new Error(pErr.message);

  const { error: dErr } = await supabase.from("user_supermarkets").delete().eq("user_id", user.id);
  if (dErr) throw new Error(dErr.message);
  if (supers.length > 0) {
    const { error: iErr } = await supabase
      .from("user_supermarkets")
      .insert(supers.map((s) => ({ user_id: user.id, supermarket_id: s })));
    if (iErr) throw new Error(iErr.message);
  }
  revalidatePath("/", "layout");
  redirect("/?guardado=1");
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
