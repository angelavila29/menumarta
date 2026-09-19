"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

/**
 * Devuelve en JSON todo lo que la app guarda de ti. Se descarga desde
 * Ajustes; no incluye el catálogo de precios, que es público.
 */
export async function exportMyData(): Promise<string> {
  const { supabase, user } = await requireUser();
  const id = user.id;

  const [profile, supers, favorites, favRecipes, recipes, menus, lists, items, pantry, staples, mapped] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
    supabase.from("user_supermarkets").select("*").eq("user_id", id),
    supabase.from("favorites").select("*").eq("user_id", id),
    supabase.from("favorite_recipes").select("*").eq("user_id", id),
    supabase.from("recipes").select("*, recipe_ingredients(*)").eq("owner_id", id),
    supabase.from("weekly_menus").select("*").eq("user_id", id),
    supabase.from("shopping_lists").select("*").eq("user_id", id),
    supabase.from("shopping_list_items").select("*, shopping_lists!inner(user_id)").eq("shopping_lists.user_id", id),
    supabase.from("pantry_items").select("*").eq("user_id", id),
    supabase.from("staple_items").select("*").eq("user_id", id),
    supabase.from("ingredient_product_map").select("*").eq("user_id", id),
  ]);

  // Si alguna consulta falla, mejor saberlo que entregar un archivo a medias.
  const failed = [profile, supers, favorites, favRecipes, recipes, menus, lists, items, pantry, staples, mapped]
    .map((r) => r.error?.message)
    .filter(Boolean);
  if (failed.length > 0) throw new Error(failed[0] as string);

  const data = {
    exportado: new Date().toISOString(),
    cuenta: { id, email: user.email ?? null, alta: user.created_at },
    perfil: profile.data ?? null,
    supermercados: supers.data ?? [],
    productos_favoritos: favorites.data ?? [],
    recetas_favoritas: favRecipes.data ?? [],
    mis_recetas: recipes.data ?? [],
    menus_semanales: menus.data ?? [],
    listas_de_la_compra: lists.data ?? [],
    productos_en_listas: items.data ?? [],
    despensa: pantry.data ?? [],
    basicos: staples.data ?? [],
    ingredientes_asignados_a_productos: mapped.data ?? [],
  };
  return JSON.stringify(data, null, 2);
}

/** Borra la cuenta y todo lo que cuelga de ella. No tiene vuelta atrás. */
export async function deleteMyAccount(confirmation: string) {
  const { supabase, user } = await requireUser();
  if (confirmation.trim().toUpperCase() !== "BORRAR") {
    throw new Error("Escribe BORRAR para confirmar.");
  }

  // Las fotos de recetas están en Storage y no se van con la cuenta:
  // Postgres no permite borrar storage.objects desde SQL.
  const { data: photos } = await supabase.storage.from("recipe-photos").list(user.id, { limit: 1000 });
  if (photos && photos.length > 0) {
    await supabase.storage.from("recipe-photos").remove(photos.map((f) => `${user.id}/${f.name}`));
  }

  const { error } = await supabase.rpc("delete_my_account");
  if (error) throw new Error(error.message);
  await supabase.auth.signOut();
  redirect("/login?borrada=1");
}
