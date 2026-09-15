"use client";

import Link from "next/link";
import { useTransition } from "react";
import { generateWeekAction, setServingsAction, setSlotAction } from "@/lib/menu-actions";
import { DAYS, MEALS, type Menu, type Recipe, type Slot } from "@/lib/menu";

export function MenuGrid({ menu, recipes, slots, offset }: { menu: Menu; recipes: Recipe[]; slots: Slot[]; offset: number }) {
  const [pending, start] = useTransition();
  const byKey = new Map(slots.map((s) => [`${s.day}-${s.meal}`, s.recipe_id]));
  const filled = slots.filter((s) => s.recipe_id !== null).length;
  const weekLabel = formatWeek(menu.week_start);

  return (
    <main>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Menú</h1>
        <div className="flex gap-1 text-sm">
          <Link href="/menu" className={`rounded-lg px-2 py-1 ${offset === 0 ? "bg-green-100 font-semibold text-green-800" : "text-zinc-500"}`}>
            Esta semana
          </Link>
          <Link href="/menu?semana=siguiente" className={`rounded-lg px-2 py-1 ${offset === 1 ? "bg-green-100 font-semibold text-green-800" : "text-zinc-500"}`}>
            Siguiente
          </Link>
        </div>
      </div>
      <p className="mb-3 text-sm text-zinc-500">Semana del {weekLabel}</p>

      <div className="mb-4 flex items-center justify-between rounded-xl bg-white p-3 shadow-sm">
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
        className="mb-4 w-full rounded-xl bg-green-600 px-4 py-3 text-lg font-semibold text-white active:bg-green-700 disabled:opacity-60"
      >
        {pending ? "Un momento…" : filled > 0 ? "Generar otra semana" : "Generar semana"}
      </button>

      <div className="flex flex-col gap-2">
        {DAYS.map((name, day) => (
          <div key={day} className="rounded-xl border border-zinc-200 bg-white p-3">
            <p className="mb-2 font-semibold">{name}</p>
            <div className="flex flex-col gap-2">
              {MEALS.map((meal) => (
                <label key={meal} className="flex items-center gap-2 text-sm">
                  <span className="w-14 shrink-0 text-zinc-500">{meal === "comida" ? "Comida" : "Cena"}</span>
                  <select
                    value={byKey.get(`${day}-${meal}`) ?? ""}
                    disabled={pending}
                    onChange={(e) =>
                      start(() => setSlotAction(menu.id, day, meal, e.target.value ? Number(e.target.value) : null))
                    }
                    className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-2 py-2"
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
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Link
        href={`/menu/lista${offset === 1 ? "?semana=siguiente" : ""}`}
        aria-disabled={filled === 0}
        className={`mt-5 block rounded-xl px-4 py-3 text-center text-lg font-semibold ${
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
