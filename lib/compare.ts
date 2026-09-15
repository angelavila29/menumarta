import type { createClient } from "@/lib/supabase/server";
import { keywords, NON_FOOD_CATEGORY, wordRegex } from "@/lib/search";
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

async function equivalentIn(supabase: Supa, product: Product, chainId: string): Promise<Product | null> {
  const words = keywords(product.name.replace(product.brand ?? "", "")).slice(0, 3);
  if (words.length === 0) return null;
  let req = supabase
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("supermarket_id", chainId)
    .not("category", "imatch", NON_FOOD_CATEGORY)
    .not("price", "is", null);
  if (product.unit) req = req.eq("unit", product.unit);
  for (const w of words) req = req.filter("name_norm", "match", wordRegex(w));
  const { data } = await req.order("unit_price", { ascending: true, nullsFirst: false }).limit(1);
  return (data?.[0] as Product | undefined) ?? null;
}
