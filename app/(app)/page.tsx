import Image from "next/image";
import { CreateMenuButton } from "./home-actions";
import Link from "next/link";
import { ArrowRight, CalendarIcon, CartIcon, CheckIcon, ChevronRight, HeartIcon, PiggyIcon, SearchIcon, UsersIcon } from "@/components/icons";
import { ChainLogo } from "@/components/chain-logo";
import { FridgeIcon } from "@/components/icons-extra";
import { hasFeature } from "@/lib/access";
import { requireUser, userSupermarketIds } from "@/lib/auth";
import { compareList } from "@/lib/compare";
import { euro, formatWeekRange, superName } from "@/lib/format";
import { getOrCreateActiveList } from "@/lib/lists";
import { currentWeekStart, DAYS, getOrCreateMenu, loadRecipes, loadSlots } from "@/lib/menu";
import { recipeEmoji } from "@/lib/recipe-emoji";
import { PRODUCT_COLUMNS, type Product } from "@/lib/types";

export default async function HomePage() {
  const { supabase, user } = await requireUser();
  const weekStart = currentWeekStart();
  const canCook = await hasFeature(supabase, user, "cocinar");
  const [profile, supers, menu, recipes, listId, { data: favRows }, { data: priced }] = await Promise.all([
    supabase.from("profiles").select("display_name,household_size,planning_meals").eq("id", user.id).maybeSingle().then((r) => r.data),
    userSupermarketIds(supabase, user.id),
    getOrCreateMenu(supabase, user.id, weekStart),
    loadRecipes(supabase),
    getOrCreateActiveList(supabase, user.id),
    supabase.from("favorites").select(`product:products(${PRODUCT_COLUMNS})`).eq("user_id", user.id).limit(8),
    supabase.from("supermarkets").select("id").eq("has_prices", true),
  ]);
  const [slots, { data: itemRows }] = await Promise.all([
    loadSlots(supabase, menu.id),
    supabase.from("shopping_list_items").select(`quantity,checked,product:products(${PRODUCT_COLUMNS})`).eq("list_id", listId),
  ]);

  const name = profile?.display_name?.trim() || capitalize(user.email?.split("@")[0] ?? "");
  const recipeById = new Map(recipes.map((r) => [r.id, r]));
  const todayIdx = (new Date().getDay() + 6) % 7;
  const days = [0, 1, 2, 3, 4, 5, 6].map((d) => ({
    day: d,
    label: DAYS[d],
    comida: recipeById.get(slots.find((s) => s.day === d && s.meal === "comida")?.recipe_id ?? -1) ?? null,
    cena: recipeById.get(slots.find((s) => s.day === d && s.meal === "cena")?.recipe_id ?? -1) ?? null,
    comidaOut: slots.find((s) => s.day === d && s.meal === "comida")?.kind === "out",
    cenaOut: slots.find((s) => s.day === d && s.meal === "cena")?.kind === "out",
  }));
  const orderedDays = [...days.slice(todayIdx), ...days.slice(0, todayIdx)];
  const hasMenu = slots.some((s) => s.recipe_id !== null);

  const items = (itemRows ?? [])
    .filter((r) => r.product)
    .map((r) => ({ product: r.product as unknown as Product, quantity: Number(r.quantity), checked: r.checked as boolean }));
  const pending = items.filter((i) => !i.checked).length;
  const listTotal = items.reduce((a, i) => a + (i.product.price ?? 0) * i.quantity, 0);
  const progress = items.length ? Math.round(((items.length - pending) / items.length) * 100) : 0;

  const pricedIds = (priced ?? []).map((p) => p.id as string).filter((id) => supers.includes(id));
  const comparison = items.length > 0 && pricedIds.length > 1 ? await compareList(supabase, items, pricedIds) : null;

  const checked = items.length - pending;
  const shopping = items.length > 0 && checked > 0 && pending > 0; // está en el súper
  const today = days[todayIdx];
  const people = profile?.household_size ?? 2;
  const meals = ((profile?.planning_meals as string[] | null) ?? ["comida", "cena"]).filter((m) => m === "comida" || m === "cena");
  const chainsLabel = supers.map(superName).join(" + ");
  const showComparison = comparison && comparison.comparable > 0 && comparison.cheapest;

  const favorites = (favRows ?? []).map((r) => r.product as unknown as Product | null).filter((p): p is Product => !!p);

  return (
    <main className="flex flex-col gap-6">
      <header className="flex items-center justify-between md:hidden">
        <Image src="/logo.png" alt="Sobremesa" width={56} height={56} priority />
        <Link href="/ajustes" aria-label="Ajustes" className="flex h-11 w-11 items-center justify-center rounded-full bg-olive text-lg font-semibold text-white">
          {name.charAt(0).toUpperCase() || "?"}
        </Link>
      </header>
      <div>
        <h1 className="text-3xl font-bold md:text-4xl">Hola, {name} 👋</h1>
        <p className="mt-1 text-lg text-muted">Tu semana {formatWeekRange(weekStart)}</p>
        <p className="text-muted">Comidas sanas, sencillas y a buen precio.</p>
      </div>

      {/* Fila principal: lo que toca ahora + la compra */}
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        {!hasMenu ? (
          <section className="relative overflow-hidden rounded-2xl border border-cream-dark bg-gradient-to-r from-white via-white to-brand-soft/70 p-6 md:p-8">
            <div className="relative z-10 flex gap-4 md:max-w-[60%]">
              <span className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand md:flex">
                <CalendarIcon className="h-7 w-7" />
              </span>
              <div>
                <h2 className="text-2xl font-bold md:text-4xl">Tu semana empieza aquí</h2>
                <p className="mt-2 text-muted md:text-lg">Crea un menú semanal adaptado a tus gustos, tu presupuesto y con precios reales de tu supermercado.</p>
                <ul className="mt-4 flex flex-wrap gap-2 text-sm">
                  <li className="flex items-center gap-1.5 rounded-xl border border-cream-dark bg-white px-3 py-1.5"><UsersIcon className="h-4 w-4 text-olive" /> {people} {people === 1 ? "persona" : "personas"}</li>
                  <li className="flex items-center gap-1.5 rounded-xl border border-cream-dark bg-white px-3 py-1.5"><span aria-hidden className="text-olive">🍴</span> {meals.length === 2 ? "Comidas y cenas" : meals[0] === "cena" ? "Cenas" : "Comidas"}</li>
                  {chainsLabel && <li className="flex items-center gap-1.5 rounded-xl border border-cream-dark bg-white px-3 py-1.5"><CartIcon className="h-4 w-4 text-olive" /> {chainsLabel}</li>}
                </ul>
                <div className="mt-6">
                  <CreateMenuButton weekStart={weekStart} />
                </div>
                <Link href="/ayuda" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-brand hover:underline">
                  <span aria-hidden className="flex h-5 w-5 items-center justify-center rounded-full border border-brand text-[9px]">▶</span>
                  Ver cómo funciona
                </Link>
              </div>
            </div>
            {/* Ilustración del plato */}
            <div aria-hidden className="pointer-events-none absolute -right-10 top-1/2 hidden h-80 w-80 -translate-y-1/2 items-center justify-center rounded-full bg-brand-soft/80 md:flex">
              <span className="text-[9rem] leading-none drop-shadow-sm">🍝</span>
              <span className="absolute left-6 top-12 text-5xl">🍅</span>
              <span className="absolute bottom-14 left-4 text-4xl">🌿</span>
              <span className="absolute right-20 top-6 text-5xl">🫒</span>
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-cream-dark bg-white p-5 md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand">Hoy · {today.label}</p>
                <h2 className="mt-1 text-2xl font-bold">Qué toca hoy</h2>
              </div>
              <Link href="/menu" className="flex shrink-0 items-center gap-1 text-sm font-medium text-ink hover:text-brand">
                Ver la semana <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <TodayMeal label="Comida" recipe={today.comida} out={today.comidaOut} />
              <TodayMeal label="Cena" recipe={today.cena} out={today.cenaOut} />
            </div>
            <ul className="no-scrollbar -mx-5 mt-4 flex gap-2 overflow-x-auto px-5 md:mx-0 md:px-0">
              {orderedDays.slice(1, 7).map((d) => (
                <li key={d.day} className="w-36 shrink-0 rounded-xl bg-cream px-3 py-2 text-xs">
                  <p className="font-semibold">{d.label}</p>
                  <p className="truncate text-muted">{d.comida?.name ?? (d.comidaOut ? "Como fuera" : "—")}</p>
                  <p className="truncate text-muted">{d.cena?.name ?? (d.cenaOut ? "Como fuera" : "—")}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className={`rounded-2xl border border-cream-dark bg-white p-5 ${shopping ? "lg:order-first" : ""}`}>
          <Link href="/lista" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <CartIcon className="h-6 w-6" />
            </span>
            <span className="flex-1 text-lg font-bold">{shopping ? "Estás comprando" : "Tu compra"}</span>
            <ChevronRight className="h-5 w-5 text-muted" />
          </Link>
          {items.length === 0 ? (
            <div className="flex flex-col items-center py-4 text-center">
              <span aria-hidden className="flex h-20 w-20 items-center justify-center rounded-full bg-cream text-muted">
                <CartIcon className="h-10 w-10" />
              </span>
              <p className="mt-3 font-semibold">Todavía no tienes productos</p>
              <p className="text-sm text-muted">{hasMenu ? "Organiza la compra desde tu menú y la lista se llena sola." : "La lista se generará cuando crees tu menú semanal."}</p>
              <Link href={hasMenu ? "/menu/lista" : "/lista"} className="mt-4 w-full max-w-60 rounded-xl border border-brand/40 bg-white px-4 py-2.5 text-center text-sm font-semibold text-brand hover:bg-brand-soft">
                {hasMenu ? "Organizar la compra" : "Ver lista"}
              </Link>
            </div>
          ) : (
            <>
              <p className="mt-4 text-sm text-muted">
                {items.length} productos · {pending === 0 ? "todo comprado" : `${pending} pendientes`}
              </p>
              {checked > 0 && (
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-cream-dark" aria-hidden>
                  <div className="h-full rounded-full bg-olive" style={{ width: `${progress}%` }} />
                </div>
              )}
              <p className="mt-3 flex items-baseline justify-between">
                <span className="text-sm text-muted">Estimado</span>
                <span className="text-2xl font-bold">{euro(listTotal)}</span>
              </p>
              <Link
                href="/lista"
                className={`mt-4 block rounded-xl px-4 py-3 text-center font-semibold ${shopping ? "bg-brand text-white hover:bg-brand-dark" : "border border-cream-dark text-ink hover:bg-cream"}`}
              >
                {shopping ? "Seguir comprando" : "Ver lista"}
              </Link>
            </>
          )}
        </section>
      </div>

      {/* Mejor supermercado: solo cuando hay algo que comparar */}
      {showComparison && comparison.cheapest && (
        <section className="rounded-2xl border border-cream-dark bg-white p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold">Mejor supermercado esta semana</h2>
            <span className="text-xs text-muted">Con los {comparison.comparable} productos que hay en las dos cadenas</span>
          </div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-3">
            {comparison.chains
              .slice()
              .sort((a, b) => a.total - b.total)
              .map((c) => {
                const best = comparison.cheapest?.id === c.id;
                return (
                  <li key={c.id} className={`flex items-center gap-2 rounded-xl px-3 py-2.5 ${best ? "bg-olive-soft" : "bg-cream"}`}>
                    <ChainLogo id={c.id} name={superName(c.id)} size={22} />
                    <span className="flex-1 text-sm font-medium">{superName(c.id)}</span>
                    <span className={`font-bold ${best ? "text-olive-dark" : ""}`}>{euro(c.total)}</span>
                  </li>
                );
              })}
            {comparison.saving > 0.005 && (
              <li className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-olive-dark">
                <PiggyIcon className="h-5 w-5 shrink-0" />
                <span>Ahorras <b>{euro(comparison.saving)}</b></span>
              </li>
            )}
          </ul>
        </section>
      )}

      {/* ¿Qué cocino hoy? (en pruebas: solo para algunos correos) */}
      {canCook && (
        <Link href="/cocinar" className="flex items-center gap-4 rounded-2xl bg-olive-soft p-4 hover:brightness-[0.98]">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-olive text-white">
            <FridgeIcon className="h-6 w-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-bold leading-tight">¿Qué cocino hoy?</span>
            <span className="block text-sm text-muted">Dinos qué tienes en casa y cuánto quieres gastar. Te sugerimos recetas con tus ingredientes.</span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-ink" />
        </Link>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <section className="rounded-2xl border border-cream-dark bg-white p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand"><SearchIcon className="h-6 w-6" /></span>
            <div>
              <h2 className="text-lg font-bold">Buscar un producto</h2>
              <p className="text-sm text-muted">Consulta precios reales en tus supermercados.</p>
            </div>
          </div>
          <form action="/buscar" className="relative mt-4">
            <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
            <input type="search" name="q" placeholder="Leche, pasta, huevos, aceite…" className="w-full rounded-xl border border-cream-dark bg-cream/50 py-3 pl-12 pr-4 outline-none focus:border-brand" />
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            {["Leche", "Huevos", "Arroz", "Café"].map((q) => (
              <Link key={q} href={`/buscar?q=${encodeURIComponent(q.toLowerCase())}`} className="rounded-xl bg-cream px-3 py-1.5 text-sm text-ink hover:bg-cream-dark">
                {q}
              </Link>
            ))}
          </div>
        </section>

        <section className="relative overflow-hidden rounded-2xl border border-cream-dark bg-white p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand"><HeartIcon className="h-6 w-6" /></span>
            <h2 className="flex-1 text-lg font-bold">Tus favoritos</h2>
            {favorites.length > 0 && <Link href="/favoritos" className="text-sm font-medium text-brand hover:underline">Ver todos</Link>}
          </div>
          {favorites.length === 0 ? (
            <div className="relative mt-3">
              <p className="text-muted">Todavía no tienes favoritos.</p>
              <p className="text-muted">Guarda productos mientras buscas.</p>
              <Link href="/buscar" className="mt-3 inline-flex items-center gap-1 font-medium text-brand hover:underline">
                Explorar productos <ArrowRight className="h-4 w-4" />
              </Link>
              <div aria-hidden className="pointer-events-none absolute -bottom-2 right-0 hidden text-5xl sm:block">
                <span className="relative -top-6 left-6 text-3xl">❤️</span>🥛<span className="text-4xl">🍅</span>
              </div>
            </div>
          ) : (
            <ul className="no-scrollbar -mx-5 mt-3 flex gap-3 overflow-x-auto px-5 pb-1">
              {favorites.slice(0, 6).map((p) => (
                <li key={p.id} className="flex w-40 shrink-0 gap-2 rounded-xl border border-cream-dark p-2">
                  <div className="flex h-12 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-cream">
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image_url} alt="" className="h-full w-full object-contain" loading="lazy" />
                    ) : (
                      <span className="text-xl">🛒</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{shortName(p.name)}</p>
                    <p className="text-base font-bold">{euro(p.price)}</p>
                    <p className="flex items-center gap-1 truncate text-[11px] text-muted">
                      <ChainLogo id={p.supermarket_id} size={12} /> {superName(p.supermarket_id)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Próxima semana */}
      <section className="overflow-hidden rounded-2xl border border-cream-dark bg-white md:grid md:grid-cols-[220px_1fr_auto_auto] md:items-center">
        <div aria-hidden className="hidden h-full min-h-32 items-center justify-center gap-1 bg-gradient-to-br from-olive-soft to-brand-soft text-5xl md:flex">
          📋<span className="text-4xl">🥕🍅</span>
        </div>
        <div className="p-5">
          <h2 className="text-xl font-bold">¿Sin ideas para la próxima semana?</h2>
          <p className="mt-1 text-sm text-muted">Te ayudamos a crear un menú equilibrado con recetas sencillas y generamos la lista de la compra automáticamente.</p>
        </div>
        <ul className="hidden flex-col gap-1.5 px-5 text-sm md:flex md:border-r md:border-cream-dark">
          {["Recetas sanas y rápidas", "Adaptado a tus gustos", "Con precios reales"].map((t) => (
            <li key={t} className="flex items-center gap-2"><CheckIcon className="h-4 w-4 rounded-full bg-olive-soft text-olive" /> {t}</li>
          ))}
        </ul>
        <div className="px-5 pb-5 md:p-5">
          <Link
            href="/menu?semana=siguiente"
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 font-semibold ${hasMenu ? "bg-brand text-white hover:bg-brand-dark" : "border border-brand/40 text-brand hover:bg-brand-soft"}`}
          >
            Crear menú semanal <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}

function TodayMeal({ label, recipe, out }: { label: string; recipe: { id: number; name: string; tags: string[] } | null; out?: boolean }) {
  const inner = (
    <>
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-cream text-2xl">
        {recipe ? recipeEmoji(recipe.tags, recipe.name) : out ? "🍴" : "·"}
      </span>
      <span className="min-w-0">
        <span className="block text-xs text-muted">{label}</span>
        <span className="line-clamp-2 font-semibold leading-tight">{recipe?.name ?? (out ? "Como fuera" : "Sin plato")}</span>
      </span>
    </>
  );
  return recipe ? (
    <Link href={`/recetas/${recipe.id}`} className="flex items-center gap-3 rounded-xl bg-cream/60 p-3 hover:bg-cream">{inner}</Link>
  ) : (
    <div className="flex items-center gap-3 rounded-xl bg-cream/60 p-3">{inner}</div>
  );
}

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function shortName(name: string) {
  return name.split(" ").slice(0, 3).join(" ");
}
