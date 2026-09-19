import { requireUser, userSupermarketIds } from "@/lib/auth";
import { compareList } from "@/lib/compare";
import { formatWeekRange, superName } from "@/lib/format";
import { getOrCreateActiveList } from "@/lib/lists";
import {
  aggregateIngredients,
  currentWeekStart,
  defaultCookSessions,
  getOrCreateMenu,
  loadRecipes,
  loadSlots,
  weekOffsetFrom,
  type Recipe,
} from "@/lib/menu";
import { PRODUCT_COLUMNS, type Product } from "@/lib/types";
import { MenuGrid, type BalanceItem, type MenuSettings } from "./menu-grid";

const DIET_LABEL: Record<string, string> = {
  todo: "Cocina casera de todo",
  vegetariano: "Cocina vegetariana",
  vegano: "Cocina vegana",
  pescetariano: "Cocina pescetariana",
  otro: "Dieta personalizada",
};
const MEAL_LABEL: Record<string, string> = { comida: "comidas", cena: "cenas", desayuno: "desayunos", merienda: "meriendas" };

export default async function MenuPage(props: PageProps<"/menu">) {
  const sp = await props.searchParams;
  const offset = weekOffsetFrom(sp.semana);
  const { supabase, user } = await requireUser();
  const weekStart = currentWeekStart(offset);

  const [{ data: profile }, supers, { data: chainRows }, listId] = await Promise.all([
    supabase.from("profiles").select("household_size,planning_meals,diet,allergies,avoid_foods,cook_sessions").eq("id", user.id).maybeSingle(),
    userSupermarketIds(supabase, user.id),
    supabase.from("supermarkets").select("id,name,has_prices"),
    getOrCreateActiveList(supabase, user.id),
  ]);
  const menu = await getOrCreateMenu(supabase, user.id, weekStart, profile?.household_size ?? 2);
  const [recipes, slots, { data: itemRows }] = await Promise.all([
    loadRecipes(supabase),
    loadSlots(supabase, menu.id),
    supabase.from("shopping_list_items").select(`quantity,product:products(${PRODUCT_COLUMNS})`).eq("list_id", listId),
  ]);
  const needs = await aggregateIngredients(supabase, slots, menu.servings);

  // Lista actual y comparativa entre cadenas con precios
  const items = (itemRows ?? [])
    .filter((r) => r.product)
    .map((r) => ({ product: r.product as unknown as Product, quantity: Number(r.quantity) }));
  const listTotal = items.reduce((a, i) => a + (i.product.price ?? 0) * i.quantity, 0);
  const myChains = (chainRows ?? []).filter((c) => supers.includes(c.id as string));
  const pricedIds = myChains.filter((c) => c.has_prices).map((c) => c.id as string);
  const comparison = items.length > 0 && pricedIds.length > 1 ? await compareList(supabase, items, pricedIds) : null;
  const cheapestName = comparison?.cheapest && comparison.comparable > 0 ? superName(comparison.cheapest.id) : null;

  // Equilibrio: platos por familia según las etiquetas de cada receta
  const recipeById = new Map(recipes.map((r) => [r.id, r]));
  const used = slots
    .map((s) => (s.recipe_id !== null ? recipeById.get(s.recipe_id) : undefined))
    .filter((r): r is Recipe => r !== undefined);
  const count = (tags: string[]) => used.filter((r) => r.tags.some((t) => tags.includes(t))).length;
  const balance: BalanceItem[] = [
    { label: "Verduras", emoji: "🥬", bg: "bg-olive-soft", n: count(["verdura", "vegetariano", "ensalada", "sopa"]) },
    { label: "Legumbres", emoji: "🫘", bg: "bg-amber-100", n: count(["legumbre"]) },
    { label: "Pescado", emoji: "🐟", bg: "bg-sky-100", n: count(["pescado"]) },
    { label: "Carnes", emoji: "🥩", bg: "bg-rose-100", n: count(["carne"]) },
  ];

  // Ajustes del menú
  const meals = (profile?.planning_meals ?? ["comida", "cena"]).map((m: string) => MEAL_LABEL[m] ?? m);
  const restrictions = [...(profile?.allergies ?? []), ...(profile?.avoid_foods ?? [])].map((a: string) => `sin ${a}`);
  const chainNames = myChains.map((c) => c.name as string);
  const settings: MenuSettings = {
    meals: capitalize(joinList(meals)),
    diet: DIET_LABEL[profile?.diet ?? "todo"] ?? DIET_LABEL.todo,
    chains: chainNames.length > 3 ? `${chainNames.slice(0, 3).join(" + ")} y ${chainNames.length - 3} más` : chainNames.join(" + "),
    prefs: restrictions.length > 0 ? capitalize(restrictions.slice(0, 3).join(", ")) : "Sin preferencias especiales",
  };

  return (
    <MenuGrid
      menu={menu}
      recipes={recipes}
      slots={slots}
      offset={offset}
      weekRange={formatWeekRange(weekStart)}
      todayIndex={offset === 0 ? (new Date().getDay() + 6) % 7 : null}
      listTotal={listTotal}
      cheapestName={cheapestName}
      ingredientsCount={needs.length}
      cookSessions={profile?.cook_sessions ?? defaultCookSessions(profile?.household_size ?? 2, 14 - slots.filter((s) => s.kind === "out").length)}
      balance={balance}
      settings={settings}
    />
  );
}

function joinList(xs: string[]) {
  if (xs.length <= 1) return xs[0] ?? "";
  return `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`;
}
function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
