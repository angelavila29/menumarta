"use client";

import Link from "next/link";
import { useState } from "react";
import { HeartIcon, PlusIcon, SearchIcon } from "@/components/icons";
import { RecipeArt } from "@/components/recipe-art";

export type BankRecipe = {
  id: number;
  name: string;
  meal: string;
  tags: string[];
  time: number | null;
  difficulty: string | null;
  description: string | null;
  ownerId: string | null;
  author: string;
  source: "sobremesa" | "mia" | "amigo" | "comunidad";
  visibility: string;
  saved: boolean;
};

const VIEWS: [string, string][] = [["todas", "Todas"], ["mias", "Mías"], ["amigos", "De amigos"], ["sobremesa", "De Sobremesa"], ["guardadas", "Guardadas"]];
const VIS_LABEL: Record<string, string> = { private: "Solo yo", friends: "Amigos", public: "Pública" };

function norm(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function RecipeBank({ recipes, initialView, initialAuthor, friendCount, friendsMode }: { recipes: BankRecipe[]; initialView: string; initialAuthor: string | null; friendCount: number; friendsMode: "all" | "saved" }) {
  const [view, setView] = useState(VIEWS.some(([v]) => v === initialView) ? initialView : "todas");
  const [author, setAuthor] = useState<string | null>(initialAuthor);
  const [q, setQ] = useState("");
  const [meal, setMeal] = useState("");

  const counts: Record<string, number> = {
    todas: recipes.length,
    mias: recipes.filter((r) => r.source === "mia").length,
    amigos: recipes.filter((r) => r.source === "amigo").length,
    sobremesa: recipes.filter((r) => r.source === "sobremesa").length,
    guardadas: recipes.filter((r) => r.saved).length,
  };
  const authorName = author ? recipes.find((r) => r.ownerId === author)?.author ?? null : null;

  const shown = recipes.filter((r) => {
    if (author && r.ownerId !== author) return false;
    if (!author) {
      if (view === "mias" && r.source !== "mia") return false;
      if (view === "amigos" && r.source !== "amigo") return false;
      if (view === "sobremesa" && r.source !== "sobremesa") return false;
      if (view === "guardadas" && !r.saved) return false;
    }
    if (meal && r.meal !== meal && r.meal !== "ambas") return false;
    if (q.trim() && !norm(`${r.name} ${r.tags.join(" ")} ${r.author}`).includes(norm(q.trim()))) return false;
    return true;
  });

  return (
    <main>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold md:text-5xl">Banco de recetas</h1>
          <p className="mt-1 text-muted md:text-lg">Sube las tuyas, descubre las de tus amigos y úsalas en tu menú.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/amigos" className="rounded-xl border border-cream-dark bg-white px-4 py-2.5 font-medium hover:bg-cream">
            Amigos{friendCount > 0 ? ` (${friendCount})` : ""}
          </Link>
          <Link href="/recetas/nueva" className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 font-semibold text-white hover:bg-brand-dark">
            <PlusIcon className="h-5 w-5" /> Nueva receta
          </Link>
        </div>
      </div>

      <div className="no-scrollbar -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
        {VIEWS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => { setView(id); setAuthor(null); }}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${!author && view === id ? "bg-brand text-white" : "border border-cream-dark bg-white hover:bg-cream"}`}
          >
            {label} ({counts[id]})
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <div className="relative min-w-56 flex-1 md:max-w-md">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar receta, tipo o persona…"
            aria-label="Buscar recetas"
            className="w-full rounded-xl border border-cream-dark bg-white py-2.5 pl-12 pr-4 outline-none focus:border-brand"
          />
        </div>
        <select value={meal} onChange={(e) => setMeal(e.target.value)} aria-label="Momento del día" className="rounded-xl border border-cream-dark bg-white px-4 py-2.5 outline-none focus:border-brand">
          <option value="">Comidas y cenas</option>
          <option value="comida">Solo comidas</option>
          <option value="cena">Solo cenas</option>
        </select>
      </div>

      {!author && view === "amigos" && counts.amigos > 0 && (
        <p className="mt-3 rounded-xl bg-olive-soft px-3 py-2 text-sm text-olive-dark">
          {friendsMode === "all"
            ? "«Generar semana» puede usar todas estas recetas."
            : "«Generar semana» solo usa las que guardes con el corazón."}{" "}
          <Link href="/amigos" className="font-semibold underline">Cambiar</Link>
        </p>
      )}

      {author && (
        <p className="mt-3 flex items-center gap-2 text-sm">
          <span className="rounded-lg bg-olive-soft px-3 py-1.5 font-medium text-olive-dark">Recetas de {authorName ?? "esta persona"}</span>
          <button type="button" onClick={() => setAuthor(null)} className="text-brand hover:underline">Ver todas</button>
        </p>
      )}

      {shown.length === 0 ? (
        <div className="mt-6 rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="text-4xl">📖</p>
          <p className="mt-2 font-semibold">
            {view === "mias" ? "Todavía no has subido ninguna receta" : view === "amigos" ? "Aún no hay recetas de amigos" : view === "guardadas" ? "No has guardado ninguna receta" : "No hay recetas con esos filtros"}
          </p>
          <p className="text-sm text-muted">
            {view === "amigos" ? "Añade a tus amigos y verás aquí las recetas que compartan." : "Sube tu primera receta: tarda un par de minutos."}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            {view === "amigos" ? (
              <Link href="/amigos" className="rounded-xl bg-brand px-4 py-2.5 font-semibold text-white">Añadir amigos</Link>
            ) : (
              <Link href="/recetas/nueva" className="rounded-xl bg-brand px-4 py-2.5 font-semibold text-white">Nueva receta</Link>
            )}
          </div>
        </div>
      ) : (
        <ul className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {shown.map((r) => (
            <li key={r.id}>
              <Link href={`/recetas/${r.id}`} className="group block h-full overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="relative">
                  <RecipeArt tags={r.tags} name={r.name} className="aspect-[4/3] text-6xl transition group-hover:brightness-95" />
                  {r.saved && <HeartIcon className="absolute right-2 top-2 h-6 w-6 fill-brand text-brand" />}
                </div>
                <div className="p-3">
                  <p className="line-clamp-2 font-semibold leading-tight group-hover:text-brand">{r.name}</p>
                  <p className="mt-1 text-xs text-muted">
                    {r.time ? `⏱️ ${r.time} min` : ""}{r.time && r.difficulty ? " · " : ""}{r.difficulty ?? ""}
                  </p>
                  <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                    <span className={`rounded-md px-1.5 py-0.5 font-medium ${r.source === "mia" ? "bg-brand-soft text-brand-dark" : r.source === "amigo" ? "bg-olive-soft text-olive-dark" : "bg-cream text-ink"}`}>
                      {r.source === "mia" ? "Tuya" : `De ${r.author}`}
                    </span>
                    {r.source === "mia" && <span className="text-muted">{VIS_LABEL[r.visibility]}</span>}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
