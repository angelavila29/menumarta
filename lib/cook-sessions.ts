/** Veces que cocinas a la semana, por rangos. Lo que se guarda es un número (o null = que decida la app). */
export const COOK_RANGES: { id: string; label: string; value: number | null; hint: string }[] = [
  { id: "1-2", label: "1 o 2 veces", value: 2, hint: "Cocinas poco y tiras de sobras y cosas rápidas." },
  { id: "3-4", label: "3 o 4 veces", value: 4, hint: "Cocinas un par de veces y lo repartes." },
  { id: "5-6", label: "5 o 6 veces", value: 6, hint: "Casi cada día, con alguna sobra." },
  { id: "7+", label: "7 o más", value: 8, hint: "Te gusta cocinar y no te importa hacerlo a menudo." },
  { id: "any", label: "Me da igual", value: null, hint: "Lo ajustamos según cuántos sois en casa." },
];

/** Del número guardado al rango que se marca en pantalla. */
export function cookRangeOf(sessions: number | null | undefined): string {
  if (sessions == null) return "any";
  if (sessions <= 2) return "1-2";
  if (sessions <= 4) return "3-4";
  if (sessions <= 6) return "5-6";
  return "7+";
}
