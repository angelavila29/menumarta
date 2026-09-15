"use client";

import { useState } from "react";
import { ProductCard } from "@/components/product-card";
import type { Product } from "@/lib/types";

export function FavoritesList({ products }: { products: Product[] }) {
  const [items, setItems] = useState(products);
  return (
    <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      {items.map((p) => (
        <ProductCard
          key={p.id}
          product={p}
          initialFavorite
          onRemovedFromFavorites={() => setItems((xs) => xs.filter((x) => x.id !== p.id))}
        />
      ))}
    </ul>
  );
}
