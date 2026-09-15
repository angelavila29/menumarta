import { recipeEmoji } from "@/lib/recipe-emoji";

const TILE_BG: Record<string, string> = {
  legumbre: "from-amber-100 to-amber-50",
  pescado: "from-sky-100 to-sky-50",
  carne: "from-rose-100 to-rose-50",
  pasta: "from-yellow-100 to-yellow-50",
  arroz: "from-yellow-100 to-orange-50",
  huevo: "from-orange-100 to-amber-50",
  sopa: "from-amber-100 to-orange-50",
  ensalada: "from-lime-100 to-green-50",
  verdura: "from-lime-100 to-green-50",
  guiso: "from-orange-100 to-rose-50",
};

/** Ilustración de una receta (emoji sobre degradado según su tipo); no tenemos fotos. */
export function RecipeArt({ tags, name, className = "" }: { tags: string[]; name: string; className?: string }) {
  return (
    <div aria-hidden className={`flex items-center justify-center bg-gradient-to-br ${TILE_BG[tags[0] ?? ""] ?? "from-cream-dark to-cream"} ${className}`}>
      {recipeEmoji(tags, name)}
    </div>
  );
}
