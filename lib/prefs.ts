/** Preferencias de alimentación del usuario y cómo afectan a las recetas. */
import type { Recipe } from "@/lib/menu";

export type Prefs = {
  diet: string | null; // todo | vegetariano | vegano | pescetariano | otro
  allergies: string[]; // gluten, lactosa, frutos secos, huevo, marisco, soja
  avoid: string[]; // nombres de ingrediente a evitar (texto libre)
};

const MEAT_TAGS = ["carne", "guiso"];
const FISH_TAGS = ["pescado"];
const MEAT_WORDS = ["pollo", "cerdo", "ternera", "chorizo", "jamón", "jamon", "carne", "lomo", "albóndiga", "cocido"];
const FISH_WORDS = ["merluza", "salmón", "salmon", "bacalao", "atún", "atun", "gambas", "pescado", "marisco"];
const EGG_WORDS = ["huevo"];
const DAIRY_WORDS = ["leche", "queso", "nata", "yogur", "mantequilla"];
const GLUTEN_WORDS = ["pan", "harina", "macarrones", "espaguetis", "fideos", "pasta", "sándwich", "sandwich", "rallado"];
const NUT_WORDS = ["almendra", "nuez", "nueces", "cacahuete", "avellana", "pistacho"];
const SHELLFISH_WORDS = ["gambas", "marisco", "langostino", "mejillón", "mejillon", "calamar"];
const SOY_WORDS = ["soja", "tofu"];

function norm(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
function hasAny(haystack: string[], words: string[]) {
  const h = haystack.map(norm);
  return words.some((w) => h.some((x) => x.includes(norm(w))));
}

/** ¿Es apta la receta (por nombre, etiquetas e ingredientes) para estas preferencias? */
export function recipeAllowed(recipe: Recipe, ingredients: string[], prefs: Prefs): boolean {
  const text = [recipe.name, ...ingredients];
  const diet = prefs.diet ?? "todo";
  if (diet === "vegetariano" || diet === "vegano") {
    if (recipe.tags.some((t) => MEAT_TAGS.includes(t) || FISH_TAGS.includes(t))) return false;
    if (hasAny(text, [...MEAT_WORDS, ...FISH_WORDS])) return false;
  }
  if (diet === "vegano" && hasAny(text, [...EGG_WORDS, ...DAIRY_WORDS])) return false;
  if (diet === "pescetariano") {
    if (recipe.tags.some((t) => MEAT_TAGS.includes(t))) return false;
    if (hasAny(text, MEAT_WORDS)) return false;
  }
  for (const a of prefs.allergies.map(norm)) {
    if (a === "gluten" && hasAny(text, GLUTEN_WORDS)) return false;
    if (a === "lactosa" && hasAny(text, DAIRY_WORDS)) return false;
    if (a === "huevo" && hasAny(text, EGG_WORDS)) return false;
    if (a === "marisco" && hasAny(text, SHELLFISH_WORDS)) return false;
    if (a === "frutos secos" && hasAny(text, NUT_WORDS)) return false;
    if (a === "soja" && hasAny(text, SOY_WORDS)) return false;
  }
  if (prefs.avoid.some((a) => isAvoidedIn(text, a))) return false;
  return true;
}

/**
 * Cómo escribe la gente lo que no le gusta → cómo aparece en las recetas. "tomate natural" no
 * casa con ningún ingrediente (las recetas dicen "tomate" o "tomate cherry"), y quien lo escribe
 * así sí come tomate frito, que es otra cosa.
 */
const AVOID_ALIASES: Record<string, string[]> = {
  "tomate natural": ["tomate", "tomate cherry", "tomates"],
  "tomate crudo": ["tomate", "tomate cherry", "tomates"],
  pescado: ["merluza", "bacalao", "salmón", "dorada", "lubina", "atún", "sardinas", "caballa", "pescado", "trucha", "rape"],
  marisco: ["gambas", "langostinos", "mejillones", "calamares", "sepia", "pulpo", "marisco"],
  "carne roja": ["ternera", "cerdo", "lomo", "chuletas", "costillas", "carne picada", "cordero"],
  verdura: ["calabacín", "berenjena", "brócoli", "coliflor", "espinacas", "acelgas", "judías verdes", "pimiento", "puerro", "calabaza"],
};

/**
 * Lo escrito tal cual se busca dentro del nombre y los ingredientes ("cerdo" pilla "lomo de cerdo").
 * Un alias, en cambio, exige el ingrediente exacto: "tomate" no debe pillar "tomate frito".
 */
function isAvoidedIn(text: string[], avoid: string): boolean {
  const alias = AVOID_ALIASES[norm(avoid)];
  if (!alias) return hasAny(text, [avoid]);
  const exact = new Set(alias.map(norm));
  return text.some((t) => exact.has(norm(t)));
}

/** Para comprobar en la ficha si un ingrediente concreto choca con lo que evitas. */
export function isAvoided(ingredient: string, avoid: string[]): boolean {
  return avoid.some((a) => isAvoidedIn([ingredient], a));
}
