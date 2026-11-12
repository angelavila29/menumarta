import type { createClient } from "@/lib/supabase/server";
import { freshSince, keywords, NON_FOOD_CATEGORY, stem, unaccent, wordRegex } from "@/lib/search";
import { PRODUCT_COLUMNS, type Product } from "@/lib/types";
import { toBase } from "@/lib/units";

type Supa = Awaited<ReturnType<typeof createClient>>;

export type Recipe = {
  id: number;
  name: string;
  meal: "comida" | "cena" | "ambas";
  servings: number;
  tags: string[];
  owner_id: string | null; // null = receta de Sobremesa
  author_name: string | null;
  photo_url?: string | null;
};
// kind "out" = como fuera o no cocino: el generador no toca ese hueco
export type Slot = { day: number; meal: "comida" | "cena"; recipe_id: number | null; kind: "meal" | "out"; cooked?: boolean; side_recipe_id?: number | null };

/** Las guarniciones (puré, arroz blanco…) acompañan a un plato; nunca son la comida por sí solas. */
export const isSide = (r: { tags: string[] }) => r.tags.includes("guarnicion");
export type Menu = { id: string; week_start: string; servings: number; portion: number };

/** Tamaño de ración para cuadrar unas calorías: de 0,75 a 2, en saltos de cuarto. */
export function portionFor(targetKcal: number, actualKcal: number): number {
  if (!(targetKcal > 0) || !(actualKcal > 0)) return 1;
  return Math.min(2, Math.max(0.75, Math.round((targetKcal / actualKcal) * 4) / 4));
}

export const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
export const MEALS = ["comida", "cena"] as const;

/** Día de la semana de hoy en horario español: 0 = lunes … 6 = domingo. */
export function todayIndex(): number {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Madrid", weekday: "short" }).format(new Date());
  return Math.max(0, ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(wd));
}

/**
 * Lunes de la semana actual en horario español, como 'YYYY-MM-DD'. El servidor va en UTC, así
 * que de 00:00 a 02:00 la fecha UTC es la del día anterior: hay que calcularla en Madrid.
 */
export function currentWeekStart(offsetWeeks = 0): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  const dow = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday"));
  const d = new Date(Date.UTC(Number(get("year")), Number(get("month")) - 1, Number(get("day"))));
  d.setUTCDate(d.getUTCDate() - (dow < 0 ? 0 : dow) + offsetWeeks * 7);
  return d.toISOString().slice(0, 10);
}

/** Si el menú no existe se crea para las personas que viven en casa (perfil), salvo que se indique otra cosa. */
export async function getOrCreateMenu(supabase: Supa, userId: string, weekStart: string, defaultServings?: number): Promise<Menu> {
  const { data } = await supabase
    .from("weekly_menus")
    .select("id,week_start,servings,portion")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (data) return { ...data, portion: Number(data.portion) || 1 } as Menu;
  let servings = defaultServings;
  if (servings == null) {
    const { data: profile } = await supabase.from("profiles").select("household_size").eq("id", userId).maybeSingle();
    servings = profile?.household_size ?? 2;
  }
  const { data: created, error } = await supabase
    .from("weekly_menus")
    .insert({ user_id: userId, week_start: weekStart, servings })
    .select("id,week_start,servings,portion")
    .single();
  if (error) throw new Error(error.message);
  return { ...created, portion: Number(created.portion) || 1 } as Menu;
}

export async function loadRecipes(supabase: Supa): Promise<Recipe[]> {
  const { data } = await supabase.from("recipes").select("id,name,meal,servings,tags,owner_id,author_name,photo_url").order("name");
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
  const { data } = await supabase.from("weekly_menu_slots").select("day,meal,recipe_id,kind,cooked,side_recipe_id").eq("menu_id", menuId);
  return (data ?? []) as Slot[];
}

export const MAX_PORTIONS = 3; // una receta cocinada da como mucho 3 comidas (por conservación)

/**
 * Veces que se cocina por defecto si no se ha elegido: en casas de una o dos personas, casi todo
 * distinto y unas pocas comidas de sobras (10 de 14); a partir de tres, cada comida.
 */
export function defaultCookSessions(householdSize: number, activeSlots: number): number {
  return householdSize <= 2 ? Math.min(activeSlots, Math.max(1, Math.round(activeSlots * 0.72))) : activeSlots;
}

