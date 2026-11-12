/**
 * Fotos de las recetas de Sobremesa generadas con GPT-Image-2 vía APIMart.
 *
 *   npx tsx scripts/gen_photos.mts --dry            # solo enseña los prompts, no gasta nada
 *   npx tsx scripts/gen_photos.mts --limit 3        # genera y sube 3 (para probar)
 *   npx tsx scripts/gen_photos.mts                  # todas las recetas de Sobremesa sin foto
 *   npx tsx scripts/gen_photos.mts --id 123         # una receta concreta (aunque ya tenga foto)
 *
 * Necesita APIMART_API_KEY y SUPABASE_SERVICE_ROLE_KEY en .env.local. Solo toca recetas del banco
 * (owner_id null); las fotos van a recipe-photos/sobremesa/<slug>.jpg, cuadradas a 900 px.
 * El recorte usa `sips` (macOS).
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const value = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const DRY = flag("dry");
const LIMIT = Number(value("limit") ?? Infinity);
const ONLY = value("id") ? Number(value("id")) : null;
const KEY = process.env.APIMART_API_KEY;
if (!DRY && !KEY) throw new Error("Falta APIMART_API_KEY en .env.local");

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const API = "https://api.apimart.ai/v1";
const BACKGROUND = new Set(["aceite de oliva", "ajo", "sal", "pimienta", "laurel", "pimentón", "harina", "perejil", "agua", "vinagre", "azúcar", "orégano", "comino"]);

const slug = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * El mismo estilo que funcionó a mano en ChatGPT: describir el plato y pedir foto de WhatsApp.
 * La descripción de la receta no se usa: trae consejos ("pon las alubias en remojo") que no se ven.
 */
function promptFor(r: { name: string; tags: string[] }, ings: string[]) {
  const main = ings.filter((i) => !BACKGROUND.has(i) && !/^caldo|^agua|^vino/.test(i)).slice(0, 6);
  const spoon = r.tags.some((t) => ["sopa", "legumbre", "guiso"].includes(t));
  const serving = spoon ? "servido en un plato hondo blanco" : r.tags.includes("guarnicion") ? "servido como guarnición en un plato blanco sencillo" : "servido en un plato blanco sencillo";
  return (
    `Crea una imagen de: ${r.name}, plato casero español${main.length ? ` hecho con ${main.join(", ")}` : ""}, ${serving}. ` +
    "Foto cuadrada hecha con el móvil en una casa, de cerca y un poco desde arriba, con luz natural, sobre la mesa de la cocina. " +
    "Comida real, ración normal, sin decorar. Sin texto ni marcas de agua. " +
    "Que parezca una foto normal de WhatsApp, no profesional."
  );
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(body).slice(0, 300)}`);
  return body as T;
}

async function generate(prompt: string): Promise<{ url: string; credits: number | null }> {
  const sub = await api<{ data: { task_id: string }[] }>("/images/generations", {
    method: "POST",
    body: JSON.stringify({ model: "gpt-image-2", prompt, n: 1, size: "1:1", resolution: "1k" }),
  });
  const task = sub.data?.[0]?.task_id;
  if (!task) throw new Error(`sin task_id: ${JSON.stringify(sub).slice(0, 200)}`);
  const started = Date.now();
  while (Date.now() - started < 5 * 60_000) {
    await new Promise((r) => setTimeout(r, 4000));
    const t = await api<{ data: { status: string; credits_cost?: number; result?: { images: { url: string[] | string }[] }; error?: { message: string } } }>(`/tasks/${task}?language=es`);
    const st = t.data?.status;
    if (st === "completed") {
      const u = t.data.result?.images?.[0]?.url;
      const url = Array.isArray(u) ? u[0] : u;
      if (!url) throw new Error("completada sin imagen");
      return { url, credits: t.data.credits_cost ?? null };
    }
    if (st === "failed" || st === "cancelled") throw new Error(t.data.error?.message ?? st);
  }
  throw new Error("tarda más de 5 minutos");
}

const [{ data: recipes, error }, { data: ingRows }] = await Promise.all([
  sb.from("recipes").select("id,name,tags,photo_url").is("owner_id", null).order("id"),
  sb.from("recipe_ingredients").select("recipe_id,ingredient_name,qty").order("qty", { ascending: false }),
]);
if (error) throw error;
const ingredients = new Map<number, string[]>();
for (const r of ingRows ?? []) ingredients.set(r.recipe_id, [...(ingredients.get(r.recipe_id) ?? []), r.ingredient_name]);

const todo = (recipes ?? []).filter((r) => (ONLY ? r.id === ONLY : !r.photo_url)).slice(0, LIMIT);
console.log(`${todo.length} recetas${DRY ? " (en seco, sin generar)" : ""}\n`);

const dir = join(tmpdir(), "sobremesa-fotos");
mkdirSync(dir, { recursive: true });
let ok = 0;
let credits = 0;
const failed: string[] = [];
for (const [i, r] of todo.entries()) {
  const prompt = promptFor(r, ingredients.get(r.id) ?? []);
  if (DRY) {
    console.log(`#${r.id} ${r.name}\n  ${prompt}\n`);
    continue;
  }
  const label = `[${i + 1}/${todo.length}] #${r.id} ${r.name}`;
  try {
    const { url, credits: c } = await generate(prompt);
    const raw = join(dir, `${r.id}.png`);
    const jpg = join(dir, `${r.id}.jpg`);
    writeFileSync(raw, Buffer.from(await (await fetch(url)).arrayBuffer()));
    // cuadrada (por si viniera con otra proporción) y a 900 px, como las que se suben a mano
    const dims = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", raw]).toString().match(/\d+/g)!.slice(-2).map(Number);
    const side = Math.min(dims[0], dims[1]);
    execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "82", "-c", String(side), String(side), raw, "--out", jpg]);
    execFileSync("sips", ["-Z", "900", jpg]);
    const path = `sobremesa/${slug(r.name)}.jpg`;
    const up = await sb.storage.from("recipe-photos").upload(path, readFileSync(jpg), { contentType: "image/jpeg", upsert: true });
    if (up.error) throw new Error(up.error.message);
    // ?v= para que el navegador no enseñe la foto anterior si se regenera
    const publicUrl = `${sb.storage.from("recipe-photos").getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
    const { error: e } = await sb.from("recipes").update({ photo_url: publicUrl }).eq("id", r.id).is("owner_id", null);
    if (e) throw new Error(e.message);
    ok++;
    credits += c ?? 0;
    console.log(`${label} ✓ ${c != null ? `${c} créditos` : ""}`);
  } catch (err) {
    failed.push(`#${r.id} ${r.name}: ${String(err).slice(0, 160)}`);
    console.log(`${label} ✗ ${String(err).slice(0, 160)}`);
  }
}
if (!DRY) {
  console.log(`\nHechas ${ok}/${todo.length} · ${credits.toFixed(2)} créditos`);
  if (failed.length) console.log(`Fallidas (se pueden relanzar, solo coge las que no tienen foto):\n  ${failed.join("\n  ")}`);
}
