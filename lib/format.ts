const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

export function euro(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return eur.format(n);
}

const UNIT_LABEL: Record<string, string> = { kg: "kg", l: "L", ud: "ud" };

export function unitPrice(n: number | null | undefined, unit: string | null | undefined): string {
  if (n === null || n === undefined || !unit) return "";
  const u = UNIT_LABEL[unit] ?? unit;
  // Los productos de €/kg muy caros (azafrán) o muy baratos (servilletas) se leen mejor con más decimales
  const formatted = n < 1 ? n.toFixed(3).replace(".", ",") : n.toFixed(2).replace(".", ",");
  return `${formatted} €/${u}`;
}

export function superName(id: string): string {
  return { mercadona: "Mercadona", dia: "Dia" }[id] ?? id;
}

/** '1 l' → '1 L', '0.75 l' → '0,75 L', '6 ud' → '6 ud' */
export function packSize(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/\bl\b/, "L").replace(/(\d)\.(\d)/, "$1,$2");
}

/** Colores por cadena para etiquetas y cabeceras. */
export const SUPER_STYLE: Record<string, { badge: string; band: string; border: string }> = {
  mercadona: { badge: "bg-emerald-100 text-emerald-800", band: "bg-emerald-600", border: "border-l-emerald-500" },
  dia: { badge: "bg-red-100 text-red-800", band: "bg-red-600", border: "border-l-red-500" },
};
const DEFAULT_STYLE = { badge: "bg-zinc-100 text-zinc-700", band: "bg-zinc-600", border: "border-l-zinc-400" };
export function superStyle(id: string) {
  return SUPER_STYLE[id] ?? DEFAULT_STYLE;
}
