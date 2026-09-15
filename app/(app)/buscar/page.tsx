import Link from "next/link";
import { Search } from "@/components/search";
import { requireUser, userSupermarketIds } from "@/lib/auth";

export default async function SearchPage(props: PageProps<"/buscar">) {
  const sp = await props.searchParams;
  const initialQuery = typeof sp.q === "string" ? sp.q : "";
  const { supabase, user } = await requireUser();
  const supers = await userSupermarketIds(supabase, user.id);
  const [{ data: favs }, { data: priced }, { data: offerRows }] = await Promise.all([
    supabase.from("favorites").select("product_id").eq("user_id", user.id),
    supabase.from("supermarkets").select("id,name").eq("has_prices", true),
    supabase.from("products").select("supermarket_id").eq("is_discounted", true).in("supermarket_id", supers.length > 0 ? supers : ["-"]),
  ]);
  const favoriteIds = (favs ?? []).map((f) => f.product_id as number);
  const chains = (priced ?? [])
    .filter((s) => supers.includes(s.id as string))
    .map((s) => ({ id: s.id as string, name: s.name as string }));
  const offers = chains.map((c) => ({ chain: c.id, name: c.name, count: (offerRows ?? []).filter((r) => r.supermarket_id === c.id).length }));

  return (
    <main>
      <h1 className="text-3xl font-bold md:text-5xl">Buscar productos</h1>
      <p className="mt-1 text-muted md:text-lg">Encuentra precios reales y añade productos a tu lista de la compra.</p>
      {supers.length > chains.length && chains.length > 0 && (
        <p className="mt-1 text-sm text-muted">Por ahora solo hay precios de {chains.map((c) => c.name).join(" y ")}.</p>
      )}
      {chains.length === 0 ? (
        <div className="mt-5 rounded-2xl bg-amber-50 p-5 text-amber-900">
          <p className="font-semibold">Todavía no hay precios de tus supermercados.</p>
          <p className="text-sm">Añade Mercadona o Dia para buscar productos.</p>
          <Link href="/onboarding" className="mt-3 inline-block rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white">
            Elegir supermercados
          </Link>
        </div>
      ) : (
        <div className="mt-5">
          <Search key={initialQuery} initialQuery={initialQuery} favoriteIds={favoriteIds} chains={chains} offers={offers} />
        </div>
      )}
    </main>
  );
}
