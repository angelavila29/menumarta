import Link from "next/link";
import { requireUser, userSupermarketIds } from "@/lib/auth";
import {
  aggregateIngredients,
  cheapestProductFor,
  currentWeekStart,
  getOrCreateMenu,
  loadSlots,
  packsNeeded,
  type Need,
} from "@/lib/menu";
import { PRODUCT_COLUMNS, type Product } from "@/lib/types";
import { Review, type ReviewRow } from "./review";

export default async function MenuListPage(props: PageProps<"/menu/lista">) {
  const sp = await props.searchParams;
  const offset = sp.semana === "siguiente" ? 1 : 0;
  const { supabase, user } = await requireUser();
  const [menu, supers] = await Promise.all([
    getOrCreateMenu(supabase, user.id, currentWeekStart(offset)),
    userSupermarketIds(supabase, user.id),
  ]);
  const slots = await loadSlots(supabase, menu.id);
  const needs = await aggregateIngredients(supabase, slots, menu.servings);

  if (needs.length === 0) {
    return (
      <main>
        <h1 className="mb-3 text-2xl font-bold">Lista del menú</h1>
        <p className="text-zinc-600">El menú está vacío. Genera la semana primero.</p>
        <Link href="/menu" className="mt-3 inline-block text-green-700 underline">Volver al menú</Link>
      </main>
    );
  }

  // Mapeos guardados del usuario
  const { data: maps } = await supabase
    .from("ingredient_product_map")
    .select(`ingredient_name,product:products(${PRODUCT_COLUMNS})`)
    .eq("user_id", user.id)
    .in("ingredient_name", needs.map((n) => n.ingredient));
  const mapped = new Map<string, Product>();
  for (const m of maps ?? []) {
    const p = m.product as unknown as Product | null;
    if (p && supers.includes(p.supermarket_id)) mapped.set(m.ingredient_name as string, p);
  }

  const rows: ReviewRow[] = await Promise.all(
    needs.map(async (need: Need) => {
      const saved = mapped.get(need.ingredient) ?? null;
      const product = saved ?? (await cheapestProductFor(supabase, need, supers));
      return {
        need,
        product,
        fromMap: saved !== null,
        quantity: product ? packsNeeded(need, product) : 1,
      };
    })
  );

  return <Review rows={rows} servings={menu.servings} />;
}
