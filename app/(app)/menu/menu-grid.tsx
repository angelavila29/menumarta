"use client";

import Link from "next/link";
import { useTransition } from "react";
import { CartIcon, ChevronLeft, ChevronRight, HeartIcon, LeafIcon, PlusIcon, SettingsIcon, StoreIcon } from "@/components/icons";
import { euro } from "@/lib/format";
import { DAYS, MEALS, type Menu, type Recipe, type Slot } from "@/lib/menu";
import { generateWeekAction, setServingsAction, setSlotAction } from "@/lib/menu-actions";
import { RecipeArt } from "@/components/recipe-art";

export type MenuSettings = { meals: string; diet: string; chains: string; prefs: string };
export type BalanceItem = { label: string; emoji: string; bg: string; n: number };

type Props = {
  menu: Menu;
  recipes: Recipe[];
  slots: Slot[];
  offset: number;
  weekRange: string;
  todayIndex: number | null;
  listTotal: number;
  cheapestName: string | null;
  ingredientsCount: number;
  balance: BalanceItem[];
  settings: MenuSettings;
};

const svg = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, viewBox: "0 0 24 24" };
const ForkIcon = ({ className }: { className?: string }) => (
  <svg {...svg} className={className}><path d="M7 3v8a2 2 0 0 0 2 2v8M5 3v5M9 3v5M17 3c-2 0-3 3-3 6s1 4 3 4v8" /></svg>
);
const UsersIcon = ({ className }: { className?: string }) => (
  <svg {...svg} className={className}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6" /></svg>
);

const hrefFor = (o: number) => (o === 0 ? "/menu" : `/menu?semana=${o}`);

