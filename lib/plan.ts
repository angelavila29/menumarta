/**
 * Plan de compra: convierte los ingredientes de la semana en productos y calcula cuánto cuesta
 * comprarlo todo en cada supermercado o repartido entre ellos.
 */
import { cheapestProductFor, packsNeeded, type Need } from "@/lib/menu";
import type { createClient } from "@/lib/supabase/server";
import { PRODUCT_COLUMNS, type Product } from "@/lib/types";

type Supa = Awaited<ReturnType<typeof createClient>>;

export type Choice = { product: Product; packs: number; cost: number };
export type PlanRow = {
  key: string; // ingrediente + unidad
  need: Need;
  inPantry: boolean;
  remembered: boolean; // el usuario eligió este producto otras veces
  options: Record<string, Choice | null>; // por cadena
};
export type PlanSummary = {
  id: string; // id de cadena o "mixed"
  total: number;
  missing: number; // ingredientes sin producto en este plan
  stores: number;
};

export async function buildPlanRows(supabase: Supa, userId: string, needs: Need[], chainIds: string[]): Promise<PlanRow[]> {
  if (needs.length === 0) return [];
  const names = Array.from(new Set(needs.map((n) => n.ingredient)));
  const [{ data: maps }, { data: pantry }] = await Promise.all([
    supabase.from("ingredient_product_map").select(`ingredient_name,product:products(${PRODUCT_COLUMNS})`).eq("user_id", userId).in("ingredient_name", names),
    supabase.from("pantry_items").select("ingredient_name").eq("user_id", userId),
  ]);
  const mapped = new Map<string, Product>();
  for (const m of maps ?? []) {
    const p = m.product as unknown as Product | null;
    if (p) mapped.set(m.ingredient_name as string, p);
  }
  const have = new Set((pantry ?? []).map((p) => p.ingredient_name as string));

  return Promise.all(
    needs.map(async (need) => {
      const saved = mapped.get(need.ingredient) ?? null;
      const entries = await Promise.all(
        chainIds.map(async (chain): Promise<[string, Choice | null]> => {
          const product = saved && saved.supermarket_id === chain ? saved : await cheapestProductFor(supabase, need, [chain]);
          if (!product || product.price == null) return [chain, null];
          const packs = packsNeeded(need, product);
          return [chain, { product, packs, cost: product.price * packs }];
        })
      );
      return {
        key: `${need.ingredient}|${need.unit}`,
        need,
        inPantry: have.has(need.ingredient),
        remembered: saved !== null,
        options: Object.fromEntries(entries),
      };
    })
  );
}

/** Opción elegida para una fila según el plan ("mixed" = la más barata de cualquier cadena). */
export function choiceFor(row: PlanRow, planId: string): Choice | null {
  if (planId !== "mixed") return row.options[planId] ?? null;
  const all = Object.values(row.options).filter((c): c is Choice => c !== null);
  return all.sort((a, b) => a.cost - b.cost)[0] ?? null;
}

export function summarize(rows: PlanRow[], chainIds: string[]): PlanSummary[] {
  const toBuy = rows.filter((r) => !r.inPantry);
  const plans = [...chainIds, ...(chainIds.length > 1 ? ["mixed"] : [])];
  return plans.map((id) => {
    let total = 0;
    let missing = 0;
    const stores = new Set<string>();
    for (const r of toBuy) {
      const c = choiceFor(r, id);
      if (!c) missing++;
      else {
        total += c.cost;
        stores.add(c.product.supermarket_id);
      }
    }
    return { id, total, missing, stores: stores.size };
  });
}

/** Plan recomendado según la estrategia del perfil. */
export function recommendedPlan(plans: PlanSummary[], compareMode: string | null, mainChain: string | null): string {
  const complete = plans.filter((p) => p.missing === Math.min(...plans.map((x) => x.missing)));
  const cheapest = complete.slice().sort((a, b) => a.total - b.total)[0] ?? plans[0];
  const main = plans.find((p) => p.id === mainChain);
  if (compareMode === "barato" || !main) return cheapest?.id ?? "mixed";
  if (compareMode === "habitual") return main.id;
  // "avisar": tu habitual, salvo que cambiar ahorre de verdad (más de 3 € y más de un 8 %)
  const saving = main.total - cheapest.total;
  return main.missing <= cheapest.missing && !(saving > 3 && saving > main.total * 0.08) ? main.id : cheapest.id;
}
