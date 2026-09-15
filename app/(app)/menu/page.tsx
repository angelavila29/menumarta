import { requireUser } from "@/lib/auth";
import { currentWeekStart, getOrCreateMenu, loadRecipes, loadSlots } from "@/lib/menu";
import { MenuGrid } from "./menu-grid";

export default async function MenuPage(props: PageProps<"/menu">) {
  const sp = await props.searchParams;
  const offset = sp.semana === "siguiente" ? 1 : 0;
  const { supabase, user } = await requireUser();
  const weekStart = currentWeekStart(offset);
  const menu = await getOrCreateMenu(supabase, user.id, weekStart);
  const [recipes, slots] = await Promise.all([loadRecipes(supabase), loadSlots(supabase, menu.id)]);

  return <MenuGrid menu={menu} recipes={recipes} slots={slots} offset={offset} />;
}
