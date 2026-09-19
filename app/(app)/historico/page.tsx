import Link from "next/link";
import { ChainLogo } from "@/components/chain-logo";
import { requireUser, userSupermarketIds } from "@/lib/auth";
import { euro, packSize, superName } from "@/lib/format";
import { getOrCreateActiveList } from "@/lib/lists";
import { PRODUCT_COLUMNS, type Product } from "@/lib/types";

type Change = { product_id: number; first_price: number; last_price: number; first_date: string; last_date: string; pct: number };

export default async function HistoryPage() {
  const { supabase, user } = await requireUser();
  const supers = await userSupermarketIds(supabase, user.id);
  const [{ data: raw }, { data: favs }, listId] = await Promise.all([
    supabase.rpc("price_changes", { p_chains: supers, p_days: 30 }),
    supabase.from("favorites").select("product_id").eq("user_id", user.id),
    getOrCreateActiveList(supabase, user.id),
  ]);
  const { data: listRows } = await supabase.from("shopping_list_items").select("product_id").eq("list_id", listId);

  const changes = ((raw ?? []) as Change[]).map((c) => ({ ...c, first_price: Number(c.first_price), last_price: Number(c.last_price), pct: Number(c.pct) }));
  const mineIds = new Set([...(favs ?? []).map((f) => f.product_id as number), ...(listRows ?? []).map((l) => l.product_id as number)]);

  // Los cambios de más del 60 % suelen ser un cambio de formato, no de precio: se dejan fuera del ranking
  const sane = changes.filter((c) => Math.abs(c.pct) <= 60);
  const down = sane.filter((c) => c.pct < 0).sort((a, b) => a.pct - b.pct).slice(0, 12);
  const up = sane.filter((c) => c.pct > 0).sort((a, b) => b.pct - a.pct).slice(0, 12);
  const mine = changes.filter((c) => mineIds.has(c.product_id));

  const ids = Array.from(new Set([...down, ...up, ...mine].map((c) => c.product_id)));
  const { data: prodRows } = ids.length > 0 ? await supabase.from("products").select(PRODUCT_COLUMNS).in("id", ids) : { data: [] };
  const products = new Map(((prodRows ?? []) as Product[]).map((p) => [p.id, p]));

  const since = changes.reduce((min, c) => (c.first_date < min ? c.first_date : min), changes[0]?.first_date ?? "");
  const avg = sane.length ? sane.reduce((a, c) => a + c.pct, 0) / sane.length : 0;

  return (
    <main>
      <h1 className="text-3xl font-bold md:text-5xl">Histórico de precios</h1>
      <p className="mt-1 text-muted md:text-lg">
        {changes.length > 0 ? `Qué ha cambiado en tus supermercados desde el ${longDate(since)}.` : "Todavía no hay cambios de precio registrados en tus supermercados."}
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <Tile label="Productos que han bajado" value={String(changes.filter((c) => c.pct < 0).length)} tone="good" />
        <Tile label="Productos que han subido" value={String(changes.filter((c) => c.pct > 0).length)} tone="warn" />
        <Tile label="Variación media de los que cambian" value={`${avg > 0 ? "+" : ""}${avg.toLocaleString("es-ES", { maximumFractionDigits: 1 })} %`} tone="neutral" />
      </div>

      {mine.length > 0 && (
        <section className="mt-5 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">En tus favoritos y tu lista</h2>
          <List changes={mine.sort((a, b) => a.pct - b.pct)} products={products} />
        </section>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-2 lg:items-start">
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">↓ Lo que más ha bajado</h2>
          <List changes={down} products={products} />
        </section>
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">↑ Lo que más ha subido</h2>
          <List changes={up} products={products} />
        </section>
      </div>
      <p className="mt-4 text-xs text-muted">Guardamos el precio de cada producto una vez al día. Los cambios de más del 60 % se excluyen de los rankings porque suelen ser un cambio de formato.</p>
    </main>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone: "good" | "warn" | "neutral" }) {
  const cls = tone === "good" ? "bg-olive-soft text-olive-dark" : tone === "warn" ? "bg-amber-50 text-amber-900" : "bg-white text-ink";
  return (
    <section className={`rounded-2xl p-4 shadow-sm ${cls}`}>
      <p className="text-sm opacity-80">{label}</p>
      <p className="text-3xl font-bold">{value}</p>
    </section>
  );
}

function List({ changes, products }: { changes: Change[]; products: Map<number, Product> }) {
  const rows = changes.filter((c) => products.has(c.product_id));
  if (rows.length === 0) return <p className="mt-2 text-sm text-muted">Nada por ahora.</p>;
  return (
    <ul className="mt-2 divide-y divide-cream-dark">
      {rows.map((c) => {
        const p = products.get(c.product_id)!;
        const downward = c.pct < 0;
        return (
          <li key={c.product_id} className="flex items-center gap-3 py-2.5">
            <ChainLogo id={p.supermarket_id} name={superName(p.supermarket_id)} size={24} />
            <span className="min-w-0 flex-1">
              <Link href={`/producto/${p.id}`} className="line-clamp-1 text-sm font-medium hover:text-brand">{p.name}</Link>
              <span className="text-xs text-muted">{packSize(p.pack_size)}</span>
            </span>
            <span className="shrink-0 text-right text-sm">
              <span className="text-muted line-through">{euro(c.first_price)}</span> <b>{euro(c.last_price)}</b>
            </span>
            <span className={`w-16 shrink-0 rounded-lg px-2 py-1 text-center text-xs font-semibold ${downward ? "bg-olive-soft text-olive-dark" : "bg-amber-50 text-amber-900"}`}>
              {downward ? "↓" : "↑"} {Math.abs(c.pct).toLocaleString("es-ES", { maximumFractionDigits: 1 })} %
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function longDate(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-ES", { day: "numeric", month: "long" });
}
