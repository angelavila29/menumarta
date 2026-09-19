import { requireUser } from "@/lib/auth";
import { RecipeBank, type BankRecipe } from "./recipe-bank";

export default async function RecipesPage(props: PageProps<"/recetas">) {
  const sp = await props.searchParams;
  const { supabase, user } = await requireUser();
  const [{ data: rows }, { data: favs }, { data: friends }] = await Promise.all([
    supabase.from("recipes").select("id,name,meal,tags,time_minutes,difficulty,description,owner_id,author_name,visibility,created_at").order("created_at", { ascending: false }),
    supabase.from("favorite_recipes").select("recipe_id").eq("user_id", user.id),
    supabase.rpc("my_friendships"),
  ]);
  const saved = new Set((favs ?? []).map((f) => f.recipe_id as number));
  const friendNames = new Map(
    ((friends ?? []) as { other_id: string; display_name: string; status: string }[])
      .filter((f) => f.status === "accepted")
      .map((f) => [f.other_id, f.display_name])
  );

  const recipes: BankRecipe[] = (rows ?? []).map((r) => {
    const owner = r.owner_id as string | null;
    const source: BankRecipe["source"] = owner === null ? "sobremesa" : owner === user.id ? "mia" : friendNames.has(owner) ? "amigo" : "comunidad";
    return {
      id: r.id as number,
      name: r.name as string,
      meal: r.meal as string,
      tags: (r.tags ?? []) as string[],
      time: r.time_minutes as number | null,
      difficulty: r.difficulty as string | null,
      description: r.description as string | null,
      ownerId: owner,
      author: owner === null ? "Sobremesa" : owner === user.id ? "Tú" : (friendNames.get(owner) ?? (r.author_name as string | null) ?? "Alguien"),
      source,
      visibility: r.visibility as string,
      saved: saved.has(r.id as number),
    };
  });

  const view = typeof sp.ver === "string" ? sp.ver : "todas";
  const author = typeof sp.autor === "string" ? sp.autor : null;
  return <RecipeBank recipes={recipes} initialView={view} initialAuthor={author} friendCount={friendNames.size} />;
}
