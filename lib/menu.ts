import type { createClient } from "@/lib/supabase/server";
import { keywords, NON_FOOD_CATEGORY, stem, unaccent, wordRegex } from "@/lib/search";
import { PRODUCT_COLUMNS, type Product } from "@/lib/types";

type Supa = Awaited<ReturnType<typeof createClient>>;

export type Recipe = {
  id: number;
  name: string;
  meal: "comida" | "cena" | "ambas";
  servings: number;
  tags: string[];
  owner_id: string | null; // null = receta de Sobremesa
  author_name: string | null;
};
export type Slot = { day: number; meal: "comida" | "cena"; recipe_id: number | null };
export type Menu = { id: string; week_start: string; servings: number };

export const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
export const MEALS = ["comida", "cena"] as const;

/** Lunes de la semana actual, como 'YYYY-MM-DD' (hora local del servidor). */
export function currentWeekStart(offsetWeeks = 0): string {
  const d = new Date();
  const dow = (d.getDay() + 6) % 7; // lunes = 0
  d.setDate(d.getDate() - dow + offsetWeeks * 7);
  return d.toISOString().slice(0, 10);
}

export async function getOrCreateMenu(supabase: Supa, userId: string, weekStart: string, defaultServings = 2): Promise<Menu> {
  const { data } = await supabase
    .from("weekly_menus")
    .select("id,week_start,servings")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (data) return data as Menu;
  const { data: created, error } = await supabase
    .from("weekly_menus")
    .insert({ user_id: userId, week_start: weekStart, servings: defaultServings })
    .select("id,week_start,servings")
    .single();
  if (error) throw new Error(error.message);
  return created as Menu;
}

export async function loadRecipes(supabase: Supa): Promise<Recipe[]> {
  const { data } = await supabase.from("recipes").select("id,name,meal,servings,tags,owner_id,author_name").order("name");
  return (data ?? []) as Recipe[];
}

/** Nombres de ingredientes por receta (para filtrar por dieta/alergias). */
export async function loadIngredientNames(supabase: Supa): Promise<Map<number, string[]>> {
  const { data } = await supabase.from("recipe_ingredients").select("recipe_id,ingredient_name");
  const m = new Map<number, string[]>();
  for (const r of data ?? []) {
    const list = m.get(r.recipe_id as number) ?? [];
    list.push(r.ingredient_name as string);
    m.set(r.recipe_id as number, list);
  }
  return m;
}

export async function loadSlots(supabase: Supa, menuId: string): Promise<Slot[]> {
  const { data } = await supabase.from("weekly_menu_slots").select("day,meal,recipe_id").eq("menu_id", menuId);
  return (data ?? []) as Slot[];
}

/**
 * Elige recetas al azar sin repetir, máximo 2 por etiqueta principal (tags[0]) en la semana.
 * Si no queda ninguna que cumpla la regla, la relaja antes que dejar el hueco vacío.
 */
export function generateWeek(recipes: Recipe[]): Slot[] {
  const used = new Set<number>();
  const tagCount = new Map<string, number>();
  const shuffled = [...recipes].sort(() => Math.random() - 0.5);
  const slots: Slot[] = [];

  for (const day of [0, 1, 2, 3, 4, 5, 6]) {
    for (const meal of MEALS) {
      const candidates = shuffled.filter((r) => !used.has(r.id) && (r.meal === meal || r.meal === "ambas"));
      const ok = candidates.find((r) => (tagCount.get(r.tags[0] ?? "") ?? 0) < 2) ?? candidates[0];
      if (ok) {
        used.add(ok.id);
        const t = ok.tags[0] ?? "";
        tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
      }
      slots.push({ day, meal, recipe_id: ok?.id ?? null });
    }
  }
  return slots;
}

// ---------------------------------------------------------------------------
// Ingredientes agregados → productos
// ---------------------------------------------------------------------------
export type Need = { ingredient: string; qty: number; unit: string }; // unidad de receta: g, ml, ud

export async function aggregateIngredients(supabase: Supa, slots: Slot[], servings: number): Promise<Need[]> {
  const recipeIds = Array.from(new Set(slots.map((s) => s.recipe_id).filter((x): x is number => x !== null)));
  if (recipeIds.length === 0) return [];
  const [{ data: recipes }, { data: ings }] = await Promise.all([
    supabase.from("recipes").select("id,servings").in("id", recipeIds),
    supabase.from("recipe_ingredients").select("recipe_id,ingredient_name,qty,unit").in("recipe_id", recipeIds),
  ]);
  const baseServings = new Map((recipes ?? []).map((r) => [r.id as number, Number(r.servings) || 4]));
  // Una receta puede estar en varios huecos: se cuenta tantas veces como aparezca
  const times = new Map<number, number>();
  for (const s of slots) if (s.recipe_id !== null) times.set(s.recipe_id, (times.get(s.recipe_id) ?? 0) + 1);

  const acc = new Map<string, Need>();
  for (const i of ings ?? []) {
    const rid = i.recipe_id as number;
    const factor = (servings / (baseServings.get(rid) ?? 4)) * (times.get(rid) ?? 1);
    const key = `${i.ingredient_name}|${i.unit}`;
    const cur = acc.get(key) ?? { ingredient: i.ingredient_name as string, qty: 0, unit: i.unit as string };
    cur.qty += Number(i.qty) * factor;
    acc.set(key, cur);
  }
  return Array.from(acc.values()).sort((a, b) => a.ingredient.localeCompare(b.ingredient, "es"));
}

