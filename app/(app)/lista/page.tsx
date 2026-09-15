import { requireUser, userSupermarketIds } from "@/lib/auth";
import { findCheaperEquivalent } from "@/lib/equivalents";
import { getOrCreateActiveList } from "@/lib/lists";
import { PRODUCT_COLUMNS, type Product } from "@/lib/types";
import { ListView, type ListItem } from "./list-view";

export default async function ListPage() {
  const { supabase, user } = await requireUser();
  const [listId, supers] = await Promise.all([
    getOrCreateActiveList(supabase, user.id),
    userSupermarketIds(supabase, user.id),
  ]);

  const { data } = await supabase
    .from("shopping_list_items")
    .select(`id,quantity,checked,product:products(${PRODUCT_COLUMNS})`)
    .eq("list_id", listId)
    .order("id", { ascending: true });

  const raw = (data ?? []).filter((r) => r.product);
  const items: ListItem[] = await Promise.all(
    raw.map(async (r) => {
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
  );

  return <ListView items={items} supermarkets={supers} />;
}