/**
 * Genera la semana cocinando `sessions` veces; el resto de huecos son sobras de algo cocinado
 * antes. Las sobras se reparten por la semana: mejor dos días después que al día siguiente, y
 * como mucho una al día, para no comer y cenar lo mismo dos días seguidos. Los huecos de
 * `blocked` ("como fuera") no se tocan. Máximo 2 recetas por etiqueta principal; si no hay otra, se relaja.
 */
export type GeneratePrefs = {
  sessions?: number;
  blocked?: Set<string>;
  ingredients?: Map<number, string[]>; // para premiar recetas que comparten ingredientes
  thrifty?: boolean; // presupuesto u objetivo de ahorrar
  quick?: boolean; // objetivo de ahorrar tiempo
  healthy?: boolean; // objetivo de comer más sano
  pantry?: Set<string>; // lo que ya hay en casa: premia recetas que lo gastan y penaliza las que obligan a comprar
  pantryFirst?: boolean; // "con lo que tengo": la despensa manda aunque se repita algo más
  /** objetivo corporal y nutrición por ración de cada receta: acerca el menú a lo que la persona busca */
  bodyGoal?: "perder" | "mantener" | "ganar" | null;
  nutrition?: Map<number, { kcal: number; protein: number; veg: number }>;
  /** kcal que debería tener cada plato (comida o cena) según el objetivo */
  kcalPerMeal?: number;
};

/** Puntos extra según el objetivo: proteína para ganar músculo, ligereza y verdura para perder peso. */
function goalBonus(r: Recipe, opts: GeneratePrefs): number {
  const n = opts.nutrition?.get(r.id);
  if (!n || !opts.bodyGoal) return 0;
  if (opts.bodyGoal === "ganar") return Math.min(12, n.protein / 4) - (n.protein < 15 ? 4 : 0);
  if (opts.bodyGoal === "perder") {
    const target = opts.kcalPerMeal ?? 450;
    // Ligero pero saciante: la proteína pesa tanto como no pasarse
    return Math.min(3, n.veg * 1.5) - Math.max(0, (n.kcal - target) / 30) + Math.min(8, n.protein / 4);
  }
  return 0;
}

// Ingredientes de fondo de armario: compartirlos no ahorra nada
const BACKGROUND = new Set(["aceite de oliva", "ajo", "cebolla", "laurel", "pimentón", "harina", "perejil"]);

/**
 * Palabras que definen un plato: "Pisto con arroz" y "Pisto con huevo" comparten "pisto";
 * "Salchichas con puré" y "Filetes rusos con puré" comparten "puré". Repetirlas aburre.
 */
const NAME_STOP = new Set(["con", "de", "del", "y", "a", "al", "la", "el", "en", "las", "los", "para", "casera", "casero", "rápido", "rápida"]);
function dishWords(name: string): string[] {
  return name.toLowerCase().split(/\s+/).filter((w) => w.length > 2 && !NAME_STOP.has(w));
}

/** Los dos primeros ingredientes de una receta son casi siempre los que la definen. */
function mainOf(ings: string[]): string[] {
  return ings.slice(0, 2);
}

