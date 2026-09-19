import type { createClient } from "@/lib/supabase/server";
import { keywords, NOT_FOOD_CATEGORY, PACK_WORDS, unaccent, wordRegex } from "@/lib/search";
import { PRODUCT_COLUMNS, type Product } from "@/lib/types";

type Supa = Awaited<ReturnType<typeof createClient>>;

export type ChainTotal = { id: string; total: number; missing: number };
export type Comparison = {
  chains: ChainTotal[]; // total sobre los productos comparables + cuántos faltan en esa cadena
  comparable: number; // productos que existen en todas las cadenas
  items: number;
  cheapest: ChainTotal | null;
  saving: number;
};

/**
 * ¿Cuánto costaría la lista comprándola entera en cada cadena?
 * Solo se suman los productos que tienen equivalente en TODAS las cadenas, para que la
 * comparación sea justa; el resto se cuenta como "faltan" en la cadena donde no existen.
 * TODO: equivalentes por nombre; usar las equivalencias de opencesta en la fase 2.
 */
export async function compareList(
  supabase: Supa,
  items: { product: Product; quantity: number }[],
  chainIds: string[]
): Promise<Comparison> {
  const chains: ChainTotal[] = chainIds.map((id) => ({ id, total: 0, missing: 0 }));
  if (items.length === 0 || chainIds.length === 0) return { chains, comparable: 0, items: 0, cheapest: null, saving: 0 };

  // precio por producto y cadena (null si no hay equivalente)
  const priced = await Promise.all(
    items.map(async ({ product, quantity }) => {
      const perChain = await Promise.all(
        chainIds.map(async (id) => {
          if (id === product.supermarket_id) return product.price != null ? product.price * quantity : null;
          const eq = await equivalentIn(supabase, product, id);
          return eq?.price != null ? eq.price * quantity : null;
        })
      );
      return perChain;
    })
  );

  let comparable = 0;
  for (const perChain of priced) {
    if (perChain.every((p) => p !== null)) {
      comparable += 1;
      perChain.forEach((p, i) => (chains[i].total += p as number));
    } else {
      perChain.forEach((p, i) => {
        if (p === null) chains[i].missing += 1;
      });
    }
  }

  const ranked = chains.slice().sort((a, b) => a.total - b.total);
  const cheapest = comparable > 0 ? ranked[0] : null;
  const saving = comparable > 0 && ranked.length > 1 ? ranked[1].total - ranked[0].total : 0;
  return { chains, comparable, items: items.length, cheapest, saving };
}

/** Equivalente publicado por opencesta (emparejado por marca, tamaño y nombre), si lo hay. */
export async function knownEquivalent(supabase: Supa, productId: number, chainId: string): Promise<Product | null> {
  const { data } = await supabase
    .from("product_equivalences")
    .select("product_a,product_b,score")
    .or(`product_a.eq.${productId},product_b.eq.${productId}`)
    .gte("score", 0.5)
    .order("score", { ascending: false })
    .limit(5);
  const otherIds = (data ?? []).map((e) => ((e.product_a as number) === productId ? (e.product_b as number) : (e.product_a as number)));
  if (otherIds.length === 0) return null;
  const { data: products } = await supabase.from("products").select(PRODUCT_COLUMNS).in("id", otherIds).eq("supermarket_id", chainId).not("price", "is", null);
  const list = (products ?? []) as Product[];
  return otherIds.map((id) => list.find((p) => p.id === id)).find((p): p is Product => !!p) ?? null;
}

export async function equivalentIn(supabase: Supa, product: Product, chainId: string): Promise<Product | null> {
  const known = await knownEquivalent(supabase, product.id, chainId);
  if (known) return known;
  // Palabras útiles: sin marca, sin cantidades ni formatos ("pack 6 x 1 L")
  const words = keywords(product.name.replace(product.brand ?? "", ""))
    .filter((w) => !/\d/.test(w) && !PACK_WORDS.has(unaccent(w)))
    .slice(0, 3);
  // Con una sola palabra (p. ej. "exotic" tras quitar la marca) el emparejamiento no es fiable
  if (words.length < 2) return null;
  let req = supabase
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("supermarket_id", chainId)
    .not("category", "imatch", NOT_FOOD_CATEGORY)
    .not("price", "is", null);
  if (product.unit) req = req.eq("unit", product.unit);
  for (const w of words) req = req.filter("name_norm", "match", wordRegex(w));
  // A igual precio por unidad, el envase más barato (el brik suelto antes que el pack de 6)
  const { data } = await req.order("unit_price", { ascending: true, nullsFirst: false }).order("price", { ascending: true }).limit(1);
  const eq = (data?.[0] as Product | undefined) ?? null;
  // Diferencia de precio por unidad desproporcionada: casi seguro es otro producto
  if (eq && product.unit_price && eq.unit_price) {
    const ratio = eq.unit_price / product.unit_price;
    if (ratio > 3 || ratio < 1 / 3) return null;
  }
  return eq;
}
