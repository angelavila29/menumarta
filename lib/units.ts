/**
 * Medidas de cocina. Las recetas se escriben como se habla ("2 cucharadas", "un puñado",
 * "1 vaso") y aquí se pasan a gramos, mililitros o unidades para calcular la compra y la nutrición.
 */
export type BaseUnit = "g" | "ml" | "ud";

export type UnitDef = {
  id: string;
  label: string; // singular
  plural: string;
  base: BaseUnit;
  factor: number; // cuánto vale 1 en la unidad base
  group: "peso" | "volumen" | "casa" | "piezas";
};

export const UNITS: UnitDef[] = [
  { id: "g", label: "g", plural: "g", base: "g", factor: 1, group: "peso" },
  { id: "kg", label: "kg", plural: "kg", base: "g", factor: 1000, group: "peso" },
  { id: "ml", label: "ml", plural: "ml", base: "ml", factor: 1, group: "volumen" },
  { id: "l", label: "L", plural: "L", base: "ml", factor: 1000, group: "volumen" },
  { id: "cucharada", label: "cucharada", plural: "cucharadas", base: "ml", factor: 15, group: "casa" },
  { id: "cucharadita", label: "cucharadita", plural: "cucharaditas", base: "ml", factor: 5, group: "casa" },
  { id: "vaso", label: "vaso", plural: "vasos", base: "ml", factor: 200, group: "casa" },
  { id: "taza", label: "taza", plural: "tazas", base: "ml", factor: 250, group: "casa" },
  { id: "chorrito", label: "chorrito", plural: "chorritos", base: "ml", factor: 10, group: "casa" },
  { id: "puñado", label: "puñado", plural: "puñados", base: "g", factor: 30, group: "casa" },
  { id: "pizca", label: "pizca", plural: "pizcas", base: "g", factor: 1, group: "casa" },
  { id: "ud", label: "unidad", plural: "unidades", base: "ud", factor: 1, group: "piezas" },
  { id: "diente", label: "diente", plural: "dientes", base: "ud", factor: 1, group: "piezas" },
  { id: "loncha", label: "loncha", plural: "lonchas", base: "ud", factor: 1, group: "piezas" },
  { id: "rebanada", label: "rebanada", plural: "rebanadas", base: "ud", factor: 1, group: "piezas" },
  { id: "lata", label: "lata", plural: "latas", base: "ud", factor: 1, group: "piezas" },
  { id: "bote", label: "bote", plural: "botes", base: "ud", factor: 1, group: "piezas" },
  { id: "hoja", label: "hoja", plural: "hojas", base: "ud", factor: 1, group: "piezas" },
  { id: "ramita", label: "ramita", plural: "ramitas", base: "ud", factor: 1, group: "piezas" },
];

const BY_ID = new Map(UNITS.map((u) => [u.id, u]));
const ALIASES: Record<string, string> = {
  gr: "g", grs: "g", gramo: "g", gramos: "g", kilo: "kg", kilos: "kg",
  litro: "l", litros: "l", cl: "ml", dl: "ml",
  cda: "cucharada", cdas: "cucharada", cucharadas: "cucharada", cucharada_sopera: "cucharada",
  cdta: "cucharadita", cucharaditas: "cucharadita",
  vasos: "vaso", tazas: "taza", chorro: "chorrito", chorritos: "chorrito",
  puñados: "puñado", punado: "puñado", punados: "puñado", pizcas: "pizca",
  uds: "ud", unidad: "ud", unidades: "ud", pieza: "ud", piezas: "ud",
  dientes: "diente", lonchas: "loncha", rebanadas: "rebanada", latas: "lata", botes: "bote", hojas: "hoja", ramitas: "ramita",
};

/** Un puñado no pesa lo mismo de arroz que de espinacas. */
const HANDFUL_GRAMS: [RegExp, number][] = [
  [/arroz|pasta|macarron|espagueti|fideo|lenteja|garbanzo|alubia|cusc[uú]s|quinoa/, 40],
  [/nuez|nueces|almendra|cacahuete|pasas|pistacho|frutos secos/, 25],
  [/espinaca|r[uú]cula|can[oó]nigo|lechuga|perejil|cilantro|albahaca/, 20],
  [/queso rallado|pan rallado/, 20],
];

export function unitDef(id: string): UnitDef | null {
  const k = id.trim().toLowerCase();
  return BY_ID.get(k) ?? BY_ID.get(ALIASES[k] ?? "") ?? null;
}

/** Pasa cualquier medida a g, ml o ud. Lo que no se conoce se trata como unidades. */
export function toBase(qty: number, unit: string, ingredient = ""): { qty: number; unit: BaseUnit } {
  const u = unitDef(unit);
  if (!u) return { qty, unit: "ud" };
  if (u.id === "puñado") {
    const n = ingredient.toLowerCase();
    const g = HANDFUL_GRAMS.find(([re]) => re.test(n))?.[1] ?? u.factor;
    return { qty: qty * g, unit: "g" };
  }
  // cl y dl no están en la tabla: se resuelven aquí
  const k = unit.trim().toLowerCase();
  if (k === "cl") return { qty: qty * 10, unit: "ml" };
  if (k === "dl") return { qty: qty * 100, unit: "ml" };
  return { qty: qty * u.factor, unit: u.base };
}

/** "2 cucharadas", "1 vaso", "½ diente", "150 g". Para mostrar lo que escribió la persona. */
export function formatMeasure(qty: number, unit: string, formatNumber: (n: number) => string): string {
  const u = unitDef(unit);
  if (!u) return `${formatNumber(qty)} ${unit}`;
  if (u.group === "peso" || u.group === "volumen") return `${formatNumber(qty)} ${u.label}`;
  // "½ vaso", "1 diente", "2 cucharadas": singular hasta 1 incluido
  const singular = qty <= 1.001;
  return `${formatNumber(qty)} ${singular ? u.label : u.plural}`;
}
