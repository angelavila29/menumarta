"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, userSupermarketIds } from "@/lib/auth";
import { getOrCreateActiveList } from "@/lib/lists";
import { FAMILY_FILTERS } from "@/lib/categories";
import { equivalentIn } from "@/lib/compare";
import { parsePackSize } from "@/lib/menu";
import { keywords, NOT_FOOD_CATEGORY, unaccent, wordRegex } from "@/lib/search";
import { PRODUCT_COLUMNS, type Product, type SearchResult } from "@/lib/types";

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

export async function clearList() {
  const { supabase, user } = await requireUser();
  const listId = await getOrCreateActiveList(supabase, user.id);
  await supabase.from("shopping_list_items").delete().eq("list_id", listId);
  revalidatePath("/lista");
}

// ---------------------------------------------------------------------------
// Buscador de productos (/buscar)
// ---------------------------------------------------------------------------
export type BrowseSort = "relevancia" | "precio" | "unidad" | "nombre";
export type BrowseInput = {
  query: string;
  chains: string[];
  family: string | null;
  sort: BrowseSort;
  onlyFavorites: boolean;
  onlyOffers: boolean;
};

// Sin búsqueda ni filtros enseñamos los básicos de la semana
const STAPLES = ["leche entera", "arroz redondo", "espaguetis", "huevos medianos", "tomate frito", "pan de molde", "aceite de oliva virgen extra", "pechuga de pollo"];

export async function browseProducts(input: BrowseInput): Promise<SearchResult[]> {
  const { supabase, user } = await requireUser();
  const mine = await userSupermarketIds(supabase, user.id);
  const chains = input.chains.length > 0 ? input.chains.filter((c) => mine.includes(c)) : mine;
  if (chains.length === 0) return [];

  let favIds: number[] | null = null;
  if (input.onlyFavorites) {
    const { data } = await supabase.from("favorites").select("product_id").eq("user_id", user.id);
    favIds = (data ?? []).map((f) => f.product_id as number);
    if (favIds.length === 0) return [];
  }

  const q = input.query.trim();
  const family = input.family ? FAMILY_FILTERS.find((f) => f.id === input.family) ?? null : null;
  const browsingStaples = !q && !family && !favIds && !input.onlyOffers;
  let products: Product[];

  if (browsingStaples) {
    const found = await Promise.all(
      STAPLES.map(async (term) => {
        let req = supabase
          .from("products")
          .select(PRODUCT_COLUMNS)
          .in("supermarket_id", chains)
          .not("category", "imatch", NOT_FOOD_CATEGORY)
          .not("unit_price", "is", null);
        for (const w of keywords(term)) req = req.filter("name_norm", "match", wordRegex(w));
        // A igual precio por unidad, el envase más barato (1 L antes que el pack de 6)
        const { data } = await req.order("unit_price", { ascending: true }).order("price", { ascending: true }).limit(1);
        return (data?.[0] as Product | undefined) ?? null;
      })
    );
    products = found.filter((p): p is Product => p !== null);
    if (input.sort !== "relevancia") products = sortProducts(products, input.sort, "");
  } else {
    let req = supabase.from("products").select(PRODUCT_COLUMNS).in("supermarket_id", chains).not("price", "is", null);
    for (const word of q.split(/\s+/).filter(Boolean)) req = req.ilike("name_norm", `%${unaccent(word)}%`);
    if (family) req = req.filter("category", "imatch", family.pattern);
    if (input.onlyOffers) req = req.eq("is_discounted", true);
    if (favIds) req = req.in("id", favIds);
    const { data, error } = await req.order("unit_price", { ascending: true, nullsFirst: false }).limit(60);
    if (error) throw new Error(error.message);
    products = sortProducts((data ?? []) as Product[], input.sort, q).slice(0, 24);
  }

  // Comparación con el equivalente en tus otras cadenas (aproximada, por nombre)
  return Promise.all(
    products.map(async (product) => {
      let best: SearchResult["compare"] = null;
      for (const chain of mine.filter((c) => c !== product.supermarket_id)) {
        const eq = await equivalentIn(supabase, product, chain);
        if (!eq) continue;
        const diff = packDiff(product, eq);
        if (diff !== null && (best === null || diff < best.diff)) best = { chain, diff };
      }
      return { product, compare: best };
    })
  );
}

function sortProducts(list: Product[], sort: BrowseSort, q: string): Product[] {
  const arr = list.slice();
  if (sort === "precio") return arr.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
  if (sort === "unidad") return arr.sort((a, b) => (a.unit_price ?? Infinity) - (b.unit_price ?? Infinity));
  if (sort === "nombre") return arr.sort((a, b) => a.name.localeCompare(b.name, "es"));
  const nq = unaccent(q);
  const score = (p: Product) =>
    (nq && unaccent(p.name).startsWith(nq) ? 0 : 100) +
    Math.min(p.name.split(/\s+/).length, 10) * 5 +
    Math.min(p.unit_price ?? 999, 999) / 100;
  return arr.sort((a, b) => score(a) - score(b));
}

/** Euros que cuesta de más el equivalente para la misma cantidad que este envase. */
function packDiff(p: Product, eq: Product): number | null {
  if (p.price == null || eq.price == null) return null;
  if (p.unit && p.unit === eq.unit && p.unit_price != null && eq.unit_price != null) {
    const pack = parsePackSize(p.pack_size);
    if (pack && pack.unit === p.unit) return (eq.unit_price - p.unit_price) * pack.amount;
  }
  return eq.price - p.price;
}
