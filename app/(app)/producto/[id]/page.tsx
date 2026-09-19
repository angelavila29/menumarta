import Link from "next/link";
import { notFound } from "next/navigation";
import { ChainLogo } from "@/components/chain-logo";
import { CheckIcon, LeafIcon, PiggyIcon } from "@/components/icons";
import { BulbIcon, ExternalIcon } from "@/components/icons-extra";
import { requireUser, userSupermarketIds } from "@/lib/auth";
import { FAMILY_FILTERS, familyOf } from "@/lib/categories";
import { equivalentIn } from "@/lib/compare";
import { euro, packSize, superName, unitPrice, zoneNotice } from "@/lib/format";
import { getOrCreateActiveList } from "@/lib/lists";
import { parsePackSize } from "@/lib/menu";
import { keywords, PACK_WORDS, unaccent, wordRegex } from "@/lib/search";
import { PRODUCT_COLUMNS, type Product } from "@/lib/types";
import { PriceChart } from "./price-chart";
import { AddToListControl, FavoriteButton, QuickAddButton } from "./product-client";

const TIPS: Record<string, string> = {
  fruta: "Compra la fruta y la verdura en dos veces a lo largo de la semana: aguanta mejor y desperdicias menos.",
  lacteos: "Los packs de 6 briks suelen costar lo mismo por litro que el brik suelto: compara antes de cargar peso.",
  carne: "Las bandejas grandes salen más baratas por kilo. Sepáralas en raciones y congela lo que no uses.",
  pescado: "El pescado congelado conserva sus nutrientes y suele costar menos que el fresco.",
  despensa: "Arroz, pasta y legumbres aguantan meses: el formato grande compensa si su precio por kilo es menor.",
  pan: "El pan se congela muy bien en rebanadas y así no se pone duro.",
  conservas: "Las conservas son una buena reserva para las semanas con poco tiempo.",
  congelados: "Mira el precio por kilo de los congelados: el formato familiar no siempre sale a cuenta.",
  bebidas: "Compara el precio por litro: los formatos pequeños suelen ser bastante más caros.",
};