export function generateWeek(recipes: Recipe[], opts: GeneratePrefs = {}): Slot[] {
  const blocked = opts.blocked ?? new Set<string>();
  const keyOf = (day: number, meal: string) => `${day}-${meal}`;
  const order: { day: number; meal: "comida" | "cena" }[] = [];
  for (const day of [0, 1, 2, 3, 4, 5, 6]) for (const meal of MEALS) order.push({ day, meal });
  const active = order.filter((s) => !blocked.has(keyOf(s.day, s.meal)));
  const sessions = Math.max(1, Math.min(opts.sessions ?? active.length, active.length));

  // Qué huecos serán sobras y de cuál. Se relaja por pasos solo si no salen las cuentas:
  // 1) dos días después, una sobra al día, cada plato se repite una vez; 2) tres días después;
  // 3) al día siguiente; 4) dos sobras el mismo día; 5) un plato hasta MAX_PORTIONS veces.
  const leftoverOf = new Map<string, string>();
  const donorUses = new Map<string, number>();
  const leftoverDays = new Map<number, number>();
  const activeKeys = new Set(active.map((s) => keyOf(s.day, s.meal)));
  const mixed = [...active].sort(() => Math.random() - 0.5);
  const passes: { gaps: number[]; perDay: number; uses: number }[] = [
    { gaps: [2], perDay: 1, uses: 1 },
    { gaps: [3], perDay: 1, uses: 1 },
    { gaps: [1], perDay: 1, uses: 1 },
    { gaps: [2, 3, 1], perDay: 2, uses: 1 },
    { gaps: [2, 3, 1], perDay: 2, uses: MAX_PORTIONS - 1 },
  ];
  for (const pass of passes) {
    for (const gap of pass.gaps) {
      for (const s of mixed) {
        if (leftoverOf.size >= active.length - sessions) break;
        const key = keyOf(s.day, s.meal);
        const donor = keyOf(s.day - gap, s.meal);
        if (leftoverOf.has(key) || donorUses.has(key) || !activeKeys.has(donor) || leftoverOf.has(donor)) continue;
        if ((leftoverDays.get(s.day) ?? 0) >= pass.perDay || (donorUses.get(donor) ?? 0) >= pass.uses) continue;
        leftoverOf.set(key, donor);
        donorUses.set(donor, (donorUses.get(donor) ?? 0) + 1);
        leftoverDays.set(s.day, (leftoverDays.get(s.day) ?? 0) + 1);
      }
    }
  }

  const used = new Set<number>();
  const tagCount = new Map<string, number>();
  const shuffled = [...recipes].sort(() => Math.random() - 0.5);
  const assigned = new Map<string, number>();
  const bought = new Set<string>(opts.pantry ?? []); // lo que ya tienes cuenta como "ya comprado"
  const mains = new Map<string, number>(); // ingrediente principal de cada receta elegida: patata, huevo, pollo…
  const dishes = new Set<string>(); // palabras de los platos elegidos: "pisto", "puré", "ensalada"…
  const cookedAt = new Map<number, { day: number; count: number; meal: Recipe["meal"] }>();
  const isFree = (day: number, meal: string) => day <= 6 && !blocked.has(keyOf(day, meal)) && !assigned.has(keyOf(day, meal));
  let done = 0;

  for (const slot of active) {
    const from = leftoverOf.get(keyOf(slot.day, slot.meal));
    if (from !== undefined) {
      const id = assigned.get(from);
      if (id !== undefined) {
        assigned.set(keyOf(slot.day, slot.meal), id);
        cookedAt.get(id)!.count++;
      }
      continue;
    }
    if (done >= sessions) continue; // cocinando muy pocas veces no hay reparto que valga: lo rellena el paso final
    const candidates = shuffled.filter((r) => !used.has(r.id) && (r.meal === slot.meal || r.meal === "ambas"));
    const varied = candidates.filter((r) => (tagCount.get(r.tags[0] ?? "") ?? 0) < 2);
    // Entre unas pocas al azar (para que cada semana sea distinta) gana la que mejor encaja
    // Con despensa, se miran más candidatas para que de verdad salga lo que aprovecha lo que hay
    const shortlist = (varied.length > 0 ? varied : candidates).slice(0, opts.pantryFirst ? 40 : opts.pantry ? 12 : 5);
    const score = (r: Recipe) => {
      const ings = (opts.ingredients?.get(r.id) ?? []).filter((i) => !BACKGROUND.has(i));
      const shared = ings.filter((i) => bought.has(i)).length;
      const missing = opts.pantry ? ings.length - shared : 0;
      // Variedad: que no se repita el ingrediente principal (el primero de la receta) toda la semana
      const repeats = mainOf(ings).reduce((n, m) => n + (mains.get(m) ?? 0), 0) + dishWords(r.name).filter((w) => dishes.has(w)).length * 2;
      const pf = opts.pantryFirst ? 3 : 1;
      return (
        shared * 2 * pf -
        missing * 1.5 * pf -
        repeats * (opts.pantryFirst ? 1.5 : 3) +
        goalBonus(r, opts) +
        (opts.thrifty && r.tags.includes("económico") ? 3 : 0) +
        (opts.quick && r.tags.includes("rápido") ? 2 : 0) +
        (opts.healthy && r.tags.some((t) => ["verdura", "legumbre", "pescado", "ensalada"].includes(t)) ? 2 : 0)
      );
    };
    const recipe = shortlist.slice().sort((a, b) => score(b) - score(a))[0];
    if (!recipe) continue;
    for (const i of opts.ingredients?.get(recipe.id) ?? []) bought.add(i);
    for (const m of mainOf((opts.ingredients?.get(recipe.id) ?? []).filter((i) => !BACKGROUND.has(i)))) mains.set(m, (mains.get(m) ?? 0) + 1);
    used.add(recipe.id);
    for (const w of dishWords(recipe.name)) dishes.add(w);
    tagCount.set(recipe.tags[0] ?? "", (tagCount.get(recipe.tags[0] ?? "") ?? 0) + 1);
    assigned.set(keyOf(slot.day, slot.meal), recipe.id);
    cookedAt.set(recipe.id, { day: slot.day, count: 1, meal: recipe.meal });
    done++;
  }

  // huecos que quedan: sobras de algo cocinado en los 3 días anteriores que aún dé para otra ración
  for (const slot of active) {
    if (assigned.has(keyOf(slot.day, slot.meal))) continue;
    const donor = [...cookedAt.entries()].find(
      ([, c]) => c.count < MAX_PORTIONS && slot.day > c.day && slot.day - c.day <= 3 && (c.meal === slot.meal || c.meal === "ambas")
    );
    if (donor) {
      assigned.set(keyOf(slot.day, slot.meal), donor[0]);
      donor[1].count++;
    }
  }

  return order.map((s) => {
    const out = blocked.has(keyOf(s.day, s.meal));
    return { day: s.day, meal: s.meal, recipe_id: out ? null : assigned.get(keyOf(s.day, s.meal)) ?? null, kind: out ? "out" : "meal" };
  });
}

