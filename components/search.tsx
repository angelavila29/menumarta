"use client";

import { useEffect, useRef, useState } from "react";
import { searchProducts } from "@/lib/actions";
import type { Product } from "@/lib/types";
import { ProductCard } from "./product-card";

export function Search({ favoriteIds, initialQuery = "" }: { favoriteIds: number[]; initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery);
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);
  const favs = new Set(favoriteIds);

  useEffect(() => {
    const term = q.trim();
    const id = ++seq.current;
    const t = setTimeout(async () => {
      if (term.length < 2) {
        setResults([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const data = await searchProducts(term);
        if (id === seq.current) setResults(data);
      } finally {
        if (id === seq.current) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Busca: leche, arroz, tomate…"
        autoFocus
        className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-lg outline-none focus:border-brand md:max-w-xl"
      />
      {loading && <p className="mt-3 text-sm text-zinc-500">Buscando…</p>}
      {!loading && q.trim().length >= 2 && results.length === 0 && (
        <p className="mt-3 text-sm text-zinc-500">Nada con ese nombre en tus supermercados.</p>
      )}
      <ul className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {results.map((p) => (
          <ProductCard key={p.id} product={p} initialFavorite={favs.has(p.id)} />
        ))}
      </ul>
    </div>
  );
}