export default async function ProductPage(props: PageProps<"/producto/[id]">) {
  const { id } = await props.params;
  const productId = Number(id);
  if (!Number.isInteger(productId)) notFound();
  const { supabase, user } = await requireUser();

  const [{ data: row }, supers, { data: chainRows }, listId, { data: fav }, { data: history }, { data: maps }] = await Promise.all([
    supabase.from("products").select(`${PRODUCT_COLUMNS},updated_at`).eq("id", productId).maybeSingle(),
    userSupermarketIds(supabase, user.id),
    supabase.from("supermarkets").select("id,name,has_prices"),
    getOrCreateActiveList(supabase, user.id),
    supabase.from("favorites").select("product_id").eq("user_id", user.id).eq("product_id", productId).maybeSingle(),
    supabase.from("price_history").select("captured_at,price").eq("product_id", productId).order("captured_at", { ascending: true }).limit(180),
    supabase.from("ingredient_product_map").select("ingredient_name").eq("user_id", user.id).eq("product_id", productId),
  ]);
  if (!row) notFound();
  const product = row as unknown as Product & { updated_at: string };
  const chainName = (cid: string) => ((chainRows ?? []).find((c) => c.id === cid)?.name as string | undefined) ?? superName(cid);
  const fam = familyOf(product.category);
  const famFilter = FAMILY_FILTERS.find((f) => f.id === fam.id);

  // Mismo producto en tus otras cadenas, comparado para la misma cantidad que este envase
  const pack = parsePackSize(product.pack_size);
  const sameQtyCost = (p: Product) =>
    pack && pack.unit === product.unit && p.unit === product.unit && p.unit_price != null ? p.unit_price * pack.amount : (p.price ?? Infinity);
  const priced = (chainRows ?? []).filter((c) => c.has_prices && supers.includes(c.id as string));
  const words = keywords(product.name.replace(product.brand ?? "", "")).filter((w) => !/\d/.test(w) && !PACK_WORDS.has(unaccent(w)));

  let simReq = supabase.from("products").select(PRODUCT_COLUMNS).eq("supermarket_id", product.supermarket_id).neq("id", productId).not("price", "is", null);
  if (words[0]) simReq = simReq.filter("name_norm", "match", wordRegex(words[0]));
  if (famFilter) simReq = simReq.filter("category", "imatch", famFilter.pattern);

  const [rows, { data: listItem }, { data: simRows }] = await Promise.all([
    Promise.all(
      priced.map(async (c) => {
        const p = c.id === product.supermarket_id ? product : await equivalentIn(supabase, product, c.id as string);
        return { chain: c.id as string, product: p, cost: p ? sameQtyCost(p) : Infinity };
      })
    ),
    supabase.from("shopping_list_items").select("quantity").eq("list_id", listId).eq("product_id", productId).maybeSingle(),
    simReq.order("unit_price", { ascending: true }).limit(12),
  ]);

  const found = rows.filter((r) => r.product !== null).sort((a, b) => a.cost - b.cost);
  const missingChains = rows.filter((r) => r.product === null).map((r) => chainName(r.chain));
  const best = found[0] ?? null;
  const next = found[1] ?? null;
  const mine = found.find((r) => r.chain === product.supermarket_id) ?? null;
  const saving = best && next ? next.cost - best.cost : 0;

  let priceLabel: { text: string; tone: "good" | "warn" } | null = null;
  if (found.length > 1 && mine && best) {
    const other = found.find((r) => r.chain !== product.supermarket_id)!;
    if (best.chain === product.supermarket_id && saving > 0.005) priceLabel = { text: "Mejor precio", tone: "good" };
    else if (Math.abs(mine.cost - (best.chain === product.supermarket_id ? other.cost : best.cost)) <= 0.005) priceLabel = { text: `Mismo precio que en ${chainName(other.chain)}`, tone: "good" };
    else priceLabel = { text: `${euro(mine.cost - best.cost)} más caro que en ${chainName(best.chain)}`, tone: "warn" };
  }

  const seen = new Set([unaccent(product.name)]);
  const similar = ((simRows ?? []) as Product[])
    .filter((p) => {
      const k = unaccent(p.name);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 3);

  const points = (history ?? []).filter((h) => h.price != null).map((h) => ({ date: h.captured_at as string, price: Number(h.price) }));
  const trend = trendOf(points);
  const inListQty = listItem ? Number(listItem.quantity) : 0;
  const ingredients = (maps ?? []).map((m) => m.ingredient_name as string);

  const fit = inListQty > 0
    ? { title: "Ya está en tu lista de la compra", text: `Tienes ${inListQty} ${inListQty === 1 ? "unidad" : "unidades"} en tu lista de esta semana.`, href: "/lista" }
    : ingredients.length > 0
      ? { title: "Este producto encaja en tu menú", text: `Lo usas como «${ingredients.slice(0, 2).join("» y «")}» en tus recetas.`, href: "/menu" }
      : { title: "¿Lo añades a tu compra?", text: "Añádelo a tu lista de la semana con el botón de la izquierda.", href: "/lista" };

  return (
    <main className="grid gap-5 lg:grid-cols-[1fr_340px] lg:items-start">
      <div className="flex min-w-0 flex-col gap-5">
        <nav aria-label="Ruta" className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
          <Link href="/buscar" className="hover:text-brand">Buscar productos</Link>
          <span aria-hidden>/</span>
          <Link href="/buscar" className="hover:text-brand">{fam.name}</Link>
          <span aria-hidden>/</span>
          <span className="text-ink">{product.name}</span>
        </nav>

        <section className="grid gap-5 rounded-2xl bg-white p-5 shadow-sm md:grid-cols-[minmax(0,260px)_1fr]">
          <div className="relative flex h-64 items-center justify-center rounded-xl bg-cream/50 p-4 md:h-72">
            {product.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.image_url} alt={product.name} className="h-full w-full object-contain" />
            ) : (
              <span aria-hidden className="text-8xl">{fam.emoji}</span>
            )}
            {product.is_discounted && (
              <span className="absolute left-3 top-3 rounded-md bg-brand px-2 py-0.5 text-xs font-semibold uppercase text-white">Oferta</span>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold leading-tight md:text-3xl">{product.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="inline-flex items-center gap-2 rounded-lg bg-cream px-2.5 py-1">
                <ChainLogo id={product.supermarket_id} name={chainName(product.supermarket_id)} size={20} />
                {chainName(product.supermarket_id)}
              </span>
              {product.pack_size && <span className="text-muted">{packSize(product.pack_size)}</span>}
            </div>
            <p className="mt-3 text-4xl font-bold">{euro(product.price)}</p>
            <p className="text-muted">{unitPrice(product.unit_price, product.unit)}</p>
            {priceLabel && (
              <p className={`mt-2 inline-block rounded-lg px-3 py-1 text-sm font-semibold ${priceLabel.tone === "good" ? "bg-olive-soft text-olive-dark" : "bg-amber-50 text-amber-800"}`}>
                {priceLabel.text}
              </p>
            )}
            <p className="mt-2 text-sm text-muted">🕒 {updatedLabel(product.updated_at)}</p>
            <AddToListControl productId={productId} />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <FavoriteButton key={`fav-${!!fav}`} productId={productId} initial={!!fav} />
              {product.product_url && (
                <a href={product.product_url} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
                  Ver en {chainName(product.supermarket_id)} <ExternalIcon className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="text-lg font-bold">Comparativa por supermercado</h2>
            {found.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No hay precios de tus supermercados para comparar.</p>
            ) : (
              <ul className="mt-3 divide-y divide-cream-dark">
                {found.map((r, i) => (
                  <li key={r.chain} className="flex items-center gap-3 py-2.5">
                    <ChainLogo id={r.chain} name={chainName(r.chain)} size={26} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{chainName(r.chain)}</span>
                      {r.chain !== product.supermarket_id && r.product && (
                        <Link href={`/producto/${r.product.id}`} className="block truncate text-xs text-muted hover:text-brand">{r.product.name}</Link>
                      )}
                    </span>
                    <span className="text-right">
                      <span className="block font-bold">{euro(r.product?.price)}</span>
                      <span className="block text-xs text-muted">{unitPrice(r.product?.unit_price, r.product?.unit)}</span>
                    </span>
                    {found.length > 1 &&
                      (i === 0 && found[1].cost - found[0].cost > 0.005 ? (
                        <span className="w-24 shrink-0 rounded-lg bg-olive-soft px-2 py-1 text-center text-xs font-medium text-olive-dark">Mejor precio</span>
                      ) : i > 0 && r.cost - found[0].cost > 0.005 ? (
                        <span className="w-24 shrink-0 rounded-lg bg-red-50 px-2 py-1 text-center text-xs font-medium text-red-700">+{euro(r.cost - found[0].cost)}</span>
                      ) : (
                        <span className="w-24 shrink-0 rounded-lg bg-cream px-2 py-1 text-center text-xs font-medium">Igual</span>
                      ))}
                  </li>
                ))}
              </ul>
            )}
            {missingChains.length > 0 && (
              <p className="mt-1 text-xs text-muted">Sin equivalente claro en {missingChains.join(" y ")}.</p>
            )}
            {best && next && saving > 0.005 && (
              <p className="mt-3 flex items-center gap-3 rounded-xl bg-olive-soft px-3 py-3 text-olive-dark">
                <PiggyIcon className="h-7 w-7 shrink-0" />
                <span>
                  <b>Ahorro de {euro(saving)} en {chainName(best.chain)}</b>
                  <br />
                  <span className="text-sm">Frente al siguiente precio más bajo ({chainName(next.chain)}).</span>
                </span>
              </p>
            )}
          </section>

          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="text-lg font-bold">Histórico de precio</h2>
            {points.length >= 2 ? (
              <div className="mt-2">
                <PriceChart points={points} />
              </div>
            ) : (
              <div className="mt-3 rounded-xl bg-cream p-4">
                <p className="text-sm text-muted">Precio registrado</p>
                <p className="text-3xl font-bold">{euro(points[0]?.price ?? product.price)}</p>
                <p className="text-sm text-muted">{points[0] ? longDate(points[0].date) : "hoy"}</p>
              </div>
            )}
            <div className={`mt-3 flex gap-3 rounded-xl p-3 ${trend.tone === "warn" ? "bg-amber-50 text-amber-900" : trend.tone === "good" ? "bg-olive-soft text-olive-dark" : "bg-cream text-ink"}`}>
              <span aria-hidden className="text-xl">{trend.tone === "warn" ? "↗" : trend.tone === "good" ? "✓" : "📈"}</span>
              <span>
                <span className="block font-semibold">{trend.title}</span>
                <span className="block text-sm opacity-90">{trend.text}</span>
              </span>
            </div>
          </section>
        </div>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">Información del producto</h2>
          {product.supermarket_id === "mercadona" && <p className="text-sm text-muted">{zoneNotice(null).replace("en tu zona", "fuera de Madrid")}</p>}
          <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <Info label="Marca" value={product.brand ?? "—"} />
            <Info label="Formato" value={packSize(product.pack_size) || "—"} />
            <Info label="Categoría" value={fam.name} />
            <Info label="Precio por unidad" value={unitPrice(product.unit_price, product.unit) || "—"} />
            {product.supermarket_id === "mercadona" && <Info label="Zona del precio" value="Madrid" />}
            <Info label="Última actualización" value={new Date(product.updated_at).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })} />
          </dl>
        </section>
      </div>

      <aside className="flex flex-col gap-4">
        <Link href={fit.href} className="flex gap-3 rounded-2xl bg-olive-soft p-4 hover:brightness-[0.98]">
          <CheckIcon className="mt-0.5 h-7 w-7 shrink-0 text-olive-dark" />
          <span>
            <span className="block font-bold text-olive-dark">{fit.title}</span>
            <span className="block text-sm text-olive-dark/90">{fit.text}</span>
          </span>
        </Link>

        <section className="flex gap-3 rounded-2xl bg-brand-soft p-4">
          <BulbIcon className="h-8 w-8 shrink-0 text-brand" />
          <div>
            <p className="font-bold">Consejo Sobremesa</p>
            <p className="text-sm text-ink/80">{TIPS[fam.id] ?? "Fíjate en el precio por kilo o litro: es la forma más justa de comparar envases distintos."}</p>
          </div>
        </section>

        {similar.length > 0 && (
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Equivalentes similares</h2>
              {words[0] && (
                <Link href={`/buscar?q=${encodeURIComponent(words[0])}`} className="text-sm font-semibold text-brand hover:underline">Ver todos</Link>
              )}
            </div>
            <ul className="mt-3 flex flex-col gap-2">
              {similar.map((p) => (
                <li key={p.id} className="flex items-center gap-3 rounded-xl border border-cream-dark p-2">
                  <div className="flex h-14 w-12 shrink-0 items-center justify-center">
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image_url} alt="" className="h-full w-full object-contain" loading="lazy" />
                    ) : (
                      <span aria-hidden className="text-2xl">{fam.emoji}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/producto/${p.id}`} className="line-clamp-2 text-sm font-semibold leading-tight hover:text-brand">{p.name}</Link>
                    <p className="text-xs text-muted">{[p.brand, packSize(p.pack_size)].filter(Boolean).join(" · ")}</p>
                    <p className="text-sm font-bold">
                      {euro(p.price)} <span className="text-xs font-normal text-muted">{unitPrice(p.unit_price, p.unit)}</span>
                    </p>
                  </div>
                  <QuickAddButton productId={p.id} name={p.name} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="flex items-center gap-3 rounded-2xl bg-olive-soft/60 p-5">
          <LeafIcon className="h-10 w-10 shrink-0 text-olive" />
          <p className="font-hand -rotate-2 text-2xl leading-tight text-olive-dark">Pequeñas elecciones, grandes comidas</p>
        </section>
      </aside>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  );
}

function longDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-ES", { day: "numeric", month: "long" });
}

function updatedLabel(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
  return d.toDateString() === new Date().toDateString() ? `Actualizado hoy, ${date}` : `Actualizado el ${date}`;
}

function trendOf(points: { date: string; price: number }[]): { title: string; text: string; tone: "good" | "warn" | "neutral" } {
  if (points.length < 2) {
    return {
      title: "Empezamos a seguir este precio",
      text: points[0] ? `Tenemos datos desde el ${longDate(points[0].date)}. Verás su evolución según pasen los días.` : "Aún no hay histórico de este producto.",
      tone: "neutral",
    };
  }
  const first = points[0];
  const last = points[points.length - 1];
  const change = (last.price - first.price) / first.price;
  const pct = `${Math.abs(change * 100).toLocaleString("es-ES", { maximumFractionDigits: 1 })} %`;
  if (Math.abs(change) < 0.02) return { title: "Precio estable", text: `Se ha mantenido similar desde el ${longDate(first.date)}.`, tone: "good" };
  if (change > 0) return { title: `Ha subido un ${pct}`, text: `Costaba ${euro(first.price)} el ${longDate(first.date)}.`, tone: "warn" };
  return { title: `Ha bajado un ${pct}`, text: `Costaba ${euro(first.price)} el ${longDate(first.date)}.`, tone: "good" };
}
