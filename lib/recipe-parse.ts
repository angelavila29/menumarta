/**
 * Lee una receta pegada como texto (de una web, de WhatsApp, de unas notas) y saca nombre,
 * ingredientes con cantidad y pasos. Es heurístico: el formulario queda relleno para revisar.
 */
import { stem, unaccent } from "@/lib/search";

export type ParsedRecipe = {
  name: string;
  servings: number | null;
  timeMinutes: number | null;
  ingredients: { name: string; qty: number; unit: "g" | "ml" | "ud" }[];
  steps: string[];
};

const UNITS: Record<string, { unit: "g" | "ml" | "ud"; factor: number }> = {
  kg: { unit: "g", factor: 1000 }, kilo: { unit: "g", factor: 1000 }, kilos: { unit: "g", factor: 1000 },
  g: { unit: "g", factor: 1 }, gr: { unit: "g", factor: 1 }, grs: { unit: "g", factor: 1 }, gramo: { unit: "g", factor: 1 }, gramos: { unit: "g", factor: 1 },
  l: { unit: "ml", factor: 1000 }, litro: { unit: "ml", factor: 1000 }, litros: { unit: "ml", factor: 1000 },
  ml: { unit: "ml", factor: 1 }, cl: { unit: "ml", factor: 10 }, dl: { unit: "ml", factor: 100 },
  cucharada: { unit: "ml", factor: 15 }, cucharadas: { unit: "ml", factor: 15 }, cda: { unit: "ml", factor: 15 }, cdas: { unit: "ml", factor: 15 },
  cucharadita: { unit: "ml", factor: 5 }, cucharaditas: { unit: "ml", factor: 5 }, cdta: { unit: "ml", factor: 5 },
  vaso: { unit: "ml", factor: 200 }, vasos: { unit: "ml", factor: 200 }, taza: { unit: "ml", factor: 250 }, tazas: { unit: "ml", factor: 250 },
  ud: { unit: "ud", factor: 1 }, uds: { unit: "ud", factor: 1 }, unidad: { unit: "ud", factor: 1 }, unidades: { unit: "ud", factor: 1 },
  diente: { unit: "ud", factor: 1 }, dientes: { unit: "ud", factor: 1 }, lata: { unit: "ud", factor: 1 }, latas: { unit: "ud", factor: 1 },
  bote: { unit: "ud", factor: 1 }, botes: { unit: "ud", factor: 1 }, hoja: { unit: "ud", factor: 1 }, hojas: { unit: "ud", factor: 1 },
  rebanada: { unit: "ud", factor: 1 }, rebanadas: { unit: "ud", factor: 1 }, loncha: { unit: "ud", factor: 1 }, lonchas: { unit: "ud", factor: 1 },
};
const FRACTIONS: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75, "1/2": 0.5, "1/4": 0.25, "3/4": 0.75, "1/3": 0.33, medio: 0.5, media: 0.5, un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4 };

const QTY = String.raw`(\d+(?:[.,]\d+)?(?:\s*/\s*\d+)?|½|¼|¾|medio|media|un|una|uno|dos|tres|cuatro)`;
const ING_RE = new RegExp(String.raw`^${QTY}\s*([a-záéíóúñ]+\.?)?\s*(?:de\s+|del\s+)?(.*)$`, "i");

function toNumber(s: string): number {
  const k = s.toLowerCase().replace(/\s/g, "");
  if (FRACTIONS[k] !== undefined) return FRACTIONS[k];
  if (k.includes("/")) {
    const [a, b] = k.split("/").map(Number);
    return b ? a / b : a;
  }
  return parseFloat(k.replace(",", "."));
}

