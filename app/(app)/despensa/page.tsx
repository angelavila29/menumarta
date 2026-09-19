import { requireUser } from "@/lib/auth";
import { PRODUCT_COLUMNS, type Product } from "@/lib/types";
import { Pantry } from "./pantry";

// Lo que casi todo el mundo tiene siempre en casa: se ofrece primero
const COMMON = ["aceite de oliva", "ajo", "cebolla", "harina", "pimentón", "laurel", "arroz", "huevo", "pan rallado", "caldo de pollo", "tomate frito", "patata"];

export default async function PantryPage() {
  const { supabase, user } = await requireUser();
  const [{ data: ings }, { data: mine }, { data: staples }] = await Promise.all([
    supabase.from("recipe_ingredients").select("ingredient_name"),
    supabase.from("pantry_items").select("ingredient_name").eq("user_id", user.id),
    supabase.from("staple_items").select(`quantity,product:products(${PRODUCT_COLUMNS})`).eq("user_id", user.id),
  ]);
  const all = Array.from(new Set((ings ?? []).map((i) => i.ingredient_name as string))).sort((a, b) => a.localeCompare(b, "es"));
  const ordered = [...COMMON.filter((c) => all.includes(c)), ...all.filter((a) => !COMMON.includes(a))];
  return (
    <Pantry
      ingredients={ordered}
      commonCount={COMMON.filter((c) => all.includes(c)).length}
      have={(mine ?? []).map((m) => m.ingredient_name as string)}
      staples={(staples ?? [])
        .map((s) => ({ product: s.product as unknown as Product | null, quantity: Number(s.quantity) }))
        .filter((s): s is { product: Product; quantity: number } => s.product !== null)}
    />
  );
}
