/**
 * Nutrición aproximada de las recetas a partir de sus ingredientes.
 * Valores por 100 g (o 100 ml) redondeados de tablas de composición habituales, y el peso
 * típico de una unidad cuando el ingrediente se cuenta por unidades. Es una estimación.
 */
type Row = { kcal: number; protein: number; carbs: number; unitGrams?: number; veg?: boolean; density?: number };

const T: Record<string, Row> = {
  "aceite de oliva": { kcal: 884, protein: 0, carbs: 0, density: 0.92 },
  aceitunas: { kcal: 145, protein: 1, carbs: 4 },
  ajo: { kcal: 149, protein: 6.4, carbs: 33, unitGrams: 5 },
  "alubias blancas": { kcal: 333, protein: 23, carbs: 60 },
  arroz: { kcal: 360, protein: 7, carbs: 79 },
  "atún en lata": { kcal: 150, protein: 25, carbs: 0 },
  bacalao: { kcal: 82, protein: 18, carbs: 0 },
  berenjena: { kcal: 25, protein: 1, carbs: 6, unitGrams: 300, veg: true },
  brócoli: { kcal: 34, protein: 2.8, carbs: 7, veg: true },
  calabacín: { kcal: 17, protein: 1.2, carbs: 3, unitGrams: 250, veg: true },
  calabaza: { kcal: 26, protein: 1, carbs: 6.5, veg: true },
  "caldo de pollo": { kcal: 5, protein: 0.6, carbs: 0.3 },
  "carne picada": { kcal: 250, protein: 17, carbs: 0 },
  cebolla: { kcal: 40, protein: 1.1, carbs: 9, unitGrams: 150, veg: true },
  champiñones: { kcal: 22, protein: 3.1, carbs: 3.3, veg: true },
  chorizo: { kcal: 455, protein: 24, carbs: 2 },
  espaguetis: { kcal: 360, protein: 12.5, carbs: 72 },
  espinacas: { kcal: 23, protein: 2.9, carbs: 3.6, veg: true },
  fideos: { kcal: 360, protein: 12.5, carbs: 72 },
  "filete de ternera": { kcal: 150, protein: 21, carbs: 0 },
  gambas: { kcal: 99, protein: 24, carbs: 0.2 },
  "garbanzos cocidos": { kcal: 139, protein: 7, carbs: 20 },
  guindilla: { kcal: 40, protein: 2, carbs: 9, unitGrams: 2 },
  guisantes: { kcal: 81, protein: 5.4, carbs: 14, veg: true },
  harina: { kcal: 364, protein: 10, carbs: 76 },
  huevo: { kcal: 143, protein: 12.6, carbs: 0.7, unitGrams: 55 },
  "jamón cocido": { kcal: 115, protein: 18, carbs: 1 },
  "jamón serrano": { kcal: 240, protein: 30, carbs: 0 },
  "judías verdes": { kcal: 31, protein: 1.8, carbs: 7, veg: true },
  laurel: { kcal: 0, protein: 0, carbs: 0, unitGrams: 0.5 },
  lechuga: { kcal: 15, protein: 1.4, carbs: 2.9, unitGrams: 400, veg: true },
  lentejas: { kcal: 350, protein: 25, carbs: 60 },
  "lentejas cocidas": { kcal: 116, protein: 9, carbs: 20 },
  "tortillas de trigo": { kcal: 310, protein: 8, carbs: 52, unitGrams: 40 },
  cuscús: { kcal: 360, protein: 12, carbs: 72 },
  limón: { kcal: 29, protein: 1.1, carbs: 9, unitGrams: 100 },
  "lomo de cerdo": { kcal: 143, protein: 21, carbs: 0 },
  macarrones: { kcal: 360, protein: 12.5, carbs: 72 },
  "maíz en lata": { kcal: 80, protein: 2.5, carbs: 16, veg: true },
  merluza: { kcal: 72, protein: 17, carbs: 0 },
  "muslo de pollo": { kcal: 180, protein: 18, carbs: 0 },
  nata: { kcal: 340, protein: 2, carbs: 3 },
  pan: { kcal: 265, protein: 9, carbs: 49 },
  "pan de molde": { kcal: 265, protein: 8, carbs: 48, unitGrams: 25 },
  "pan rallado": { kcal: 395, protein: 13, carbs: 72 },
  patata: { kcal: 77, protein: 2, carbs: 17, unitGrams: 200 },
  "pechuga de pollo": { kcal: 120, protein: 23, carbs: 0 },
  perejil: { kcal: 36, protein: 3, carbs: 6, veg: true },
  pimentón: { kcal: 282, protein: 14, carbs: 54 },
  "pimiento rojo": { kcal: 31, protein: 1, carbs: 6, unitGrams: 200, veg: true },
  "pimiento verde": { kcal: 20, protein: 0.9, carbs: 4.6, unitGrams: 150, veg: true },
  plátano: { kcal: 89, protein: 1.1, carbs: 23, unitGrams: 120 },
  "queso en lonchas": { kcal: 330, protein: 20, carbs: 2, unitGrams: 20 },
  "queso fresco": { kcal: 175, protein: 12, carbs: 3 },
  "queso rallado": { kcal: 400, protein: 28, carbs: 2 },
  salmón: { kcal: 208, protein: 20, carbs: 0 },
  "ternera para guisar": { kcal: 160, protein: 20, carbs: 0 },
  tomate: { kcal: 18, protein: 0.9, carbs: 3.9, unitGrams: 150, veg: true },
  "tomate frito": { kcal: 80, protein: 1.5, carbs: 11, veg: true },
  "vino blanco": { kcal: 82, protein: 0.1, carbs: 2.6 },
  zanahoria: { kcal: 41, protein: 0.9, carbs: 10, unitGrams: 80, veg: true },
  aguacate: { kcal: 160, protein: 2, carbs: 9, unitGrams: 200 },
  "alubias pintas cocidas": { kcal: 120, protein: 7, carbs: 18 },
  bacon: { kcal: 400, protein: 13, carbs: 1 },
  "base de pizza": { kcal: 270, protein: 8, carbs: 50, unitGrams: 260 },
  bechamel: { kcal: 110, protein: 3, carbs: 8 },
  cerveza: { kcal: 43, protein: 0.5, carbs: 3.5 },
  "chuletas de cerdo": { kcal: 230, protein: 20, carbs: 0 },
  coliflor: { kcal: 25, protein: 2, carbs: 5, unitGrams: 900, veg: true },
  "costillas de cerdo": { kcal: 280, protein: 17, carbs: 0 },
  curry: { kcal: 325, protein: 14, carbs: 58 },
  gnocchi: { kcal: 160, protein: 4, carbs: 32 },
  leche: { kcal: 47, protein: 3.3, carbs: 4.8, density: 1.03 },
  mantequilla: { kcal: 740, protein: 0.7, carbs: 0.6 },
  "masa de empanadillas": { kcal: 330, protein: 8, carbs: 45, unitGrams: 250 },
  mayonesa: { kcal: 680, protein: 1, carbs: 2, density: 0.95 },
  "menestra de verduras": { kcal: 45, protein: 3, carbs: 7, veg: true },
  mozzarella: { kcal: 250, protein: 18, carbs: 2 },
  noodles: { kcal: 350, protein: 10, carbs: 72 },
  "pan de pita": { kcal: 275, protein: 9, carbs: 55, unitGrams: 60 },
  pepino: { kcal: 15, protein: 0.7, carbs: 3.6, unitGrams: 300, veg: true },
  pesto: { kcal: 450, protein: 5, carbs: 6 },
  picatostes: { kcal: 400, protein: 10, carbs: 65 },
  "pimientos asados": { kcal: 30, protein: 1, carbs: 5, veg: true },
  "placas para lasaña": { kcal: 350, protein: 12, carbs: 70, unitGrams: 17 },
  puerro: { kcal: 30, protein: 1.5, carbs: 6, unitGrams: 150, veg: true },
  salchichas: { kcal: 280, protein: 12, carbs: 3, unitGrams: 40 },
  "salmón ahumado": { kcal: 180, protein: 22, carbs: 0 },
  "salsa césar": { kcal: 400, protein: 2, carbs: 6 },
  "salsa de soja": { kcal: 55, protein: 8, carbs: 5 },
  "tomate cherry": { kcal: 18, protein: 0.9, carbs: 3.9, veg: true },
  tortellini: { kcal: 290, protein: 12, carbs: 45 },
  vinagre: { kcal: 20, protein: 0, carbs: 0.5 },
};

