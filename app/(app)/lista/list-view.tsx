"use client";

import { useState, useTransition } from "react";
import { clearChecked, removeItem, setItemChecked, setItemQuantity } from "@/lib/actions";
import { euro, packSize, superName, superStyle, unitPrice } from "@/lib/format";
import type { Product } from "@/lib/types";

export type ListItem = {
  id: number;
  quantity: number;
  checked: boolean;
  product: Product;
  cheaper: { name: string; supermarket_id: string; unit_price: number; unit: string; price: number | null } | null;
};

function lineTotal(i: ListItem) {
  return (i.product.price ?? 0) * i.quantity;
}

type Chain = { id: string; name: string; has_prices: boolean };

export function ListView({ items, chains: userChains }: { items: ListItem[]; chains: Chain[] }) {
  const [pending, startTransition] = useTransition();
  const [shared, setShared] = useState<"" | "ok" | "copiado">("");

  // Totales por supermercado (todos los productos, tachados incluidos)
  const totals: Record<string, number> = {};
  for (const i of items) totals[i.product.supermarket_id] = (totals[i.product.supermarket_id] ?? 0) + lineTotal(i);
  const grand = Object.values(totals).reduce((a, b) => a + b, 0);
  // Cadenas a mostrar: las del usuario con precios, más cualquiera que tenga productos en la lista
  const nameOf = (id: string) => userChains.find((c) => c.id === id)?.name ?? superName(id);
  const chains = Array.from(
    new Set([...userChains.filter((c) => c.has_prices).map((c) => c.id), ...Object.keys(totals)])
  );
  const checkedCount = items.filter((i) => i.checked).length;

  const chainsWithItems = chains.filter((c) => items.some((i) => i.product.supermarket_id === c));

  function share(onlyChain?: string) {
    const text = onlyChain
      ? buildShareText(items.filter((i) => i.product.supermarket_id === onlyChain), [onlyChain], totals, totals[onlyChain] ?? 0)
      : buildShareText(items, chains, totals, grand);
    startTransition(async () => {
      if (typeof navigator !== "undefined" && navigator.share) {
        try {
          await navigator.share({ title: "Lista de la compra", text });
          setShared("ok");
          return;
        } catch {
          /* cancelado: probamos con el portapapeles */
        }
      }
      await navigator.clipboard.writeText(text);
      setShared("copiado");
      setTimeout(() => setShared(""), 2000);
    });
  }

  const summary = (
    <div className="mb-4 rounded-xl bg-white p-3 shadow-sm md:flex md:items-center md:justify-between md:gap-6 md:p-4">
      <div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {chains.map((c) => (
            <div key={c}>
              <span className="text-zinc-500">{nameOf(c)}: </span>
              <span className="font-semibold">{euro(totals[c] ?? 0)}</span>
            </div>
          ))}
        </div>
        <div className="mt-1 text-lg">
          <span className="text-zinc-500">Total: </span>
          <span className="font-bold">{euro(grand)}</span>
        </div>
      </div>
        {items.length > 0 && (
          <div className="hidden gap-2 md:flex">
            {checkedCount > 0 && (
              <button type="button" disabled={pending} onClick={() => startTransition(() => clearChecked())} className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 font-medium text-zinc-700">
                Vaciar comprados ({checkedCount})
              </button>
            )}
            <button type="button" onClick={() => share()} className="rounded-xl bg-brand px-5 py-2.5 font-semibold text-white active:bg-brand-dark">
              {shared === "copiado" ? "Copiado ✓" : "Compartir todo"}
            </button>
          </div>
        )}
      </div>
  );

  return (
    <main>
      <h1 className="mb-3 text-2xl font-bold">Lista</h1>
      {summary}
      {items.length === 0 ? (
        <p className="text-zinc-600">Tu lista está vacía. Añade productos desde el buscador o favoritos.</p>
      ) : (
        <div className={`grid gap-4 ${chainsWithItems.length > 1 ? "lg:grid-cols-2" : ""}`}>
          {chainsWithItems.map((c) => {
            const mine = items.filter((i) => i.product.supermarket_id === c);
            return (
              <section key={c} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                <header className={`flex items-center justify-between px-4 py-3 text-white ${superStyle(c).band}`}>
                  <span className="text-lg font-bold">{nameOf(c)}</span>
                  <span className="text-sm">
                    {mine.length} {mine.length === 1 ? "producto" : "productos"} · <b>{euro(totals[c] ?? 0)}</b>
                  </span>
                </header>
                <ul className="flex flex-col gap-2 p-3">
                  {mine.map((i) => (
                    <Row key={i.id} item={i} disabled={pending} start={startTransition} />
                  ))}
                </ul>
                <footer className="border-t border-zinc-100 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => share(c)}
                    className="text-sm font-medium text-brand underline"
                  >
                    Compartir solo la lista de {nameOf(c)}
                  </button>
                </footer>
              </section>
            );
          })}
        </div>
      )}

      {items.length > 0 && (
        <div className="mt-6 flex flex-col gap-2 md:hidden">
          <button
            type="button"
            onClick={() => share()}
            className="rounded-xl bg-brand px-4 py-3 text-lg font-semibold text-white active:bg-brand-dark"
          >
            {shared === "copiado" ? "Copiado al portapapeles ✓" : "Compartir"}
          </button>
          {checkedCount > 0 && (
            <button
              type="button"
              disabled={pending}
              onClick={() => startTransition(() => clearChecked())}
              className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-lg font-medium text-zinc-700"
            >
              Vaciar comprados ({checkedCount})
            </button>
          )}
        </div>
      )}
    </main>
  );
}