/** Unidad de producto equivalente a la unidad de receta y la cantidad convertida. */
export function toProductUnit(qty: number, unit: string): { qty: number; unit: string } {
  if (unit === "g") return { qty: qty / 1000, unit: "kg" };
  if (unit === "ml") return { qty: qty / 1000, unit: "l" };
  return { qty, unit: "ud" };
}

/** '500 g' → {amount: 0.5, unit: 'kg'}; '6 ud' → {6,'ud'}; '1.5 l' → {1.5,'l'} */
export function parsePackSize(s: string | null | undefined): { amount: number; unit: string } | null {
  if (!s) return null;
  const m = s.trim().match(/^(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|cl|ud)$/i);
  if (!m) return null;
  const n = parseFloat(m[1].replace(",", "."));
  const u = m[2].toLowerCase();
  if (u === "g") return { amount: n / 1000, unit: "kg" };
  if (u === "ml") return { amount: n / 1000, unit: "l" };
  if (u === "cl") return { amount: n / 100, unit: "l" };
  return { amount: n, unit: u };
}

/** Cuántos envases hacen falta; 1 si no se puede calcular. */
export function packsNeeded(need: Need, product: Product): number {
  const want = toProductUnit(need.qty, need.unit);
  const pack = parsePackSize(product.pack_size);
  if (!pack || pack.unit !== want.unit || pack.amount <= 0) return 1;
  return Math.max(1, Math.ceil(want.qty / pack.amount - 1e-9));
}

/**
 * Propone un producto para un ingrediente:
 *  - todas las palabras del ingrediente como palabra completa (singular o plural, sin tildes);
 *    si no hay nada, va quitando palabras por el final ("atún en lata" → "atún");
 *  - descarta categorías no alimentarias;
 *  - entre los candidatos prefiere: misma unidad de venta, nombre que empieza por el ingrediente,
 *    envase no desproporcionado, nombre más corto y más barato por unidad.
 * TODO: aproximación. Mejorar con equivalencias de opencesta o con un LLM en la fase 2.
 */
export async function cheapestProductFor(supabase: Supa, need: Need, supers: string[]): Promise<Product | null> {
  if (supers.length === 0) return null;
  const words = keywords(need.ingredient);
  const want = toProductUnit(need.qty, need.unit);
  const wantUnit = want.unit;

  for (let n = words.length; n >= 1; n--) {
    let req = supabase
      .from("products")
      .select(PRODUCT_COLUMNS)
      .in("supermarket_id", supers)
      .not("category", "imatch", NON_FOOD_CATEGORY)
      .not("unit_price", "is", null);
    for (const w of words.slice(0, n)) req = req.filter("name_norm", "match", wordRegex(w));
    const { data } = await req.order("unit_price", { ascending: true }).limit(40);
    const candidates = (data ?? []) as Product[];
    if (candidates.length === 0) continue;

    const score = (p: Product) => {
      const unitMatch = p.unit === wantUnit ? 0 : 1;
      const extraWords = Math.max(0, p.name.split(/\s+/).length - n);
      const startsWith = unaccent(p.name).startsWith(stem(words[0])) ? 0 : 1;
      // Envase mucho mayor que lo necesario (garrafa de 5 L para 230 ml): mejor uno más pequeño
      const pack = parsePackSize(p.pack_size);
      const oversized = pack && pack.unit === wantUnit && pack.amount > 5 * Math.max(want.qty, 0.05) ? 1 : 0;
      return unitMatch * 100 + startsWith * 30 + oversized * 20 + Math.min(extraWords, 8) * 10 + (p.unit_price ?? 0) / 1000;
    };
    return candidates.sort((a, b) => score(a) - score(b))[0];
  }
  return null;
}

/** Parámetro ?semana= → desplazamiento en semanas ('siguiente' = 1, '-1', '2'...). */
export function weekOffsetFrom(v: string | string[] | undefined): number {
  if (v === "siguiente") return 1;
  const n = typeof v === "string" ? parseInt(v, 10) : 0;
  return Number.isFinite(n) ? Math.max(-12, Math.min(12, n)) : 0;
}
