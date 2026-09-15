"use client";

import { useState } from "react";
import { ProductCard } from "@/components/product-card";
import type { Product } from "@/lib/types";

export function FavoritesList({ products }: { products: Product[] }) {
  const [items, setItems] = useState(products);
  return (
    <ul className="flex flex-col gap-2">
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
