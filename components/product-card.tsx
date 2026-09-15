"use client";

import { useState, useTransition } from "react";
import { addToList, toggleFavorite } from "@/lib/actions";
import { euro, packSize, superName, superStyle, unitPrice } from "@/lib/format";
import type { Product } from "@/lib/types";

export function ProductCard({
  product,
  initialFavorite,
  onRemovedFromFavorites,
}: {
  product: Product;
  initialFavorite: boolean;
  onRemovedFromFavorites?: () => void;
}) {
  const [fav, setFav] = useState(initialFavorite);
  const [added, setAdded] = useState(false);
  const [pending, startTransition] = useTransition();

  function onFav() {
    const next = !fav;
    setFav(next);
    startTransition(async () => {
      try {
        await toggleFavorite(product.id, next);
        if (!next) onRemovedFromFavorites?.();
      } catch {
        setFav(!next);
      }
    });
  }

  function onAdd() {
    startTransition(async () => {
      await addToList(product.id, 1);
      setAdded(true);
      setTimeout(() => setAdded(false), 1500);
    });
  }

  return (
    <li className="flex gap-3 rounded-xl border border-zinc-200 bg-white p-3">
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-zinc-100">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image_url} alt="" className="h-full w-full object-contain" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl">🛒</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-medium leading-snug">{product.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-600">
          <span className={`rounded px-1.5 py-0.5 font-medium ${superStyle(product.supermarket_id).badge}`}>
            {superName(product.supermarket_id)}
          </span>
          {product.pack_size && <span>{packSize(product.pack_size)}</span>}
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-lg font-bold">{euro(product.price)}</span>
          <span className="text-xs text-zinc-500">{unitPrice(product.unit_price, product.unit)}</span>
        </div>
      </div>
      <div className="flex shrink-0 flex-col justify-between">
        <button
          type="button"
          onClick={onFav}
          aria-label={fav ? "Quitar de favoritos" : "Añadir a favoritos"}
          className={`rounded-lg px-2 py-1 text-xl ${fav ? "text-amber-500" : "text-zinc-300"}`}
        >
          ★
        </button>
        <button
          type="button"
          onClick={onAdd}
          disabled={pending}
          className={`rounded-lg px-2 py-1 text-sm font-semibold ${
            added ? "bg-green-600 text-white" : "bg-green-100 text-green-800"
          }`}
        >
          {added ? "✓" : "+ lista"}
        </button>
      </div>
    </li>
  );
}
