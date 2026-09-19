"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CheckIcon, PlusIcon } from "@/components/icons";
import { saveRecipe, type RecipeInput } from "@/lib/recipe-bank-actions";
import { parseRecipeText } from "@/lib/recipe-parse";
import { EXTRA_TAGS, MAIN_TAGS, VISIBILITY } from "@/lib/recipe-tags";

type IngRow = { name: string; qty: string; unit: string };

const fieldCls = "rounded-xl border border-cream-dark bg-white px-3 py-2.5 outline-none focus:border-brand";
const inputCls = `w-full ${fieldCls}`;

export function RecipeForm({ initial, knownIngredients }: { initial: RecipeInput | null; knownIngredients: string[] }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [meal, setMeal] = useState(initial?.meal ?? "ambas");
  const [servings, setServings] = useState(initial?.servings ?? 2);
  const [time, setTime] = useState(initial?.timeMinutes != null ? String(initial.timeMinutes) : "");
  const [difficulty, setDifficulty] = useState(initial?.difficulty ?? "Fácil");
  const [mainTag, setMainTag] = useState(initial?.mainTag ?? "guiso");
  const [extraTags, setExtraTags] = useState<string[]>(initial?.extraTags ?? []);
  const [visibility, setVisibility] = useState(initial?.visibility ?? "friends");
  const [ings, setIngs] = useState<IngRow[]>(
    initial?.ingredients.map((i) => ({ name: i.name, qty: String(i.qty), unit: i.unit })) ?? [
      { name: "", qty: "", unit: "g" },
      { name: "", qty: "", unit: "g" },
      { name: "", qty: "", unit: "g" },
    ]
  );
  const [steps, setSteps] = useState<string[]>(initial?.steps.length ? initial.steps : ["", ""]);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasted, setPasted] = useState("");
  const [pasteMsg, setPasteMsg] = useState("");

  function fillFromText() {
    const r = parseRecipeText(pasted, knownIngredients);
    if (r.ingredients.length === 0 && r.steps.length === 0) {
      setPasteMsg("No he encontrado ingredientes ni pasos en ese texto. Prueba a pegarlo con un ingrediente por línea.");
      return;
    }
    if (r.name) setName(r.name.slice(0, 80));
    if (r.servings) setServings(r.servings);
    if (r.timeMinutes) setTime(String(r.timeMinutes));
    if (r.ingredients.length > 0) setIngs(r.ingredients.map((i) => ({ name: i.name, qty: String(i.qty), unit: i.unit })));
    if (r.steps.length > 0) setSteps(r.steps);
    setPasteMsg(`Relleno con ${r.ingredients.length} ingredientes y ${r.steps.length} pasos. Revísalo antes de publicar.`);
    setPasteOpen(false);
  }

  const setIng = (i: number, patch: Partial<IngRow>) => setIngs((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const setStep = (i: number, v: string) => setSteps((xs) => xs.map((x, j) => (j === i ? v : x)));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    start(async () => {
      const res = await saveRecipe({
        id: initial?.id,
        name,
        description,
        meal,
        servings,
        timeMinutes: time ? Number(time) : null,
        difficulty,
        mainTag,
        extraTags,
        visibility,
        ingredients: ings.map((i) => ({ name: i.name, qty: Number(i.qty.replace(",", ".")), unit: i.unit })),
        steps,
      });
      if (res && !res.ok) setError(res.error);
    });
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <div className="flex min-w-0 flex-col gap-4">
        {!initial?.id && (
          <section className="rounded-2xl bg-olive-soft p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-olive-dark">¿Ya la tienes escrita?</h2>
                <p className="text-sm text-olive-dark/90">Pega el texto de una web, de WhatsApp o de tus notas y rellenamos el formulario.</p>
              </div>
              <button type="button" onClick={() => setPasteOpen((v) => !v)} className="rounded-xl bg-olive px-4 py-2.5 font-semibold text-white hover:bg-olive-dark">
                {pasteOpen ? "Cerrar" : "Pegar receta"}
              </button>
            </div>
            {pasteOpen && (
              <div className="mt-3">
                <textarea
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                  rows={8}
                  aria-label="Texto de la receta"
                  placeholder={"Lentejas de la abuela\nPara 4 personas\n\nIngredientes:\n400 g de lentejas\n2 zanahorias\n...\n\nPreparación:\n1. Sofríe la cebolla..."}
                  className="w-full rounded-xl border border-cream-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-brand"
                />
                <button type="button" onClick={fillFromText} disabled={pasted.trim().length < 20} className="mt-2 rounded-xl bg-brand px-5 py-2.5 font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
                  Rellenar el formulario
                </button>
              </div>
            )}
            {pasteMsg && <p role="status" className="mt-2 text-sm text-olive-dark">{pasteMsg}</p>}
          </section>
        )}
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-bold">Lo básico</h2>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Nombre de la receta</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} placeholder="Ej. Lentejas de mi abuela" className={inputCls} />
          </label>
          <label className="mt-3 block">
            <span className="mb-1 block text-sm font-semibold">Descripción corta <span className="font-normal text-muted">(opcional)</span></span>
            <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} placeholder="Una frase que dé ganas de hacerla" className={inputCls} />
          </label>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Es para</span>
              <select value={meal} onChange={(e) => setMeal(e.target.value)} className={inputCls}>
                <option value="ambas">Comida o cena</option>
                <option value="comida">Comida</option>
                <option value="cena">Cena</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Raciones</span>
              <input type="number" min={1} max={12} value={servings} onChange={(e) => setServings(Number(e.target.value))} className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Tiempo (min)</span>
              <input type="number" min={1} max={600} value={time} onChange={(e) => setTime(e.target.value)} placeholder="30" className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Dificultad</span>
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className={inputCls}>
                <option>Fácil</option>
                <option>Media</option>
                <option>Difícil</option>
              </select>
            </label>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Tipo de plato</span>
              <select value={mainTag} onChange={(e) => setMainTag(e.target.value)} className={inputCls}>
                {MAIN_TAGS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>
            <div>
              <span className="mb-1 block text-sm font-semibold">También es</span>
              <div className="flex flex-wrap gap-2">
                {EXTRA_TAGS.map(([id, label]) => {
                  const on = extraTags.includes(id);
                  return (
                    <button key={id} type="button" aria-pressed={on} onClick={() => setExtraTags(on ? extraTags.filter((t) => t !== id) : [...extraTags, id])} className={`rounded-xl border px-3 py-2 text-sm font-medium ${on ? "border-olive bg-olive-soft text-olive-dark" : "border-cream-dark bg-white hover:bg-cream"}`}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">Ingredientes</h2>
          <p className="mb-3 text-sm text-muted">Usa nombres sencillos como «arroz» o «pechuga de pollo». Así encontramos el producto y su precio.</p>
          <datalist id="ingredientes-conocidos">
            {knownIngredients.map((n) => <option key={n} value={n} />)}
          </datalist>
          <ul className="flex flex-col gap-2">
            {ings.map((row, i) => (
              <li key={i} className="flex items-center gap-2">
                <input value={row.name} onChange={(e) => setIng(i, { name: e.target.value })} list="ingredientes-conocidos" placeholder="Ingrediente" aria-label={`Ingrediente ${i + 1}`} maxLength={60} className={`${fieldCls} min-w-0 flex-1`} />
                <input value={row.qty} onChange={(e) => setIng(i, { qty: e.target.value })} inputMode="decimal" placeholder="Cant." aria-label={`Cantidad del ingrediente ${i + 1}`} className={`${fieldCls} w-16 shrink-0 sm:w-20`} />
                <select value={row.unit} onChange={(e) => setIng(i, { unit: e.target.value })} aria-label={`Unidad del ingrediente ${i + 1}`} className={`${fieldCls} w-[5.5rem] shrink-0 px-2 sm:w-28`}>
                  <option value="g">g</option>
                  <option value="ml">ml</option>
                  <option value="ud">uds</option>
                </select>
                <button type="button" onClick={() => setIngs((xs) => (xs.length > 1 ? xs.filter((_, j) => j !== i) : xs))} aria-label={`Quitar ingrediente ${i + 1}`} className="h-10 w-8 shrink-0 text-muted hover:text-ink">✕</button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setIngs((xs) => [...xs, { name: "", qty: "", unit: "g" }])} className="mt-3 flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
            <PlusIcon className="h-4 w-4" /> Añadir ingrediente
          </button>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-bold">Preparación</h2>
          <ol className="flex flex-col gap-2">
            {steps.map((s, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">{i + 1}</span>
                <textarea value={s} onChange={(e) => setStep(i, e.target.value)} rows={2} maxLength={500} placeholder={`Paso ${i + 1}`} aria-label={`Paso ${i + 1}`} className={`${fieldCls} min-w-0 flex-1 resize-y`} />
                <button type="button" onClick={() => setSteps((xs) => (xs.length > 1 ? xs.filter((_, j) => j !== i) : xs))} aria-label={`Quitar paso ${i + 1}`} className="mt-2 h-8 w-8 shrink-0 text-muted hover:text-ink">✕</button>
              </li>
            ))}
          </ol>
          <button type="button" onClick={() => setSteps((xs) => [...xs, ""])} className="mt-3 flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
            <PlusIcon className="h-4 w-4" /> Añadir paso
          </button>
        </section>
      </div>

      <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-6">
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-bold">¿Quién puede verla?</h2>
          <ul className="flex flex-col gap-1">
            {VISIBILITY.map(([id, title, desc]) => (
              <li key={id}>
                <button type="button" role="radio" aria-checked={visibility === id} onClick={() => setVisibility(id)} className={`flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left ${visibility === id ? "border-brand bg-brand-soft" : "border-transparent hover:bg-cream"}`}>
                  <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${visibility === id ? "border-brand" : "border-cream-dark"}`}>
                    {visibility === id && <span className="h-2.5 w-2.5 rounded-full bg-brand" />}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{title}</span>
                    <span className="block text-xs text-muted">{desc}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={pending} className="flex items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3 font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
          <CheckIcon className="h-5 w-5" /> {pending ? "Guardando…" : initial?.id ? "Guardar cambios" : "Publicar receta"}
        </button>
        <Link href={initial?.id ? `/recetas/${initial.id}` : "/recetas"} className="rounded-xl border border-cream-dark bg-white px-6 py-3 text-center font-medium hover:bg-cream">Cancelar</Link>
      </aside>
    </form>
  );
}
