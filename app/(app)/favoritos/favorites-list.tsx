"use client";

import Link from "next/link";
import { useState } from "react";
import { ProductTile } from "@/components/product-tile";
import { RecipeArt } from "@/components/recipe-art";
import type { Product } from "@/lib/types";

type SavedRecipe = { id: number; name: string; tags: string[]; time_minutes: number | null; difficulty: string | null; photo_url: string | null };

export function FavoritesList({ products, recipes }: { products: Product[]; recipes: SavedRecipe[] }) {
  const [items, setItems] = useState(products);
  return (
    <div className="flex flex-col gap-6">
      {recipes.length > 0 && (
        <section>
          <h2 className="mb-3 mt-5 text-lg font-bold">Recetas guardadas ({recipes.length})</h2>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {recipes.map((r) => (
              <li key={r.id}>
                <Link href={`/recetas/${r.id}`} className="group block overflow-hidden rounded-2xl bg-white shadow-sm">
                  <RecipeArt tags={r.tags} name={r.name} photoUrl={r.photo_url} className="aspect-[4/3] text-6xl transition group-hover:brightness-95" />
                  <div className="p-3">
                    <p className="line-clamp-2 font-semibold leading-tight group-hover:text-brand">{r.name}</p>
                    <p className="mt-1 text-xs text-muted">
                      {r.time_minutes ? `⏱️ ${r.time_minutes} min` : ""}{r.time_minutes && r.difficulty ? " · " : ""}{r.difficulty ?? ""}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {items.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold">Productos guardados ({items.length})</h2>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {items.map((p) => (
              <ProductTile key={p.id} result={{ product: p, compare: null }} initialFavorite view="grid" onUnfavorite={() => setItems((xs) => xs.filter((x) => x.id !== p.id))} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
