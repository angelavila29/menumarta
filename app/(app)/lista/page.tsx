import { requireUser, userSupermarketIds } from "@/lib/auth";
import { compareList } from "@/lib/compare";
import { findCheaperEquivalent } from "@/lib/equivalents";
import { getOrCreateActiveList } from "@/lib/lists";
import { currentWeekStart } from "@/lib/menu";
import { PRODUCT_COLUMNS, type Product } from "@/lib/types";
import { ListView, type ListItem } from "./list-view";

export default async function ListPage() {
  const { supabase, user } = await requireUser();
  const [listId, supers, { data: chainRows }] = await Promise.all([
    getOrCreateActiveList(supabase, user.id),
    userSupermarketIds(supabase, user.id),
    supabase.from("supermarkets").select("id,name,has_prices"),
  ]);
  const chains = (chainRows ?? [])
    .filter((c) => supers.includes(c.id as string))
    .map((c) => ({ id: c.id as string, name: c.name as string, has_prices: c.has_prices as boolean }));

  const { data } = await supabase
    .from("shopping_list_items")
    .select(`id,quantity,checked,product:products(${PRODUCT_COLUMNS})`)
    .eq("list_id", listId)
    .order("id", { ascending: true });

  const raw = (data ?? []).filter((r) => r.product);
  const pricedIds = chains.filter((c) => c.has_prices).map((c) => c.id);

  const [items, comparison] = await Promise.all([
    Promise.all(
      raw.map(async (r): Promise<ListItem> => {
        const product = r.product as unknown as Product;
        const others = supers.filter((s) => s !== product.supermarket_id);
        const cheaper = await findCheaperEquivalent(supabase, product, others);
        return {
          id: r.id as number,
          quantity: Number(r.quantity),
          checked: r.checked as boolean,
          product,
          cheaper: cheaper
            ? { name: cheaper.product.name, supermarket_id: cheaper.product.supermarket_id, unit_price: cheaper.product.unit_price!, unit: cheaper.product.unit!, price: cheaper.product.price }
            : null,
        };
      })
    ),
    raw.length > 0 && pricedIds.length > 1
      ? compareList(
          supabase,
          raw.map((r) => ({ product: r.product as unknown as Product, quantity: Number(r.quantity) })),
          pricedIds
        )
      : Promise.resolve(null),
  ]);

  return <ListView items={items} chains={chains} comparison={comparison} weekStart={currentWeekStart()} />;
}
