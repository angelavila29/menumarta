/**
 * Carga data/recipes.json en Supabase (recipes + recipe_ingredients).
 * Uso: npx tsx scripts/seed_recipes.ts   (lee SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY de .env.local)
 * Idempotente: las recetas se identifican por nombre; sus ingredientes se reemplazan.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* sin .env.local: usamos el entorno */
  }
}
loadEnv();

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");

type Recipe = {
  name: string;
  meal: "comida" | "cena" | "ambas";
  servings: number;
  tags: string[];
  description?: string;
  time_minutes?: number;
  difficulty?: string;
  steps?: string[];
  ingredients: { ingredient: string; qty: number; unit: string }[];
};

async function main() {
  const supabase = createClient(url!, key!, { auth: { persistSession: false } });
  const recipes: Recipe[] = JSON.parse(readFileSync("data/recipes.json", "utf8"));
  let ingredientCount = 0;

  for (const r of recipes) {
    const { data: rec, error } = await supabase
      .from("recipes")
      .upsert(
        {
          owner_id: null,
          visibility: "public",
          name: r.name,
          meal: r.meal,
          servings: r.servings,
          tags: r.tags,
          description: r.description ?? null,
          time_minutes: r.time_minutes ?? null,
          difficulty: r.difficulty ?? null,
          steps: r.steps ?? [],
        },
        { onConflict: "owner_id,name" }
      )
      .select("id")
      .single();
    if (error) throw new Error(`${r.name}: ${error.message ?? JSON.stringify(error).slice(0, 300)}`);

    await supabase.from("recipe_ingredients").delete().eq("recipe_id", rec.id);
    const rows = r.ingredients.map((i) => ({
      recipe_id: rec.id,
      ingredient_name: i.ingredient.trim().toLowerCase(),
      qty: i.qty,
      unit: i.unit,
    }));
    const { error: iErr } = await supabase.from("recipe_ingredients").insert(rows);
    if (iErr) throw new Error(`${r.name} ingredientes: ${iErr.message}`);
    ingredientCount += rows.length;
  }
  console.log(`${recipes.length} recetas y ${ingredientCount} ingredientes cargados`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