/** Peso típico en gramos de una unidad del ingrediente (1 cebolla ≈ 150 g). */
export function unitGramsOf(ingredient: string): number | null {
  return T[ingredient]?.unitGrams ?? null;
}

function gramsOf(ingredient: string, qty: number, unit: string): number | null {
  const row = T[ingredient];
  if (unit === "g") return qty;
  if (unit === "ml") return qty * (row?.density ?? 1);
  if (unit === "ud") return row?.unitGrams != null ? qty * row.unitGrams : null;
  return null;
}

export type Nutrition = { kcal: number; protein: number; carbs: number; veg: number; covered: number; total: number };

/** Nutrición por ración. `covered` dice cuántos ingredientes se han podido calcular. */
export function nutritionPerServing(ings: { ingredient_name: string; qty: number; unit: string }[], servings: number): Nutrition {
  let kcal = 0;
  let protein = 0;
  let carbs = 0;
  let veg = 0;
  let covered = 0;
  for (const i of ings) {
    const row = T[i.ingredient_name];
    const g = gramsOf(i.ingredient_name, Number(i.qty), i.unit);
    if (!row || g === null) continue;
    covered += 1;
    kcal += (row.kcal * g) / 100;
    protein += (row.protein * g) / 100;
    carbs += (row.carbs * g) / 100;
    if (row.veg) veg += g;
  }
  const s = Math.max(1, servings);
  return { kcal: Math.round(kcal / s), protein: Math.round(protein / s), carbs: Math.round(carbs / s), veg: Math.round(veg / s), covered, total: ings.length };
}
