import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { DAYS } from "@/lib/menu";
import { RecipeForm, type MenuTarget } from "../recipe-form";

type SP = Promise<{ semana?: string; dia?: string; comida?: string }>;

export default async function NewRecipePage({ searchParams }: { searchParams: SP }) {
  const { supabase } = await requireUser();
  const sp = await searchParams;
  const { data } = await supabase.from("recipe_ingredients").select("ingredient_name");
  const known = Array.from(new Set((data ?? []).map((r) => r.ingredient_name as string))).sort((a, b) => a.localeCompare(b, "es"));

  // Desde el menú ("Crear receta nueva" al elegir plato): al guardarla va directa a ese hueco
  const day = Number(sp.dia);
  const offset = Number(sp.semana) === 1 ? 1 : 0;
  const target: MenuTarget | undefined =
    Number.isInteger(day) && day >= 0 && day <= 6 && (sp.comida === "comida" || sp.comida === "cena")
      ? { offset, day, meal: sp.comida, label: `${DAYS[day].toLowerCase()}${offset ? " de la semana que viene" : ""}, ${sp.comida}` }
      : undefined;

  return (
    <main>
      <nav aria-label="Ruta" className="mb-2 flex items-center gap-1.5 text-sm text-muted">
        {target ? (
          <Link href={`/menu${offset ? "?semana=1" : ""}`} className="hover:text-brand">Menú semanal</Link>
        ) : (
          <Link href="/recetas" className="hover:text-brand">Banco de recetas</Link>
        )}
        <span aria-hidden>/</span>
        <span className="text-ink">Nueva receta</span>
      </nav>
      <h1 className="mb-5 text-3xl font-bold md:text-4xl">Nueva receta</h1>
      <RecipeForm initial={null} knownIngredients={known} target={target} />
    </main>
  );
}
