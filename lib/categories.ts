/** Familias de producto para agrupar la lista (a partir de products.category de cada cadena). */
export type Family = { id: string; name: string; emoji: string; order: number };

const FAMILIES: (Family & { re: RegExp })[] = [
  { id: "fruta", name: "Fruta y verdura", emoji: "🍅", order: 1, re: /fruta|verdura/ },
  { id: "carne", name: "Carne y charcutería", emoji: "🥩", order: 2, re: /carne|charcuter/ },
  { id: "pescado", name: "Pescado y marisco", emoji: "🐟", order: 3, re: /pescado|marisco/ },
  { id: "lacteos", name: "Lácteos y huevos", emoji: "🥚", order: 4, re: /huevo|leche|mantequilla|queso|yogur|postre/ },
  { id: "despensa", name: "Pasta, arroz y legumbres", emoji: "🍝", order: 5, re: /arroz|pasta|legumbre/ },
  { id: "pan", name: "Panadería y desayuno", emoji: "🍞", order: 6, re: /panader|pasteler|boller|galleta|cereal|mermelada|cafe|café|cacao|infusion|azucar|azúcar|chocolate|golosina/ },
  { id: "conservas", name: "Conservas y salsas", emoji: "🥫", order: 7, re: /conserva|caldo|crema|aceite|salsa|especia/ },
  { id: "congelados", name: "Congelados y preparados", emoji: "🧊", order: 8, re: /congelado|helado|pizza|preparado/ },
  { id: "aperitivos", name: "Aperitivos y frutos secos", emoji: "🥜", order: 9, re: /aperitivo|fruto/ },
  { id: "bebidas", name: "Bebidas", emoji: "🧃", order: 10, re: /agua|refresco|zumo|smoothie|bodega|cerveza|vino|licor/ },
  { id: "hogar", name: "Limpieza y hogar", emoji: "🧽", order: 11, re: /limpieza|hogar/ },
  { id: "cuidado", name: "Cuidado personal", emoji: "🧴", order: 12, re: /cuidado|higiene|cabello|perfumer|maquillaje|parafarmacia|fitoterapia|salud/ },
  { id: "bebe", name: "Bebé e infantil", emoji: "🍼", order: 13, re: /beb[eé]|infantil/ },
  { id: "mascotas", name: "Mascotas", emoji: "🐾", order: 14, re: /mascota/ },
];
const OTHER: Family = { id: "otros", name: "Otros", emoji: "🛒", order: 99 };

export function familyOf(category: string | null | undefined): Family {
  if (!category) return OTHER;
  const c = category.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  for (const f of FAMILIES) if (f.re.test(c)) return f;
  return OTHER;
}
