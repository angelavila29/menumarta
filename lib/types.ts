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
};

export const SUPER_NAMES: Record<string, string> = {
  mercadona: "Mercadona",
  dia: "Dia",
};

export const PRODUCT_COLUMNS =
  "id,supermarket_id,name,brand,category,price,unit_price,unit,pack_size,image_url,product_url";
