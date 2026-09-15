import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CartIcon, ChartIcon, ChevronRight, PiggyIcon, SearchIcon } from "@/components/icons";
import { requireUser, userSupermarketIds } from "@/lib/auth";
import { compareList } from "@/lib/compare";
import { euro, superName, superStyle } from "@/lib/format";
import { getOrCreateActiveList } from "@/lib/lists";
import { currentWeekStart, DAYS, getOrCreateMenu, loadRecipes, loadSlots } from "@/lib/menu";
import { recipeEmoji } from "@/lib/recipe-emoji";
import { PRODUCT_COLUMNS, type Product } from "@/lib/types";

export default async function HomePage() {
  const { supabase, user } = await requireUser();
  const weekStart = currentWeekStart();
  const [profile, supers, menu, recipes, listId, { data: favRows }, { data: priced }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle().then((r) => r.data),
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

  const favorites = (favRows ?? []).map((r) => r.product as unknown as Product | null).filter((p): p is Product => !!p);

  return (
    <main className="flex flex-col gap-4">
      {/* Cabecera */}
      <header className="flex items-center justify-between md:hidden">
        <Image src="/logo.png" alt="Sobremesa" width={56} height={56} priority />
        <Link
          href="/ajustes"
          aria-label="Ajustes"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-olive text-lg font-semibold text-white"
        >
          {name.charAt(0).toUpperCase() || "?"}
        </Link>
      </header>
      <div>
        <h1 className="text-3xl font-bold">Hola, {name} 👋</h1>
        <p className="mt-1 text-muted">Tu semana {formatWeekRange(weekStart)}</p>
      </div>

      {/* Menú de la semana */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">Tu menú de esta semana</h2>
            <p className="text-sm text-muted">Comidas sencillas y a buen precio</p>
          </div>
          <Link href="/menu" className="flex shrink-0 items-center gap-1 text-sm font-medium text-brand">
            {hasMenu ? "Ver completo" : "Generar"} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {hasMenu ? (
          <div className="no-scrollbar -mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0 lg:grid-cols-7">
            {orderedDays.map((d, i) => (
              <div
                key={d.day}
                className={`w-44 shrink-0 rounded-xl border p-3 md:w-auto ${
                  i === 0 ? "border-brand-soft bg-brand-soft/60" : "border-cream-dark bg-cream/60"
                }`}
              >
                <p className={`mb-2 text-sm font-semibold ${i === 0 ? "text-brand" : ""}`}>
                  {i === 0 ? `HOY · ${d.label}` : d.label}
                </p>
                <Meal label="Comida" recipe={d.comida} />
                <div className="my-2 border-t border-cream-dark" />
                <Meal label="Cena" recipe={d.cena} />
              </div>
            ))}
          </div>
        ) : (
          <Link href="/menu" className="mt-3 block rounded-xl bg-brand px-4 py-3 text-center font-semibold text-white">
            Generar mi menú semanal
          </Link>
        )}
      </section>

      {/* Compra + comparativa */}
      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <Link href="/lista" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-white">
              <CartIcon className="h-6 w-6" />
            </span>
            <span className="flex-1 text-lg font-bold">Tu compra</span>
            <ChevronRight className="h-5 w-5 text-muted" />
          </Link>
          <p className="mt-3 text-sm text-muted">
            {items.length} productos · {pending} pendientes
          </p>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-cream-dark">
              <div className="h-full rounded-full bg-olive" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs text-muted">{progress}%</span>
          </div>
          <p className="mt-3 flex items-baseline justify-between">
            <span className="text-sm text-muted">Estimado:</span>
            <span className="text-2xl font-bold">{euro(listTotal)}</span>
          </p>
          <Link href="/lista" className="mt-3 block rounded-xl bg-brand px-4 py-3 text-center font-semibold text-white">
            Ver lista
          </Link>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <Link href="/lista" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-olive text-white">
              <ChartIcon className="h-6 w-6" />
            </span>
            <span className="flex-1 text-lg font-bold leading-tight">¿Dónde sale más barata?</span>
            <ChevronRight className="h-5 w-5 text-muted" />
          </Link>
          <p className="mt-1 text-sm text-muted">
            {comparison && comparison.comparable > 0
              ? `${comparison.comparable} de ${comparison.items} productos existen en las dos cadenas`
              : "Comparativa de tu lista actual"}
          </p>
          {comparison ? (
            <>
              <ul className="mt-3 flex flex-col gap-2">
                {comparison.chains
                  .slice()
                  .sort((a, b) => a.total - b.total)
                  .map((c) => {
                    const best = comparison.cheapest?.id === c.id;
                    return (
                      <li
                        key={c.id}
                        className={`flex items-center gap-2 rounded-xl px-3 py-2 ${best ? "bg-olive-soft" : "bg-cream"}`}
                      >
                        <span className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${superStyle(c.id).badge}`}>
                          {superName(c.id).slice(0, 3).toUpperCase()}
                        </span>
                        <span className="flex-1 text-sm font-medium">{superName(c.id)}</span>
                        <span className={`font-bold ${best ? "text-olive-dark" : ""}`}>{euro(c.total)}</span>
                        {c.missing > 0 && (
                          <span className="text-xs text-muted" title="Productos que no encuentro en esta cadena">
                            · faltan {c.missing}
                          </span>
                        )}
                      </li>
                    );
                  })}
              </ul>
              {comparison.cheapest && comparison.saving > 0.005 && (
                <p className="mt-3 flex items-center gap-2 rounded-xl bg-olive-soft px-3 py-2 text-sm text-olive-dark">
                  <PiggyIcon className="h-6 w-6 shrink-0" />
                  <span>
                    <b>Ahorras {euro(comparison.saving)}</b> comprando lo comparable en {superName(comparison.cheapest.id)}
                  </span>
                </p>
              )}
            </>
          ) : (
            <p className="mt-3 text-sm text-muted">
              {items.length === 0 ? "Añade productos a tu lista para comparar." : "Necesitas dos supermercados con precios para comparar."}
            </p>
          )}
          {comparison && comparison.comparable === 0 && (
            <p className="mt-3 text-sm text-muted">Ninguno de tus productos existe en las dos cadenas a la vez.</p>
          )}
        </section>
      </div>

      {/* Buscador */}
      <form action="/buscar" className="relative">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
        <input
          type="search"
          name="q"
          placeholder="Buscar leche, pasta, huevos…"
          className="w-full rounded-2xl border border-cream-dark bg-white py-3.5 pl-12 pr-4 text-base shadow-sm outline-none focus:border-brand"
        />
      </form>

      {/* Favoritos */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">Tus favoritos</h2>
            <p className="text-sm text-muted">Accede rápido a tus productos habituales</p>
          </div>
          <Link href="/favoritos" className="flex shrink-0 items-center gap-1 text-sm font-medium text-brand">
            Ver todos <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {favorites.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Marca productos con ★ en el buscador y aparecerán aquí.</p>
        ) : (
          <ul className="no-scrollbar -mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
            {favorites.map((p) => (
              <li key={p.id} className="flex w-36 shrink-0 gap-2 rounded-xl border border-cream-dark p-2 md:w-auto">
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
                  <p className="text-base font-bold text-olive-dark">{euro(p.price)}</p>
                  <p className="truncate text-[11px] text-muted">{superName(p.supermarket_id)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Meal({ label, recipe }: { label: string; recipe: { name: string; tags: string[] } | null }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-2xl shadow-sm">
        {recipe ? recipeEmoji(recipe.tags, recipe.name) : "·"}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] text-muted">{label}</p>
        <p className="line-clamp-2 text-sm font-medium leading-tight">{recipe?.name ?? "Sin plato"}</p>
      </div>
    </div>
  );
}

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function shortName(name: string) {
  return name.split(" ").slice(0, 3).join(" ");
}

function formatWeekRange(weekStart: string) {
  const [y, m, d] = weekStart.split("-").map(Number);
  const start = new Date(y, m - 1, d);
  const end = new Date(y, m - 1, d + 6);
  const month = end.toLocaleDateString("es-ES", { month: "long" });
  if (start.getMonth() === end.getMonth()) return `del ${start.getDate()} al ${end.getDate()} de ${month}`;
  const m1 = start.toLocaleDateString("es-ES", { month: "long" });
  return `del ${start.getDate()} de ${m1} al ${end.getDate()} de ${month}`;
}
