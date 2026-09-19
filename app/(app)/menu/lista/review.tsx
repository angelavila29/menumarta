"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { ChainLogo } from "@/components/chain-logo";
import { CartIcon, CheckIcon, PiggyIcon } from "@/components/icons";
import { searchProducts } from "@/lib/actions";
import { euro, packSize, superName, unitPrice } from "@/lib/format";
import type { Need } from "@/lib/menu";
import { confirmMenuListAction } from "@/lib/menu-actions";
import { setPantryItem } from "@/lib/pantry-actions";
import { choiceFor, summarize, type PlanRow } from "@/lib/plan";
import type { Product } from "@/lib/types";

export type StapleRow = { product: Product; quantity: number };
type Override = { product: Product; packs: number };

export function Review({ rows: initialRows, chains, recommended, mainChain, budget, servings, weekRange, staples }: {
  rows: PlanRow[];
  chains: { id: string; name: string }[];
  recommended: string;
  mainChain: string | null;
  budget: number | null;
  servings: number;
  weekRange: string;
  staples: StapleRow[];
}) {
  const [rows, setRows] = useState(initialRows);
  const [plan, setPlan] = useState(recommended);
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [packs, setPacks] = useState<Record<string, number>>({});
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [withStaples, setWithStaples] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [showPantry, setShowPantry] = useState(false);
  const [pending, start] = useTransition();

  const chainIds = chains.map((c) => c.id);
  const nameOf = (id: string) => (id === "mixed" ? "Repartido" : chains.find((c) => c.id === id)?.name ?? superName(id));
  const plans = useMemo(() => summarize(rows, chainIds), [rows, chainIds]);
  const cheapestTotal = Math.min(...plans.filter((p) => p.missing === Math.min(...plans.map((x) => x.missing))).map((p) => p.total));

  const resolved = rows.map((r) => {
    const o = overrides[r.key];
    const c = o ? { product: o.product, packs: o.packs, cost: (o.product.price ?? 0) * o.packs } : choiceFor(r, plan);
    const n = c ? packs[r.key] ?? c.packs : 0;
    return { row: r, choice: c, packs: n, cost: c ? (c.product.price ?? 0) * n : 0 };
  });
  const toBuy = resolved.filter((x) => !x.row.inPantry && x.choice && !skipped.has(x.row.key));
  const noProduct = resolved.filter((x) => !x.row.inPantry && !x.choice);
  const inPantry = resolved.filter((x) => x.row.inPantry);
  const staplesTotal = withStaples ? staples.reduce((a, s) => a + (s.product.price ?? 0) * s.quantity, 0) : 0;
  const total = toBuy.reduce((a, x) => a + x.cost, 0) + staplesTotal;
  const over = budget !== null && total > budget;
  const storesUsed = Array.from(new Set(toBuy.map((x) => x.choice!.product.supermarket_id)));

  function togglePantry(key: string, ingredient: string, has: boolean) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, inPantry: has } : r)));
    start(() => setPantryItem(ingredient, has));
  }
  function confirm() {
    start(() =>
      confirmMenuListAction(
        toBuy.map((x) => ({ ingredient: x.row.need.ingredient, productId: x.choice!.product.id, quantity: x.packs })),
        withStaples ? staples.map((s) => ({ productId: s.product.id, quantity: s.quantity })) : []
      )
    );
  }

  return (
    <main>
      <nav aria-label="Ruta" className="mb-2 flex items-center gap-1.5 text-sm text-muted">
        <Link href="/menu" className="hover:text-brand">Menú semanal</Link>
        <span aria-hidden>/</span>
        <span className="text-ink">Organizar la compra</span>
      </nav>
      <h1 className="text-3xl font-bold md:text-5xl">Organizar la compra</h1>
      <p className="mt-1 text-muted md:text-lg">Semana {weekRange} · para {servings} {servings === 1 ? "persona" : "personas"}</p>

      {/* Planes */}
      <section className="mt-5">
        <h2 className="mb-2 text-lg font-bold">¿Dónde la compras?</h2>
        <div className={`grid gap-3 ${plans.length > 2 ? "md:grid-cols-3" : plans.length === 2 ? "md:grid-cols-2" : ""}`}>
          {plans.map((p) => {
            const on = plan === p.id;
            const diff = p.total - cheapestTotal;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => { setPlan(p.id); setOverrides({}); setPacks({}); }}
                className={`rounded-2xl border-2 bg-white p-4 text-left shadow-sm ${on ? "border-brand" : "border-transparent hover:border-cream-dark"}`}
              >
                <span className="flex items-center gap-2">
                  {p.id === "mixed" ? (
                    <span className="flex -space-x-2">{chainIds.map((c) => <span key={c} className="rounded-full bg-white p-0.5"><ChainLogo id={c} size={24} /></span>)}</span>
                  ) : (
                    <ChainLogo id={p.id} name={nameOf(p.id)} size={28} />
                  )}
                  <span className="font-bold">{p.id === "mixed" ? "Repartido entre tiendas" : `Todo en ${nameOf(p.id)}`}</span>
                </span>
                <span className="mt-2 block text-3xl font-bold">{euro(p.total)}</span>
                <span className="mt-1 flex flex-wrap gap-1.5 text-xs">
                  {p.id === recommended && <span className="rounded-full bg-olive px-2 py-0.5 font-medium text-white">Recomendado</span>}
                  {p.id === mainChain && <span className="rounded-full bg-cream px-2 py-0.5 font-medium">Tu habitual</span>}
                  {diff < 0.005 && p.missing === 0 ? (
                    <span className="rounded-full bg-olive-soft px-2 py-0.5 font-medium text-olive-dark">El más barato</span>
                  ) : diff >= 0.005 ? (
                    <span className="rounded-full bg-cream px-2 py-0.5 text-muted">+{euro(diff)}</span>
                  ) : null}
                  {p.id === "mixed" && <span className="rounded-full bg-cream px-2 py-0.5 text-muted">{p.stores} {p.stores === 1 ? "tienda" : "tiendas"}</span>}
                  {p.missing > 0 && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800">faltan {p.missing}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          {/* Para comprar */}
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="text-lg font-bold">Para comprar ({toBuy.length})</h2>
            <p className="mb-2 text-sm text-muted">Si ya tienes algo en casa, márcalo y lo recordaremos para las próximas semanas.</p>
            <ul className="divide-y divide-cream-dark">
              {resolved.filter((x) => !x.row.inPantry && x.choice).map((x) => {
                const off = skipped.has(x.row.key);
                const p = x.choice!.product;
                return (
                  <li key={x.row.key} className={`py-3 ${off ? "opacity-50" : ""}`}>
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={!off}
                        onChange={(e) => setSkipped((s) => { const n = new Set(s); if (e.target.checked) n.delete(x.row.key); else n.add(x.row.key); return n; })}
                        aria-label={`Comprar ${x.row.need.ingredient}`}
                        className="h-5 w-5 shrink-0 accent-olive"
                      />
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-cream">
                        {p.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.image_url} alt="" className="h-full w-full object-contain" loading="lazy" />
                        ) : (
                          <ChainLogo id={p.supermarket_id} size={24} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">
                          <b className="capitalize">{x.row.need.ingredient}</b> <span className="text-muted">· necesitas {fmtQty(x.row.need)}</span>
                        </p>
                        <p className="line-clamp-1 text-sm">{p.name}</p>
                        <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                          <span className="inline-flex items-center gap-1"><ChainLogo id={p.supermarket_id} size={12} /> {superName(p.supermarket_id)}</span>
                          <span>{packSize(p.pack_size)}</span>
                          <span>{unitPrice(p.unit_price, p.unit)}</span>
                          {x.row.remembered && !overrides[x.row.key] && <span>· elegido otras veces</span>}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="font-bold">{euro(x.cost)}</span>
                        <span className="flex items-center gap-1">
                          <button type="button" aria-label="Menos" onClick={() => setPacks((m) => ({ ...m, [x.row.key]: Math.max(1, x.packs - 1) }))} className="h-7 w-7 rounded-md bg-cream font-bold">−</button>
                          <span className="w-5 text-center text-sm font-semibold">{x.packs}</span>
                          <button type="button" aria-label="Más" onClick={() => setPacks((m) => ({ ...m, [x.row.key]: x.packs + 1 }))} className="h-7 w-7 rounded-md bg-cream font-bold">+</button>
                        </span>
                      </div>
                    </div>
                    <div className="ml-8 mt-1 flex flex-wrap gap-x-4 text-xs font-medium">
                      <button type="button" onClick={() => togglePantry(x.row.key, x.row.need.ingredient, true)} className="text-olive-dark hover:underline">Ya lo tengo en casa</button>
                      <button type="button" onClick={() => setEditing(editing === x.row.key ? null : x.row.key)} className="text-brand hover:underline">Cambiar producto</button>
                    </div>
                    {editing === x.row.key && (
                      <Picker
                        initial={x.row.need.ingredient}
                        onPick={(prod) => { setOverrides((o) => ({ ...o, [x.row.key]: { product: prod, packs: 1 } })); setPacks((m) => { const n = { ...m }; delete n[x.row.key]; return n; }); setEditing(null); }}
                        onClose={() => setEditing(null)}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          {noProduct.length > 0 && (
            <section className="rounded-2xl bg-amber-50 p-4">
              <h2 className="font-bold text-amber-900">Sin producto en este plan ({noProduct.length})</h2>
              <ul className="mt-2 flex flex-col gap-2">
                {noProduct.map((x) => (
                  <li key={x.row.key} className="rounded-xl bg-white p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <b className="capitalize">{x.row.need.ingredient}</b>
                      <span className="text-muted">{fmtQty(x.row.need)}</span>
                      <button type="button" onClick={() => setEditing(editing === x.row.key ? null : x.row.key)} className="ml-auto font-medium text-brand hover:underline">Buscar producto</button>
                      <button type="button" onClick={() => togglePantry(x.row.key, x.row.need.ingredient, true)} className="font-medium text-olive-dark hover:underline">Ya lo tengo</button>
                    </div>
                    {editing === x.row.key && (
                      <Picker initial={x.row.need.ingredient} onPick={(prod) => { setOverrides((o) => ({ ...o, [x.row.key]: { product: prod, packs: 1 } })); setEditing(null); }} onClose={() => setEditing(null)} />
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {inPantry.length > 0 && (
            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <button type="button" onClick={() => setShowPantry((v) => !v)} aria-expanded={showPantry} className="flex w-full items-center justify-between text-left">
                <span className="text-lg font-bold">Ya lo tienes en casa ({inPantry.length})</span>
                <span className="text-sm text-brand">{showPantry ? "Ocultar" : "Ver"}</span>
              </button>
              {showPantry && (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {inPantry.map((x) => (
                    <li key={x.row.key} className="inline-flex items-center gap-2 rounded-xl bg-olive-soft px-3 py-1.5 text-sm text-olive-dark">
                      <span className="capitalize">{x.row.need.ingredient}</span>
                      <button type="button" onClick={() => togglePantry(x.row.key, x.row.need.ingredient, false)} aria-label={`Comprar ${x.row.need.ingredient}`} title="Se me ha acabado: comprarlo">✕</button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {staples.length > 0 && (
            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <label className="flex items-center gap-3">
                <input type="checkbox" checked={withStaples} onChange={(e) => setWithStaples(e.target.checked)} className="h-5 w-5 accent-olive" />
                <span className="flex-1 text-lg font-bold">Tus básicos de cada semana ({staples.length})</span>
                <span className="font-bold">{euro(staples.reduce((a, s) => a + (s.product.price ?? 0) * s.quantity, 0))}</span>
              </label>
              <p className="ml-8 text-sm text-muted">{staples.map((s) => s.product.name).slice(0, 4).join(", ")}{staples.length > 4 ? "…" : ""} · <Link href="/despensa" className="text-brand hover:underline">Editar</Link></p>
            </section>
          )}
        </div>

        {/* Resumen */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-6">
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold">Tu compra de la semana</h2>
            <p className="mt-2 text-4xl font-bold">{euro(total)}</p>
            <p className="text-sm text-muted">{toBuy.length} productos{withStaples && staples.length > 0 ? ` + ${staples.length} básicos` : ""} · {storesUsed.map(nameOf).join(" y ") || "—"}</p>
            {budget !== null && (
              <div className="mt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Presupuesto semanal</span>
                  <span className="font-semibold">{euro(budget)}</span>
                </div>
                <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-cream-dark" role="progressbar" aria-valuenow={Math.round(total)} aria-valuemin={0} aria-valuemax={budget} aria-label="Gasto frente a presupuesto">
                  <div className={`h-full rounded-full ${over ? "bg-red-600" : "bg-olive"}`} style={{ width: `${Math.min(100, (total / budget) * 100)}%` }} />
                </div>
                <p className={`mt-2 text-sm ${over ? "text-red-700" : "text-olive-dark"}`}>
                  {over ? `Te pasas ${euro(total - budget)}. Marca lo que ya tengas o cambia algún plato por uno más barato.` : `Te sobran ${euro(budget - total)}.`}
                </p>
              </div>
            )}
            {budget === null && (
              <p className="mt-3 text-sm text-muted">¿Tienes un tope semanal? <Link href="/ajustes#cocina" className="text-brand hover:underline">Pon tu presupuesto</Link> y te avisamos si te pasas.</p>
            )}
            <button type="button" onClick={confirm} disabled={pending || (toBuy.length === 0 && staplesTotal === 0)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3.5 font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
              <CartIcon className="h-5 w-5" /> {pending ? "Añadiendo…" : "Añadir a mi lista"}
            </button>
          </section>
          {plans.length > 1 && plan !== "mixed" && (plans.find((p) => p.id === plan)?.total ?? 0) - cheapestTotal > 0.5 && (
            <section className="flex gap-3 rounded-2xl bg-olive-soft p-4 text-olive-dark">
              <PiggyIcon className="h-7 w-7 shrink-0" />
              <p className="text-sm"><b>Podrías ahorrar {euro((plans.find((p) => p.id === plan)?.total ?? 0) - cheapestTotal)}</b> con otro plan. Míralo arriba.</p>
            </section>
          )}
          <p className="flex items-start gap-2 text-xs text-muted"><CheckIcon className="mt-0.5 h-4 w-4 shrink-0" /> Los precios cuentan envases enteros, que es lo que pagas en caja. Lo que sobre de un envase te vale para otra semana.</p>
        </aside>
      </div>
    </main>
  );
}

function Picker({ initial, onPick, onClose }: { initial: string; onPick: (p: Product) => void; onClose: () => void }) {
  const [q, setQ] = useState(initial);
  const [results, setResults] = useState<Product[] | null>(null);
  const [pending, start] = useTransition();
  const run = (v: string) => {
    setQ(v);
    if (v.trim().length < 2) return setResults([]);
    start(async () => setResults(await searchProducts(v)));
  };
  return (
    <div className="ml-8 mt-2 rounded-xl bg-cream p-2">
      <div className="flex gap-2">
        <input autoFocus type="search" value={q} onChange={(e) => run(e.target.value)} onFocus={() => results === null && run(q)} placeholder="Buscar producto…" className="min-w-0 flex-1 rounded-lg border border-cream-dark bg-white px-3 py-2 text-sm outline-none focus:border-brand" />
        <button type="button" onClick={onClose} className="px-2 text-sm text-muted">Cerrar</button>
      </div>
      {pending && <p className="mt-1 text-xs text-muted">Buscando…</p>}
      <ul className="mt-2 flex max-h-64 flex-col gap-1 overflow-y-auto">
        {(results ?? []).slice(0, 12).map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => onPick(p)} className="w-full rounded-lg bg-white px-3 py-2 text-left text-sm hover:bg-brand-soft">
              <span className="line-clamp-1">{p.name}</span>
              <span className="text-xs text-muted">{superName(p.supermarket_id)} · {packSize(p.pack_size)} · {euro(p.price)} · {unitPrice(p.unit_price, p.unit)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function fmtQty(n: Need) {
  const q = Math.round(n.qty * 100) / 100;
  if (n.unit === "g" && q >= 1000) return `${(q / 1000).toLocaleString("es-ES")} kg`;
  if (n.unit === "ml" && q >= 1000) return `${(q / 1000).toLocaleString("es-ES")} L`;
  return `${q.toLocaleString("es-ES")} ${n.unit === "ud" ? (q === 1 ? "unidad" : "unidades") : n.unit}`;
}
