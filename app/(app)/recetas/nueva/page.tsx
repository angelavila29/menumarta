import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { RecipeForm } from "../recipe-form";

export default async function NewRecipePage() {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("recipe_ingredients").select("ingredient_name");
  const known = Array.from(new Set((data ?? []).map((r) => r.ingredient_name as string))).sort((a, b) => a.localeCompare(b, "es"));
  return (
    <main>
      <nav aria-label="Ruta" className="mb-2 flex items-center gap-1.5 text-sm text-muted">
        <Link href="/recetas" className="hover:text-brand">Banco de recetas</Link>
        <span aria-hidden>/</span>
        <span className="text-ink">Nueva receta</span>
      </nav>
      <h1 className="mb-5 text-3xl font-bold md:text-4xl">Nueva receta</h1>
      <RecipeForm initial={null} knownIngredients={known} />
    </main>
  );
}
