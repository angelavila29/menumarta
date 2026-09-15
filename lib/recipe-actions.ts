"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addToList } from "@/lib/actions";
import { requireUser, userSupermarketIds } from "@/lib/auth";
import { cheapestProductFor, packsNeeded, type Need } from "@/lib/menu";
import type { createClient } from "@/lib/supabase/server";
import { PRODUCT_COLUMNS, type Product } from "@/lib/types";

type Supa = Awaited<ReturnType<typeof createClient>>;

/** Producto para un ingrediente: el que el usuario eligió otras veces, o el más adecuado y barato. */
async function productForNeed(supabase: Supa, userId: string, need: Need): Promise<Product | null> {
  const supers = await userSupermarketIds(supabase, userId);
  const { data: map } = await supabase
    .from("ingredient_product_map")
    .select(`product:products(${PRODUCT_COLUMNS})`)
    .eq("user_id", userId)
    .eq("ingredient_name", need.ingredient)
    .maybeSingle();
  const mapped = (map?.product as unknown as Product | null) ?? null;
  if (mapped && supers.includes(mapped.supermarket_id)) return mapped;
  return cheapestProductFor(supabase, need, supers);
}

export async function addIngredientToList(recipeId: number, need: Need) {
  const { supabase, user } = await requireUser();
  const product = await productForNeed(supabase, user.id, need);
  if (!product) throw new Error("No encuentro un producto para este ingrediente.");
  await addToList(product.id, packsNeeded(need, product));
  revalidatePath(`/recetas/${recipeId}`);
}

export async function addRecipeToList(recipeId: number, needs: Need[]) {
  const { supabase, user } = await requireUser();
  for (const need of needs.slice(0, 40)) {
    const product = await productForNeed(supabase, user.id, need);
    if (product) await addToList(product.id, packsNeeded(need, product));
  }
  revalidatePath(`/recetas/${recipeId}`);
  redirect("/lista");
}

export async function toggleRecipeFavorite(recipeId: number, makeFavorite: boolean) {
  const { supabase, user } = await requireUser();
  if (makeFavorite) {
    const { error } = await supabase
      .from("favorite_recipes")
      .upsert({ user_id: user.id, recipe_id: recipeId }, { onConflict: "user_id,recipe_id" });
    if (error) throw new Error(error.message);
  } else {
    await supabase.from("favorite_recipes").delete().eq("user_id", user.id).eq("recipe_id", recipeId);
  }
  revalidatePath(`/recetas/${recipeId}`);
}
