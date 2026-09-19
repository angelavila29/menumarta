import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { PRODUCT_COLUMNS, type Product } from "@/lib/types";
import { FavoritesList } from "./favorites-list";

export default async function FavoritesPage() {
  const { supabase, user } = await requireUser();
  const [{ data: products }, { data: recipes }] = await Promise.all([
    supabase.from("favorites").select(`product:products(${PRODUCT_COLUMNS})`).eq("user_id", user.id),
    supabase.from("favorite_recipes").select("recipe:recipes(id,name,tags,time_minutes,difficulty,photo_url)").eq("user_id", user.id),
  ]);
  const items = (products ?? [])
    .map((r) => r.product as unknown as Product | null)
    .filter((p): p is Product => p !== null)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  const savedRecipes = (recipes ?? [])
    .map((r) => r.recipe as unknown as { id: number; name: string; tags: string[]; time_minutes: number | null; difficulty: string | null; photo_url: string | null } | null)
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  return (
    <main>
      <h1 className="text-3xl font-bold md:text-5xl">Favoritos</h1>
      <p className="mt-1 text-muted md:text-lg">Los productos y las recetas que guardas para tenerlos a mano.</p>
      <FavoritesList products={items} recipes={savedRecipes} />
      {items.length === 0 && savedRecipes.length === 0 && (
        <div className="mt-6 rounded-2xl bg-white p-8 text-center shadow-sm">
          <p aria-hidden className="text-4xl">♥</p>
          <p className="mt-2 font-semibold">Todavía no has guardado nada</p>
          <p className="text-sm text-muted">Usa el corazón en los productos del buscador y en las recetas que te gusten.</p>
          <div className="mt-4 flex justify-center gap-2">
            <Link href="/buscar" className="rounded-xl bg-brand px-4 py-2.5 font-semibold text-white">Buscar productos</Link>
            <Link href="/recetas" className="rounded-xl border border-cream-dark bg-white px-4 py-2.5 font-medium">Ver recetas</Link>
          </div>
        </div>
      )}
    </main>
  );
}