/** Lleva "huevos", "dientes de ajo" o "AOVE" al nombre que ya usamos, si existe. */
function canonical(name: string, known: string[]): string {
  let n = name.toLowerCase().replace(/\(.*?\)/g, " ").replace(/[.,;:]+$/g, "").replace(/\s+/g, " ").trim();
  n = n.replace(/^(de|del)\s+/, "");
  if (/\baove\b|aceite de oliva/.test(n)) return "aceite de oliva";
  const SKIP = new Set(["de", "del", "la", "el", "los", "las"]);
  const words = unaccent(n).split(" ").filter((w) => !SKIP.has(w)).map(stem);
  let best: { name: string; score: number } | null = null;
  for (const k of known) {
    const kw = unaccent(k).split(" ").filter((w) => !SKIP.has(w)).map(stem);
    if (!kw.every((w) => words.includes(w))) continue;
    if (!best || kw.length > best.score) best = { name: k, score: kw.length };
  }
  return best?.name ?? n;
}

export function parseRecipeText(text: string, known: string[]): ParsedRecipe {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/^[\s\-•*·–▢☐]+/, "").trim()).filter(Boolean);
  const out: ParsedRecipe = { name: "", servings: null, timeMinutes: null, ingredients: [], steps: [] };
  let section: "none" | "ingredients" | "steps" = "none";

  const all = text.toLowerCase();
  const serv = all.match(/(?:para|raciones:?|comensales:?|personas:?)\s*(\d{1,2})\s*(?:personas|raciones|comensales)?/);
  if (serv) out.servings = Math.min(12, Number(serv[1]));
  const hours = all.match(/(\d+(?:[.,]\d+)?)\s*(?:h|horas?)\b/);
  const mins = all.match(/(\d{1,3})\s*(?:min|minutos)\b/);
  if (hours || mins) out.timeMinutes = Math.round((hours ? parseFloat(hours[1].replace(",", ".")) * 60 : 0) + (mins && !hours ? Number(mins[1]) : 0)) || null;

  for (const line of lines) {
    const low = unaccent(line);
    if (/^ingredientes\b/.test(low)) { section = "ingredients"; continue; }
    if (/^(preparacion|elaboracion|pasos|instrucciones|modo de preparacion|como se hace)\b/.test(low)) { section = "steps"; continue; }
    // línea de datos ("Para 4 personas · 40 min"): ya está leída arriba, no es un paso
    if (line.length < 60 && /(\d+\s*(min|minutos|h|horas?)\b|para\s+\d+\s+(personas|raciones|comensales)|raciones:|comensales:)/.test(low)) continue;
    if (!out.name && section === "none" && line.length <= 80 && !/^\d/.test(line)) { out.name = line.replace(/^receta( de)?:?\s*/i, ""); continue; }

    const m = line.match(ING_RE);
    const looksLikeStep = /^\d+[.)]\s+\S/.test(line) || line.length > 70;
    if (section !== "steps" && m && !looksLikeStep) {
      const qtyRaw = toNumber(m[1]);
      const unitWord = (m[2] ?? "").toLowerCase().replace(".", "");
      const u = UNITS[unitWord];
      // si la "unidad" no lo es ("2 huevos"), forma parte del nombre
      const rest = u ? m[3] : `${m[2] ?? ""} ${m[3]}`.trim();
      if (rest && Number.isFinite(qtyRaw)) {
        out.ingredients.push({ name: canonical(rest, known), qty: Math.round(qtyRaw * (u?.factor ?? 1) * 100) / 100, unit: u?.unit ?? "ud" });
        if (section === "none") section = "ingredients";
        continue;
      }
    }
    if (section === "ingredients" && !looksLikeStep && line.length < 60) {
      // ingrediente sin cantidad ("sal", "aceite de oliva"): no se compra por cantidad, se omite
      continue;
    }
    const step = line.replace(/^\d+[.)]\s*/, "").replace(/^paso\s*\d+:?\s*/i, "");
    if (step.length > 8) {
      out.steps.push(step);
      section = "steps";
    }
  }
  if (!out.name) out.name = lines[0]?.slice(0, 80) ?? "";
  return out;
}
