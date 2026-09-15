/** Emoji por etiqueta principal de la receta (no tenemos fotos). */
const BY_TAG: Record<string, string> = {
  legumbre: "🍲", pasta: "🍝", arroz: "🍚", carne: "🍗", pescado: "🐟", huevo: "🍳",
  sopa: "🥣", ensalada: "🥗", verdura: "🥦", rápido: "🥪", guiso: "🥘", vegetariano: "🥬", económico: "🍽️",
};
export function recipeEmoji(tags: string[] | null | undefined, name?: string): string {
  const n = (name ?? "").toLowerCase();
  if (n.includes("tortilla")) return "🍳";
  if (n.includes("sándwich") || n.includes("sandwich")) return "🥪";
  if (n.includes("crema") || n.includes("puré") || n.includes("sopa")) return "🥣";
  if (n.includes("gambas")) return "🍤";
  if (n.includes("salmón") || n.includes("merluza") || n.includes("bacalao")) return "🐟";
  for (const t of tags ?? []) if (BY_TAG[t]) return BY_TAG[t];
  return "🍽️";
}
