"use client";

import { useState, useTransition } from "react";
import { ChainLogo } from "@/components/chain-logo";
import { CheckIcon, SearchIcon } from "@/components/icons";
import { searchProducts } from "@/lib/actions";
import { euro, packSize, superName } from "@/lib/format";
import { addStaplesToList, setPantryItem, setStaple } from "@/lib/pantry-actions";
import type { Product } from "@/lib/types";

type Staple = { product: Product; quantity: number };

export function Pantry({ ingredients, commonCount, have: initialHave, staples: initialStaples }: { ingredients: string[]; commonCount: number; have: string[]; staples: Staple[] }) {
  const [have, setHave] = useState(new Set(initialHave));
  const [staples, setStaples] = useState(initialStaples);
  const [filter, setFilter] = useState("");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const [searching, startSearch] = useTransition();

  function toggle(name: string) {
    const has = !have.has(name);
    setHave((s) => { const n = new Set(s); if (has) n.add(name); else n.delete(name); return n; });
    start(() => setPantryItem(name, has));
  }
  function search(v: string) {
    setQ(v);
    if (v.trim().length < 2) return setResults([]);
    startSearch(async () => setResults(await searchProducts(v)));
  }
  function changeStaple(p: Product, quantity: number) {
    setStaples((xs) => (quantity <= 0 ? xs.filter((x) => x.product.id !== p.id) : xs.some((x) => x.product.id === p.id) ? xs.map((x) => (x.product.id === p.id ? { ...x, quantity } : x)) : [...xs, { product: p, quantity }]));
    start(() => setStaple(p.id, quantity));
  }

  const f = filter.trim().toLowerCase();
  const shown = ingredients.filter((i) => !f || i.includes(f));
  const weekly = staples.reduce((a, s) => a + (s.product.price ?? 0) * s.quantity, 0);

  return (
    <main>
      <h1 className="text-3xl font-bold md:text-5xl">Despensa</h1>
      <p className="mt-1 text-muted md:text-lg">Lo que ya tienes no se compra. Lo que compras siempre entra solo en la lista.</p>

      <div className="mt-5 grid gap-5 lg:grid-cols-2 lg:items-start">
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">Lo que ya tengo en casa ({have.size})</h2>
          <p className="text-sm text-muted">Al crear la lista del menú, estos ingredientes no se añaden. Desmárcalo cuando se te acabe algo.</p>
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar ingredientes…" aria-label="Filtrar ingredientes" className="mt-3 w-full rounded-xl border border-cream-dark bg-white px-3 py-2.5 outline-none focus:border-brand" />
          <ul className="mt-3 flex flex-wrap gap-2">
            {shown.map((name, i) => {
              const on = have.has(name);
              return (
                <li key={name} className={!f && i === commonCount ? "basis-full border-t border-cream-dark pt-2" : ""}>
                  <button type="button" aria-pressed={on} onClick={() => toggle(name)} className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm capitalize ${on ? "border-olive bg-olive-soft font-medium text-olive-dark" : "border-cream-dark bg-white hover:bg-cream"}`}>
                    {on && <CheckIcon className="h-3.5 w-3.5" />} {name}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Mis básicos de cada semana ({staples.length})</h2>
              <p className="text-sm text-muted">Leche, pan, café, papel… Entran solos al organizar la compra.</p>
            </div>
            {staples.length > 0 && <span className="shrink-0 text-lg font-bold">{euro(weekly)}</span>}
          </div>

          <ul className="mt-3 flex flex-col gap-2">
            {staples.map((s) => (
              <li key={s.product.id} className="flex items-center gap-3 rounded-xl border border-cream-dark p-2.5">
                <ChainLogo id={s.product.supermarket_id} size={24} />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-1 text-sm font-medium">{s.product.name}</span>
                  <span className="text-xs text-muted">{superName(s.product.supermarket_id)} · {packSize(s.product.pack_size)} · {euro(s.product.price)}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <button type="button" aria-label="Menos" onClick={() => changeStaple(s.product, s.quantity - 1)} className="h-7 w-7 rounded-md bg-cream font-bold">−</button>
                  <span className="w-5 text-center text-sm font-semibold">{s.quantity}</span>
                  <button type="button" aria-label="Más" onClick={() => changeStaple(s.product, s.quantity + 1)} className="h-7 w-7 rounded-md bg-cream font-bold">+</button>
                </span>
              </li>
            ))}
          </ul>

          <div className="relative mt-3">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
            <input type="search" value={q} onChange={(e) => search(e.target.value)} placeholder="Añadir un básico: leche, pan de molde, café…" aria-label="Buscar producto para añadir como básico" className="w-full rounded-xl border border-cream-dark bg-white py-2.5 pl-10 pr-3 outline-none focus:border-brand" />
          </div>
          {searching && <p className="mt-1 text-xs text-muted">Buscando…</p>}
          <ul className="mt-2 flex max-h-72 flex-col gap-1 overflow-y-auto">
            {results.slice(0, 10).map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => { changeStaple(p, 1); setQ(""); setResults([]); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-brand-soft">
                  <ChainLogo id={p.supermarket_id} size={18} />
                  <span className="min-w-0 flex-1"><span className="line-clamp-1">{p.name}</span><span className="text-xs text-muted">{packSize(p.pack_size)} · {euro(p.price)}</span></span>
                  <span className="text-brand">+ Añadir</span>
                </button>
              </li>
            ))}
          </ul>

          {staples.length > 0 && (
            <button
              type="button"
              disabled={pending}
              onClick={() => start(async () => { const n = await addStaplesToList(); setMsg(n === 0 ? "Ya estaban todos en tu lista." : `${n} ${n === 1 ? "básico añadido" : "básicos añadidos"} a tu lista.`); })}
              className="mt-4 w-full rounded-xl border border-brand px-4 py-2.5 font-semibold text-brand hover:bg-brand-soft disabled:opacity-60"
            >
              Añadir mis básicos a la lista ahora
            </button>
          )}
          {msg && <p role="status" className="mt-2 text-center text-sm text-olive-dark">{msg}</p>}
        </section>
      </div>
    </main>
  );
}
