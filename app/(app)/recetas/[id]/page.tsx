import Link from "next/link";
import { notFound } from "next/navigation";
import { ChainLogo } from "@/components/chain-logo";
import { CheckIcon, PiggyIcon } from "@/components/icons";
import { BulbIcon } from "@/components/icons-extra";
import { RecipeArt } from "@/components/recipe-art";
import { requireUser, userSupermarketIds } from "@/lib/auth";
import { euro } from "@/lib/format";
import { getOrCreateActiveList } from "@/lib/lists";
import { cheapestProductFor, currentWeekStart, DAYS, toProductUnit, type Need } from "@/lib/menu";
import { nutritionPerServing, unitGramsOf } from "@/lib/nutrition";
import { keywords, stem, unaccent } from "@/lib/search";
import { PRODUCT_COLUMNS, type Product } from "@/lib/types";
import { AddAllButton, AddToMenuControl, DeleteRecipeButton, FavoriteRecipeButton, IngredientAddButton } from "./recipe-client";

type Ing = { ingredient_name: string; qty: number; unit: string };

const TIPS: Record<string, string> = {
  legumbre: "Cocina el doble de legumbre y congela la mitad: tendrás otra comida lista en minutos.",
  arroz: "Cocina un poco más de arroz y guárdalo en la nevera. Te servirá de base para otras recetas durante la semana.",
  pasta: "Guarda un vaso del agua de cocer la pasta: ayuda a ligar la salsa sin añadir nata.",
  carne: "Saca la carne de la nevera 15 minutos antes de cocinarla para que se haga de forma uniforme.",
  pescado: "El pescado congelado de calidad es igual de nutritivo y suele salir más barato.",
  huevo: "Los huevos a temperatura ambiente cuajan de forma más uniforme.",
  sopa: "Haz caldo de más y congélalo en porciones: es la base de cremas y arroces.",
  ensalada: "Aliña la ensalada justo antes de servir para que no se ablande.",
  verdura: "Las verduras de temporada están más ricas y cuestan menos.",
  guiso: "Los guisos están aún mejor al día siguiente: haz ración doble para otra comida.",
};

