/**
 * Electrodomésticos: qué tiene cada persona en su cocina y qué necesita cada receta.
 * Lo que pide una receta se deduce de sus pasos ("hornea", "tritura"…), así vale también
 * para las recetas que sube la gente sin tener que marcar nada.
 */
export type ApplianceId = "fuego" | "horno" | "microondas" | "freidora" | "batidora" | "olla";

export const APPLIANCES: { id: ApplianceId; label: string; hint: string }[] = [
  { id: "fuego", label: "Vitro o fuegos", hint: "Sartén y cazuela" },
  { id: "horno", label: "Horno", hint: "Asados y gratinados" },
  { id: "microondas", label: "Microondas", hint: "Calentar y cocinar rápido" },
  { id: "freidora", label: "Freidora de aire", hint: "Sustituye al horno en lo pequeño" },
  { id: "batidora", label: "Batidora", hint: "Cremas, purés y salsas" },
  { id: "olla", label: "Olla exprés", hint: "Legumbres y guisos rápidos" },
];

const NEEDS: [ApplianceId, RegExp][] = [
  ["horno", /\bhorno|hornea|gratin/i],
  ["batidora", /tritur|batidora|bate hasta que quede (fino|cremoso)/i],
  ["fuego", /sart[eé]n|sofr[ií]|cuec|cocer|hierv|plancha|fr[ií]e|fre[ií]r|salte|cazuela|olla|rehoga|\bdora|pocha/i],
];

/** Lo que necesita una receta según sus pasos. El microondas y la olla exprés nunca son imprescindibles. */
export function requiredAppliances(steps: string[] | null | undefined): ApplianceId[] {
  const text = (steps ?? []).join(" ");
  return NEEDS.filter(([, re]) => re.test(text)).map(([id]) => id);
}

/**
 * ¿Se puede hacer con lo que hay en casa? `have` null = no lo ha dicho: no se filtra nada.
 * La freidora de aire sirve para lo que pide horno.
 */
export function canCook(steps: string[] | null | undefined, have: string[] | null | undefined): boolean {
  if (!have) return true;
  const h = new Set(have);
  return requiredAppliances(steps).every((need) => h.has(need) || (need === "horno" && h.has("freidora")));
}
