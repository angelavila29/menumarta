"use client";

import { useEffect, useRef, useState } from "react";
import { browseProducts, type BrowseSort } from "@/lib/actions";
import { FAMILY_FILTERS } from "@/lib/categories";
import { SEARCH_EVENT } from "@/lib/events";
import type { SearchResult } from "@/lib/types";
import { ChainLogo } from "./chain-logo";
import { ChevronDown, ChevronRight, HeartIcon, SearchIcon } from "./icons";
import { BulbIcon } from "./icons-extra";
import { ProductTile } from "./product-tile";

type Chain = { id: string; name: string };
type Offer = { chain: string; name: string; count: number };

const SORTS: { id: BrowseSort; label: string }[] = [
  { id: "relevancia", label: "Ordenar por relevancia" },
  { id: "precio", label: "Precio más bajo" },
  { id: "unidad", label: "Precio por kg / L" },
  { id: "nombre", label: "Nombre (A-Z)" },
];

const svg = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, viewBox: "0 0 24 24" };
const TagIcon = ({ className }: { className?: string }) => (
  <svg {...svg} className={className}><path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z" /><circle cx="7.5" cy="7.5" r="1.3" fill="currentColor" /></svg>
);
const GridIcon = ({ className }: { className?: string }) => (
  <svg {...svg} className={className}><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></svg>
);
const ListIcon = ({ className }: { className?: string }) => (
  <svg {...svg} className={className}><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" fill="currentColor" /><circle cx="4.5" cy="12" r="1" fill="currentColor" /><circle cx="4.5" cy="18" r="1" fill="currentColor" /></svg>
);
const FilterIcon = ({ className }: { className?: string }) => (
  <svg {...svg} className={className}><path d="M4 5h16l-6 7.5V19l-4 1.5v-8z" /></svg>
);

