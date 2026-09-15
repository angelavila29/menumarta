"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getOrCreateActiveList } from "@/lib/lists";
import { currentWeekStart, generateWeek, getOrCreateMenu, loadRecipes } from "@/lib/menu";

export async function generateWeekAction(weekStart: string) {
  const { supabase, user } = await requireUser();
  const menu = await getOrCreateMenu(supabase, user.id, weekStart || currentWeekStart());
  const recipes = await loadRecipes(supabase);
  const slots = generateWeek(recipes).map((s) => ({ ...s, menu_id: menu.id }));
  const { error } = await supabase.from("weekly_menu_slots").upsert(slots, { onConflict: "menu_id,day,meal" });
  if (error) throw new Error(error.message);
  revalidatePath("/menu");
}

export async function setSlotAction(menuId: string, day: number, meal: "comida" | "cena", recipeId: number | null) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("weekly_menu_slots")
    .upsert({ menu_id: menuId, day, meal, recipe_id: recipeId }, { onConflict: "menu_id,day,meal" });
  if (error) throw new Error(error.message);
  revalidatePath("/menu");
}

export async function setServingsAction(menuId: string, servings: number) {
  const { supabase } = await requireUser();
  const n = Math.min(12, Math.max(1, Math.round(servings)));
  await supabase.from("weekly_menus").update({ servings: n }).eq("id", menuId);
  revalidatePath("/menu");
}

export type ConfirmItem = { ingredient: string; productId: number; quantity: number };

/** Añade los productos revisados a la lista activa y guarda el mapeo ingrediente→producto. */
export async function confirmMenuListAction(rawItems: ConfirmItem[]) {
  const { supabase, user } = await requireUser();
  const listId = await getOrCreateActiveList(supabase, user.id);

  // El mismo producto puede venir de varios ingredientes (patata en g y en ud): sumamos cantidades
  const qtyByProduct = new Map<number, number>();
  const productByIngredient = new Map<string, number>();
  for (const it of rawItems) {
    qtyByProduct.set(it.productId, (qtyByProduct.get(it.productId) ?? 0) + it.quantity);
    if (!productByIngredient.has(it.ingredient)) productByIngredient.set(it.ingredient, it.productId);
  }

  const { data: existing } = await supabase
    .from("shopping_list_items")
    .select("id,product_id,quantity")
    .eq("list_id", listId);
  const byProduct = new Map((existing ?? []).map((e) => [e.product_id as number, e]));

  for (const [productId, quantity] of qtyByProduct) {
    const prev = byProduct.get(productId);
    if (prev) {
      await supabase
        .from("shopping_list_items")
        .update({ quantity: Number(prev.quantity) + quantity, checked: false })
        .eq("id", prev.id);
    } else {
      await supabase.from("shopping_list_items").insert({ list_id: listId, product_id: productId, quantity });
    }
  }

  if (productByIngredient.size > 0) {
    const { error } = await supabase.from("ingredient_product_map").upsert(
      Array.from(productByIngredient, ([ingredient_name, product_id]) => ({ user_id: user.id, ingredient_name, product_id })),
      { onConflict: "user_id,ingredient_name" }
    );
    if (error) throw new Error(error.message);
  }
  revalidatePath("/lista");
  redirect("/lista");
}
