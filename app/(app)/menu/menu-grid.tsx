"use client";
import { useConfirm } from "@/components/confirm-dialog";
import Link from "next/link";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { DayBreakdown } from "@/components/day-breakdown";
import { CartIcon, ChevronLeft, ChevronRight, HeartIcon, LeafIcon, PlusIcon, SettingsIcon, StoreIcon } from "@/components/icons";
import { euro } from "@/lib/format";
import { DAYS, MEALS, type Menu, type Recipe, type Slot } from "@/lib/menu";
import { generateWeekAction, repeatPreviousWeekAction, setCookedAction, setCookSessionsAction, setPortionAction, setServingsAction, setSideAction, setSlotAction } from "@/lib/menu-actions";
import { RecipeArt } from "@/components/recipe-art";
import { RecipePicker } from "@/components/recipe-picker";

export type MenuSettings = { meals: string; diet: string; chains: string; prefs: string };
export type BalanceItem = { label: string; emoji: string; bg: string; n: number };
type Meter = { value: number; target: number; verdict: "ok" | "bajo" | "alto" };
export type GoalPanel = {
  bodyGoal: "perder" | "mantener" | "ganar" | null;
  estimated: boolean;
  kcalDay: number;
  proteinDay: number;
  fatDay: number;
  carbsDay: number;
  /** tamaño de ración del menú (1 = la de la receta) */
  portion: number;
  skipMeals: string[];
  plan: { kgPerWeek: number; targetKg: number | null; weeks: number | null } | null;
  kcal: Meter;
  protein: Meter;
  veg: Meter;
  days: { kcal: number; protein: number; meals: number }[];
  headline: string;
  tips: string[];
  score: number;
  unknownSlots: number;
};

type Props = {
  menu: Menu;
  recipes: Recipe[];
  slots: Slot[];
  offset: number;
  weekRange: string;
  todayIndex: number | null;
  favoriteIds: number[];
  minutes: Record<number, number | null>;
  listTotal: number;
  weekCost: number | null;
  weekCostWhere: string | null;
  budget: number | null;
  cheapestName: string | null;
  ingredientsCount: number;
  cookSessions: number;
  pantryCount: number;
  balance: BalanceItem[];
  goal: GoalPanel;
  settings: MenuSettings;
};

const svg = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, viewBox: "0 0 24 24" };
const ForkIcon = ({ className }: { className?: string }) => (
  <svg {...svg} className={className}><path d="M7 3v8a2 2 0 0 0 2 2v8M5 3v5M9 3v5M17 3c-2 0-3 3-3 6s1 4 3 4v8" /></svg>
);
const UsersIcon = ({ className }: { className?: string }) => (
  <svg {...svg} className={className}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6" /></svg>
);

const num = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 2 });
const PORTION_LABEL: Record<number, string> = { 0.75: "Ración algo más pequeña", 1: "Ración normal", 1.25: "Ración generosa", 1.5: "Ración y media", 2: "Ración doble" };

const RefreshIcon = ({ className }: { className?: string }) => (
  <svg {...svg} className={className}><path d="M20 11a8 8 0 0 0-14.3-4.5L4 8.5M4 4v4.5h4.5M4 13a8 8 0 0 0 14.3 4.5l1.7-2M20 20v-4.5h-4.5" /></svg>
);

const hrefFor = (o: number) => (o === 0 ? "/menu" : `/menu?semana=${o}`);

