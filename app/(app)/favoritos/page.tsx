import { requireUser } from "@/lib/auth";
import { PRODUCT_COLUMNS, type Product } from "@/lib/types";
import { FavoritesList } from "./favorites-list";

export default async function FavoritesPage() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("favorites")
    .select(`product:products(${PRODUCT_COLUMNS})`)
    .eq("user_id", user.id);
  const products = (data ?? [])
    .map((r) => r.product as unknown as Product | null)
    .filter((p): p is Product => p !== null)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  return (
    <main>
      <h1 className="mb-3 text-2xl font-bold">Favoritos</h1>
      {products.length === 0 ? (
        <p className="text-zinc-600">Marca productos con ★ en el buscador y aparecerán aquí.</p>
      ) : (
        <FavoritesList products={products} />
      )}
    </main>
  );
}
