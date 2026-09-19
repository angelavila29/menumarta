import type { createClient } from "@/lib/supabase/server";
import { knownEquivalent } from "@/lib/compare";
import { PRODUCT_COLUMNS, type Product } from "@/lib/types";

type Supa = Awaited<ReturnType<typeof createClient>>;

// Palabras de marca propia y ruido que no ayudan a encontrar el equivalente
const NOISE = new Set([
  "hacendado", "dia", "gran", "lactea", "láctea", "bosque", "verde", "deliplus", "compy",
  "de", "del", "la", "el", "los", "las", "con", "sin", "y", "en", "al", "a", "pack", "botella",
  "bolsa", "paquete", "bote", "lata", "brik", "tarrina", "bandeja", "x", "ud", "uds",
]);

/** Minúsculas, sin tildes, sin marca, sin tamaños; devuelve las palabras útiles. */
export function normalizeName(name: string, brand?: string | null): string[] {
  let s = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (brand) {
    const b = brand.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    s = s.replace(b, " ");
  }
  s = s.replace(/\d+([.,]\d+)?\s*(kg|g|l|ml|cl|ud|uds|unidades)?\b/g, " ");
  return s
    .split(/[^a-z0-9ñ]+/)
    .filter((w) => w.length > 1 && !NOISE.has(w));
}

export type Cheaper = { product: Product; saving: number }; // ahorro en €/unidad

/**
 * Busca en las otras cadenas del usuario un producto "equivalente" más barato por unidad.
 * TODO: aproximación por nombre (3 primeras palabras útiles). Mejorar con las
 * equivalencias de opencesta (equivalences.jsonl) o con un LLM en la fase 2.
 */
export async function findCheaperEquivalent(
  supabase: Supa,
  product: Product,
  otherSupers: string[]
): Promise<Cheaper | null> {
  if (otherSupers.length === 0 || product.unit_price == null || !product.unit) return null;
  // Primero las equivalencias publicadas por opencesta; si no hay, la aproximación por nombre
  for (const chain of otherSupers) {
    const eq = await knownEquivalent(supabase, product.id, chain);
    if (eq && eq.unit === product.unit && eq.unit_price != null && eq.unit_price < product.unit_price) {
      return { product: eq, saving: product.unit_price - eq.unit_price };
    }
  }
  const words = normalizeName(product.name, product.brand).slice(0, 3);
  if (words.length === 0) return null;

  let req = supabase
    .from("products")
    .select(PRODUCT_COLUMNS)
    .in("supermarket_id", otherSupers)
    .eq("unit", product.unit)
    .lt("unit_price", product.unit_price);
  for (const w of words) req = req.ilike("name", `%${w}%`);
  const { data } = await req.order("unit_price", { ascending: true }).limit(1);
  const found = data?.[0] as Product | undefined;
  if (!found) return null;
  return { product: found, saving: product.unit_price - (found.unit_price ?? 0) };
}