// ---------------------------------------------------------------------------
// Ingredientes agregados → productos
// ---------------------------------------------------------------------------
export type Need = { ingredient: string; qty: number; unit: string }; // unidad de receta: g, ml, ud

export async function aggregateIngredients(supabase: Supa, slots: Slot[], servings: number): Promise<Need[]> {
  // Plato y guarnición cuentan igual: cada uno tantas veces como aparezca
  const used = slots.flatMap((s) => [s.recipe_id, s.side_recipe_id ?? null]).filter((x): x is number => x !== null);
  const recipeIds = Array.from(new Set(used));
  if (recipeIds.length === 0) return [];
  const [{ data: recipes }, { data: ings }] = await Promise.all([
    supabase.from("recipes").select("id,servings").in("id", recipeIds),
    supabase.from("recipe_ingredients").select("recipe_id,ingredient_name,qty,unit").in("recipe_id", recipeIds),
  ]);
  const baseServings = new Map((recipes ?? []).map((r) => [r.id as number, Number(r.servings) || 4]));
  // Una receta puede estar en varios huecos: se cuenta tantas veces como aparezca
  const times = new Map<number, number>();
  for (const id of used) times.set(id, (times.get(id) ?? 0) + 1);

  const acc = new Map<string, Need>();
  for (const i of ings ?? []) {
    const rid = i.recipe_id as number;
    const factor = (servings / (baseServings.get(rid) ?? 4)) * (times.get(rid) ?? 1);
    // "2 cucharadas" y "30 ml" del mismo ingrediente se suman en ml
    const b = toBase(Number(i.qty), i.unit as string, i.ingredient_name as string);
    const key = `${i.ingredient_name}|${b.unit}`;
    const cur = acc.get(key) ?? { ingredient: i.ingredient_name as string, qty: 0, unit: b.unit };
    cur.qty += b.qty * factor;
    acc.set(key, cur);
  }
  return Array.from(acc.values()).sort((a, b) => a.ingredient.localeCompare(b.ingredient, "es"));
}

/** Unidad de producto equivalente a la unidad de receta y la cantidad convertida. */
export function toProductUnit(qty: number, unit: string, ingredient = ""): { qty: number; unit: string } {
  const b = toBase(qty, unit, ingredient);
  if (b.unit === "g") return { qty: b.qty / 1000, unit: "kg" };
  if (b.unit === "ml") return { qty: b.qty / 1000, unit: "l" };
  return { qty: b.qty, unit: "ud" };
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
  const want = toProductUnit(need.qty, need.unit, need.ingredient);
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
/** Ingredientes cuyo nombre a secas trae otra cosa: "pan" encontraba pan rallado antes que una barra. */
const SEARCH_AS: Record<string, string> = { pan: "barra pan", vinagre: "vinagre vino" };

export async function cheapestProductFor(supabase: Supa, need: Need, supers: string[]): Promise<Product | null> {
  if (supers.length === 0) return null;
  const words = keywords(SEARCH_AS[need.ingredient.trim().toLowerCase()] ?? need.ingredient);
  const want = toProductUnit(need.qty, need.unit, need.ingredient);
  const wantUnit = want.unit;

  for (let n = words.length; n >= 1; n--) {
    let req = supabase
      .from("products")
      .select(PRODUCT_COLUMNS)
      .in("supermarket_id", supers)
      .not("category", "imatch", NON_FOOD_CATEGORY)
      .not("unit_price", "is", null)
      .gte("updated_at", freshSince());
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