function Row({
  item,
  disabled,
  start,
}: {
  item: ListItem;
  disabled: boolean;
  start: (fn: () => Promise<void>) => void;
}) {
  const p = item.product;
  return (
    <li
      className={`rounded-xl border border-zinc-200 bg-zinc-50 p-3 ${item.checked ? "opacity-60" : ""}`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={item.checked}
          disabled={disabled}
          onChange={(e) => start(() => setItemChecked(item.id, e.target.checked))}
          className="mt-1 h-6 w-6 shrink-0 accent-brand"
          aria-label="Comprado"
        />
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium leading-snug ${item.checked ? "line-through" : ""}`}>{p.name}</p>
          <p className="text-xs text-zinc-500">
            {packSize(p.pack_size)} · {euro(p.price)} · {unitPrice(p.unit_price, p.unit)}
          </p>
          {item.cheaper && !item.checked && (
            <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
              En {superName(item.cheaper.supermarket_id)}: {item.cheaper.name} a{" "}
              {unitPrice(item.cheaper.unit_price, item.cheaper.unit)}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="font-bold">{euro(lineTotal(item))}</p>
          <div className="mt-1 flex items-center justify-end gap-1">
            <button
              type="button"
              disabled={disabled}
              onClick={() => start(() => setItemQuantity(item.id, item.quantity - 1))}
              className="h-8 w-8 rounded-lg bg-zinc-100 text-lg font-bold"
              aria-label="Menos"
            >
              −
            </button>
            <span className="w-6 text-center font-semibold">{item.quantity}</span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => start(() => setItemQuantity(item.id, item.quantity + 1))}
              className="h-8 w-8 rounded-lg bg-zinc-100 text-lg font-bold"
              aria-label="Más"
            >
              +
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => start(() => removeItem(item.id))}
              className="ml-1 h-8 w-8 rounded-lg text-zinc-400"
              aria-label="Borrar"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

function buildShareText(items: ListItem[], chains: string[], totals: Record<string, number>, grand: number) {
  const lines: string[] = ["🛒 Lista de la compra", ""];
  for (const c of chains) {
    const mine = items.filter((i) => i.product.supermarket_id === c);
    if (mine.length === 0) continue;
    lines.push(`*${superName(c)}* — ${euro(totals[c] ?? 0)}`);
    for (const i of mine) {
      const qty = i.quantity !== 1 ? `${i.quantity}× ` : "";
      lines.push(`${i.checked ? "✅" : "▢"} ${qty}${i.product.name} (${euro(lineTotal(i))})`);
    }
    lines.push("");
  }
  lines.push(`Total: ${euro(grand)}`);
  return lines.join("\n");
}
