/** Cantidades escritas por personas: "1/2", "½", "1 1/2", "0,5", "2". */

const VULGAR: Record<string, number> = { "½": 0.5, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 0.25, "¾": 0.75, "⅛": 0.125 };

/** Devuelve el número o null si no se entiende. */
export function parseQty(input: string): number | null {
  let s = input.trim().toLowerCase().replace(",", ".");
  if (!s) return null;
  let total = 0;
  for (const [ch, v] of Object.entries(VULGAR)) {
    if (s.includes(ch)) {
      total += v;
      s = s.replace(ch, "").trim();
    }
  }
  if (!s) return total > 0 ? total : null;
  // "1 1/2" → entero + fracción; "1/2" → fracción; "1.5" → decimal
  const m = s.match(/^(\d+(?:\.\d+)?)?\s*(?:(\d+)\s*\/\s*(\d+))?$/);
  if (!m || (m[1] === undefined && m[2] === undefined)) return null;
  if (m[1] !== undefined) total += Number(m[1]);
  if (m[2] !== undefined) {
    const den = Number(m[3]);
    if (den === 0) return null;
    total += Number(m[2]) / den;
  }
  return Number.isFinite(total) && total > 0 ? total : null;
}

/** 0.5 → "½", 1.5 → "1 ½", 0.33 → "⅓", 2 → "2", 0.4 → "0,4". Para unidades (huevos, cebollas). */
export function formatUnits(n: number): string {
  const whole = Math.floor(n + 1e-9);
  const frac = n - whole;
  const close = (a: number, b: number) => Math.abs(a - b) < 0.03;
  let sym = "";
  if (close(frac, 0)) sym = "";
  else if (close(frac, 0.5)) sym = "½";
  else if (close(frac, 0.25)) sym = "¼";
  else if (close(frac, 0.75)) sym = "¾";
  else if (close(frac, 1 / 3)) sym = "⅓";
  else if (close(frac, 2 / 3)) sym = "⅔";
  else return n.toLocaleString("es-ES", { maximumFractionDigits: 2 });
  if (whole === 0) return sym || "0";
  return sym ? `${whole} ${sym}` : String(whole);
}
