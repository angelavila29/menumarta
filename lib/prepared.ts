/** Platos preparados: lo que se compra ya hecho (arroz negro congelado, gyozas, lasaña…). */

/** Categorías de producto que suelen ser comida ya hecha. */
export const PREPARED_CATEGORY = /congelad|preparad|pizza|listo|rebozad|croqueta|tortillas-y|comida-/i;

/** "Arroz negro Dia Al Punto 330 g" → "Arroz negro": sin marca ni tamaño. */
export function genericName(name: string, brand: string | null): string {
  let n = brand ? name.replace(brand, " ") : name;
  n = n.replace(/\s\d[\d.,]*\s*(x\s*\d+\s*)?(g|gr|kg|ml|cl|l|ud|uds|unidades)\b.*$/i, "");
  n = n.replace(/\s+/g, " ").trim();
  return n ? n[0].toUpperCase() + n.slice(1) : name;
}

/** Tipo de plato para colores, variedad y filtros. */
export function guessMainTag(name: string): string {
  const n = name.toLowerCase();
  if (/arroz|paella|risotto/.test(n)) return "arroz";
  if (/pasta|lasa|canel|gnocchi|ñoqui|espagueti|macarr|tortellini|raviol/.test(n)) return "pasta";
  if (/merluza|bacalao|salm|pescado|gamba|calamar|marisco|surimi/.test(n)) return "pescado";
  if (/pollo|carne|cerdo|ternera|albóndiga|hamburguesa|cochinillo/.test(n)) return "carne";
  if (/tortilla|huevo/.test(n)) return "huevo";
  if (/crema|sopa|caldo|gazpacho|salmorejo/.test(n)) return "sopa";
  if (/ensalada/.test(n)) return "ensalada";
  if (/verdura|pisto|espinaca|brócoli/.test(n)) return "verdura";
  return "guiso";
}