export function MenuGrid(p: Props) {
  const { menu, recipes, offset } = p;
  const [pending, start] = useTransition();
  // Los toques (cocinado, cambiar plato, guarnición) se ven al instante; el servidor confirma después
  const [slots, patchSlot] = useOptimistic(p.slots, (state: Slot[], patch: Pick<Slot, "day" | "meal"> & Partial<Slot>) => {
    const i = state.findIndex((s) => s.day === patch.day && s.meal === patch.meal);
    if (i === -1) return [...state, { recipe_id: null, kind: "meal", cooked: false, side_recipe_id: null, ...patch } as Slot];
    return state.map((s, k) => (k === i ? { ...s, ...patch } : s));
  });
  const [notice, setNotice] = useState("");
  const [ask, confirmDialog] = useConfirm();
  const [picking, setPicking] = useState<{ day: number; meal: "comida" | "cena"; kind: "main" | "side" } | null>(null);
  const favorites = new Set(p.favoriteIds);
  // Carrusel de días: empieza en hoy y la tira de arriba salta al día que toques
  const scroller = useRef<HTMLDivElement>(null);
  const [activeDay, setActiveDay] = useState(p.todayIndex ?? 0);
  const goToDay = (day: number, smooth = true) => {
    const box = scroller.current;
    const col = box?.children[day] as HTMLElement | undefined;
    if (!box || !col) return;
    box.scrollTo({ left: col.offsetLeft - box.offsetLeft, behavior: smooth ? "smooth" : "auto" });
  };
  useEffect(() => {
    if (p.todayIndex) goToDay(p.todayIndex, false);
  }, [p.todayIndex]);
  const onDaysScroll = () => {
    const box = scroller.current;
    if (!box) return;
    const cols = Array.from(box.children) as HTMLElement[];
    const x = box.scrollLeft + box.offsetLeft;
    let best = 0;
    cols.forEach((c, i) => {
      if (Math.abs(c.offsetLeft - x) < Math.abs(cols[best].offsetLeft - x)) best = i;
    });
    // al final del carrusel no se puede llegar al último día por posición: se marca al tocar fondo
    if (box.scrollLeft + box.clientWidth >= box.scrollWidth - 4 && best < cols.length - 1 && activeDay > best) return;
    setActiveDay(best);
  };
  const recipeById = new Map(recipes.map((r) => [r.id, r]));
  const sideRecipes = recipes.filter((r) => r.tags.includes("guarnicion"));
  const slotAt = (day: number, meal: string) => slots.find((s) => s.day === day && s.meal === meal);
  const recipeAt = (day: number, meal: string) => {
    const id = slotAt(day, meal)?.recipe_id;
    return id != null ? recipeById.get(id) ?? null : null;
  };
  // Un plato es "sobras" si la misma receta ya aparece antes en la semana
  const seen = new Set<number>();
  const leftovers = new Set<string>();
  for (const day of [0, 1, 2, 3, 4, 5, 6]) {
    for (const meal of MEALS) {
      const id = slotAt(day, meal)?.recipe_id;
      if (id == null) continue;
      if (seen.has(id)) leftovers.add(`${day}-${meal}`);
      seen.add(id);
    }
  }
  const filled = slots.filter((s) => s.recipe_id !== null).length;
  const cooked = seen.size;
  const outCount = slots.filter((s) => s.kind === "out").length;
  const listHref = `/menu/lista${offset !== 0 ? `?semana=${offset}` : ""}`;

  // "Ajustar a mi objetivo": regenerar sin preguntar; el generador ya mira el objetivo del perfil
  function adjustToGoal() {
    start(() => generateWeekAction(menu.week_start));
  }
  // En la semana en curso solo se planifica de hoy en adelante
  const fromToday = p.todayIndex !== null && p.todayIndex > 0;
  const replaceBody = fromToday ? "Se cambian los platos de hoy en adelante. Los días que ya han pasado no se tocan." : "Se cambian todos los platos de esta semana.";
  async function createMenu() {
    if (filled > 0 && !(await ask({ title: "¿Regenerar el menú?", body: replaceBody, confirmLabel: "Regenerar" }))) return;
    start(async () => {
      await generateWeekAction(menu.week_start);
      setNotice("");
    });
  }

  return (
    <main className="flex flex-col gap-5">
      {confirmDialog}
      {picking && (() => {
        const { day, meal, kind } = picking;
        const current = slotAt(day, meal);
        const when = `${meal === "comida" ? "Comida" : "Cena"} del ${DAYS[day].toLowerCase()}`;
        if (kind === "side") {
          return (
            <RecipePicker
              title="Añadir guarnición"
              subtitle={`${when} · con ${recipeAt(day, meal)?.name ?? ""}`}
              recipes={sideRecipes}
              minutes={p.minutes}
              showFilters={false}
              onClose={() => setPicking(null)}
              onPick={(id) => {
                setPicking(null);
                start(async () => {
                  patchSlot({ day, meal, side_recipe_id: id });
                  await setSideAction(menu.id, day, meal, id);
                });
              }}
            />
          );
        }
        const choose = (value: number | "out" | null) => {
          setPicking(null);
          start(async () => {
            patchSlot({ day, meal, recipe_id: typeof value === "number" ? value : null, kind: value === "out" ? "out" : "meal", cooked: false, side_recipe_id: null });
            await setSlotAction(menu.id, day, meal, value);
          });
        };
        const options = recipes.filter((r) => (r.meal === meal || r.meal === "ambas") && !r.tags.includes("guarnicion"));
        // Recomendadas: lo que aún no está en la semana, primero tus favoritas y lo que aporta variedad
        const weekTags = new Set(slots.map((s) => recipeById.get(s.recipe_id ?? -1)?.tags[0]).filter(Boolean));
        const recommended = options
          .filter((r) => !seen.has(r.id))
          .map((r) => ({ r, score: (favorites.has(r.id) ? 4 : 0) + (r.owner_id ? 1 : 0) + (weekTags.has(r.tags[0]) ? 0 : 2) + (((r.id * 7 + day * 13 + (meal === "cena" ? 5 : 0)) % 10) / 10) }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 6)
          .map((x) => x.r);
        return (
          <RecipePicker
            title={when}
            subtitle={current?.recipe_id != null ? `Ahora: ${recipeById.get(current.recipe_id)?.name ?? ""}` : "Elige qué vas a comer"}
            recipes={options}
            recommended={recommended}
            favorites={favorites}
            minutes={p.minutes}
            currentId={current?.recipe_id ?? null}
            extras={[
              { label: "Como fuera / no cocino", emoji: "🍴", onClick: () => choose("out") },
              ...(current?.recipe_id != null || current?.kind === "out" ? [{ label: "Dejar vacío", emoji: "🗑️", onClick: () => choose(null) }] : []),
            ]}
            onClose={() => setPicking(null)}
            onPick={choose}
          />
        );
      })()}
      {/* Cabecera */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold md:text-5xl">Menú semanal</h1>
          <p className="mt-1 text-lg md:text-2xl">Semana {p.weekRange}</p>
          <p className="text-muted">Comidas equilibradas, sencillas y a buen precio.</p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:gap-3">
          <nav className="col-span-2 flex items-center justify-between rounded-xl border border-cream-dark bg-white shadow-sm" aria-label="Cambiar de semana">
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
            disabled={pending}
            onClick={async () => {
              if (filled > 0 && !(await ask({ title: "¿Repetir la semana anterior?", body: "El menú de esta semana se sustituye por el de la anterior.", confirmLabel: "Repetir" }))) return;
              start(async () => setNotice((await repeatPreviousWeekAction(menu.week_start)) ? "" : "La semana anterior no tiene menú que copiar."));
            }}
            className={`order-3 rounded-xl border border-cream-dark bg-white px-2 py-3 text-[13px] font-medium shadow-sm hover:bg-cream disabled:opacity-60 sm:order-none sm:px-4 sm:text-sm ${p.pantryCount > 0 ? "" : "col-span-2"}`}
          >
            ↻ Repetir semana anterior
          </button>
          {p.pantryCount > 0 && (
            <button
              type="button"
              disabled={pending}
              onClick={async () => {
                if (filled > 0 && !(await ask({ title: "¿Hacer el menú con lo que tienes?", body: `${replaceBody} Se priorizan las recetas que gastan tu despensa.`, confirmLabel: "Hacer menú" }))) return;
                start(async () => {
                  await generateWeekAction(menu.week_start, "despensa");
                  setNotice("");
                });
              }}
              title={`Prioriza las ${p.pantryCount} cosas que tienes en la despensa`}
              className="order-3 rounded-xl border border-cream-dark bg-white px-2 py-3 text-[13px] font-medium shadow-sm hover:bg-cream disabled:opacity-60 sm:order-none sm:px-4 sm:text-sm"
            >
              🥫 Con lo que tengo
            </button>
          )}
          <button
            type="button"
            onClick={createMenu}
            disabled={pending}
            className="order-2 col-span-2 flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 font-semibold text-white shadow-sm hover:bg-brand-dark disabled:opacity-60 sm:order-none"
          >
            {filled > 0 ? <RefreshIcon className={`h-5 w-5 ${pending ? "animate-spin" : ""}`} /> : <PlusIcon className="h-5 w-5" />}
            {pending ? "Preparando…" : filled > 0 ? "Regenerar menú" : "Generar menú"}
          </button>
        </div>
      </div>

      {notice && <p role="status" className="rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-900">{notice}</p>}

      {/* Resumen (en móvil va debajo de los días, que es a lo que se viene) */}
      <div className="grid gap-4 max-sm:order-2 sm:grid-cols-3">
        <Stat
          icon={<ForkIcon className="h-7 w-7" />}
          iconBg="bg-olive-soft text-olive-dark"
          big={filled === 0 ? "0" : `Cocinas ${cooked} ${cooked === 1 ? "vez" : "veces"}`}
          bigClass={filled === 0 ? "text-3xl" : "text-xl"}
          small={filled === 0 ? "comidas planificadas" : `para ${filled} comidas${outCount > 0 ? ` · ${outCount} fuera` : ""}`}
        />
        <Stat
          icon={<CartIcon className="h-7 w-7" />}
          iconBg={p.budget !== null && p.weekCost !== null && p.weekCost > p.budget ? "bg-red-50 text-red-700" : "bg-brand-soft text-brand"}
          label="Compra estimada de la semana"
          big={p.weekCost !== null ? euro(p.weekCost) : euro(p.listTotal)}
          small={
            p.weekCost === null
              ? "en tu lista actual"
              : p.budget === null
                ? p.weekCostWhere ?? undefined
                : p.weekCost > p.budget
                  ? `te pasas ${euro(p.weekCost - p.budget)} de tus ${euro(p.budget)}`
                  : `dentro de tus ${euro(p.budget)} · ${p.weekCostWhere}`
          }
        />
        <Stat
          icon={<StoreIcon className="h-7 w-7" />}
          iconBg="bg-olive-soft text-olive-dark"
          big={p.cheapestName ?? "Compara precios"}
          small={p.cheapestName ? "es la opción más barata" : "al crear tu lista de la compra"}
          bigClass="text-xl"
        />
      </div>

      {/* Semana */}
      {/* Tira de días: de un vistazo qué hay planificado, y salta al día que toques */}
      <div className="max-sm:order-1">
        <ul className="grid grid-cols-7 gap-1 rounded-2xl bg-white p-1.5 shadow-sm sm:gap-2 sm:p-2">
          {DAYS.map((name, day) => {
            const today = p.todayIndex === day;
            const planned = MEALS.filter((meal) => slotAt(day, meal)?.recipe_id != null || slotAt(day, meal)?.kind === "out").length;
            const on = activeDay === day;
            return (
              <li key={day}>
                <button
                  type="button"
                  aria-label={`Ir al ${name.toLowerCase()}`}
                  aria-current={on ? "true" : undefined}
                  onClick={() => {
                    setActiveDay(day);
                    goToDay(day);
                  }}
                  className={`flex w-full flex-col items-center rounded-xl px-1 py-2 transition ${on ? "bg-brand text-white" : today ? "bg-brand-soft text-brand-dark" : "hover:bg-cream"}`}
                >
                  <span className="text-[11px] font-medium uppercase sm:text-xs">
                    <span className="sm:hidden">{name.slice(0, 1)}</span>
                    <span className="hidden sm:inline">{name.slice(0, 3)}</span>
                  </span>
                  <span className="text-base font-bold leading-tight sm:text-lg">{dayNumber(menu.week_start, day)}</span>
                  <span className="mt-1 flex gap-0.5" aria-hidden>
                    {[0, 1].map((i) => (
                      <span key={i} className={`h-1.5 w-1.5 rounded-full ${i < planned ? (on ? "bg-white" : "bg-olive") : on ? "bg-white/40" : "bg-cream-dark"}`} />
                    ))}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div
          ref={scroller}
          onScroll={onDaysScroll}
          className="no-scrollbar -mx-4 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pb-2 md:mx-0 md:px-0"
        >
          {DAYS.map((name, day) => {
            const today = p.todayIndex === day;
            const past = p.todayIndex !== null && day < p.todayIndex;
            return (
              <section
                key={day}
                aria-label={name}
                className={`w-[84%] max-w-[340px] shrink-0 snap-start scroll-ml-4 rounded-2xl p-3 shadow-sm sm:w-[260px] md:scroll-ml-0 ${today ? "border-2 border-brand bg-brand-soft/60" : "border-2 border-transparent bg-white"} ${past ? "opacity-70" : ""}`}
              >
                <div className="mb-3 flex items-center justify-between gap-2 px-1">
                  <h2 className={`text-lg font-bold leading-tight ${today ? "text-brand-dark" : ""}`}>
                    {name}
                    <span className="block text-xs font-normal text-muted">{dayDate(menu.week_start, day)}</span>
                  </h2>
                  {today && <span className="rounded-full bg-brand px-2.5 py-1 text-xs font-semibold text-white">Hoy</span>}
                </div>
                <div className="flex flex-col gap-3">
                  {MEALS.map((meal) => (
                    <MealSlot
                      key={meal}
                      day={day}
                      label={meal === "comida" ? "Comida" : "Cena"}
                      recipe={recipeAt(day, meal)}
                      minutes={p.minutes[slotAt(day, meal)?.recipe_id ?? -1] ?? null}
                      isOut={slotAt(day, meal)?.kind === "out"}
                      isLeftover={leftovers.has(`${day}-${meal}`)}
                      cooked={slotAt(day, meal)?.cooked === true}
                      onCooked={(v) =>
                        start(async () => {
                          patchSlot({ day, meal, cooked: v });
                          await setCookedAction(menu.id, day, meal, v);
                        })
                      }
                      disabled={pending}
                      ariaLabel={`Cambiar ${meal} del ${name.toLowerCase()}`}
                      side={recipeById.get(slotAt(day, meal)?.side_recipe_id ?? -1) ?? null}
                      onOpen={() => setPicking({ day, meal, kind: "main" })}
                      onOpenSide={() => setPicking({ day, meal, kind: "side" })}
                      onRemoveSide={() =>
                        start(async () => {
                          patchSlot({ day, meal, side_recipe_id: null });
                          await setSideAction(menu.id, day, meal, null);
                        })
                      }
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {/* Pie: equilibrio, lista y ajustes */}
      <div className="grid gap-4 max-sm:order-3 lg:grid-cols-[1.3fr_1.2fr_1fr]">
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-olive text-white"><LeafIcon className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold leading-tight">Equilibrio de la semana</h2>
              <p className="text-sm text-muted">
                {p.goal.bodyGoal ? `Tu objetivo: ${GOAL_LABEL[p.goal.bodyGoal].toLowerCase()}.` : "Una alimentación variada y equilibrada."}
              </p>
            </div>
            <span className="shrink-0 rounded-lg bg-cream px-2.5 py-1 text-sm">{filled} comidas</span>
          </div>
          <ul className="mt-4 grid grid-cols-4 gap-1 text-center sm:gap-2">
            {p.balance.map((b) => (
              <li key={b.label} className="min-w-0">
                <span className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl ${b.bg}`}>{b.emoji}</span>
                <p className="mt-2 text-[13px] font-semibold sm:text-sm">{b.label}</p>
                <p className="text-xs text-muted sm:text-sm">{b.n} {b.n === 1 ? "plato" : "platos"}</p>
              </li>
            ))}
          </ul>

          {filled > 0 && (
            <div className="mt-5 border-t border-cream-dark pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">
                  <span className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${p.goal.score === 3 ? "bg-olive" : p.goal.score >= 2 ? "bg-amber-400" : "bg-brand"}`} />
                  {p.goal.headline}
                </p>
                <span className="text-xs text-muted">Media al día entre comida y cena</span>
              </div>
              {p.goal.bodyGoal && (
                <div className="mt-3 flex flex-col gap-2">
                  {p.goal.plan && (
                    <p className="rounded-xl bg-cream px-3 py-2 text-sm">
                      Tu plan: perder <b>{num(p.goal.plan.kgPerWeek)} kg por semana</b>
                      {p.goal.plan.targetKg != null && p.goal.plan.weeks != null && (
                        <> hasta <b>{num(p.goal.plan.targetKg)} kg</b>, en unas <b>{p.goal.plan.weeks} semanas</b></>
                      )}
                      . <Link href="/ajustes#objetivo" className="font-medium text-brand hover:underline">Cambiar</Link>
                    </p>
                  )}
                  <DayBreakdown kcalDay={p.goal.kcalDay} proteinDay={p.goal.proteinDay} fatDay={p.goal.fatDay} carbsDay={p.goal.carbsDay} skip={p.goal.skipMeals} />
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-cream-dark px-3 py-2 text-sm">
                    <span className="min-w-0">
                      <b>{PORTION_LABEL[p.goal.portion] ?? `Ración ×${num(p.goal.portion)}`}</b>
                      <span className="block text-xs text-muted">Ajustada a tus calorías. La compra ya la cuenta.</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <button type="button" aria-label="Ración más pequeña" disabled={pending || p.goal.portion <= 0.75} onClick={() => start(() => setPortionAction(menu.id, p.goal.portion - 0.25))} className="h-8 w-8 rounded-lg bg-cream font-bold disabled:opacity-40">−</button>
                      <span className="w-12 text-center font-semibold tabular-nums">×{num(p.goal.portion)}</span>
                      <button type="button" aria-label="Ración más grande" disabled={pending || p.goal.portion >= 2} onClick={() => start(() => setPortionAction(menu.id, p.goal.portion + 0.25))} className="h-8 w-8 rounded-lg bg-cream font-bold disabled:opacity-40">+</button>
                    </span>
                  </div>
                </div>
              )}
              <ul className="mt-3 flex flex-col gap-2.5">
                <MeterRow label="Calorías (comida + cena)" unit="kcal" m={p.goal.kcal} />
                <MeterRow label="Proteína" unit="g" m={p.goal.protein} />
                <MeterRow label="Verdura" unit="raciones" m={p.goal.veg} />
              </ul>
              {p.goal.tips.length > 0 && (
                <ul className="mt-3 flex flex-col gap-1.5 text-sm">
                  {p.goal.tips.map((t) => (
                    <li key={t} className="flex gap-2"><span aria-hidden className="text-brand">•</span><span>{t}</span></li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {p.goal.bodyGoal ? (
                  p.goal.score < 3 && (
                    <button type="button" disabled={pending} onClick={adjustToGoal} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
                      {pending ? "Ajustando…" : "Ajustar el menú a mi objetivo"}
                    </button>
                  )
                ) : (
                  <Link href="/ajustes#objetivo" className="rounded-xl border border-cream-dark bg-white px-4 py-2.5 text-sm font-medium hover:bg-cream">
                    Poner un objetivo (perder peso, ganar músculo…)
                  </Link>
                )}
                {p.goal.bodyGoal && (
                  <Link href="/ajustes#objetivo" className="text-sm font-medium text-brand hover:underline">
                    {p.goal.estimated ? "Añade peso y altura para afinar" : "Cambiar objetivo"}
                  </Link>
                )}
              </div>
              {p.goal.unknownSlots > 0 && <p className="mt-2 text-xs text-muted">{p.goal.unknownSlots} {p.goal.unknownSlots === 1 ? "plato no cuenta" : "platos no cuentan"}: no conocemos sus ingredientes.</p>}
            </div>
          )}
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
            <li className="flex items-center gap-3">
              <span aria-hidden className="w-5 shrink-0 text-center">🍳</span>
              <span className="flex-1">Cocino {p.cookSessions} {p.cookSessions === 1 ? "vez" : "veces"} por semana</span>
              <span className="flex items-center gap-1">
                <button type="button" disabled={pending || p.cookSessions <= 1} onClick={() => start(() => setCookSessionsAction(p.cookSessions - 1))} aria-label="Cocinar menos veces" className="h-7 w-7 rounded-md bg-cream font-bold disabled:opacity-40">−</button>
                <button type="button" disabled={pending || p.cookSessions >= 14} onClick={() => start(() => setCookSessionsAction(p.cookSessions + 1))} aria-label="Cocinar más veces" className="h-7 w-7 rounded-md bg-cream font-bold disabled:opacity-40">+</button>
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

function MealSlot({ label, day, recipe, minutes, isOut, isLeftover, cooked, onCooked, disabled, ariaLabel, onOpen, side, onOpenSide, onRemoveSide }: {
  label: string;
  day: number;
  recipe: Recipe | null;
  minutes: number | null;
  isOut: boolean;
  isLeftover: boolean;
  cooked: boolean;
  onCooked: (v: boolean) => void;
  disabled: boolean;
  ariaLabel: string;
  onOpen: () => void;
  side: Recipe | null;
  onOpenSide: () => void;
  onRemoveSide: () => void;
}) {
  // Hueco sin plato: una sola zona grande para elegir
  if (!recipe) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={onOpen}
        aria-label={ariaLabel}
        className={`group flex aspect-[16/9] w-full flex-col items-center justify-center gap-1 rounded-xl text-sm disabled:opacity-70 ${
          isOut ? "bg-cream text-muted" : "border-2 border-dashed border-cream-dark text-muted hover:border-brand hover:text-brand"
        }`}
      >
        <span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span>
        {isOut ? (
          <>
            <span aria-hidden className="text-3xl">🍴</span>
            Como fuera
          </>
        ) : (
          <>
            <PlusIcon className="h-6 w-6" />
            Elegir plato
          </>
        )}
      </button>
    );
  }
  // Tarjeta: la imagen arriba (con "Cambiar"), el nombre abre la receta, y abajo las dos acciones
  return (
    <article className={`overflow-hidden rounded-xl border bg-white ${cooked ? "border-olive" : "border-cream-dark"}`}>
      <div className="relative">
        <RecipeArt tags={recipe.tags} name={recipe.name} photoUrl={recipe.photo_url} className={`aspect-[16/9] w-full text-6xl ${isLeftover ? "opacity-60" : ""}`} />
        <span className="absolute left-2 top-2 flex items-center gap-1">
          <span className="rounded-md bg-white/95 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide">{label}</span>
          <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${isLeftover ? "bg-white/95 text-muted" : "bg-brand text-white"}`}>{isLeftover ? "Sobras" : "Cocinas"}</span>
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={onOpen}
          aria-label={ariaLabel}
          className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold shadow-sm hover:bg-white hover:text-brand disabled:opacity-70"
        >
          <RefreshIcon className="h-3.5 w-3.5" /> Cambiar
        </button>
      </div>
      <div className="p-3">
        <Link href={`/recetas/${recipe.id}?dia=${day}`} className={`line-clamp-2 block min-h-[2.6em] font-semibold leading-snug hover:text-brand hover:underline ${isLeftover ? "text-muted" : ""}`}>
          {recipe.name}
        </Link>
        <p className="mt-0.5 flex min-h-[1.25rem] items-center gap-1 text-xs text-muted">
          {minutes && !isLeftover ? <span>⏱ {minutes} min</span> : isLeftover ? <span>Ya cocinado: solo calentar</span> : null}
          {side && (
            <>
              <span aria-hidden>·</span>
              <Link href={`/recetas/${side.id}`} className="line-clamp-1 text-olive-dark hover:underline">con {side.name.toLowerCase()}</Link>
              <button type="button" disabled={disabled} onClick={onRemoveSide} aria-label={`Quitar ${side.name}`} className="shrink-0 rounded px-1 hover:text-red-700">×</button>
            </>
          )}
        </p>
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-cream-dark pt-2 text-xs">
          <label className={`flex cursor-pointer items-center gap-1.5 ${cooked ? "font-semibold text-olive-dark" : "text-muted"}`}>
            <input type="checkbox" checked={cooked} disabled={disabled} onChange={(e) => onCooked(e.target.checked)} className="h-4 w-4 accent-olive" />
            {cooked ? "Hecho" : isLeftover ? "Comido" : "Cocinado"}
          </label>
          {!side && (
            <button type="button" disabled={disabled} onClick={onOpenSide} aria-label={`Añadir guarnición a ${recipe.name}`} className="font-medium text-muted hover:text-brand">
              ＋ Guarnición
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function dayNumber(weekStart: string, d: number) {
  const [y, m, dd] = weekStart.split("-").map(Number);
  return new Date(y, m - 1, dd + d).getDate();
}

function dayDate(weekStart: string, d: number) {
  const [y, m, dd] = weekStart.split("-").map(Number);
  return new Date(y, m - 1, dd + d).toLocaleDateString("es-ES", { day: "numeric", month: "long" });
}

const GOAL_LABEL: Record<"perder" | "mantener" | "ganar", string> = { perder: "Perder peso", mantener: "Mantenerte", ganar: "Ganar músculo" };

function MeterRow({ label, unit, m }: { label: string; unit: string; m: { value: number; target: number; verdict: "ok" | "bajo" | "alto" } }) {
  const pct = m.target > 0 ? Math.min(130, (m.value / m.target) * 100) : 0;
  const tone = m.verdict === "ok" ? "bg-olive" : m.verdict === "bajo" ? "bg-amber-400" : "bg-brand";
  const word = m.verdict === "ok" ? "bien" : m.verdict === "bajo" ? "poco" : "mucho";
  const fmt = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: unit === "raciones" ? 1 : 0, useGrouping: "always" } as Intl.NumberFormatOptions);
  return (
    <li>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted">
          <b className="text-ink">{fmt(m.value)}</b> de {fmt(m.target)} {unit} · <span className={m.verdict === "ok" ? "text-olive-dark" : "text-brand-dark"}>{word}</span>
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-cream-dark" aria-hidden>
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </li>
  );
}
