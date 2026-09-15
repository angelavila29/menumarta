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
