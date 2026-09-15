import Link from "next/link";
import { Search } from "@/components/search";
import { requireUser, userSupermarketIds } from "@/lib/auth";

export default async function SearchPage(props: PageProps<"/buscar">) {
  const sp = await props.searchParams;
  const initialQuery = typeof sp.q === "string" ? sp.q : "";
  const { supabase, user } = await requireUser();
  const supers = await userSupermarketIds(supabase, user.id);
  const [{ data: favs }, { data: priced }] = await Promise.all([
    supabase.from("favorites").select("product_id").eq("user_id", user.id),
    supabase.from("supermarkets").select("id,name").eq("has_prices", true),
  ]);
  const favoriteIds = (favs ?? []).map((f) => f.product_id as number);
  const withPrices = (priced ?? []).filter((s) => supers.includes(s.id as string)).map((s) => s.name as string);

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
        <>
          {withPrices.length < supers.length && (
            <p className="mb-3 text-sm text-zinc-500">
              {withPrices.length > 0
                ? `Por ahora hay precios de ${withPrices.join(" y ")}. El resto de tus supermercados se añadirán cuando tengamos datos.`
                : "Todavía no hay precios de tus supermercados. Añade Mercadona o Dia en Ajustes para buscar."}
            </p>
          )}
          <Search favoriteIds={favoriteIds} initialQuery={initialQuery} />
        </>
      )}
    </main>
  );
}
