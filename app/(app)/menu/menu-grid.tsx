"use client";

import Link from "next/link";
import { useTransition } from "react";
import { generateWeekAction, setServingsAction, setSlotAction } from "@/lib/menu-actions";
import { DAYS, MEALS, type Menu, type Recipe, type Slot } from "@/lib/menu";

export function MenuGrid({ menu, recipes, slots, offset }: { menu: Menu; recipes: Recipe[]; slots: Slot[]; offset: number }) {
  const [pending, start] = useTransition();
  const byKey = new Map(slots.map((s) => [`${s.day}-${s.meal}`, s.recipe_id]));
  const recipeName = new Map(recipes.map((r) => [r.id, r.name]));
  const filled = slots.filter((s) => s.recipe_id !== null).length;
  const weekLabel = formatWeek(menu.week_start);

  return (
    <main>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Menú</h1>
        <div className="flex gap-1 text-sm">
          <Link href="/menu" className={`rounded-lg px-2 py-1 ${offset === 0 ? "bg-brand-soft font-semibold text-brand-dark" : "text-zinc-500"}`}>
            Esta semana
          </Link>
          <Link href="/menu?semana=siguiente" className={`rounded-lg px-2 py-1 ${offset === 1 ? "bg-brand-soft font-semibold text-brand-dark" : "text-zinc-500"}`}>
            Siguiente
          </Link>
        </div>
      </div>
      <p className="mb-3 text-sm text-zinc-500">Semana del {weekLabel}</p>

      <div className="mb-4 flex items-center justify-between rounded-xl bg-white p-3 shadow-sm md:max-w-sm">
        <span className="font-medium">Personas</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={pending || menu.servings <= 1}
            onClick={() => start(() => setServingsAction(menu.id, menu.servings - 1))}
            className="h-9 w-9 rounded-lg bg-zinc-100 text-xl font-bold disabled:opacity-40"
            aria-label="Menos personas"
          >
            −
          </button>
          <span className="w-6 text-center text-lg font-semibold">{menu.servings}</span>
          <button
            type="button"
            disabled={pending || menu.servings >= 12}
            onClick={() => start(() => setServingsAction(menu.id, menu.servings + 1))}
            className="h-9 w-9 rounded-lg bg-zinc-100 text-xl font-bold disabled:opacity-40"
            aria-label="Más personas"
          >
            +
          </button>
        </div>
      </div>

      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => generateWeekAction(menu.week_start))}
        className="mb-4 w-full rounded-xl bg-brand px-4 py-3 text-lg font-semibold text-white active:bg-brand-dark disabled:opacity-60 md:w-auto md:px-8"
      >
        {pending ? "Un momento…" : filled > 0 ? "Generar otra semana" : "Generar semana"}
      </button>

      <div className="flex flex-col gap-2 lg:grid lg:grid-cols-7">
        {DAYS.map((name, day) => (
          <div key={day} className="rounded-xl border border-zinc-200 bg-white p-3">
            <p className="mb-2 font-semibold">{name}</p>
            <div className="flex flex-col gap-2">
              {MEALS.map((meal) => (
                <label key={meal} className="flex items-center gap-2 text-sm lg:flex-col lg:items-stretch lg:gap-1">
                  <span className="w-14 shrink-0 text-zinc-500 lg:w-auto lg:text-xs">{meal === "comida" ? "Comida" : "Cena"}</span>
                  <span className="relative block min-w-0 flex-1">
                    <span
                      className={`block min-h-10 rounded-lg border border-zinc-300 bg-white px-2 py-2 pr-6 leading-snug ${
                        byKey.get(`${day}-${meal}`) ? "" : "text-zinc-400"
                      }`}
                    >
                      {recipeName.get(byKey.get(`${day}-${meal}`) ?? -1) ?? "— vacío —"}
                    </span>
                    <span className="pointer-events-none absolute right-2 top-2 text-zinc-400">▾</span>
                  <select
                    value={byKey.get(`${day}-${meal}`) ?? ""}
                    disabled={pending}
                    aria-label={`${name}, ${meal}`}
                    onChange={(e) =>
                      start(() => setSlotAction(menu.id, day, meal, e.target.value ? Number(e.target.value) : null))
                    }
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  >
                    <option value="">— vacío —</option>
                    {recipes
                      .filter((r) => r.meal === meal || r.meal === "ambas")
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                  </select>
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Link
        href={`/menu/lista${offset === 1 ? "?semana=siguiente" : ""}`}
        aria-disabled={filled === 0}
        className={`mt-5 block rounded-xl px-4 py-3 text-center text-lg font-semibold md:inline-block md:px-8 ${
          filled === 0 ? "pointer-events-none bg-zinc-200 text-zinc-500" : "bg-zinc-900 text-white"
        }`}
      >
        Crear lista de la compra
      </Link>
    </main>
  );
}

function formatWeek(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "long" });
}
