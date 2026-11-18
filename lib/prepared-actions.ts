"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { parsePackSize } from "@/lib/menu";
import { guessMainTag } from "@/lib/prepared";

export type PreparedInput = {
  productId: number;
  name: string;
  meal: string;
  servings: number; // raciones que salen del envase
  kcal100: number;
  protein100: number;
  carbs100: number;
  packGrams: number;
  minutes: number | null;
  howTo: string;
};

const num = (v: unknown, min: number, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

/**
 * Da de alta un producto que ya viene hecho como plato: receta con la bolsa entera como
 * ingrediente, calorías de su etiqueta y el producto enlazado para la lista de la compra.
 * Queda como receta tuya visible para todo el mundo, así le sirve a cualquiera.
 */
export async function createPreparedDish(input: PreparedInput): Promise<{ ok: false; error: string }> {
  const { supabase, user } = await requireUser();
  const { data: product } = await supabase.from("products").select("id,name,image_url,pack_size").eq("id", input.productId).maybeSingle();
  if (!product) return { ok: false, error: "No encuentro ese producto." };

  const base = input.name.replace(/\(preparad[oa]\)/i, "").trim().slice(0, 60);
  if (base.length < 3) return { ok: false, error: "Ponle un nombre al plato (mínimo 3 letras)." };
  const name = `${base} (preparado)`;
  const kcal = num(input.kcal100, 1, 900);
  if (kcal === null) return { ok: false, error: "Pon las calorías por 100 g que vienen en la etiqueta." };
  const protein = num(input.protein100, 0, 100) ?? 0;
  const carbs = num(input.carbs100, 0, 100) ?? 0;
  const pack = parsePackSize(product.pack_size as string | null);
  const grams = num(input.packGrams, 1, 5000) ?? (pack && pack.unit === "kg" ? pack.amount * 1000 : null);
  if (grams === null) return { ok: false, error: "Pon cuántos gramos trae el envase." };
  const servings = Math.round(num(input.servings, 1, 12) ?? 1);
  const minutes = num(input.minutes, 1, 120);

  // El ingrediente es el propio plato; sus calorías salen de la etiqueta
  const ingredient = name.toLowerCase();
  const { data: existing } = await supabase.from("ingredient_nutrition").select("created_by").eq("ingredient_name", ingredient).maybeSingle();
  if (!existing) {
    const { error } = await supabase
      .from("ingredient_nutrition")
      .insert({ ingredient_name: ingredient, kcal, protein, carbs, unit_grams: grams, product_id: product.id, created_by: user.id });
    if (error) return { ok: false, error: error.message };
  } else if (existing.created_by === user.id) {
    await supabase.from("ingredient_nutrition").update({ kcal, protein, carbs, unit_grams: grams, product_id: product.id }).eq("ingredient_name", ingredient);
  }

  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
  const howTo = input.howTo.trim().slice(0, 500);
  const { data: recipe, error } = await supabase
    .from("recipes")
    .insert({
      owner_id: user.id,
      author_name: profile?.display_name?.trim() || null,
      name,
      description: "Se compra ya hecho: solo hay que calentarlo.",
      meal: ["comida", "cena", "ambas"].includes(input.meal) ? input.meal : "ambas",
      servings,
      time_minutes: minutes,
      difficulty: "Fácil",
      tags: [guessMainTag(base), "preparado", "rápido", "pocas ollas"],
      steps: ["Sigue las instrucciones del envase.", ...(howTo ? [howTo] : [])],
      visibility: "public",
      photo_url: (product.image_url as string | null) ?? null,
    })
    .select("id")
    .single();
  if (error || !recipe) return { ok: false, error: error?.message.includes("recipes_owner_name_key") ? "Ya tienes un plato con ese nombre." : error?.message ?? "No se ha podido guardar." };

  await supabase.from("recipe_ingredients").insert({ recipe_id: recipe.id, ingredient_name: ingredient, qty: 1, unit: "ud" });
  await supabase.from("ingredient_product_map").upsert({ user_id: user.id, ingredient_name: ingredient, product_id: product.id }, { onConflict: "user_id,ingredient_name" });
  revalidatePath("/recetas");
  redirect(`/recetas/${recipe.id}`);
}
