export type Product = {
  id: number;
  supermarket_id: string;
  name: string;
  brand: string | null;
  category: string | null;
  price: number | null;
  unit_price: number | null;
  unit: string | null;
  pack_size: string | null;
  image_url: string | null;
  product_url: string | null;
  is_discounted?: boolean;
};

/** Resultado del buscador: producto + comparación con su equivalente en otra cadena. */
export type SearchResult = {
  product: Product;
  // diff > 0: este producto sale más barato que en `chain` por esa cantidad de euros
  compare: { chain: string; diff: number } | null;
};

export const SUPER_NAMES: Record<string, string> = {
  mercadona: "Mercadona",
  dia: "Dia",
};

export const PRODUCT_COLUMNS =
  "id,supermarket_id,name,brand,category,price,unit_price,unit,pack_size,image_url,product_url,is_discounted";
