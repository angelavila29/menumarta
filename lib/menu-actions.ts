"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getOrCreateActiveList } from "@/lib/lists";
import { currentWeekStart, generateWeek, getOrCreateMenu, loadIngredientNames, loadRecipes } from "@/lib/menu";
import { recipeAllowed } from "@/lib/prefs";

export async function generateWeekAction(weekStart: string) {
  const { supabase, user } = await requireUser();
  await generateWeekFor(supabase, user.id, weekStart || currentWeekStart());
  revalidatePath("/menu");
}

/** Genera la semana respetando dieta, alergias y alimentos a evitar del perfil. */
export async function generateWeekFor(supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>, userId: string, weekStart: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("household_size,diet,allergies,avoid_foods,max_recipe_minutes")
    .eq("id", userId)
    .maybeSingle();
  const menu = await getOrCreateMenu(supabase, userId, weekStart, profile?.household_size ?? 2);
  const [recipes, ingredients, { data: times }] = await Promise.all([
    loadRecipes(supabase),
    loadIngredientNames(supabase),
    supabase.from("recipes").select("id,time_minutes"),
  ]);
  const { data: favs } = await supabase.from("favorite_recipes").select("recipe_id").eq("user_id", userId);
  const saved = new Set((favs ?? []).map((f) => f.recipe_id as number));
  const pool = recipes.filter((r) => r.owner_id === null || r.owner_id === userId || saved.has(r.id));
  const minutes = new Map((times ?? []).map((t) => [t.id as number, t.time_minutes as number | null]));
  const maxMinutes = profile?.max_recipe_minutes ?? null;
  const prefs = { diet: profile?.diet ?? null, allergies: profile?.allergies ?? [], avoid: profile?.avoid_foods ?? [] };
  let allowed = pool.filter(
    (r) =>
      recipeAllowed(r, ingredients.get(r.id) ?? [], prefs) &&
      (maxMinutes === null || (minutes.get(r.id) ?? 0) <= maxMinutes)
  );
  if (allowed.length < 6) allowed = pool; // demasiado restrictivo: mejor un menú que ninguno
  const slots = generateWeek(allowed).map((s) => ({ ...s, menu_id: menu.id }));
  const { error } = await supabase.from("weekly_menu_slots").upsert(slots, { onConflict: "menu_id,day,meal" });
  if (error) throw new Error(error.message);
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