export function Search({ favoriteIds, initialQuery = "", chains, offers }: { favoriteIds: number[]; initialQuery?: string; chains: Chain[]; offers: Offer[] }) {
  const allIds = chains.map((c) => c.id);
  const [q, setQ] = useState(initialQuery);
  const [selected, setSelected] = useState<string[]>(allIds);
  const [family, setFamily] = useState<string | null>(null);
  const [sort, setSort] = useState<BrowseSort>("relevancia");
  const [onlyFav, setOnlyFav] = useState(false);
  const [onlyOffers, setOnlyOffers] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const favs = new Set(favoriteIds);

  // El buscador de la barra superior (escritorio) manda aquí lo que se escribe
  useEffect(() => {
    const onSearch = (e: Event) => setQ((e as CustomEvent<string>).detail ?? "");
    window.addEventListener(SEARCH_EVENT, onSearch);
    return () => window.removeEventListener(SEARCH_EVENT, onSearch);
  }, []);

  const selectedKey = selected.join(",");
  useEffect(() => {
    const id = ++seq.current;
    const t = setTimeout(async () => {
      setLoading(true);
      window.history.replaceState(null, "", q.trim() ? `/buscar?q=${encodeURIComponent(q.trim())}` : "/buscar");
      try {
        const data = await browseProducts({
          query: q,
          chains: selectedKey ? selectedKey.split(",") : [],
          family,
          sort,
          onlyFavorites: onlyFav,
          onlyOffers,
        });
        if (id === seq.current) setResults(data);
      } catch {
        if (id === seq.current) setResults([]);
      } finally {
        if (id === seq.current) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q, selectedKey, family, sort, onlyFav, onlyOffers]);

  function toggleChain(id: string) {
    setSelected((s) => (s.includes(id) ? (s.length > 1 ? s.filter((x) => x !== id) : s) : [...s, id]));
  }
  function clearAll() {
    setQ("");
    setSelected(allIds);
    setFamily(null);
    setSort("relevancia");
    setOnlyFav(false);
    setOnlyOffers(false);
  }

  const nameOf = (id: string) => chains.find((c) => c.id === id)?.name ?? id;
  const familyName = FAMILY_FILTERS.find((f) => f.id === family)?.name ?? null;
  const sortLabel = SORTS.find((s) => s.id === sort)?.label.replace("Ordenar por r", "R") ?? "";
  const totalOffers = offers.reduce((a, o) => a + o.count, 0);
  const offerChains = offers.filter((o) => o.count > 0).map((o) => o.name).join(" y ");
  const staples = !q.trim() && !family && !onlyFav && !onlyOffers;

  return (
    <div>
      {/* Buscador (en escritorio está en la barra superior) */}
      <div className="relative mb-3 md:hidden">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar productos, marcas…"
          className="w-full rounded-2xl border border-cream-dark bg-white py-3.5 pl-12 pr-4 text-base shadow-sm outline-none focus:border-brand"
        />
      </div>

      {/* Filtros */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
        {chains.map((c) => {
          const on = selected.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => toggleChain(c.id)}
              aria-pressed={on}
              className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm shadow-sm ${on ? "border-cream-dark bg-white" : "border-dashed border-cream-dark bg-transparent text-muted"}`}
            >
              <ChainLogo id={c.id} name={c.name} size={24} />
              {c.name}
              <span className="text-muted">{on ? "✕" : "+"}</span>
            </button>
          );
        })}
        <Select value={family ?? ""} onChange={(v) => setFamily(v || null)} label="Categoría">
          <option value="">Todas las categorías</option>
          {FAMILY_FILTERS.map((f) => (
            <option key={f.id} value={f.id}>{f.emoji} {f.name}</option>
          ))}
        </Select>
        <Select value={sort} onChange={(v) => setSort(v as BrowseSort)} label="Orden">
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </Select>
        <Toggle on={onlyFav} onClick={() => setOnlyFav((v) => !v)} icon={<HeartIcon className={`h-5 w-5 ${onlyFav ? "fill-brand text-brand" : ""}`} />}>
          Solo favoritos
        </Toggle>
        <Toggle on={onlyOffers} disabled={totalOffers === 0} onClick={() => setOnlyOffers((v) => !v)} icon={<TagIcon className="h-5 w-5" />}>
          Ofertas
        </Toggle>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_300px] lg:items-start">
        {/* Resultados */}
        <div>
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="font-semibold">
              {loading && results.length === 0 ? "Buscando…" : `${results.length} ${results.length === 1 ? "resultado" : "resultados"}`}
              {staples && !loading && <span className="font-normal text-muted"> · básicos de la semana</span>}
            </p>
            <div className="flex items-center gap-1 text-sm">
              <button type="button" onClick={() => setView("grid")} aria-label="Vista en cuadrícula" aria-pressed={view === "grid"} className={`flex h-9 w-9 items-center justify-center rounded-lg ${view === "grid" ? "bg-brand-soft text-brand" : "text-muted hover:text-ink"}`}>
                <GridIcon className="h-5 w-5" />
              </button>
              <button type="button" onClick={() => setView("list")} aria-pressed={view === "list"} className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 ${view === "list" ? "bg-brand-soft text-brand" : "text-muted hover:text-ink"}`}>
                <ListIcon className="h-5 w-5" /> Vista en lista
              </button>
            </div>
          </div>

          {!loading && results.length === 0 ? (
            <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
              <p className="text-4xl">🔎</p>
              <p className="mt-2 font-semibold">No hay productos con estos filtros</p>
              <p className="text-sm text-muted">Prueba con otra palabra o quita algún filtro.</p>
              <button type="button" onClick={clearAll} className="mt-4 rounded-xl bg-brand px-4 py-2.5 font-semibold text-white">Limpiar filtros</button>
            </div>
          ) : (
            <ul
              aria-busy={loading}
              className={`${view === "grid" ? "grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4" : "flex flex-col gap-2"} transition-opacity ${loading ? "opacity-60" : ""}`}
            >
              {results.map((r) => (
                <ProductTile key={`${view}-${r.product.id}`} result={r} initialFavorite={favs.has(r.product.id)} view={view} />
              ))}
            </ul>
          )}
        </div>

        {/* Columna lateral */}
        <aside className="flex flex-col gap-4">
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-bold"><FilterIcon className="h-5 w-5" /> Filtros activos</h2>
              <button type="button" onClick={clearAll} className="text-sm font-semibold text-brand hover:underline">Limpiar todo</button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {q.trim() && <ActiveChip onRemove={() => setQ("")}>«{q.trim()}»</ActiveChip>}
              {selected.map((id) => (
                <ActiveChip key={id} onRemove={selected.length > 1 ? () => toggleChain(id) : undefined}>
                  <ChainLogo id={id} name={nameOf(id)} size={16} /> {nameOf(id)}
                </ActiveChip>
              ))}
              <ActiveChip onRemove={family ? () => setFamily(null) : undefined}>{familyName ?? "Todas las categorías"}</ActiveChip>
              <ActiveChip onRemove={sort !== "relevancia" ? () => setSort("relevancia") : undefined}>{sortLabel}</ActiveChip>
              {onlyFav && <ActiveChip onRemove={() => setOnlyFav(false)}>Solo favoritos</ActiveChip>}
              {onlyOffers && <ActiveChip onRemove={() => setOnlyOffers(false)}>Ofertas</ActiveChip>}
            </div>
          </section>

          <button
            type="button"
            onClick={() => setOnlyOffers((v) => !v)}
            disabled={totalOffers === 0}
            className="flex w-full items-center gap-3 rounded-2xl bg-olive-soft p-4 text-left disabled:opacity-70"
          >
            <TagIcon className="h-8 w-8 shrink-0 text-olive-dark" />
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-olive-dark">{onlyOffers ? "Ofertas activas" : "Ofertas de la semana"}</span>
              <span className="block text-sm text-olive-dark/80">
                {totalOffers === 0
                  ? "Ahora mismo no hay ofertas en tus supermercados."
                  : onlyOffers
                    ? `Mostrando productos en oferta de ${offerChains}.`
                    : `${totalOffers} productos en oferta en ${offerChains}.`}
              </span>
            </span>
            {totalOffers > 0 && <ChevronRight className="h-5 w-5 shrink-0 text-olive-dark" />}
          </button>

          <section className="flex gap-3 rounded-2xl bg-brand-soft p-4">
            <BulbIcon className="h-8 w-8 shrink-0 text-brand" />
            <div>
              <p className="font-bold">Consejo Sobremesa</p>
              <p className="text-sm text-ink/80">Compara por precio por unidad para ahorrar mejor. El formato grande no siempre es la mejor opción.</p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Select({ value, onChange, label, children }: { value: string; onChange: (v: string) => void; label: string; children: React.ReactNode }) {
  return (
    <label className="relative shrink-0">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-full appearance-none rounded-xl border border-cream-dark bg-white py-2.5 pl-4 pr-10 text-sm shadow-sm outline-none focus:border-brand"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
    </label>
  );
}

function Toggle({ on, onClick, icon, disabled, children }: { on: boolean; onClick: () => void; icon: React.ReactNode; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      className={`flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm shadow-sm disabled:opacity-50 ${on ? "border-brand bg-brand-soft text-brand-dark" : "border-cream-dark bg-white"}`}
    >
      {icon}
      {children}
    </button>
  );
}

function ActiveChip({ children, onRemove }: { children: React.ReactNode; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-cream px-2.5 py-1.5 text-sm">
      {children}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label="Quitar filtro" className="text-muted hover:text-ink">✕</button>
      )}
    </span>
  );
}
