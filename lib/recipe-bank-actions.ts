"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { currentWeekStart, getOrCreateMenu } from "@/lib/menu";
import { EXTRA_TAGS, MAIN_TAGS } from "@/lib/recipe-tags";

export type RecipeInput = {
  id?: number;
  name: string;
  description: string;
  meal: string;
  servings: number;
  timeMinutes: number | null;
  difficulty: string;
  mainTag: string;
  extraTags: string[];
  visibility: string;
  ingredients: { name: string; qty: number; unit: string }[];
  steps: string[];
};

const MEALS = ["comida", "cena", "ambas"];
const DIFFICULTIES = ["Fácil", "Media", "Difícil"];
const VISIBILITIES = ["private", "friends", "public"];
const UNITS = ["g", "ml", "ud"];

export type SaveResult = { ok: false; error: string } | { ok: true };

/** Crea o edita una receta propia. La seguridad real está en las políticas RLS. */
export async function saveRecipe(input: RecipeInput): Promise<SaveResult> {
  const { supabase, user } = await requireUser();

  const name = input.name.trim().slice(0, 80);
  if (name.length < 3) return { ok: false, error: "Ponle un nombre a la receta (mínimo 3 letras)." };
  const ingredients = input.ingredients
    .map((i) => ({ name: i.name.trim().toLowerCase().slice(0, 60), qty: Number(i.qty), unit: UNITS.includes(i.unit) ? i.unit : "g" }))
    .filter((i) => i.name.length > 0 && Number.isFinite(i.qty) && i.qty > 0)
    .slice(0, 30);
  if (ingredients.length === 0) return { ok: false, error: "Añade al menos un ingrediente con su cantidad." };
  const steps = input.steps.map((s) => s.trim().slice(0, 500)).filter(Boolean).slice(0, 20);
  const time = Number(input.timeMinutes);
  const mainIds = MAIN_TAGS.map(([id]) => id);
  const extraIds = EXTRA_TAGS.map(([id]) => id);
  const tags = [mainIds.includes(input.mainTag) ? input.mainTag : "guiso", ...input.extraTags.filter((t) => extraIds.includes(t))];

  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
  const row = {
    owner_id: user.id,
    author_name: profile?.display_name?.trim() || null,
    name,
    description: input.description.trim().slice(0, 200) || null,
    meal: MEALS.includes(input.meal) ? input.meal : "ambas",
    servings: Math.min(12, Math.max(1, Math.round(Number(input.servings) || 2))),
    time_minutes: Number.isFinite(time) && time > 0 ? Math.min(600, Math.round(time)) : null,
    difficulty: DIFFICULTIES.includes(input.difficulty) ? input.difficulty : "Fácil",
    tags,
    steps,
    visibility: VISIBILITIES.includes(input.visibility) ? input.visibility : "friends",
  };

  let recipeId = input.id;
  if (recipeId) {
    const { data, error } = await supabase.from("recipes").update(row).eq("id", recipeId).eq("owner_id", user.id).select("id");
    if (error) return { ok: false, error: dupMessage(error.message) };
    if (!data || data.length === 0) return { ok: false, error: "No puedes editar esta receta." };
    await supabase.from("recipe_ingredients").delete().eq("recipe_id", recipeId);
  } else {
    const { data, error } = await supabase.from("recipes").insert(row).select("id").single();
    if (error) return { ok: false, error: dupMessage(error.message) };
    recipeId = data.id as number;
  }

  const { error: iErr } = await supabase
    .from("recipe_ingredients")
    .insert(ingredients.map((i) => ({ recipe_id: recipeId, ingredient_name: i.name, qty: i.qty, unit: i.unit })));
  if (iErr) return { ok: false, error: iErr.message };

  revalidatePath("/recetas");
  redirect(`/recetas/${recipeId}`);
}

function dupMessage(msg: string) {
  return msg.includes("recipes_owner_name_key") ? "Ya tienes una receta con ese nombre." : msg;
}

export async function deleteRecipe(recipeId: number) {
  const { supabase, user } = await requireUser();
  await supabase.from("recipes").delete().eq("id", recipeId).eq("owner_id", user.id);
  revalidatePath("/recetas");
  redirect("/recetas?ver=mias");
}

/** Pone una receta (mía, de un amigo o de Sobremesa) en un hueco del menú de esta semana o la siguiente. */
export async function addRecipeToMenu(recipeId: number, day: number, meal: "comida" | "cena", weekOffset: number) {
  const { supabase, user } = await requireUser();
  if (!Number.isInteger(day) || day < 0 || day > 6 || !["comida", "cena"].includes(meal)) throw new Error("Hueco no válido");
  const { data: profile } = await supabase.from("profiles").select("household_size").eq("id", user.id).maybeSingle();
  const menu = await getOrCreateMenu(supabase, user.id, currentWeekStart(weekOffset === 1 ? 1 : 0), profile?.household_size ?? 2);
  const { error } = await supabase
    .from("weekly_menu_slots")
    .upsert({ menu_id: menu.id, day, meal, recipe_id: recipeId }, { onConflict: "menu_id,day,meal" });
  if (error) throw new Error(error.message);
  revalidatePath("/menu");
  revalidatePath(`/recetas/${recipeId}`);
}
