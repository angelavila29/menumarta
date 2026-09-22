import Link from "next/link";
import { hasFeature } from "@/lib/access";
import { requireUser, userSupermarketIds } from "@/lib/auth";
import { normIngredient, type CookRecipe } from "@/lib/cook";
import { cheapestProductFor, type Need, type Recipe } from "@/lib/menu";
import { recipeAllowed } from "@/lib/prefs";
import { PRODUCT_COLUMNS, type Product } from "@/lib/types";
import { Cook } from "./cook";

// Lo que casi todo el mundo tiene siempre en casa: se ofrece primero
const COMMON = ["aceite de oliva", "ajo", "cebolla", "huevo", "arroz", "patata", "tomate frito", "harina", "pimentón", "laurel", "pan rallado", "caldo de pollo"];

export default async function CookPage() {
  const { supabase, user } = await requireUser();
  if (!(await hasFeature(supabase, user, "cocinar"))) {
    return (
      <main className="mx-auto max-w-lg py-10 text-center">
        <p aria-hidden className="text-5xl">🧑‍🍳</p>
        <h1 className="mt-3 text-2xl font-bold">Todavía en pruebas</h1>
        <p className="mt-2 text-muted">Esta función solo está abierta a unas pocas personas de momento.</p>
        <Link href="/" className="mt-5 inline-block rounded-xl bg-brand px-5 py-3 font-semibold text-white hover:bg-brand-dark">Ir al inicio</Link>
      </main>
    );
  }
  const [{ data: recipeRows }, { data: ingRows }, { data: pantry }, { data: profile }, supers, { data: chainRows }, { data: mapRows }] = await Promise.all([
    supabase.from("recipes").select("id,name,meal,servings,tags,owner_id,author_name,photo_url,time_minutes").order("name"),
    supabase.from("recipe_ingredients").select("recipe_id,ingredient_name,qty,unit").order("id"),
    supabase.from("pantry_items").select("ingredient_name").eq("user_id", user.id),
    supabase.from("profiles").select("household_size,diet,allergies,avoid_foods,weekly_budget").eq("id", user.id).maybeSingle(),
    userSupermarketIds(supabase, user.id),
    supabase.from("supermarkets").select("id,has_prices"),
    supabase.from("ingredient_product_map").select(`ingredient_name,product:products(${PRODUCT_COLUMNS})`).eq("user_id", user.id),
  ]);

  const people = profile?.household_size ?? 2;
  const prefs = { diet: profile?.diet ?? null, allergies: profile?.allergies ?? [], avoid: profile?.avoid_foods ?? [] };
  const byRecipe = new Map<number, { ingredient_name: string; qty: number; unit: string }[]>();
  for (const r of ingRows ?? []) {
    const list = byRecipe.get(r.recipe_id as number) ?? [];
    list.push({ ingredient_name: r.ingredient_name as string, qty: Number(r.qty), unit: r.unit as string });
    byRecipe.set(r.recipe_id as number, list);
  }

  const recipes: CookRecipe[] = (recipeRows ?? [])
    .filter((r) => recipeAllowed(r as unknown as Recipe, (byRecipe.get(r.id as number) ?? []).map((i) => i.ingredient_name), prefs))
    .map((r) => {
      const base = Number(r.servings) || 4;
      return {
        id: r.id as number,
        name: r.name as string,
        tags: (r.tags ?? []) as string[],
        minutes: (r.time_minutes as number | null) ?? null,
        photoUrl: (r.photo_url as string | null) ?? null,
        author: r.owner_id !== null && r.owner_id !== user.id ? ((r.author_name as string | null) ?? "otra persona") : null,
        ingredients: (byRecipe.get(r.id as number) ?? []).map((i) => ({ name: i.ingredient_name, qty: (i.qty * people) / base, unit: i.unit })),
      };
    });

  // Un producto por ingrediente: el que elegiste otras veces o el más adecuado y barato
  const priced = (chainRows ?? []).filter((c) => c.has_prices && supers.includes(c.id as string)).map((c) => c.id as string);
  const mapped = new Map<string, Product>();
  for (const m of mapRows ?? []) {
    const p = m.product as unknown as Product | null;
    if (p && priced.includes(p.supermarket_id)) mapped.set(normIngredient(m.ingredient_name as string), p);
  }
  const needs = new Map<string, Need>();
  for (const r of recipes) for (const i of r.ingredients) if (!needs.has(normIngredient(i.name))) needs.set(normIngredient(i.name), { ingredient: i.name, qty: i.qty, unit: i.unit });
  const products: [string, Product | null][] = await Promise.all(
    Array.from(needs.entries()).map(async ([name, need]) => [name, mapped.get(name) ?? (await cheapestProductFor(supabase, need, priced))] as [string, Product | null])
  );

  const names = Array.from(needs.keys()).sort((a, b) => a.localeCompare(b, "es"));
  const common = COMMON.filter((c) => names.includes(c));
  return (
    <Cook
      recipes={recipes}
      products={products}
      ingredients={[...common, ...names.filter((n) => !common.includes(n))]}
      commonCount={common.length}
      have={(pantry ?? []).map((p) => normIngredient(p.ingredient_name as string))}
      people={people}
    />
  );
}
