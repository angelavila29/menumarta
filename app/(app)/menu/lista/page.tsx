import Link from "next/link";
import { requireUser, userSupermarketIds } from "@/lib/auth";
import { formatWeekRange } from "@/lib/format";
import { aggregateIngredients, currentWeekStart, getOrCreateMenu, loadSlots, weekOffsetFrom } from "@/lib/menu";
import { buildPlanRows, recommendedPlan, summarize } from "@/lib/plan";
import { PRODUCT_COLUMNS, type Product } from "@/lib/types";
import { Review, type StapleRow } from "./review";

export default async function MenuListPage(props: PageProps<"/menu/lista">) {
  const sp = await props.searchParams;
  const offset = weekOffsetFrom(sp.semana);
  const { supabase, user } = await requireUser();
  const weekStart = currentWeekStart(offset);
  const [{ data: profile }, supers, { data: chainRows }, { data: stapleRows }] = await Promise.all([
    supabase.from("profiles").select("household_size,weekly_budget,compare_mode,main_supermarket").eq("id", user.id).maybeSingle(),
    userSupermarketIds(supabase, user.id),
    supabase.from("supermarkets").select("id,name,has_prices"),
    supabase.from("staple_items").select(`quantity,product:products(${PRODUCT_COLUMNS})`).eq("user_id", user.id),
  ]);
  const menu = await getOrCreateMenu(supabase, user.id, weekStart, profile?.household_size ?? 2);
  const slots = await loadSlots(supabase, menu.id);
  const needs = await aggregateIngredients(supabase, slots, menu.servings);

  if (needs.length === 0) {
    return (
      <main>
        <h1 className="text-3xl font-bold md:text-4xl">Organizar la compra</h1>
        <p className="mt-2 text-muted">El menú de esta semana está vacío. Genera la semana primero.</p>
        <Link href="/menu" className="mt-4 inline-block rounded-xl bg-brand px-5 py-3 font-semibold text-white">Ir al menú</Link>
      </main>
    );
  }

  const chains = (chainRows ?? [])
    .filter((c) => c.has_prices && supers.includes(c.id as string))
    .map((c) => ({ id: c.id as string, name: c.name as string }));
  const chainIds = chains.map((c) => c.id);
  const rows = await buildPlanRows(supabase, user.id, needs, chainIds);
  const plans = summarize(rows, chainIds);
  const recommended = recommendedPlan(plans, profile?.compare_mode ?? "avisar", profile?.main_supermarket ?? null);
  const staples: StapleRow[] = (stapleRows ?? [])
    .map((s) => ({ product: s.product as unknown as Product | null, quantity: Number(s.quantity) }))
    .filter((s): s is StapleRow => s.product !== null);

  return (
    <Review
      rows={rows}
      chains={chains}
      recommended={recommended}
      mainChain={profile?.main_supermarket ?? null}
      budget={profile?.weekly_budget ?? null}
      servings={menu.servings}
      weekRange={formatWeekRange(weekStart)}
      staples={staples}
    />
  );
}
