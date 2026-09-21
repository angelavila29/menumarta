/**
 * "¿Qué cocino hoy?": ordena las recetas según lo que ya tienes en casa y lo
 * que costaría comprar lo que falta. Sin IA: es contar y restar.
 */
import { packsNeeded, type Need } from "@/lib/menu";
import type { Product } from "@/lib/types";

export type CookIngredient = { name: string; qty: number; unit: string };
export type CookRecipe = {
  id: number;
  name: string;
  tags: string[];
  minutes: number | null;
  photoUrl: string | null;
  author: string | null; // null = receta de Sobremesa o tuya
  ingredients: CookIngredient[]; // cantidades ya ajustadas a las personas de casa
};
export type MissingItem = { name: string; need: Need; product: Product | null; cost: number | null };
export type CookResult = {
  recipe: CookRecipe;
  haveCount: number;
  missing: MissingItem[];
  /** Lo que pagarías en tienda por lo que falta (envases enteros). */
  cost: number;
  /** Ingredientes que faltan y para los que no hay producto con precio. */
  unpriced: number;
};

/** Cosas que hay en cualquier cocina: nunca cuentan como "te falta". */
const ALWAYS = new Set(["sal", "agua", "pimienta", "pimienta negra"]);

export function normIngredient(s: string): string {
  return s.trim().toLowerCase();
}

export function matchRecipe(recipe: CookRecipe, have: Set<string>, products: Map<string, Product | null>): CookResult {
  const missing: MissingItem[] = [];
  let haveCount = 0;
  for (const ing of recipe.ingredients) {
    const name = normIngredient(ing.name);
    if (have.has(name) || ALWAYS.has(name)) {
      haveCount += 1;
      continue;
    }
    const need: Need = { ingredient: ing.name, qty: ing.qty, unit: ing.unit };
    const product = products.get(name) ?? null;
    const cost = product && product.price != null ? product.price * packsNeeded(need, product) : null;
    missing.push({ name: ing.name, need, product, cost });
  }
  return {
    recipe,
    haveCount,
    missing,
    cost: missing.reduce((a, m) => a + (m.cost ?? 0), 0),
    unpriced: missing.filter((m) => m.cost === null).length,
  };
}

/**
 * Primero lo que puedes cocinar ya; después lo que menos cosas te pide comprar;
 * a igualdad, lo más barato de completar y lo que más aprovecha tu nevera.
 * Con presupuesto, lo que se pasa se aparta (no se esconde: se cuenta).
 */
export function rankRecipes(
  recipes: CookRecipe[],
  have: Set<string>,
  products: Map<string, Product | null>,
  budget: number | null
): { results: CookResult[]; overBudget: number } {
  const all = recipes.filter((r) => r.ingredients.length > 0).map((r) => matchRecipe(r, have, products));
  const within = budget === null ? all : all.filter((r) => r.cost <= budget + 1e-9);
  within.sort(
    (a, b) =>
      a.missing.length - b.missing.length ||
      a.unpriced - b.unpriced ||
      a.cost - b.cost ||
      b.haveCount - a.haveCount ||
      a.recipe.name.localeCompare(b.recipe.name, "es")
  );
  return { results: within, overBudget: all.length - within.length };
}