export default async function RecipePage(props: PageProps<"/recetas/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const recipeId = Number(id);
  if (!Number.isInteger(recipeId)) notFound();
  const { supabase, user } = await requireUser();

  const [{ data: recipe }, { data: ingRows }, { data: profile }, supers, { data: chainRows }, listId, { data: fav }, { data: allRecipes }, { data: weekMenu }] =
    await Promise.all([
      supabase.from("recipes").select("id,name,meal,servings,tags,description,time_minutes,difficulty,steps,owner_id,author_name,visibility").eq("id", recipeId).maybeSingle(),
      supabase.from("recipe_ingredients").select("ingredient_name,qty,unit").eq("recipe_id", recipeId).order("id"),
      supabase.from("profiles").select("household_size").eq("id", user.id).maybeSingle(),
      userSupermarketIds(supabase, user.id),
      supabase.from("supermarkets").select("id,name,has_prices"),
      getOrCreateActiveList(supabase, user.id),
      supabase.from("favorite_recipes").select("recipe_id").eq("user_id", user.id).eq("recipe_id", recipeId).maybeSingle(),
      supabase.from("recipes").select("id,name,tags,time_minutes,difficulty"),
      supabase.from("weekly_menus").select("id,week_start").eq("user_id", user.id).eq("week_start", currentWeekStart()).maybeSingle(),
    ]);
  if (!recipe) notFound();

  const tags: string[] = recipe.tags ?? [];
  const isMine = recipe.owner_id === user.id;
  const authorLabel = recipe.owner_id === null ? "Receta de Sobremesa" : isMine ? "Receta tuya" : `Receta de ${recipe.author_name ?? "otra persona"}`;
  const VIS: Record<string, string> = { private: "solo la ves tú", friends: "la ven tus amigos", public: "la ve todo el mundo" };
  const ings = (ingRows ?? []) as Ing[];
  const people = profile?.household_size ?? 2;
  const base = Number(recipe.servings) || 4;
  const needs: Need[] = ings.map((i) => ({ ingredient: i.ingredient_name, qty: (Number(i.qty) * people) / base, unit: i.unit }));

  const [{ data: listRows }, { data: mapRows }, weekSlots] = await Promise.all([
    supabase.from("shopping_list_items").select("product:products(name)").eq("list_id", listId),
    supabase.from("ingredient_product_map").select(`ingredient_name,product:products(${PRODUCT_COLUMNS})`).eq("user_id", user.id).in("ingredient_name", needs.map((n) => n.ingredient)),
    weekMenu
      ? supabase.from("weekly_menu_slots").select("day,meal").eq("menu_id", weekMenu.id).eq("recipe_id", recipeId).then((r) => (r.data ?? []) as { day: number; meal: string }[])
      : Promise.resolve([] as { day: number; meal: string }[]),
  ]);

  // ¿Ya está el ingrediente en la lista? (algún producto cuyo nombre contiene sus palabras)
  const listNames = (listRows ?? []).map((r) => unaccent(((r.product as unknown as { name: string } | null)?.name) ?? ""));
  const inList = (ingredient: string) => {
    const words = keywords(ingredient).map(stem);
    return words.length > 0 && listNames.some((n) => words.every((w) => n.includes(w)));
  };
  const mapped = new Map<string, Product>();
  for (const m of mapRows ?? []) {
    const p = m.product as unknown as Product | null;
    if (p) mapped.set(m.ingredient_name as string, p);
  }

  // Coste en cada supermercado con precios: cantidad proporcional de cada ingrediente
  const priced = (chainRows ?? []).filter((c) => c.has_prices && supers.includes(c.id as string));
  const costs = await Promise.all(
    priced.map(async (c) => {
      let total = 0;
      let missing = 0;
      await Promise.all(
        needs.map(async (need) => {
          const saved = mapped.get(need.ingredient);
          const p = saved && saved.supermarket_id === c.id ? saved : await cheapestProductFor(supabase, need, [c.id as string]);
          if (!p) {
            missing += 1;
            return;
          }
          total += ingredientCost(need, p);
        })
      );
      return { id: c.id as string, name: c.name as string, total, missing };
    })
  );
  const ranked = costs.sort((a, b) => a.missing - b.missing || a.total - b.total);
  const best = ranked[0] ?? null;
  const second = ranked[1] ?? null;
  const perPerson = best && best.missing === 0 ? best.total / people : null;
  const saving = best && second && best.missing === 0 && second.missing === 0 ? second.total - best.total : 0;
  // Solo se comparan precios si todas las cadenas tienen todos los ingredientes
  const comparable = ranked.length > 1 && ranked.every((c) => c.missing === 0);

  const nutri = nutritionPerServing(ings, base);
  const steps: string[] = recipe.steps ?? [];
  const missingNeeds = needs.filter((n) => !inList(n.ingredient));
  const dayParam = typeof sp.dia === "string" ? Number(sp.dia) : NaN;
  const dayName = Number.isInteger(dayParam) && dayParam >= 0 && dayParam <= 6 ? DAYS[dayParam] : null;
  const isFav = !!fav;

  const similar = (allRecipes ?? [])
    .filter((r) => r.id !== recipeId)
    .map((r) => ({ id: r.id as number, name: r.name as string, tags: (r.tags ?? []) as string[], time: r.time_minutes as number | null, difficulty: r.difficulty as string | null }))
    .map((r) => ({ ...r, score: r.tags.filter((t) => tags.includes(t)).length }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "es"))
    .slice(0, 4);

  const weekText =
    weekSlots.length > 0 && weekMenu
      ? `Forma parte de tu menú semanal: ${weekSlots
          .map((s) => `${s.meal} del ${dayLabel(weekMenu.week_start as string, s.day)}`)
          .join(" y ")}.`
      : "Todavía no está en tu menú de esta semana. Puedes ponerla en cualquier comida o cena desde el menú.";

  return (
    <main className="grid gap-5 lg:grid-cols-[1fr_340px] lg:items-start">
      <div className="flex min-w-0 flex-col gap-5">
        <div>
          <nav aria-label="Ruta" className="mb-2 flex flex-wrap items-center gap-1.5 text-sm text-muted">
            <Link href={dayName ? "/menu" : "/recetas"} className="hover:text-brand">{dayName ? "Menú semanal" : "Banco de recetas"}</Link>
            {dayName && (
              <>
                <span aria-hidden>/</span>
                <Link href="/menu" className="hover:text-brand">{dayName}</Link>
              </>
            )}
            <span aria-hidden>/</span>
            <span className="text-ink">{recipe.name}</span>
          </nav>
          <div className="flex items-start gap-3">
            <h1 className="text-3xl font-bold md:text-4xl">{recipe.name}</h1>
            <FavoriteRecipeButton key={`h-${isFav}`} recipeId={recipeId} initial={isFav} variant="icon" />
          </div>
          <p className="mt-1 text-muted md:text-lg">{recipe.description ?? "Receta casera sencilla para tu menú semanal."}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className={`rounded-lg px-2.5 py-1 font-medium ${isMine ? "bg-brand-soft text-brand-dark" : recipe.owner_id ? "bg-olive-soft text-olive-dark" : "bg-cream"}`}>{authorLabel}</span>
            {isMine && <span className="text-muted">{VIS[recipe.visibility as string]}</span>}
            {isMine && (
              <>
                <Link href={`/recetas/${recipeId}/editar`} className="rounded-xl border border-cream-dark bg-white px-4 py-2 font-medium hover:bg-cream">Editar</Link>
                <DeleteRecipeButton recipeId={recipeId} />
              </>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_1.1fr]">
          <div className="flex flex-col gap-3">
            <RecipeArt tags={tags} name={recipe.name} className="aspect-[4/3] rounded-2xl text-8xl shadow-sm" />
            <div className="grid grid-cols-2 gap-2">
              <Stat emoji="⏱️" value={recipe.time_minutes ? `${recipe.time_minutes} min` : "—"} label="Tiempo total" />
              <Stat emoji="🧑‍🍳" value={recipe.difficulty ?? "—"} label="Dificultad" />
              <Stat emoji="👥" value={`${people} ${people === 1 ? "persona" : "personas"}`} label="Raciones" />
              <Stat emoji="💶" value={perPerson !== null ? euro(perPerson) : "—"} label="por persona" />
            </div>
          </div>

          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="mb-2 flex flex-wrap items-baseline gap-x-2 text-lg font-bold">
              Ingredientes <span className="text-sm font-normal text-muted">(para {people} {people === 1 ? "persona" : "personas"})</span>
            </h2>
            <ul className="divide-y divide-cream-dark">
              {needs.map((n) => (
                <li key={`${n.ingredient}-${n.unit}`} className="flex items-center gap-3 py-2">
                  <span aria-hidden className="w-7 shrink-0 text-center text-xl">{ingredientEmoji(n.ingredient)}</span>
                  <span className="min-w-0 flex-1 text-sm">{capitalize(n.ingredient)}</span>
                  <span className="w-20 shrink-0 text-xs text-muted">{fmtQty(n.qty, n.unit)}</span>
                  {inList(n.ingredient) ? (
                    <span className="flex w-28 shrink-0 items-center justify-center gap-1 rounded-lg bg-olive-soft px-2 py-1 text-xs font-medium text-olive-dark">
                      <CheckIcon className="h-3.5 w-3.5" /> Ya en tu lista
                    </span>
                  ) : (
                    <IngredientAddButton recipeId={recipeId} need={n} />
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-lg font-bold">Preparación</h2>
            {steps.length > 0 ? (
              <ol className="flex flex-col gap-3">
                {steps.map((s, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">{i + 1}</span>
                    <span className="pt-0.5">{s}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted">Todavía no tenemos los pasos de esta receta.</p>
            )}
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold">Información nutricional</h2>
            <p className="text-sm text-muted">Valores aproximados por ración</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Nutri emoji="🥩" bg="bg-rose-50" label="Proteínas" value={`${nutri.protein} g`} />
              <Nutri emoji="🥬" bg="bg-olive-soft" label="Verduras" value={`${nutri.veg} g`} />
              <Nutri emoji="🌾" bg="bg-amber-50" label="Hidratos" value={`${nutri.carbs} g`} />
              <Nutri emoji="🔥" bg="bg-brand-soft" label="Calorías" value={`${nutri.kcal} kcal`} />
            </div>
            {nutri.covered < nutri.total && (
              <p className="mt-2 text-xs text-muted">Calculado con {nutri.covered} de {nutri.total} ingredientes.</p>
            )}
          </section>
        </div>

        {similar.length > 0 && (
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold">Recetas similares</h2>
            <p className="text-sm text-muted">Otras recetas que pueden gustarte</p>
            <ul className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              {similar.map((r) => (
                <li key={r.id}>
                  <Link href={`/recetas/${r.id}`} className="group block">
                    <RecipeArt tags={r.tags} name={r.name} className="aspect-[4/3] rounded-xl text-5xl transition group-hover:brightness-95" />
                    <p className="mt-1.5 line-clamp-2 text-sm font-medium leading-tight group-hover:text-brand">{r.name}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {r.time ? `⏱️ ${r.time} min` : ""}{r.time && r.difficulty ? " · " : ""}{r.difficulty ?? ""}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <aside className="flex flex-col gap-4">
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold">Coste de esta receta</h2>
          <p className="text-sm text-muted">Precio estimado de los ingredientes para {people} {people === 1 ? "persona" : "personas"}</p>
          {ranked.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No hay precios de tus supermercados.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {ranked.map((c, i) => (
                <li key={c.id} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${i === 0 && comparable && saving > 0.005 ? "bg-olive-soft" : "bg-cream"}`}>
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm">
                    <ChainLogo id={c.id} name={c.name} size={24} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{c.name}</span>
                    {c.missing > 0 && <span className="block text-xs text-muted">faltan {c.missing} ingredientes</span>}
                  </span>
                  <span className="font-bold">{euro(c.total)}</span>
                  {comparable &&
                    (i === 0 && ranked[1].total - ranked[0].total > 0.005 ? (
                      <span className="rounded-full bg-olive px-2 py-0.5 text-xs font-medium text-white">Más barato</span>
                    ) : i > 0 && c.total - ranked[0].total > 0.005 ? (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">+{euro(c.total - ranked[0].total)}</span>
                    ) : (
                      <span className="rounded-full bg-cream-dark px-2 py-0.5 text-xs font-medium">Igual</span>
                    ))}
                </li>
              ))}
            </ul>
          )}
          {best && second && saving > 0.005 && (
            <p className="mt-3 flex items-center gap-3 rounded-xl bg-olive-soft px-3 py-3 text-olive-dark">
              <PiggyIcon className="h-7 w-7 shrink-0" />
              <span>
                <b>Ahorro de {euro(saving)} en {best.name}</b>
                <br />
                <span className="text-sm">Frente al siguiente precio más bajo ({second.name}).</span>
              </span>
            </p>
          )}
          <AddAllButton recipeId={recipeId} needs={missingNeeds} />
          <AddToMenuControl recipeId={recipeId} meal={recipe.meal as string} todayIndex={(new Date().getDay() + 6) % 7} />
          <FavoriteRecipeButton key={`b-${isFav}`} recipeId={recipeId} initial={isFav} variant="button" />
        </section>

        <section className="flex gap-3 rounded-2xl bg-olive-soft p-4">
          <CheckIcon className="mt-0.5 h-7 w-7 shrink-0 text-olive-dark" />
          <div>
            <p className="font-bold text-olive-dark">{weekSlots.length > 0 ? "Encaja con tu semana" : "Añádela a tu semana"}</p>
            <p className="text-sm text-olive-dark/90">{weekText}</p>
          </div>
        </section>

        <section className="flex gap-3 rounded-2xl bg-brand-soft p-4">
          <BulbIcon className="h-8 w-8 shrink-0 text-brand" />
          <div>
            <p className="font-bold">Consejo Sobremesa</p>
            <p className="text-sm text-ink/80">{TIPS[tags[0] ?? ""] ?? "Prepara y corta todos los ingredientes antes de encender el fuego: cocinarás más rápido y con menos estrés."}</p>
          </div>
        </section>
      </aside>
    </main>
  );
}

function Stat({ emoji, value, label }: { emoji: string; value: string; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 shadow-sm">
      <span aria-hidden className="text-xl">{emoji}</span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold">{value}</span>
        <span className="block truncate text-[11px] text-muted">{label}</span>
      </span>
    </div>
  );
}

function Nutri({ emoji, bg, label, value }: { emoji: string; bg: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-cream-dark p-3">
      <span aria-hidden className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl ${bg}`}>{emoji}</span>
      <span>
        <span className="block text-xs text-muted">{label}</span>
        <span className="block font-bold">{value}</span>
      </span>
    </div>
  );
}

/** Coste proporcional: lo que cuesta la cantidad que usa la receta, no el envase entero. */
function ingredientCost(need: Need, p: Product): number {
  const want = toProductUnit(need.qty, need.unit);
  if (p.unit_price != null && p.unit === want.unit) return p.unit_price * want.qty;
  // Ingrediente por unidades (1 cebolla) y producto por kilo: usamos el peso típico de la unidad
  const grams = want.unit === "ud" ? unitGramsOf(need.ingredient) : null;
  if (grams !== null && p.unit === "kg" && p.unit_price != null) return p.unit_price * ((want.qty * grams) / 1000);
  return p.price ?? 0;
}

function fmtQty(qty: number, unit: string): string {
  if (unit === "g" || unit === "ml") {
    const v = Math.max(5, Math.round(qty / 5) * 5);
    if (v >= 1000) return `${(v / 1000).toLocaleString("es-ES", { maximumFractionDigits: 2 })} ${unit === "g" ? "kg" : "L"}`;
    return `${v} ${unit}`;
  }
  const u = Math.max(0.5, Math.round(qty * 2) / 2);
  return `${u.toLocaleString("es-ES")} ${u === 1 ? "unidad" : "unidades"}`;
}

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function dayLabel(weekStart: string, day: number) {
  const [y, m, d] = weekStart.split("-").map(Number);
  return new Date(y, m - 1, d + day).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}

const EMOJI: [RegExp, string][] = [
  [/pollo/, "🍗"], [/arroz/, "🍚"], [/cebolla/, "🧅"], [/ajo/, "🧄"], [/tomate/, "🍅"], [/patata/, "🥔"],
  [/zanahoria/, "🥕"], [/aceite|aceituna/, "🫒"], [/huevo/, "🥚"], [/nata|leche/, "🥛"], [/queso/, "🧀"],
  [/pan/, "🍞"], [/macarrones|espaguetis|fideos/, "🍝"], [/pimiento/, "🫑"], [/lechuga|espinacas/, "🥬"],
  [/brocoli/, "🥦"], [/calabacin/, "🥒"], [/berenjena/, "🍆"], [/champi/, "🍄"], [/gambas/, "🍤"],
  [/merluza|bacalao|salmon|atun/, "🐟"], [/ternera|lomo|chorizo|jamon|carne/, "🥩"],
  [/lentejas|garbanzos|alubias|guisantes|judias/, "🫘"], [/limon/, "🍋"], [/platano/, "🍌"], [/vino/, "🍷"],
  [/caldo/, "🥣"], [/harina/, "🌾"], [/laurel|perejil/, "🌿"], [/maiz/, "🌽"], [/calabaza/, "🎃"], [/pimenton|guindilla/, "🌶️"],
];
function ingredientEmoji(name: string) {
  const n = unaccent(name);
  return EMOJI.find(([re]) => re.test(n))?.[1] ?? "🧂";
}
