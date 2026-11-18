"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CartIcon, CheckIcon, HeartIcon, PlusIcon } from "@/components/icons";
import { addToList, toggleFavorite } from "@/lib/actions";
import { createPreparedDish } from "@/lib/prepared-actions";

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

/** "Usar como plato preparado": da de alta un congelado o un plato listo como comida del menú. */
export function PreparedButton({ productId, defaultName, defaultGrams }: { productId: number; defaultName: string; defaultGrams: number | null }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [meal, setMeal] = useState("ambas");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [grams, setGrams] = useState(defaultGrams ? String(defaultGrams) : "");
  const [servings, setServings] = useState(1);
  const [minutes, setMinutes] = useState("10");
  const [howTo, setHowTo] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const n = (s: string) => Number(s.replace(",", "."));
  const perServing = kcal && grams ? Math.round((n(kcal) * n(grams)) / 100 / servings) : null;
  const field = "w-full rounded-xl border border-cream-dark bg-white px-3 py-2.5 outline-none focus:border-brand";

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-olive/40 bg-olive-soft px-4 py-2.5 text-sm font-semibold text-olive-dark hover:bg-olive/15">
        🧊 Usar como plato preparado
      </button>
    );
  }
  return (
    <div role="dialog" aria-modal="true" aria-label="Plato preparado" className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          start(async () => {
            const res = await createPreparedDish({
              productId,
              name,
              meal,
              servings,
              kcal100: n(kcal),
              protein100: protein ? n(protein) : 0,
              carbs100: carbs ? n(carbs) : 0,
              packGrams: n(grams),
              minutes: minutes ? n(minutes) : null,
              howTo,
            });
            if (res && !res.ok) setError(res.error);
          });
        }}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Plato preparado</h2>
            <p className="text-sm text-muted">Para ponerlo en el menú como cualquier receta. Lo verá todo el mundo.</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar" className="h-9 w-9 shrink-0 rounded-full bg-cream text-lg">×</button>
        </div>
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium">
            Nombre
            <div className="mt-1 flex items-center gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
              <span className="shrink-0 text-sm text-muted">(preparado)</span>
            </div>
          </label>
          <fieldset>
            <legend className="text-sm font-medium">¿Para cuándo?</legend>
            <div className="mt-1 flex gap-2">
              {[["comida", "Comida"], ["cena", "Cena"], ["ambas", "Las dos"]].map(([id, label]) => (
                <button key={id} type="button" aria-pressed={meal === id} onClick={() => setMeal(id)} className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium ${meal === id ? "border-brand bg-brand text-white" : "border-cream-dark bg-white"}`}>
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          <div>
            <p className="text-sm font-medium">De la etiqueta, por 100 g</p>
            <div className="mt-1 grid grid-cols-3 gap-2">
              <label className="text-xs text-muted">Calorías (kcal)*<input inputMode="decimal" required value={kcal} onChange={(e) => setKcal(e.target.value)} className={field} /></label>
              <label className="text-xs text-muted">Proteínas (g)<input inputMode="decimal" value={protein} onChange={(e) => setProtein(e.target.value)} className={field} /></label>
              <label className="text-xs text-muted">Hidratos (g)<input inputMode="decimal" value={carbs} onChange={(e) => setCarbs(e.target.value)} className={field} /></label>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <label className="text-xs text-muted">Envase (g)*<input inputMode="decimal" required value={grams} onChange={(e) => setGrams(e.target.value)} className={field} /></label>
            <label className="text-xs text-muted">
              Raciones
              <select value={servings} onChange={(e) => setServings(Number(e.target.value))} className={field}>
                {[1, 2, 3, 4, 5, 6].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="text-xs text-muted">Minutos<input inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} className={field} /></label>
          </div>
          {perServing !== null && Number.isFinite(perServing) && (
            <p className="rounded-xl bg-cream px-3 py-2 text-sm">Por ración: <strong>{perServing} kcal</strong></p>
          )}
          <label className="text-sm font-medium">
            Cómo se hace <span className="font-normal text-muted">(opcional)</span>
            <textarea value={howTo} onChange={(e) => setHowTo(e.target.value)} rows={2} placeholder="Sartén con un poco de aceite, 6-8 minutos sin descongelar" className={`${field} mt-1 text-sm`} />
          </label>
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={pending} className="rounded-xl bg-brand px-5 py-3 font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
            {pending ? "Guardando…" : "Guardar plato"}
          </button>
        </div>
      </form>
    </div>
  );
}
