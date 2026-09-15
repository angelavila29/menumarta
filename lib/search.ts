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

export function keywords(text: string): string[] {
  return text
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 1 && !STOP.has(unaccent(w)));
}

/** Categorías que nunca son un ingrediente (regex sobre products.category, case-insensitive). */
export const NON_FOOD_CATEGORY =
  "limpieza|hogar|higiene|cuidado|perfumer|cabello|maquillaje|mascotas|beb[eé]|infantil|parafarmacia|fitoterapia|salud|refrescos|agua-y|zumos|golosinas|caramelos|cacao|caf[eé]|infusiones|postres|yogures|pizzas|preparados";

/** Solo lo que seguro no es comida (para comparar y buscar básicos; incluye yogures y postres). */
export const NOT_FOOD_CATEGORY =
  "limpieza|hogar|higiene|cuidado|perfumer|cabello|maquillaje|mascotas|parafarmacia|fitoterapia";

/** Palabras de formato o tamaño que no sirven para emparejar productos entre cadenas. */
export const PACK_WORDS = new Set(["pack", "x", "botella", "bolsa", "brik", "lata", "bote", "tarro", "paquete", "caja", "bandeja", "kg", "g", "gr", "l", "ml", "cl", "ud", "uds", "unidades"]);
