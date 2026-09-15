/**
 * Geolocalización y supermercados cercanos con OpenStreetMap (gratis).
 *  - Nominatim: dirección o código postal → coordenadas (y al revés).
 *  - Overpass: tiendas shop=supermarket|hypermarket|convenience en un radio.
 * Solo se llama desde el servidor (acciones), con User-Agent identificable.
 */

const UA = "menumarta/0.1 (https://github.com/angelavila29/menumarta)";

export type GeoPoint = { lat: number; lng: number; label: string };

export async function geocode(query: string): Promise<GeoPoint | null> {
  const q = /^\d{5}$/.test(query.trim()) ? `${query.trim()}, España` : `${query.trim()}, España`;
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "es");
  url.searchParams.set("accept-language", "es");
  const r = await fetch(url, { headers: { "User-Agent": UA }, cache: "no-store" });
  if (!r.ok) return null;
  const data = (await r.json()) as { lat: string; lon: string; display_name: string }[];
  if (!data[0]) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), label: shortLabel(data[0].display_name) };
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("accept-language", "es");
  const r = await fetch(url, { headers: { "User-Agent": UA }, cache: "no-store" });
  if (!r.ok) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  const data = (await r.json()) as { display_name?: string };
  return data.display_name ? shortLabel(data.display_name) : `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

function shortLabel(displayName: string): string {
  // "Calle X, Salamanca, Madrid, Comunidad de Madrid, 28001, España" → primeras 3 partes
  return displayName.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 3).join(", ");
}

// ---------------------------------------------------------------------------
// Cadenas
// ---------------------------------------------------------------------------
export type NearbyChain = {
  id: string;
  name: string;
  stores: number;
  nearestM: number; // distancia a la tienda más cercana, en metros
  nearestName: string;
};

// Patrón sobre brand/name (sin tildes, minúsculas) → id canónico y nombre
const CHAIN_RULES: [RegExp, string, string][] = [
  [/mercadona/, "mercadona", "Mercadona"],
  [/\bdia\b|\bd[ií]a\b|la plaza de dia/, "dia", "Dia"],
  [/carrefour/, "carrefour", "Carrefour"],
  [/\blidl\b/, "lidl", "Lidl"],
  [/\baldi\b/, "aldi", "Aldi"],
  [/alcampo|simply/, "alcampo", "Alcampo"],
  [/ahorramas/, "ahorramas", "Ahorramás"],
  [/eroski|caprabo/, "eroski", "Eroski"],
  [/hipercor/, "hipercor", "Hipercor"],
  [/supercor/, "supercor", "Supercor"],
  [/corte ingles/, "elcorteingles", "Supermercado El Corte Inglés"],
  [/^bm\b|\bbm supermercados/, "bm", "BM"],
  [/consum/, "consum", "Consum"],
  [/froiz/, "froiz", "Froiz"],
  [/gadis/, "gadis", "Gadis"],
  [/\blupa\b/, "lupa", "Lupa"],
  [/condis/, "condis", "Condis"],
  [/coviran/, "coviran", "Covirán"],
  [/\bspar\b|eurospar/, "spar", "Spar"],
  [/masymas|mas y mas/, "masymas", "Masymas"],
  [/family cash/, "familycash", "Family Cash"],
  [/primaprix/, "primaprix", "Primaprix"],
  [/unide/, "unide", "Unide"],
  [/\bsuma\b/, "suma", "Suma"],
  [/sanchez romero/, "sanchezromero", "Sánchez Romero"],
  [/bonpreu|esclat/, "bonpreu", "Bonpreu"],
  [/el arbol/, "elarbol", "El Árbol"],
  [/dealz/, "dealz", "Dealz"],
];

function norm(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function canonicalChain(brand: string | undefined, name: string | undefined): { id: string; name: string } | null {
  const candidates = [brand, name].filter((x): x is string => !!x);
  for (const c of candidates) {
    const n = norm(c);
    for (const [re, id, label] of CHAIN_RULES) if (re.test(n)) return { id, name: label };
  }
  // Marca desconocida: solo si OSM la etiqueta explícitamente como marca
  if (brand) {
    const id = norm(brand).replace(/[^a-z0-9]/g, "");
    if (id.length >= 2) return { id, name: brand };
  }
  return null;
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

type OsmElement = { lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };

export async function nearbyChains(lat: number, lng: number, radiusM = 2500): Promise<NearbyChain[]> {
  const query = `[out:json][timeout:25];(nwr["shop"~"^(supermarket|hypermarket|convenience)$"](around:${radiusM},${lat},${lng}););out center tags;`;
  const r = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
    body: "data=" + encodeURIComponent(query),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Overpass ${r.status}`);
  const data = (await r.json()) as { elements: OsmElement[] };

  const byChain = new Map<string, NearbyChain>();
  for (const el of data.elements) {
    const tags = el.tags ?? {};
    const chain = canonicalChain(tags.brand, tags.name);
    if (!chain) continue;
    const plat = el.lat ?? el.center?.lat;
    const plng = el.lon ?? el.center?.lon;
    if (plat === undefined || plng === undefined) continue;
    const d = Math.round(haversineM(lat, lng, plat, plng));
    const cur = byChain.get(chain.id);
    if (!cur) {
      byChain.set(chain.id, { id: chain.id, name: chain.name, stores: 1, nearestM: d, nearestName: tags.name ?? chain.name });
    } else {
      cur.stores += 1;
      if (d < cur.nearestM) {
        cur.nearestM = d;
        cur.nearestName = tags.name ?? chain.name;
      }
    }
  }
  return Array.from(byChain.values()).sort((a, b) => a.nearestM - b.nearestM);
}

export function formatDistance(m: number): string {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`;
}