export function MenuGrid(p: Props) {
  const { menu, recipes, slots, offset } = p;
  const [pending, start] = useTransition();
  const recipeById = new Map(recipes.map((r) => [r.id, r]));
  const recipeAt = (day: number, meal: string) => {
    const id = slots.find((s) => s.day === day && s.meal === meal)?.recipe_id;
    return id != null ? recipeById.get(id) ?? null : null;
  };
  const filled = slots.filter((s) => s.recipe_id !== null).length;
  const listHref = `/menu/lista${offset !== 0 ? `?semana=${offset}` : ""}`;

  function createMenu() {
    if (filled > 0 && !confirm("¿Sustituir el menú de esta semana por uno nuevo?")) return;
    start(() => generateWeekAction(menu.week_start));
  }

  return (
    <main className="flex flex-col gap-5">
      {/* Cabecera */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold md:text-5xl">Menú semanal</h1>
          <p className="mt-1 text-lg md:text-2xl">Semana {p.weekRange}</p>
          <p className="text-muted">Comidas equilibradas, sencillas y a buen precio.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <nav className="flex items-center rounded-xl border border-cream-dark bg-white shadow-sm" aria-label="Cambiar de semana">
            <Link href={hrefFor(offset - 1)} aria-label="Semana anterior" className="flex h-11 w-10 items-center justify-center text-muted hover:text-brand">
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <span className="px-2 text-sm">
              {offset === 0 ? "Esta semana" : offset === 1 ? "Semana que viene" : `Semana ${p.weekRange.replace(/^del /, "del ")}`}
            </span>
            <Link href={hrefFor(offset + 1)} aria-label="Semana siguiente" className="flex h-11 w-10 items-center justify-center text-muted hover:text-brand">
              <ChevronRight className="h-5 w-5" />
            </Link>
          </nav>
          <button
            type="button"
            onClick={createMenu}
            disabled={pending}
            className="flex items-center gap-2 rounded-xl bg-brand px-5 py-3 font-semibold text-white shadow-sm hover:bg-brand-dark disabled:opacity-60"
          >
            <PlusIcon className="h-5 w-5" />
            {pending ? "Preparando…" : filled > 0 ? "Crear nuevo menú" : "Generar menú"}
          </button>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={<ForkIcon className="h-7 w-7" />} iconBg="bg-olive-soft text-olive-dark" big={String(filled)} small="comidas planificadas" />
        <Stat icon={<CartIcon className="h-7 w-7" />} iconBg="bg-brand-soft text-brand" label="Lista estimada" big={euro(p.listTotal)} />
        <Stat
          icon={<StoreIcon className="h-7 w-7" />}
          iconBg="bg-olive-soft text-olive-dark"
          big={p.cheapestName ?? "Compara precios"}
          small={p.cheapestName ? "es la opción más barata" : "al crear tu lista de la compra"}
          bigClass="text-xl"
        />
      </div>

      {/* Semana */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {DAYS.map((name, day) => {
          const today = p.todayIndex === day;
          return (
            <section
              key={day}
              className={`rounded-2xl p-3 shadow-sm ${today ? "border-2 border-brand bg-brand-soft/50" : "border border-transparent bg-white"}`}
            >
              <div className="mb-3">
                <div className="flex items-center justify-between gap-1">
                  <h2 className={`font-bold ${today ? "text-brand" : ""}`}>{name}</h2>
                  {today && <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-semibold text-white">Hoy</span>}
                </div>
                <p className="whitespace-nowrap text-xs text-muted">{dayDate(menu.week_start, day)}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-1">
                {MEALS.map((meal) => (
                  <MealSlot
                    key={meal}
                    day={day}
                    label={meal === "comida" ? "Comida" : "Cena"}
                    meal={meal}
                    recipe={recipeAt(day, meal)}
                    recipes={recipes}
                    disabled={pending}
                    ariaLabel={`Cambiar ${meal} del ${name.toLowerCase()}`}
                    onChange={(id) => start(() => setSlotAction(menu.id, day, meal, id))}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* Pie: equilibrio, lista y ajustes */}
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1.2fr_1fr]">
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-olive text-white"><LeafIcon className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold leading-tight">Equilibrio de la semana</h2>
              <p className="text-sm text-muted">Una alimentación variada y equilibrada.</p>
            </div>
            <span className="shrink-0 rounded-lg bg-cream px-2.5 py-1 text-sm">{filled} comidas</span>
          </div>
          <ul className="mt-4 grid grid-cols-4 gap-2 text-center">
            {p.balance.map((b) => (
              <li key={b.label}>
                <span className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl ${b.bg}`}>{b.emoji}</span>
                <p className="mt-2 text-sm font-semibold">{b.label}</p>
                <p className="text-sm text-muted">{b.n} {b.n === 1 ? "plato" : "platos"}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-olive text-white"><CartIcon className="h-5 w-5" /></span>
            <div>
              <h2 className="text-lg font-bold leading-tight">Generar lista de la compra</h2>
              <p className="text-sm text-muted">Convierte tu menú en una lista de la compra optimizada y compara precios en tus supermercados.</p>
            </div>
          </div>
          <Link
            href={listHref}
            aria-disabled={filled === 0}
            className={`mt-4 flex items-center justify-center gap-2 rounded-xl px-4 py-3.5 font-semibold ${
              filled === 0 ? "pointer-events-none bg-cream-dark text-muted" : "bg-brand text-white hover:bg-brand-dark"
            }`}
          >
            <CartIcon className="h-5 w-5" /> Generar lista de la compra <ChevronRight className="h-5 w-5" />
          </Link>
          <p className="mt-3 text-xs text-muted">
            {filled === 0
              ? "Genera primero el menú de la semana."
              : <>Se incluirán <b className="text-ink">{p.ingredientsCount}</b> ingredientes de tu menú semanal.</>}
          </p>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold"><SettingsIcon className="h-5 w-5" /> Ajustes del menú</h2>
            <Link href="/ajustes#alimentacion" className="text-sm font-semibold text-brand hover:underline">Editar</Link>
          </div>
          <ul className="mt-3 flex flex-col gap-2.5 text-sm">
            <li className="flex items-center gap-3">
              <UsersIcon className="h-5 w-5 shrink-0" />
              <span className="flex-1">{menu.servings} {menu.servings === 1 ? "persona" : "personas"}</span>
              <span className="flex items-center gap-1">
                <button type="button" disabled={pending || menu.servings <= 1} onClick={() => start(() => setServingsAction(menu.id, menu.servings - 1))} aria-label="Menos personas" className="h-7 w-7 rounded-md bg-cream font-bold disabled:opacity-40">−</button>
                <button type="button" disabled={pending || menu.servings >= 12} onClick={() => start(() => setServingsAction(menu.id, menu.servings + 1))} aria-label="Más personas" className="h-7 w-7 rounded-md bg-cream font-bold disabled:opacity-40">+</button>
              </span>
            </li>
            <li className="flex items-center gap-3"><ForkIcon className="h-5 w-5 shrink-0" /> {p.settings.meals}</li>
            <li className="flex items-center gap-3"><LeafIcon className="h-5 w-5 shrink-0 text-olive" /> {p.settings.diet}</li>
            <li className="flex items-center gap-3"><StoreIcon className="h-5 w-5 shrink-0" /> {p.settings.chains}</li>
            <li className="flex items-center gap-3"><HeartIcon className="h-5 w-5 shrink-0" /> {p.settings.prefs}</li>
          </ul>
        </section>
      </div>
    </main>
  );
}

function Stat({ icon, iconBg, big, small, label, bigClass = "text-3xl" }: { icon: React.ReactNode; iconBg: string; big: string; small?: string; label?: string; bigClass?: string }) {
  return (
    <section className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm">
      <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${iconBg}`}>{icon}</span>
      <div className="min-w-0">
        {label && <p className="text-sm text-muted">{label}</p>}
        <p className={`font-bold leading-tight ${bigClass}`}>{big}</p>
        {small && <p className="text-sm text-muted">{small}</p>}
      </div>
    </section>
  );
}

function MealSlot({ label, meal, day, recipe, recipes, disabled, ariaLabel, onChange }: {
  label: string;
  meal: string;
  day: number;
  recipe: Recipe | null;
  recipes: Recipe[];
  disabled: boolean;
  ariaLabel: string;
  onChange: (id: number | null) => void;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold">{label}</p>
      {/* La imagen abre el selector para cambiar el plato; el nombre abre la receta */}
      <div className="group relative" title="Cambiar plato">
        {recipe ? (
          <RecipeArt tags={recipe.tags} name={recipe.name} className="aspect-[4/3] rounded-xl text-5xl transition group-hover:brightness-95" />
        ) : (
          <div className="flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-cream-dark text-xs text-muted group-hover:border-brand group-hover:text-brand">
            <PlusIcon className="h-5 w-5" /> Añadir
          </div>
        )}
        <select
          value={recipe?.id ?? ""}
          disabled={disabled}
          aria-label={ariaLabel}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        >
          <option value="">— vacío —</option>
          {recipes
            .filter((r) => r.meal === meal || r.meal === "ambas")
            .map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
        </select>
      </div>
      {recipe ? (
        <Link href={`/recetas/${recipe.id}?dia=${day}`} className="mt-1.5 line-clamp-2 block min-h-[2.5em] text-sm leading-tight hover:text-brand hover:underline">
          {recipe.name}
        </Link>
      ) : (
        <p className="mt-1.5 min-h-[2.5em] text-sm leading-tight text-muted">Sin plato</p>
      )}
    </div>
  );
}

function dayDate(weekStart: string, d: number) {
  const [y, m, dd] = weekStart.split("-").map(Number);
  return new Date(y, m - 1, dd + d).toLocaleDateString("es-ES", { day: "numeric", month: "long" });
}
