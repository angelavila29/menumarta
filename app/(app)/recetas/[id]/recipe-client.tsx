"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CartIcon, HeartIcon, PlusIcon } from "@/components/icons";
import type { Need } from "@/lib/menu";
import { addIngredientToList, addRecipeToList, toggleRecipeFavorite } from "@/lib/recipe-actions";
import { addRecipeToMenu, deleteRecipe } from "@/lib/recipe-bank-actions";

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
  const router = useRouter();
  return (
    <>
      <button
        type="button"
        disabled={pending || needs.length === 0}
        onClick={() =>
          start(async () => {
            try {
              const { to } = await addRecipeToList(recipeId, needs);
              router.push(to);
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

const DAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

/** Coloca la receta en un hueco del menú de esta semana o de la siguiente. */
export function AddToMenuControl({ recipeId, meal, todayIndex }: { recipeId: number; meal: string; todayIndex: number }) {
  const [open, setOpen] = useState(false);
  const [week, setWeek] = useState(0);
  const [day, setDay] = useState(todayIndex);
  const [slot, setSlot] = useState<"comida" | "cena">(meal === "cena" ? "cena" : "comida");
  const [done, setDone] = useState("");
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <>
        <button type="button" onClick={() => { setOpen(true); setDone(""); }} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-brand bg-white px-4 py-3 font-medium text-brand hover:bg-brand-soft">
          <PlusIcon className="h-5 w-5" /> Añadir a mi menú
        </button>
        {done && <p role="status" className="mt-1 text-center text-xs text-olive-dark">{done}</p>}
      </>
    );
  }
  return (
    <div className="mt-2 rounded-xl border border-brand bg-brand-soft/40 p-3">
      <p className="mb-2 text-sm font-semibold">¿Cuándo la quieres?</p>
      <div className="grid grid-cols-2 gap-2">
        <select value={week} onChange={(e) => setWeek(Number(e.target.value))} aria-label="Semana" className="rounded-lg border border-cream-dark bg-white px-2 py-2 text-sm">
          <option value={0}>Esta semana</option>
          <option value={1}>La semana que viene</option>
        </select>
        <select value={day} onChange={(e) => setDay(Number(e.target.value))} aria-label="Día" className="rounded-lg border border-cream-dark bg-white px-2 py-2 text-sm">
          {DAY_NAMES.map((d, i) => <option key={d} value={i}>{d}</option>)}
        </select>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {(["comida", "cena"] as const).map((m) => (
          <button key={m} type="button" aria-pressed={slot === m} onClick={() => setSlot(m)} className={`rounded-lg border px-2 py-2 text-sm font-medium ${slot === m ? "border-brand bg-brand text-white" : "border-cream-dark bg-white"}`}>
            {m === "comida" ? "Comida" : "Cena"}
          </button>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await addRecipeToMenu(recipeId, day, slot, week);
              setDone(`Añadida: ${slot} del ${DAY_NAMES[day].toLowerCase()}${week === 1 ? " de la semana que viene" : ""}.`);
              setOpen(false);
            })
          }
          className="flex-1 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {pending ? "Añadiendo…" : "Poner en el menú"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm text-muted hover:text-ink">Cancelar</button>
      </div>
    </div>
  );
}

export function DeleteRecipeButton({ recipeId }: { recipeId: number }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm("¿Borrar esta receta? No se puede deshacer.")) start(() => deleteRecipe(recipeId));
      }}
      className="rounded-xl px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50"
    >
      {pending ? "Borrando…" : "Borrar"}
    </button>
  );
}
