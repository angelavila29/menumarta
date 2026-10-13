import { dayBreakdown } from "@/lib/goal";

// "1.430" y no "1430": en español los números de 4 cifras no se agrupan por defecto
const kcal = (n: number) => n.toLocaleString("es-ES", { useGrouping: "always" } as Intl.NumberFormatOptions);

/** El objetivo diario y cómo se reparte entre las comidas del día; marca las que planifica el menú. */
export function DayBreakdown({ kcalDay, proteinDay }: { kcalDay: number; proteinDay?: number }) {
  const parts = dayBreakdown(kcalDay);
  const menuKcal = Math.round(kcalDay * parts.filter((p) => p.menu).reduce((s, p) => s + p.share, 0));
  return (
    <div className="rounded-xl bg-olive-soft p-3 text-sm text-olive-dark">
      <p>
        Tu objetivo diario: <b className="text-base">{kcal(kcalDay)} kcal</b>
        {proteinDay != null && <> y <b>{proteinDay} g de proteína</b></>}
      </p>
      <ul className="mt-2 flex flex-col gap-1">
        {parts.map((p) => (
          <li key={p.key} className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1 ${p.menu ? "bg-white font-medium text-ink" : ""}`}>
            <span>
              <span aria-hidden className="mr-1.5">{p.emoji}</span>
              {p.label}
              {p.menu && <span className="ml-1.5 rounded bg-olive px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">en tu menú</span>}
            </span>
            <span className="shrink-0 tabular-nums">~{kcal(p.kcal)} kcal</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs">
        El menú planifica comida y cena (~{kcal(menuKcal)} kcal). Desayuno, fruta, pan y postre los pones tú.
      </p>
    </div>
  );
}
