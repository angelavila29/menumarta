import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import type { RecipeInput } from "@/lib/recipe-bank-actions";
import { EXTRA_TAGS, MAIN_TAGS } from "@/lib/recipe-tags";
import { RecipeForm } from "../../recipe-form";

export default async function EditRecipePage(props: PageProps<"/recetas/[id]/editar">) {
  const { id } = await props.params;
  const recipeId = Number(id);
  if (!Number.isInteger(recipeId)) notFound();
  const { supabase, user } = await requireUser();
  const [{ data: r }, { data: ings }, { data: all }] = await Promise.all([
    supabase.from("recipes").select("id,name,description,meal,servings,time_minutes,difficulty,tags,steps,visibility,owner_id").eq("id", recipeId).maybeSingle(),
    supabase.from("recipe_ingredients").select("ingredient_name,qty,unit").eq("recipe_id", recipeId).order("id"),
    supabase.from("recipe_ingredients").select("ingredient_name"),
  ]);
  if (!r || r.owner_id !== user.id) notFound();

  const tags = (r.tags ?? []) as string[];
  const mainIds = MAIN_TAGS.map(([t]) => t);
  const extraIds = EXTRA_TAGS.map(([t]) => t);
  const initial: RecipeInput = {
    id: recipeId,
    name: r.name as string,
    description: (r.description as string | null) ?? "",
    meal: r.meal as string,
    servings: Number(r.servings) || 2,
    timeMinutes: r.time_minutes as number | null,
    difficulty: (r.difficulty as string | null) ?? "Fácil",
    mainTag: tags.find((t) => mainIds.includes(t)) ?? "guiso",
    extraTags: tags.filter((t) => extraIds.includes(t)),
    visibility: r.visibility as string,
    ingredients: (ings ?? []).map((i) => ({ name: i.ingredient_name as string, qty: Number(i.qty), unit: i.unit as string })),
    steps: (r.steps ?? []) as string[],
  };
  const known = Array.from(new Set((all ?? []).map((x) => x.ingredient_name as string))).sort((a, b) => a.localeCompare(b, "es"));

  return (
    <main>
      <nav aria-label="Ruta" className="mb-2 flex flex-wrap items-center gap-1.5 text-sm text-muted">
        <Link href="/recetas" className="hover:text-brand">Banco de recetas</Link>
        <span aria-hidden>/</span>
        <Link href={`/recetas/${recipeId}`} className="hover:text-brand">{initial.name}</Link>
        <span aria-hidden>/</span>
        <span className="text-ink">Editar</span>
      </nav>
      <h1 className="mb-5 text-3xl font-bold md:text-4xl">Editar receta</h1>
      <RecipeForm initial={initial} knownIngredients={known} />
    </main>
  );
}
