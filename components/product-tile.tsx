"use client";

import { useState, useTransition } from "react";
import { addToList, toggleFavorite } from "@/lib/actions";
import { euro, packSize, superName, unitPrice } from "@/lib/format";
import type { SearchResult } from "@/lib/types";
import { ChainLogo } from "./chain-logo";
import { CheckIcon, HeartIcon, PlusIcon } from "./icons";

/** Tarjeta de producto del buscador, en cuadrícula o en lista. */
export function ProductTile({ result, initialFavorite, view }: { result: SearchResult; initialFavorite: boolean; view: "grid" | "list" }) {
  const p = result.product;
  const [fav, setFav] = useState(initialFavorite);
  const [added, setAdded] = useState(false);
  const [pending, start] = useTransition();

  function onFav() {
    const next = !fav;
    setFav(next);
    start(async () => {
      try {
        await toggleFavorite(p.id, next);
      } catch {
        setFav(!next);
      }
    });
  }
  function onAdd() {
    start(async () => {
      await addToList(p.id, 1);
      setAdded(true);
      setTimeout(() => setAdded(false), 1500);
    });
  }

  const chain = (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-cream px-1.5 py-0.5 text-xs text-ink">
      <ChainLogo id={p.supermarket_id} size={16} /> {superName(p.supermarket_id)}
    </span>
  );
  const favBtn = (
    <button
      type="button"
      onClick={onFav}
      aria-label={fav ? "Quitar de favoritos" : "Añadir a favoritos"}
      aria-pressed={fav}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cream-dark text-brand hover:bg-brand-soft"
    >
      <HeartIcon className={`h-5 w-5 ${fav ? "fill-brand" : ""}`} />
    </button>
  );
  const addBtn = (
    <button
      type="button"
      onClick={onAdd}
      disabled={pending}
      className={`flex w-full flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 font-semibold text-white disabled:opacity-60 ${added ? "bg-olive" : "bg-brand hover:bg-brand-dark"}`}
    >
      {added ? <><CheckIcon className="h-4 w-4" /> Añadido</> : <><PlusIcon className="h-4 w-4" /> Añadir</>}
    </button>
  );
  const image = (size: string, emoji: string) => (
    <div className={`relative flex shrink-0 items-center justify-center ${size}`}>
      {p.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.image_url} alt="" className="h-full w-full object-contain" loading="lazy" />
      ) : (
        <span className={emoji}>🛒</span>
      )}
      {p.is_discounted && (
        <span className="absolute left-0 top-0 rounded-md bg-brand px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">Oferta</span>
      )}
    </div>
  );

  if (view === "list") {
    return (
      <li className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
        {image("h-16 w-16", "text-3xl")}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 font-semibold leading-tight">{p.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
            {chain}
            {p.pack_size && <span>{packSize(p.pack_size)}</span>}
            <span>{unitPrice(p.unit_price, p.unit)}</span>
          </div>
          <div className="mt-1"><CompareLabel compare={result.compare} /></div>
        </div>
        <p className="shrink-0 text-lg font-bold">{euro(p.price)}</p>
        <div className="flex shrink-0 items-center gap-2">
          {favBtn}
          <div className="hidden w-28 sm:block">{addBtn}</div>
          <button type="button" onClick={onAdd} disabled={pending} aria-label="Añadir a la lista" className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white sm:hidden">
            {added ? <CheckIcon className="h-5 w-5" /> : <PlusIcon className="h-5 w-5" />}
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex flex-col rounded-2xl bg-white p-3 shadow-sm">
      {image("h-32 md:h-36", "text-5xl")}
      <p className="mt-2 line-clamp-2 min-h-[2.6em] font-semibold leading-tight">{p.name}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
        {chain}
        {p.pack_size && <span>{packSize(p.pack_size)}</span>}
      </div>
      <p className="mt-2 text-xl font-bold">{euro(p.price)}</p>
      <p className="text-xs text-muted">{unitPrice(p.unit_price, p.unit) || " "}</p>
      <div className="mt-1.5 min-h-6"><CompareLabel compare={result.compare} /></div>
      <div className="mt-auto flex gap-2 pt-3">
        {favBtn}
        {addBtn}
      </div>
    </li>
  );
}

function CompareLabel({ compare }: { compare: SearchResult["compare"] }) {
  if (!compare) return null;
  const name = superName(compare.chain);
  if (compare.diff > 0.01) {
    return <span className="inline-block rounded-md bg-olive-soft px-2 py-0.5 text-xs font-medium text-olive-dark">{euro(compare.diff)} más barato que en {name}</span>;
  }
  if (compare.diff < -0.01) {
    return <span className="inline-block rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">{euro(-compare.diff)} más caro que en {name}</span>;
  }
  return <span className="inline-block rounded-md bg-olive-soft px-2 py-0.5 text-xs font-medium text-olive-dark">Mejor precio · igual en {name}</span>;
}
