"use client";

import { useEffect, useMemo, useState } from "react";
import { RecipeArt } from "@/components/recipe-art";

export type PickerRecipe = { id: number; name: string; tags: string[]; photo_url?: string | null; owner_id?: string | null; author_name?: string | null };
type Extra = { label: string; emoji: string; onClick: () => void };

const FILTERS: [string, string][] = [["rápido", "⏱️ Rápidas"], ["táper", "🥡 De táper"], ["económico", "💶 Económicas"], ["vegetariano", "🥬 Vegetarianas"], ["carne", "🍗 Carne"], ["pescado", "🐟 Pescado"], ["pasta", "🍝 Pasta"], ["legumbre", "🍲 Legumbres"]];
const plain = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Elegir un plato a la vista: recomendados arriba, buscador y filtros, y todas las recetas con
 * su imagen. Sustituye al desplegable de nombres.
 */
export function RecipePicker({ title, subtitle, recipes, recommended = [], favorites, minutes, currentId, extras = [], showFilters = true, onPick, onClose }: {
  title: string;
  subtitle?: string;
  recipes: PickerRecipe[];
  recommended?: PickerRecipe[];
  favorites?: Set<number>;
  minutes?: Record<number, number | null>;
  currentId?: number | null;
  extras?: Extra[];
  showFilters?: boolean;
  onPick: (id: number) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // que no se mueva la página de detrás
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const found = useMemo(() => {
    const words = plain(q).split(/\s+/).filter(Boolean);
    return recipes.filter((r) => {
      if (filter && !r.tags.includes(filter)) return false;
      const hay = plain(`${r.name} ${r.tags.join(" ")}`);
      return words.every((w) => hay.includes(w));
    });
  }, [recipes, q, filter]);
  const browsing = q.trim() === "" && filter === null;
  const usedFilters = FILTERS.filter(([id]) => recipes.some((r) => r.tags.includes(id)));

  const Card = ({ r }: { r: PickerRecipe }) => {
    const current = r.id === currentId;
    const mins = minutes?.[r.id];
    return (
      <li>
        <button type="button" onClick={() => onPick(r.id)} aria-pressed={current} className="group block w-full text-left">
          <span className="relative block">
            <RecipeArt tags={r.tags} name={r.name} photoUrl={r.photo_url} className={`aspect-square rounded-xl text-4xl transition group-hover:brightness-95 sm:text-5xl ${current ? "ring-2 ring-brand ring-offset-2" : ""}`} />
            {favorites?.has(r.id) && <span aria-label="Favorita" className="absolute right-1.5 top-1.5 rounded-full bg-white/90 px-1 text-xs">❤️</span>}
            {current && <span className="absolute left-1.5 top-1.5 rounded-md bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-white">Ahora</span>}
          </span>
          <span className="mt-1.5 line-clamp-2 block text-[13px] font-medium leading-tight group-hover:text-brand sm:text-sm">{r.name}</span>
          <span className="block text-[11px] text-muted">
            {mins ? `${mins} min` : ""}
            {r.owner_id ? `${mins ? " · " : ""}de ${r.author_name ?? "un amigo"}` : ""}
          </span>
        </button>
      </li>
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/50 sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-[92dvh] w-full max-w-3xl flex-col rounded-t-3xl bg-white shadow-2xl sm:h-auto sm:max-h-[88vh] sm:rounded-2xl">
        <div className="shrink-0 border-b border-cream-dark p-4 pb-3 sm:p-5 sm:pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-lg font-bold">{title}</p>
              {subtitle && <p className="truncate text-sm text-muted">{subtitle}</p>}
            </div>
            <button type="button" onClick={onClose} aria-label="Cerrar" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cream text-lg hover:bg-cream-dark">×</button>
          </div>
          <label className="mt-3 flex items-center gap-2 rounded-xl border border-cream-dark bg-white px-3 focus-within:border-brand">
            <span aria-hidden className="text-muted">🔍</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar: pollo, pasta, lentejas…" aria-label="Buscar receta" className="w-full bg-transparent py-2.5 text-base outline-none" />
            {q && <button type="button" onClick={() => setQ("")} aria-label="Borrar búsqueda" className="px-1 text-muted">×</button>}
          </label>
          {showFilters && usedFilters.length > 0 && (
            <ul className="no-scrollbar -mx-4 mt-2.5 flex gap-2 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
              {usedFilters.map(([id, label]) => (
                <li key={id} className="shrink-0">
                  <button type="button" aria-pressed={filter === id} onClick={() => setFilter(filter === id ? null : id)} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${filter === id ? "border-brand bg-brand text-white" : "border-cream-dark bg-white hover:bg-cream"}`}>
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5">
          {browsing && recommended.length > 0 && (
            <section className="mb-5">
              <p className="mb-2 text-sm font-semibold">Recomendadas para este hueco</p>
              <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
                {recommended.map((r) => <Card key={r.id} r={r} />)}
              </ul>
            </section>
          )}
          {browsing && extras.length > 0 && (
            <div className="mb-5 flex flex-wrap gap-2">
              {extras.map((x) => (
                <button key={x.label} type="button" onClick={x.onClick} className="flex items-center gap-2 rounded-xl border border-cream-dark px-3 py-2 text-sm font-medium hover:bg-cream">
                  <span aria-hidden>{x.emoji}</span> {x.label}
                </button>
              ))}
            </div>
          )}
          <p className="mb-2 text-sm font-semibold">{browsing ? `Todas (${found.length})` : `${found.length} ${found.length === 1 ? "receta" : "recetas"}`}</p>
          {found.length === 0 ? (
            <p className="rounded-xl bg-cream px-4 py-6 text-center text-sm text-muted">No hay ninguna receta así. Prueba con otra palabra o quita el filtro.</p>
          ) : (
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
              {found.map((r) => <Card key={r.id} r={r} />)}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
