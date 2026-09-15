import Link from "next/link";
import { Search } from "@/components/search";
import { requireUser, userSupermarketIds } from "@/lib/auth";

export default async function HomePage() {
  const { supabase, user } = await requireUser();
  const supers = await userSupermarketIds(supabase, user.id);
  const { data: favs } = await supabase.from("favorites").select("product_id").eq("user_id", user.id);
  const favoriteIds = (favs ?? []).map((f) => f.product_id as number);

  return (
    <main>
      <h1 className="mb-3 text-2xl font-bold">Buscar</h1>
      {supers.length === 0 ? (
        <div className="rounded-xl bg-amber-50 p-4 text-amber-900">
          <p className="font-medium">Aún no has elegido supermercados.</p>
          <Link href="/ajustes" className="mt-2 inline-block rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white">
            Ir a ajustes
          </Link>
        </div>
      ) : (
        <Search favoriteIds={favoriteIds} />
      )}
    </main>
  );
}
