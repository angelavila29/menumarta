"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CartIcon, CheckIcon, HeartIcon, PlusIcon } from "@/components/icons";
import { addToList, toggleFavorite } from "@/lib/actions";

export function AddToListControl({ productId }: { productId: number }) {
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <div className="flex items-center rounded-xl border border-cream-dark bg-white">
        <button type="button" aria-label="Menos" onClick={() => setQty((q) => Math.max(1, q - 1))} className="h-11 w-11 text-xl text-brand">−</button>
        <span className="w-8 text-center font-semibold" aria-live="polite">{qty}</span>
        <button type="button" aria-label="Más" onClick={() => setQty((q) => Math.min(99, q + 1))} className="h-11 w-11 text-xl text-brand">+</button>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await addToList(productId, qty);
            setAdded(true);
            router.refresh();
            setTimeout(() => setAdded(false), 2000);
          })
        }
        className={`flex min-w-48 flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 font-semibold text-white disabled:opacity-60 ${added ? "bg-olive" : "bg-brand hover:bg-brand-dark"}`}
      >
        {added ? <><CheckIcon className="h-5 w-5" /> Añadido a la compra</> : <><CartIcon className="h-5 w-5" /> Añadir a la compra</>}
      </button>
    </div>
  );
}

export function FavoriteButton({ productId, initial }: { productId: number; initial: boolean }) {
  const [fav, setFav] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={fav}
      onClick={() => {
        const next = !fav;
        setFav(next);
        start(async () => {
          try {
            await toggleFavorite(productId, next);
          } catch {
            setFav(!next);
          }
        });
      }}
      className="flex items-center gap-2 rounded-xl border border-cream-dark bg-white px-4 py-2.5 text-sm font-medium hover:bg-cream"
    >
      <HeartIcon className={`h-5 w-5 text-brand ${fav ? "fill-brand" : ""}`} />
      {fav ? "En favoritos" : "Añadir a favoritos"}
    </button>
  );
}

export function QuickAddButton({ productId, name }: { productId: number; name: string }) {
  const router = useRouter();
  const [added, setAdded] = useState(false);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-label={`Añadir ${name} a la compra`}
      onClick={() =>
        start(async () => {
          await addToList(productId, 1);
          setAdded(true);
          router.refresh();
          setTimeout(() => setAdded(false), 1500);
        })
      }
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white disabled:opacity-60 ${added ? "bg-olive" : "bg-brand hover:bg-brand-dark"}`}
    >
      {added ? <CheckIcon className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
    </button>
  );
}
