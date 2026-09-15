"use client";

import { useState, useTransition } from "react";
import { CartIcon, HeartIcon, PlusIcon } from "@/components/icons";
import type { Need } from "@/lib/menu";
import { addIngredientToList, addRecipeToList, toggleRecipeFavorite } from "@/lib/recipe-actions";

export function IngredientAddButton({ recipeId, need }: { recipeId: number; need: Need }) {
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          try {
            await addIngredientToList(recipeId, need);
            setFailed(false);
          } catch {
            setFailed(true);
          }
        })
      }
      className={`flex w-28 shrink-0 items-center justify-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold disabled:opacity-60 ${
        failed ? "bg-red-50 text-red-700" : "bg-brand-soft text-brand-dark hover:bg-brand hover:text-white"
      }`}
    >
      {failed ? "Sin producto" : pending ? "Añadiendo…" : <><PlusIcon className="h-3.5 w-3.5" /> Añadir</>}
    </button>
  );
}

export function AddAllButton({ recipeId, needs }: { recipeId: number; needs: Need[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <>
      <button
        type="button"
        disabled={pending || needs.length === 0}
        onClick={() =>
          start(async () => {
            try {
              await addRecipeToList(recipeId, needs);
            } catch {
              setError("No se han podido añadir los ingredientes.");
            }
          })
        }
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
      >
        <CartIcon className="h-5 w-5" />
        {pending ? "Añadiendo…" : needs.length === 0 ? "Todo está ya en tu lista" : "Añadir ingredientes a la compra"}
      </button>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </>
  );
}

export function FavoriteRecipeButton({ recipeId, initial, variant }: { recipeId: number; initial: boolean; variant: "icon" | "button" }) {
  const [fav, setFav] = useState(initial);
  const [pending, start] = useTransition();
  function toggle() {
    const next = !fav;
    setFav(next);
    start(async () => {
      try {
        await toggleRecipeFavorite(recipeId, next);
      } catch {
        setFav(!next);
      }
    });
  }
  if (variant === "icon") {
    return (
      <button type="button" onClick={toggle} disabled={pending} aria-pressed={fav} aria-label={fav ? "Quitar de favoritos" : "Guardar en favoritos"} className="mt-1 shrink-0 text-brand">
        <HeartIcon className={`h-8 w-8 ${fav ? "fill-brand" : ""}`} />
      </button>
    );
  }
  return (
    <button type="button" onClick={toggle} disabled={pending} aria-pressed={fav} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-cream-dark bg-white px-4 py-3 font-medium hover:bg-cream">
      <HeartIcon className={`h-5 w-5 text-brand ${fav ? "fill-brand" : ""}`} />
      {fav ? "Guardada en favoritos" : "Guardar en favoritos"}
    </button>
  );
}
