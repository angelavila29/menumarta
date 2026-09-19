/** Opciones del formulario de recetas (compartidas entre cliente y servidor). */
export const MAIN_TAGS: [string, string][] = [
  ["legumbre", "Legumbres"], ["pasta", "Pasta"], ["arroz", "Arroz"], ["carne", "Carne"], ["pescado", "Pescado"],
  ["huevo", "Huevos"], ["sopa", "Sopa o crema"], ["ensalada", "Ensalada"], ["verdura", "Verdura"], ["guiso", "Guiso u otro"],
];
export const EXTRA_TAGS: [string, string][] = [["vegetariano", "Vegetariana"], ["económico", "Económica"], ["rápido", "Rápida"]];
export const VISIBILITY: [string, string, string][] = [
  ["friends", "Mis amigos", "La verán las personas que tengas como amigas."],
  ["public", "Todo el mundo", "La verá cualquiera que use Sobremesa."],
  ["private", "Solo yo", "No la verá nadie más."],
];
