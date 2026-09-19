"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getOrCreateActiveList } from "@/lib/lists";
import { currentWeekStart, defaultCookSessions, generateWeek, getOrCreateMenu, loadIngredientNames, loadRecipes, loadSlots } from "@/lib/menu";
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
    .select("household_size,diet,allergies,avoid_foods,max_recipe_minutes,friend_recipes_mode,cook_sessions,weekly_budget,goals")
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
  // Recetas de amigos: todas o solo las guardadas, según la preferencia. Las públicas de
  // gente que no es amiga solo entran si las has guardado.
  const useAllFromFriends = (profile?.friend_recipes_mode ?? "all") === "all";
  const { data: friendRows } = useAllFromFriends ? await supabase.rpc("my_friendships") : { data: [] };
  const friendIds = new Set(
    ((friendRows ?? []) as { other_id: string; status: string }[]).filter((f) => f.status === "accepted").map((f) => f.other_id)
  );
  const pool = recipes.filter(
    (r) => r.owner_id === null || r.owner_id === userId || saved.has(r.id) || (r.owner_id !== null && friendIds.has(r.owner_id))
  );
  const minutes = new Map((times ?? []).map((t) => [t.id as number, t.time_minutes as number | null]));
  const maxMinutes = profile?.max_recipe_minutes ?? null;
  const prefs = { diet: profile?.diet ?? null, allergies: profile?.allergies ?? [], avoid: profile?.avoid_foods ?? [] };
  let allowed = pool.filter(
    (r) =>
      recipeAllowed(r, ingredients.get(r.id) ?? [], prefs) &&
      (maxMinutes === null || (minutes.get(r.id) ?? 0) <= maxMinutes)
  );
  if (allowed.length < 6) allowed = pool; // demasiado restrictivo: mejor un menú que ninguno
  // Los huecos "como fuera" se respetan; se cocina las veces que diga el perfil
  const existing = await loadSlots(supabase, menu.id);
  const blocked = new Set(existing.filter((s) => s.kind === "out").map((s) => `${s.day}-${s.meal}`));
  const sessions = profile?.cook_sessions ?? defaultCookSessions(profile?.household_size ?? 2, 14 - blocked.size);
  const goals: string[] = profile?.goals ?? [];
  const slots = generateWeek(allowed, {
    sessions,
    blocked,
    ingredients,
    thrifty: profile?.weekly_budget != null || goals.includes("ahorrar"),
    quick: goals.includes("tiempo"),
    healthy: goals.includes("saludable"),
  }).map((s) => ({ ...s, menu_id: menu.id }));
  const { error } = await supabase.from("weekly_menu_slots").upsert(slots, { onConflict: "menu_id,day,meal" });
  if (error) throw new Error(error.message);
}

/** Cambia un hueco: una receta, vacío, o "out" para marcarlo como "como fuera". */
export async function setSlotAction(menuId: string, day: number, meal: "comida" | "cena", value: number | "out" | null) {
  const { supabase } = await requireUser();
  const row = value === "out" ? { recipe_id: null, kind: "out" } : { recipe_id: value, kind: "meal" };
  const { error } = await supabase
    .from("weekly_menu_slots")
    .upsert({ menu_id: menuId, day, meal, ...row }, { onConflict: "menu_id,day,meal" });
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
export async function confirmMenuListAction(rawItems: ConfirmItem[], staples: { productId: number; quantity: number }[] = []) {
  const { supabase, user } = await requireUser();
  const listId = await getOrCreateActiveList(supabase, user.id);

  // El mismo producto puede venir de varios ingredientes (patata en g y en ud): sumamos cantidades
  const qtyByProduct = new Map<number, number>();
  const productByIngredient = new Map<string, number>();
  for (const st of staples.slice(0, 40)) qtyByProduct.set(st.productId, (qtyByProduct.get(st.productId) ?? 0) + st.quantity);
  for (const it of rawItems) {
    qtyByProduct.set(it.productId, (qtyByProduct.get(it.productId) ?? 0) + it.quantity);
    if (!productByIngredient.has(it.ingredient)) productByIngredient.set(it.ingredient, it.productId);
  }

  const { data: existing } = await supabase
    .from("shopping_list_items")
    .select("id,product_id,quantity")
    .eq("list_id", listId);
  const byProduct = new Map((existing ?? []).map((e) => [e.product_id as number, e]));

  const stapleOnly = new Set(staples.map((st) => st.productId).filter((id) => !rawItems.some((it) => it.productId === id)));
  for (const [productId, quantity] of qtyByProduct) {
    const prev = byProduct.get(productId);
    if (prev && stapleOnly.has(productId)) continue; // un básico que ya está en la lista no se duplica
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

/** Cuántas veces cocinas a la semana (el resto se cubre con sobras). Se guarda en el perfil. */
export async function setCookSessionsAction(sessions: number) {
  const { supabase, user } = await requireUser();
  const n = Math.min(14, Math.max(1, Math.round(sessions)));
  const { error } = await supabase.from("profiles").update({ cook_sessions: n }).eq("id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/menu");
}
