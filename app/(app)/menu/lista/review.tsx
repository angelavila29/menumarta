"use client";

import { useState, useTransition } from "react";
import { searchProducts } from "@/lib/actions";
import { confirmMenuListAction } from "@/lib/menu-actions";
import { euro, packSize, superName, unitPrice } from "@/lib/format";
import type { Need } from "@/lib/menu";
import type { Product } from "@/lib/types";

export type ReviewRow = { need: Need; product: Product | null; fromMap: boolean; quantity: number };

type State = ReviewRow & { skip: boolean };

export function Review({ rows, servings }: { rows: ReviewRow[]; servings: number }) {
  const [state, setState] = useState<State[]>(rows.map((r) => ({ ...r, skip: r.product === null })));
  const [editing, setEditing] = useState<number | null>(null);
  const [pending, start] = useTransition();

  const chosen = state.filter((r) => !r.skip && r.product);
  const total = chosen.reduce((a, r) => a + (r.product!.price ?? 0) * r.quantity, 0);

  function update(i: number, patch: Partial<State>) {
    setState((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  }

  function confirm() {
    start(() =>
      confirmMenuListAction(
        chosen.map((r) => ({ ingredient: r.need.ingredient, productId: r.product!.id, quantity: r.quantity }))
      )
    );
  }

  return (
    <main>
      <h1 className="mb-1 text-2xl font-bold">¿Estos productos?</h1>
      <p className="mb-4 text-sm text-zinc-500">
        Para {servings} personas. Revisa lo dudoso, cambia lo que quieras y confirma. Lo que cambies se recordará.
      </p>

      <ul className="grid gap-2 md:grid-cols-2">
        {state.map((r, i) => (
          <li key={`${r.need.ingredient}-${r.need.unit}`} className={`rounded-xl border border-zinc-200 bg-white p-3 ${r.skip ? "opacity-50" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold capitalize">{r.need.ingredient}</p>
                <p className="text-xs text-zinc-500">
                  Necesitas {fmtQty(r.need)}
                  {r.fromMap && " · elegido otras veces"}
                </p>
              </div>
              <label className="flex shrink-0 items-center gap-1 text-xs text-zinc-500">
                <input type="checkbox" checked={!r.skip} onChange={(e) => update(i, { skip: !e.target.checked })} className="h-5 w-5 accent-green-600" />
                añadir
              </label>
            </div>

            {r.product ? (
              <div className="mt-2 flex items-center gap-2">
                <div className="min-w-0 flex-1 text-sm">
                  <p className="line-clamp-2">{r.product.name}</p>
                  <p className="text-xs text-zinc-500">
                    {superName(r.product.supermarket_id)} · {packSize(r.product.pack_size)} · {euro(r.product.price)} ·{" "}
                    {unitPrice(r.product.unit_price, r.product.unit)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" onClick={() => update(i, { quantity: Math.max(1, r.quantity - 1) })} className="h-8 w-8 rounded-lg bg-zinc-100 font-bold" aria-label="Menos">−</button>
                  <span className="w-5 text-center font-semibold">{r.quantity}</span>
                  <button type="button" onClick={() => update(i, { quantity: r.quantity + 1 })} className="h-8 w-8 rounded-lg bg-zinc-100 font-bold" aria-label="Más">+</button>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-amber-700">No he encontrado nada parecido. Búscalo tú:</p>
            )}

            {editing === i ? (
              <Picker
                onPick={(p) => {
                  update(i, { product: p, skip: false, quantity: 1, fromMap: false });
                  setEditing(null);
                }}
                onClose={() => setEditing(null)}
              />
            ) : (
              <button type="button" onClick={() => setEditing(i)} className="mt-2 text-sm text-green-700 underline">
                {r.product ? "Cambiar producto" : "Buscar producto"}
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-5 rounded-xl bg-white p-3 shadow-sm md:flex md:items-center md:justify-between md:p-5">
        <p className="text-sm text-zinc-500">{chosen.length} productos</p>
        <p className="text-lg"><span className="text-zinc-500">Total aprox.: </span><span className="font-bold">{euro(total)}</span></p>
      </div>
      <button
        type="button"
        disabled={pending || chosen.length === 0}
        onClick={confirm}
        className="mt-3 w-full rounded-xl bg-green-600 px-4 py-3 text-lg font-semibold text-white active:bg-green-700 disabled:opacity-60 md:w-auto md:px-8"
      >
        {pending ? "Añadiendo…" : "Añadir a la lista"}
      </button>
    </main>
  );
}

function Picker({ onPick, onClose }: { onPick: (p: Product) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [pending, start] = useTransition();

  function onChange(v: string) {
    setQ(v);
    if (v.trim().length < 2) return setResults([]);
    start(async () => setResults(await searchProducts(v)));
  }

  return (
    <div className="mt-2 rounded-lg bg-zinc-50 p-2">
      <div className="flex gap-2">
        <input
          autoFocus
          type="search"
          value={q}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Buscar producto…"
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2"
        />
        <button type="button" onClick={onClose} className="px-2 text-sm text-zinc-500">Cerrar</button>
      </div>
      {pending && <p className="mt-1 text-xs text-zinc-500">Buscando…</p>}
      <ul className="mt-2 flex max-h-64 flex-col gap-1 overflow-y-auto">
        {results.slice(0, 12).map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => onPick(p)} className="w-full rounded-lg bg-white px-3 py-2 text-left text-sm active:bg-green-50">
              <span className="line-clamp-1">{p.name}</span>
              <span className="text-xs text-zinc-500">
                {superName(p.supermarket_id)} · {euro(p.price)} · {unitPrice(p.unit_price, p.unit)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function fmtQty(n: Need) {
  const q = Math.round(n.qty * 100) / 100;
  if (n.unit === "g" && q >= 1000) return `${(q / 1000).toString().replace(".", ",")} kg`;
  if (n.unit === "ml" && q >= 1000) return `${(q / 1000).toString().replace(".", ",")} L`;
  return `${q.toString().replace(".", ",")} ${n.unit}`;
}
