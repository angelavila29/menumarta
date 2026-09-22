/**
 * Alimentos para autocompletar en los campos de "evitar", despensa y "¿qué cocino hoy?".
 * A esta lista fija se le suman los ingredientes de las recetas, que llegan desde el servidor.
 */
export const FOODS: string[] = [
  // Verduras y hortalizas
  "acelgas", "aguacate", "ajo", "alcachofa", "apio", "berenjena", "brócoli", "calabacín", "calabaza", "cebolla", "cebolleta",
  "champiñones", "col", "coliflor", "endivia", "escarola", "espárragos", "espinacas", "guisantes", "judías verdes", "lechuga",
  "maíz", "nabo", "patata", "pepino", "pimiento rojo", "pimiento verde", "puerro", "rúcula", "remolacha", "repollo", "setas",
  "tomate", "tomate cherry", "zanahoria", "boniato", "canónigos",
  // Fruta
  "manzana", "plátano", "naranja", "mandarina", "pera", "fresas", "uvas", "melón", "sandía", "kiwi", "limón", "piña", "mango",
  "melocotón", "cerezas", "ciruelas", "higos", "granada",
  // Legumbres, arroz, pasta y pan
  "lentejas", "garbanzos", "alubias blancas", "alubias pintas", "arroz", "arroz integral", "cuscús", "quinoa", "macarrones",
  "espaguetis", "tallarines", "fideos", "noodles", "gnocchi", "tortellini", "pan", "pan de molde", "pan rallado", "pan de pita",
  "tortillas de trigo", "harina", "avena",
  // Carne
  "pollo", "pechuga de pollo", "muslo de pollo", "alitas de pollo", "pavo", "cerdo", "lomo de cerdo", "chuletas de cerdo",
  "costillas de cerdo", "carne picada", "ternera", "filete de ternera", "cordero", "conejo", "salchichas", "bacon",
  "chorizo", "jamón serrano", "jamón cocido", "pavo en lonchas", "morcilla", "hígado",
  // Pescado y marisco
  "atún en lata", "sardinas en lata", "caballa en lata", "merluza", "bacalao", "salmón", "salmón ahumado", "dorada", "lubina",
  "gambas", "langostinos", "mejillones", "calamares", "pulpo", "boquerones", "anchoas", "sepia", "rape", "trucha",
  // Huevos y lácteos
  "huevo", "leche", "nata", "mantequilla", "queso rallado", "queso fresco", "queso en lonchas", "queso curado", "mozzarella",
  "queso de cabra", "queso feta", "parmesano", "yogur", "requesón", "queso de untar", "bechamel",
  // Despensa y salsas
  "aceite de oliva", "aceite de girasol", "vinagre", "sal", "pimienta", "pimentón", "curry", "comino", "orégano", "tomillo",
  "laurel", "perejil", "albahaca", "canela", "azúcar", "miel", "tomate frito", "tomate triturado", "mayonesa", "mostaza",
  "ketchup", "salsa de soja", "pesto", "caldo de pollo", "caldo de verduras", "caldo de pescado", "vino blanco", "cerveza",
  "aceitunas", "pepinillos", "pimientos asados", "pimientos del piquillo", "maíz en lata", "garbanzos cocidos",
  "lentejas cocidas", "alubias pintas cocidas", "picatostes", "frutos secos", "nueces", "almendras", "cacahuetes",
  "pasas", "chocolate", "cacao", "café", "leche de coco", "tofu", "soja texturizada", "hummus", "guacamole",
  "masa de empanadillas", "base de pizza", "placas para lasaña", "obleas", "salsa césar", "menestra de verduras",
  "marisco", "gluten", "lactosa", "picante", "cilantro",
];

function unaccent(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Une varias listas sin repetidos ni tildes duplicadas, ordenadas en español. */
export function mergeFoods(...lists: string[][]): string[] {
  const seen = new Map<string, string>();
  for (const list of lists) for (const f of list) {
    const k = unaccent(f);
    if (k && !seen.has(k)) seen.set(k, f.trim().toLowerCase());
  }
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, "es"));
}

/** Sugerencias para lo escrito: primero las que empiezan igual, luego las que lo contienen. */
export function suggestFoods(query: string, foods: string[], exclude: Iterable<string> = [], limit = 8): string[] {
  const q = unaccent(query);
  if (!q) return [];
  const out = new Set(Array.from(exclude, unaccent));
  const starts = foods.filter((f) => unaccent(f).startsWith(q) && !out.has(unaccent(f)));
  const contains = foods.filter((f) => !unaccent(f).startsWith(q) && unaccent(f).includes(q) && !out.has(unaccent(f)));
  return [...starts, ...contains].slice(0, limit);
}
