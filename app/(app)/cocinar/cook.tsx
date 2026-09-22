"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ChainLogo } from "@/components/chain-logo";
import { FoodInput } from "@/components/food-input";
import { CartIcon, CheckIcon } from "@/components/icons";
import { RecipeArt } from "@/components/recipe-art";
import { rankRecipes, type CookRecipe, type CookResult } from "@/lib/cook";
import { euro } from "@/lib/format";
import { setPantryItem } from "@/lib/pantry-actions";
import { addRecipeToList } from "@/lib/recipe-actions";
import type { Product } from "@/lib/types";

const BUDGETS = [0, 3, 5, 10];
const PAGE = 12;

export function Cook({
  recipes, products, ingredients, commonCount, have: initialHave, people, foods,
}: {
  recipes: CookRecipe[];
  products: [string, Product | null][];
  ingredients: string[];
  commonCount: number;
  have: string[];
  people: number;
  foods: string[];
}) {
  const [have, setHave] = useState(new Set(initialHave));
  const [showAll, setShowAll] = useState(false);
  const [budgetText, setBudgetText] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [, start] = useTransition();

  const productMap = useMemo(() => new Map(products), [products]);
  const parsed = Number(budgetText.replace(",", "."));
  const budget = budgetText.trim() !== "" && Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  const { results, overBudget } = useMemo(() => rankRecipes(recipes, have, productMap, budget), [recipes, have, productMap, budget]);
  const ready = results.filter((r) => r.missing.length === 0).length;

  function toggle(name: string) {
    const has = !have.has(name);
    setHave((s) => {
      const n = new Set(s);
      if (has) n.add(name);
      else n.delete(name);
      return n;
    });
    setShown(PAGE);
    start(() => setPantryItem(name, has));
  }

  const chips = showAll ? ingredients : ingredients.slice(0, commonCount);
  const mine = Array.from(have).sort((a, b) => a.localeCompare(b, "es"));
  function setMine(next: string[]) {
    for (const n of next) if (!have.has(n)) toggle(n);
    for (const h of have) if (!next.includes(h)) toggle(h);
  }

  return (
    <main>
      <h1 className="text-3xl font-bold md:text-5xl">¿Qué cocino hoy?</h1>
      <p className="mt-1 text-muted md:text-lg">Marca lo que tienes en la nevera y cuánto quieres gastar. Te decimos qué receta encaja mejor.</p>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
        <div className="flex flex-col gap-5 lg:sticky lg:top-5">
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold">Lo que tengo en casa ({have.size})</h2>
            <p className="text-sm text-muted">Es tu misma despensa: lo que marques aquí tampoco se compra al hacer la lista del menú.</p>
            <div className="mt-3">
              <FoodInput label="Añadir algo que tienes en casa" placeholder="Escribe un ingrediente: arroz, huevos…" value={mine} onChange={setMine} suggestions={foods} tone="olive" />
            </div>
            <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted">{showAll ? "Todos los ingredientes" : "Los más habituales"}</p>
            <ul className={`flex flex-wrap gap-2 ${showAll ? "max-h-72 overflow-y-auto lg:max-h-[45vh]" : ""}`}>
              {chips.map((name) => {
                const on = have.has(name);
                return (
                  <li key={name}>
                    <button type="button" aria-pressed={on} onClick={() => toggle(name)} className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm capitalize ${on ? "border-olive bg-olive-soft font-medium text-olive-dark" : "border-cream-dark bg-white hover:bg-cream"}`}>
                      {on && <CheckIcon className="h-3.5 w-3.5" />} {name}
                    </button>
                  </li>
                );
              })}
            </ul>
            <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-3 text-sm font-medium text-brand hover:underline">
              {showAll ? "Ver solo los habituales" : `Ver todos (${ingredients.length})`}
            </button>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold">Lo que quiero gastar</h2>
            <p className="text-sm text-muted">En comprar lo que falte, para {people} {people === 1 ? "persona" : "personas"}. Déjalo vacío si te da igual.</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="relative">
                <span className="sr-only">Presupuesto en euros</span>
                <input inputMode="decimal" value={budgetText} onChange={(e) => { setBudgetText(e.target.value); setShown(PAGE); }} placeholder="Sin límite" className="w-32 rounded-xl border border-cream-dark bg-white py-2.5 pl-3 pr-8 outline-none focus:border-brand" />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted">€</span>
              </label>
              {BUDGETS.map((b) => (
                <button key={b} type="button" aria-pressed={budget === b} onClick={() => { setBudgetText(budget === b ? "" : String(b)); setShown(PAGE); }} className={`rounded-xl border px-3 py-2 text-sm font-medium ${budget === b ? "border-brand bg-brand-soft text-brand-dark" : "border-cream-dark bg-white hover:bg-cream"}`}>
                  {b === 0 ? "Nada" : `${b} €`}
                </button>
              ))}
            </div>
          </section>
        </div>

        <section aria-live="polite">
          <p className="text-sm font-medium text-muted">
            {ready > 0
              ? `Puedes cocinar ${ready} ${ready === 1 ? "receta" : "recetas"} sin comprar nada.`
              : have.size === 0
                ? "Marca lo que tienes y las recetas se ordenan solas."
                : "Con lo que tienes no sale ninguna receta entera, pero estas se quedan cerca."}
            {overBudget > 0 && ` ${overBudget} se pasan de tu presupuesto.`}
          </p>
          {results.length === 0 ? (
            <div className="mt-3 rounded-2xl bg-white p-6 text-center shadow-sm">
              <p className="font-semibold">Nada encaja con ese presupuesto.</p>
              <p className="mt-1 text-sm text-muted">Sube un poco el límite o marca más cosas de la nevera.</p>
            </div>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {results.slice(0, shown).map((r) => (
                <ResultCard key={r.recipe.id} r={r} />
              ))}
            </ul>
          )}
          {results.length > shown && (
            <button type="button" onClick={() => setShown((n) => n + PAGE)} className="mt-4 w-full rounded-xl border border-cream-dark bg-white px-4 py-3 font-medium hover:bg-cream">
              Ver más recetas ({results.length - shown})
            </button>
          )}
        </section>
      </div>
    </main>
  );
}

function ResultCard({ r }: { r: CookResult }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();
  const total = r.recipe.ingredients.length;
  const done = r.missing.length === 0;
  const buyable = r.missing.filter((m) => m.product);

  return (
    <li className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex gap-4">
        <Link href={`/recetas/${r.recipe.id}`} className="shrink-0">
          <RecipeArt tags={r.recipe.tags} name={r.recipe.name} photoUrl={r.recipe.photoUrl} className="h-20 w-20 rounded-xl text-3xl md:h-24 md:w-24" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <Link href={`/recetas/${r.recipe.id}`} className="text-lg font-bold leading-tight hover:underline">{r.recipe.name}</Link>
            {done ? (
              <span className="rounded-full bg-olive px-2.5 py-1 text-xs font-semibold text-white">Tienes todo</span>
            ) : (
              <span className="text-lg font-bold">{r.unpriced === r.missing.length ? "—" : euro(r.cost)}</span>
            )}
          </div>
          <p className="text-sm text-muted">
            {r.recipe.minutes ? `${r.recipe.minutes} min · ` : ""}Tienes {r.haveCount} de {total} ingredientes
            {r.recipe.author ? ` · de ${r.recipe.author}` : ""}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-cream-dark" aria-hidden>
            <div className="h-full rounded-full bg-olive" style={{ width: `${total ? (r.haveCount / total) * 100 : 0}%` }} />
          </div>
        </div>
      </div>

      {!done && (
        <>
          <p className="mt-3 text-sm font-semibold">{r.missing.length === 1 ? "Te falta 1 cosa" : `Te faltan ${r.missing.length} cosas`}</p>
          <ul className="mt-1 flex flex-col divide-y divide-cream-dark">
            {r.missing.map((m) => (
              <li key={m.name} className="flex items-center gap-2 py-1.5 text-sm">
                {m.product ? <ChainLogo id={m.product.supermarket_id} size={18} /> : <span className="h-[18px] w-[18px]" />}
                <span className="min-w-0 flex-1">
                  <span className="capitalize">{m.name}</span>
                  {m.product && <span className="block truncate text-xs text-muted">{m.product.name}</span>}
                </span>
                <span className={m.cost === null ? "text-xs text-muted" : "font-medium"}>{m.cost === null ? "sin precio" : euro(m.cost)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || buyable.length === 0}
              onClick={() =>
                start(async () => {
                  try {
                    const { to } = await addRecipeToList(r.recipe.id, buyable.map((m) => m.need));
                    router.push(to);
                  } catch {
                    setError("No se ha podido añadir a la lista.");
                  }
                })
              }
              className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
            >
              <CartIcon className="h-4 w-4" />
              {pending ? "Añadiendo…" : "Añadir lo que falta a la compra"}
            </button>
            <Link href={`/recetas/${r.recipe.id}`} className="rounded-xl border border-cream-dark px-4 py-2.5 text-sm font-medium hover:bg-cream">Ver receta</Link>
          </div>
          {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
        </>
      )}
      {done && (
        <Link href={`/recetas/${r.recipe.id}`} className="mt-3 inline-block rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">
          Ver cómo se hace
        </Link>
      )}
    </li>
  );
}
