/** Utilidades de normalización de texto para buscar productos. */

export function unaccent(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** 'champiñones' → 'champinon', 'aceitunas' → 'aceituna', 'ajo' → 'ajo' */
export function stem(word: string): string {
  const w = unaccent(word);
  if (w.length > 5 && w.endsWith("es")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s")) return w.slice(0, -1);
  return w;
}

/** Regex Postgres: la palabra completa, admitiendo singular/plural. */
export function wordRegex(word: string): string {
  const s = stem(word).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return `\\m${s}(e|es|s)?\\M`;
}

const STOP = new Set(["de", "del", "la", "el", "los", "las", "con", "en", "y", "al", "para", "lata"]);

/**
 * Cómo se escribe el ingrediente en casa → cómo lo escriben los supermercados.
 * Solo para casos donde la grafía no coincide en nada: 'cuscús' nunca encuentra
 * 'Cous cous Hacendado' por mucho que quitemos tildes.
 */
const SYNONYMS: Record<string, string> = {
  cuscus: "cous",
  couscous: "cous",
  yoghurt: "yogur",
};

export function keywords(text: string): string[] {
  return text
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 1 && !STOP.has(unaccent(w)))
    .map((w) => SYNONYMS[unaccent(w)] ?? w);
}

/** Categorías que nunca son un ingrediente (regex sobre products.category, case-insensitive). */
export const NON_FOOD_CATEGORY =
  "limpieza|hogar|higiene|cuidado|perfumer|cabello|maquillaje|mascotas|beb[eé]|infantil|parafarmacia|fitoterapia|salud|refrescos|agua-y|zumos|golosinas|caramelos|cacao|caf[eé]|infusiones|postres|yogures|pizzas|preparados";

/** Solo lo que seguro no es comida (para comparar y buscar básicos; incluye yogures y postres). */
export const NOT_FOOD_CATEGORY =
  "limpieza|hogar|higiene|cuidado|perfumer|cabello|maquillaje|mascotas|parafarmacia|fitoterapia";

/** Palabras de formato o tamaño que no sirven para emparejar productos entre cadenas. */
export const PACK_WORDS = new Set(["pack", "x", "botella", "bolsa", "brik", "lata", "bote", "tarro", "paquete", "caja", "bandeja", "kg", "g", "gr", "l", "ml", "cl", "ud", "uds", "unidades"]);

/** Un producto se considera vigente si la ingesta lo ha visto en los últimos tres días. */
export function freshSince(days = 3): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Ordena resultados de búsqueda por relevancia, no por precio: primero lo que empieza por lo
 * buscado ("Leche desnatada"), luego lo que lo tiene como palabra propia, y al final lo que solo
 * lo contiene dentro de otra cosa ("Cápsulas de café con leche"). A igual relevancia, nombre más
 * corto y más barato por unidad.
 */
export function rankByRelevance<T extends { name: string; unit_price: number | null }>(list: T[], query: string): T[] {
  const words = unaccent(query).trim().split(/\s+/).filter(Boolean);
  const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // palabra completa, admitiendo plural: "pan" casa con "pan" y "panes", no con "panceta"
  const whole = (w: string) => new RegExp(`(^|[^a-z0-9])${esc(w)}(es|s)?($|[^a-z0-9])`);
  const atStart = (w: string) => new RegExp(`^${esc(w)}(es|s)?($|[^a-z0-9])`);
  const score = (p: T) => {
    const n = unaccent(p.name);
    let rel = 300; // solo aparece dentro de otra palabra o no aparece
    if (words.length > 0 && words.every((w) => whole(w).test(n))) {
      rel = atStart(words[0]).test(n) ? 0 : 100 + Math.min(n.search(whole(words[0])), 50);
    }
    return rel + Math.min(p.name.split(/\s+/).length, 10) * 2 + Math.min(p.unit_price ?? 999, 999) / 1000;
  };
  return list.slice().sort((a, b) => score(a) - score(b));
}
