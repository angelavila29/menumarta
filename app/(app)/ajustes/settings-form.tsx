"use client";
import Link from "next/link";
import { useMemo, useEffect, useState, useTransition } from "react";
import { StoreMap } from "@/app/onboarding/store-map";
import { ChainLogo } from "@/components/chain-logo";
import { DayBreakdown } from "@/components/day-breakdown";
import { CartIcon, CheckIcon, HomeIcon, LeafIcon, PlusIcon, StarIcon, StoreIcon } from "@/components/icons";
import { FoodInput } from "@/components/food-input";
import { KitchenPicker } from "@/components/kitchen-picker";
import type { ApplianceId } from "@/lib/appliances";
import { COOK_RANGES, cookRangeOf } from "@/lib/cook-sessions";
import { DAY_PARTS, bmi, bmiLabel, hasBodyData, healthyWeight, paceOptions, targetsFor, type Body } from "@/lib/goal";
import { saveSettings, type SettingsInput } from "@/lib/settings-actions";

export type Chain = { id: string; name: string; has_prices: boolean };
type Props = { initial: SettingsInput; email: string; chains: Chain[]; location: { label: string | null; lat: number | null; lng: number | null }; foods: string[]; account?: React.ReactNode };

const svg = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, viewBox: "0 0 24 24" };
const UserIcon = ({ className }: { className?: string }) => (
  <svg {...svg} className={className}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
);
const BellIcon = ({ className }: { className?: string }) => (
  <svg {...svg} className={className}><path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z" /><path d="M10 21h4" /></svg>
);
const ForkIcon = ({ className }: { className?: string }) => (
  <svg {...svg} className={className}><path d="M7 3v8a2 2 0 0 0 2 2v8M5 3v5M9 3v5M17 3c-2 0-3 3-3 6s1 4 3 4v8" /></svg>
);

const TargetIcon = ({ className }: { className?: string }) => (
  <svg {...svg} className={className}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /></svg>
);

const KeyIcon = ({ className }: { className?: string }) => (
  <svg {...svg} className={className}><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9M17 6l3 3M14 9l2 2" /></svg>
);

const TABS = [
  { id: "perfil", label: "Perfil y hogar", Icon: UserIcon },
  { id: "alimentacion", label: "Alimentación", Icon: LeafIcon },
  { id: "objetivo", label: "Objetivo", Icon: TargetIcon },
  { id: "cocina", label: "Cocina", Icon: ForkIcon },
  { id: "compra", label: "Compra", Icon: StoreIcon },
  { id: "notificaciones", label: "Avisos", Icon: BellIcon },
  { id: "cuenta", label: "Cuenta", Icon: KeyIcon },
];
// Enlaces antiguos (#supermercados, #datos…) llevan a su pestaña
const HASH_TO_TAB: Record<string, string> = {
  perfil: "perfil", hogar: "perfil", alimentacion: "alimentacion", objetivo: "objetivo", cocina: "cocina",
  supermercados: "compra", estrategia: "compra", compra: "compra", notificaciones: "notificaciones", datos: "cuenta", cuenta: "cuenta",
};
const MEALS = [["comida", "Comidas"], ["cena", "Cenas"], ["desayuno", "Desayunos"], ["merienda", "Meriendas"]];
const DIETS = [["todo", "De todo"], ["vegetariano", "Vegetariana"], ["vegano", "Vegana"], ["pescetariano", "Pescetariana"], ["otro", "Otra"]];
const ALLERGIES = ["gluten", "lactosa", "frutos secos", "huevo", "marisco", "soja"];
const GOALS = [["ahorrar", "Ahorrar dinero"], ["organizar", "Organizarme mejor"], ["saludable", "Comer más sano"], ["variado", "Comer más variado"], ["tiempo", "Ahorrar tiempo"], ["todo", "Todo un poco"]];
const BUDGETS = [40, 50, 60, 70, 80, 100, 120, 150];
const BODY_GOALS: [string, string][] = [["perder", "Perder peso"], ["mantener", "Mantenerme"], ["ganar", "Ganar músculo"]];
const ACTIVITIES: [string, string][] = [["baja", "Poca"], ["media", "Media"], ["alta", "Alta"]];
const MINUTES = [15, 20, 30, 45, 60, 90];
const COMPARE = [
  ["avisar", "Dime si merece la pena cambiar", "Te avisaremos si hay una opción más barata."],
  ["habitual", "Mi supermercado habitual primero", "Priorizaremos tu supermercado de siempre."],
  ["barato", "El supermercado más barato", "Buscaremos siempre el precio más bajo, aunque cambie de tienda."],
];
const NOTIFS: [keyof SettingsInput, string, string][] = [
  ["notifyMenu", "Recordatorio de menú semanal", "Te avisaremos cuando sea el momento de planificar."],
  ["notifySavings", "Avisos de ahorro", "Te contaremos oportunidades para ahorrar."],
  ["notifyPriceDrops", "Bajada de precio en favoritos", "Te avisaremos cuando bajen de precio tus productos."],
  ["notifySummary", "Resumen semanal", "Recibe un resumen de tu semana cada domingo."],
];

export function SettingsForm({ initial, email, chains, location, foods, account }: Props) {
  const [v, setV] = useState<SettingsInput>(initial);
  const [saved, setSaved] = useState<SettingsInput>(initial);
  const [tab, setTab] = useState("perfil");
  // Abrir la pestaña que pide el enlace (/ajustes#objetivo, #supermercados…)
  useEffect(() => {
    const fromHash = () => {
      const t = HASH_TO_TAB[window.location.hash.slice(1)];
      if (t) setTab(t);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);
  function goTo(id: string) {
    setTab(id);
    history.replaceState(null, "", `#${id}`);
    // En el móvil la barra de pestañas se desplaza: que la elegida quede a la vista
    requestAnimationFrame(() => document.querySelector(`[data-tab="${id}"]`)?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" }));
  }
  const [status, setStatus] = useState<"" | "ok" | "error">("");
  const [pending, start] = useTransition();
  const noStores = useMemo(() => [], []);
  const noSelection = useMemo(() => new Set<string>(), []);

  const set = <K extends keyof SettingsInput>(k: K, val: SettingsInput[K]) => {
    setStatus("");
    setV((s) => ({ ...s, [k]: val }));
  };
  const toggleIn = (k: "planningMeals" | "allergies" | "goals", id: string, max?: number) => {
    const cur = v[k];
    if (cur.includes(id)) set(k, cur.filter((x) => x !== id));
    else if (!max || cur.length < max) set(k, [...cur, id]);
  };
  const dirty = JSON.stringify(v) !== JSON.stringify(saved);
  const name = v.displayName.trim() || email.split("@")[0];
  const main = v.mainSupermarket ?? chains.find((c) => c.has_prices)?.id ?? chains[0]?.id ?? null;

  // Solo cuenta lo que de verdad cambia el menú o la compra; cada cosa que falta sabe en qué pestaña está
  const checks: { ok: boolean; missing: string; tab: string }[] = [
    { ok: !!v.displayName.trim(), missing: "Tu nombre", tab: "perfil" },
    { ok: v.householdSize > 0, missing: "Cuántos sois en casa", tab: "perfil" },
    { ok: v.sex !== null && v.age !== null && v.weightKg !== null && v.heightCm !== null, missing: "Sexo, edad, peso y altura", tab: "objetivo" },
    { ok: v.activity !== null, missing: "Tu nivel de actividad", tab: "objetivo" },
    { ok: v.appliances !== null, missing: "Qué tienes en la cocina", tab: "cocina" },
    // presupuesto y tiempo no cuentan: "me es indiferente" y "sin límite" son respuestas válidas
    { ok: v.goals.length > 0, missing: "Qué te importa más al planificar", tab: "cocina" },
    { ok: !!location.label, missing: "Tu zona", tab: "compra" },
    { ok: chains.length > 0 && !!v.mainSupermarket, missing: "Tu supermercado habitual", tab: "compra" },
  ];
  const pendingChecks = checks.filter((c) => !c.ok);
  const completion = Math.round(((checks.length - pendingChecks.length) / checks.length) * 100);

  function save() {
    start(async () => {
      try {
        await saveSettings(v);
        setSaved(v);
        setStatus("ok");
      } catch {
        setStatus("error");
      }
    });
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold md:text-5xl">Configuración y perfil</h1>
          <p className="mt-1 text-muted md:text-lg">Gestiona tu cuenta, tus preferencias y cómo Sobremesa organiza tu semana.</p>
        </div>
        <p className="font-hand hidden -rotate-6 pr-6 text-2xl leading-tight text-olive-dark xl:block">Pequeñas decisiones,<br />grandes comidas</p>
      </div>

      <nav aria-label="Secciones" role="tablist" className="no-scrollbar -mx-4 mt-5 flex gap-1 overflow-x-auto px-4 md:mx-0 md:inline-flex md:rounded-2xl md:bg-white md:p-1 md:shadow-sm">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            data-tab={id}
            aria-selected={tab === id}
            onClick={() => goTo(id)}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm ${tab === id ? "bg-brand-soft font-semibold text-brand-dark" : "text-ink hover:bg-cream"}`}
          >
            <Icon className="h-5 w-5" /> {label}
          </button>
        ))}
      </nav>

      <div className={`mt-5 grid gap-5 lg:items-start ${pendingChecks.length > 0 ? "lg:grid-cols-[1fr_320px]" : ""}`}>
        <div role="tabpanel" className="flex flex-col gap-4">
          {tab === "perfil" && (
            <>
              <Card id="perfil" icon={<UserIcon className="h-7 w-7" />} title="Tu perfil" subtitle="Tu información personal en Sobremesa.">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                  <span aria-hidden className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-olive text-3xl font-semibold text-white">
                    {name.charAt(0).toUpperCase()}
                  </span>
                  <div className="grid flex-1 gap-3 sm:grid-cols-3">
                    <Field label="Nombre">
                      <input value={v.displayName} onChange={(e) => set("displayName", e.target.value)} maxLength={40} autoComplete="given-name" className={inputCls} />
                    </Field>
                    <Field label="Email">
                      <input value={email} readOnly aria-readonly className={`${inputCls} bg-cream text-muted`} title="El email es el de tu acceso y no se puede cambiar aquí" />
                    </Field>
                    <Field label="Teléfono">
                      <input value={v.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" autoComplete="tel" maxLength={20} placeholder="+34 600 000 000" className={inputCls} />
                    </Field>
                  </div>
                </div>
              </Card>

              <Card id="hogar" icon={<HomeIcon className="h-7 w-7" />} title="Tu hogar" subtitle="Cuéntanos sobre tu hogar para personalizar mejor tus menús.">
                <div className="flex flex-col gap-5 sm:flex-row sm:gap-8">
                  <div>
                    <p className="mb-2 text-sm font-semibold">Personas en casa</p>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center rounded-xl border border-cream-dark bg-white">
                        <button type="button" aria-label="Menos personas" onClick={() => set("householdSize", Math.max(1, v.householdSize - 1))} className="h-11 w-11 text-xl text-brand">−</button>
                        <span className="w-10 text-center text-lg font-semibold" aria-live="polite">{v.householdSize}</span>
                        <button type="button" aria-label="Más personas" onClick={() => set("householdSize", Math.min(12, v.householdSize + 1))} className="h-11 w-11 text-xl text-brand">+</button>
                      </div>
                      <span className="text-sm text-muted">{v.householdSize === 1 ? "persona" : "personas"}</span>
                    </div>
                  </div>
                  <div className="sm:border-l sm:border-cream-dark sm:pl-8">
                    <p className="mb-2 text-sm font-semibold">Planificas</p>
                    <p className="mb-2 text-xs text-muted">De momento el menú semanal solo organiza comidas y cenas.</p>
                    <div className="flex flex-wrap gap-2">
                      {MEALS.map(([id, label]) => (
                        <Chip key={id} on={v.planningMeals.includes(id)} onClick={() => toggleIn("planningMeals", id)}>{label}</Chip>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            </>
          )}
          {tab === "alimentacion" && (
            <>
              <Card id="alimentacion" icon={<LeafIcon className="h-7 w-7" />} title="Tu alimentación" subtitle="Indica tus preferencias alimentarias y qué alimentos prefieres evitar.">
                <p className="mb-2 text-sm font-semibold">Tipo de alimentación</p>
                <div className="mb-4 flex flex-wrap gap-2">
                  {DIETS.map(([id, label]) => (
                    <Chip key={id} on={v.diet === id} onClick={() => set("diet", id)}>{label}</Chip>
                  ))}
                </div>
                <p className="mb-2 text-sm font-semibold">Alergias o intolerancias</p>
                <div className="mb-4 flex flex-wrap gap-2">
                  <Chip on={v.allergies.length === 0} onClick={() => set("allergies", [])}>Ninguna</Chip>
                  {ALLERGIES.map((a) => (
                    <Chip key={a} on={v.allergies.includes(a)} onClick={() => toggleIn("allergies", a)}>{cap(a)}</Chip>
                  ))}
                </div>
                <p className="mb-2 text-sm font-semibold">Alimentos que no te gustan</p>
                <FoodInput
                  label="Añadir alimento que no te gusta"
                  placeholder="Escribe un alimento: coliflor, atún…"
                  value={v.avoidFoods}
                  onChange={(next) => set("avoidFoods", next)}
                  suggestions={foods}
                />
              </Card>
            </>
          )}
          {tab === "objetivo" && (
            <>
              <Card id="objetivo" icon={<TargetIcon className="h-7 w-7" />} title="Tu cuerpo y tu objetivo" subtitle="Con esto valoramos si el menú semanal te cuadra y lo ajustamos. Es orientativo, no consejo médico.">
                <p className="mb-2 text-sm font-semibold">¿Qué buscas?</p>
                <div className="mb-4 flex flex-wrap gap-2">
                  <Chip on={v.bodyGoal === null} onClick={() => set("bodyGoal", null)}>Sin objetivo</Chip>
                  {BODY_GOALS.map(([id, label]) => (
                    <Chip key={id} on={v.bodyGoal === id} onClick={() => set("bodyGoal", id)}>{label}</Chip>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="Sexo" hint="Para la fórmula del gasto diario.">
                    <select value={v.sex ?? ""} onChange={(e) => set("sex", e.target.value || null)} className={inputCls}>
                      <option value="">Prefiero no decirlo</option>
                      <option value="mujer">Mujer</option>
                      <option value="hombre">Hombre</option>
                    </select>
                  </Field>
                  <Field label="Edad">
                    <input inputMode="numeric" value={v.age ?? ""} onChange={(e) => set("age", e.target.value ? Number(e.target.value) : null)} placeholder="22" className={inputCls} />
                  </Field>
                  <Field label="Peso (kg)">
                    <input inputMode="decimal" value={v.weightKg ?? ""} onChange={(e) => set("weightKg", e.target.value ? Number(e.target.value.replace(",", ".")) : null)} placeholder="65" className={inputCls} />
                  </Field>
                  <Field label="Altura (cm)">
                    <input inputMode="numeric" value={v.heightCm ?? ""} onChange={(e) => set("heightCm", e.target.value ? Number(e.target.value) : null)} placeholder="170" className={inputCls} />
                  </Field>
                </div>
                <p className="mb-2 mt-4 text-sm font-semibold">Actividad</p>
                <div className="flex flex-wrap gap-2">
                  {ACTIVITIES.map(([id, label]) => (
                    <Chip key={id} small on={v.activity === id} onClick={() => set("activity", id)}>{label}</Chip>
                  ))}
                </div>
                {v.bodyGoal && (
                  <>
                    <p className="mb-1 mt-4 text-sm font-semibold">¿Qué comidas haces al día?</p>
                    <p className="mb-2 text-xs text-muted">Si te saltas alguna, sus calorías se reparten entre las demás y el menú sube las raciones de comida y cena.</p>
                    <div className="flex flex-wrap gap-2">
                      {DAY_PARTS.map((part) =>
                        part.menu ? (
                          <span key={part.key} className="inline-flex items-center gap-2 rounded-xl border border-olive bg-olive-soft px-2.5 py-1.5 text-xs font-medium text-olive-dark">
                            {part.emoji} {part.label} · en tu menú
                          </span>
                        ) : (
                          <Chip
                            key={part.key}
                            small
                            on={!v.skipMeals.includes(part.key)}
                            onClick={() => set("skipMeals", v.skipMeals.includes(part.key) ? v.skipMeals.filter((m) => m !== part.key) : [...v.skipMeals, part.key])}
                          >
                            {part.emoji} {part.label}
                          </Chip>
                        )
                      )}
                    </div>
                  </>
                )}
                {v.bodyGoal === "perder" && <LossPlan v={v} set={set} />}
                <GoalSummary v={v} />
              </Card>
            </>
          )}
          {tab === "cocina" && (
            <>
              <Card id="cocina" icon={<ForkIcon className="h-7 w-7" />} title="Presupuesto y cocina" subtitle="Ajusta tus preferencias para que las recetas se adapten a tu día a día.">
                <p className="mb-1 text-sm font-semibold">Tu cocina</p>
                <p className="mb-2 text-xs text-muted">Solo te proponemos recetas que puedas hacer con lo que tienes.</p>
                <div className="mb-5">
                  <KitchenPicker value={(v.appliances ?? ["fuego", "horno", "microondas"]) as ApplianceId[]} onChange={(next) => set("appliances", next)} />
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Field label="Presupuesto semanal" hint="Si pones uno, el menú tira a platos baratos y te avisa si te pasas.">
                    <select value={v.weeklyBudget ?? ""} onChange={(e) => set("weeklyBudget", e.target.value ? Number(e.target.value) : null)} className={inputCls}>
                      <option value="">Me es indiferente</option>
                      {BUDGETS.map((b) => <option key={b} value={b}>{b} €</option>)}
                    </select>
                  </Field>
                  <Field label="Veces que cocinas a la semana" hint="El resto de comidas salen de sobras. También lo puedes ajustar desde el menú.">
                    <select value={cookRangeOf(v.cookSessions)} onChange={(e) => set("cookSessions", COOK_RANGES.find((r) => r.id === e.target.value)?.value ?? null)} className={inputCls}>
                      {COOK_RANGES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Tiempo máximo por receta" hint="El menú solo elegirá recetas que quepan en ese tiempo.">
                    <select value={v.maxRecipeMinutes ?? ""} onChange={(e) => set("maxRecipeMinutes", e.target.value ? Number(e.target.value) : null)} className={inputCls}>
                      <option value="">Sin límite</option>
                      {MINUTES.map((m) => <option key={m} value={m}>{m} min</option>)}
                    </select>
                  </Field>
                  <div>
                    <p className="mb-1 text-sm font-semibold">Objetivo principal <span className="font-normal text-muted">(hasta 2)</span></p>
                    <div className="flex flex-wrap gap-2">
                      {GOALS.map(([id, label]) => (
                        <Chip key={id} small on={v.goals.includes(id)} onClick={() => toggleIn("goals", id, 2)}>{label}</Chip>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            </>
          )}
          {tab === "compra" && (
            <>
              <Card id="supermercados" icon={<StoreIcon className="h-7 w-7" />} title="Tus supermercados" subtitle="Tu supermercado habitual y dónde compras." action={<Link href="/onboarding" className="text-sm font-semibold text-brand hover:underline">Editar</Link>}>
                <ul className="flex flex-col gap-2">
                  {chains.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 rounded-xl border border-cream-dark p-2.5">
                      <ChainLogo id={c.id} name={c.name} size={32} />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                          {c.name}
                          {main === c.id && <span className="rounded-md bg-olive-soft px-1.5 py-0.5 text-[11px] font-medium text-olive-dark">Habitual</span>}
                        </span>
                        <span className="block text-xs text-muted">{c.has_prices ? "Con precios" : "Sin precios todavía"}</span>
                      </span>
                      {main !== c.id && (
                        <button type="button" onClick={() => set("mainSupermarket", c.id)} className="shrink-0 text-xs font-medium text-brand hover:underline">
                          Hacer habitual
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                {location.lat !== null && location.lng !== null && (
                  <div className="mt-3 overflow-hidden rounded-xl">
                    <StoreMap center={{ lat: location.lat, lng: location.lng }} stores={noStores} selected={noSelection} />
                  </div>
                )}
                {location.label && <p className="mt-2 text-xs text-muted">📍 {location.label}</p>}
                <Link href="/onboarding" className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-brand px-4 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft">
                  <PlusIcon className="h-4 w-4" /> Gestionar supermercados
                </Link>
              </Card>

              <Card id="estrategia" icon={<CartIcon className="h-7 w-7" />} title="Estrategia de compra" subtitle="Cómo quieres que te ayudemos a elegir dónde comprar.">
                <ul className="flex flex-col gap-1">
                  {COMPARE.map(([id, title, desc]) => (
                    <li key={id}>
                      <button type="button" role="radio" aria-checked={v.compareMode === id} onClick={() => set("compareMode", id)} className="flex w-full items-start gap-3 rounded-xl px-1 py-2 text-left hover:bg-cream">
                        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${v.compareMode === id ? "border-brand" : "border-cream-dark"}`}>
                          {v.compareMode === id && <span className="h-2.5 w-2.5 rounded-full bg-brand" />}
                        </span>
                        <span>
                          <span className="block text-sm font-semibold">{title}</span>
                          <span className="block text-xs text-muted">{desc}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            </>
          )}
          {tab === "notificaciones" && (
            <>
              <Card id="notificaciones" icon={<BellIcon className="h-7 w-7" />} title="Notificaciones" subtitle="Elige qué comunicaciones quieres recibir.">
                <ul className="flex flex-col gap-3">
                  {NOTIFS.map(([key, title, desc]) => {
                    const on = v[key] as boolean;
                    return (
                      <li key={key} className="flex items-center gap-3">
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold">{title}</span>
                          <span className="block text-xs text-muted">{desc}</span>
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={on}
                          aria-label={title}
                          onClick={() => set(key, !on as never)}
                          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? "bg-olive" : "bg-cream-dark"}`}
                        >
                          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-[left] ${on ? "left-6" : "left-1"}`} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-3 text-xs text-muted">Guardamos tu preferencia. Los avisos llegarán en una próxima versión.</p>
              </Card>
            </>
          )}
          {tab === "cuenta" && account}

          {tab !== "cuenta" && (
            <div className={`z-10 rounded-2xl bg-white/95 p-3 shadow-sm backdrop-blur ${dirty ? "sticky bottom-20 md:bottom-4" : ""}`}>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={save} disabled={pending || !dirty} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 font-semibold text-white hover:bg-brand-dark disabled:opacity-50 sm:flex-none sm:px-6">
                  <CheckIcon className="h-5 w-5" /> {pending ? "Guardando…" : "Guardar cambios"}
                </button>
                <button type="button" onClick={() => { setV(saved); setStatus(""); }} disabled={pending || !dirty} className="rounded-xl border border-brand bg-white px-4 py-3 font-medium text-brand hover:bg-brand-soft disabled:opacity-50 sm:px-6">
                  Cancelar
                </button>
                <span role="status" className="basis-full text-sm sm:basis-auto">
                  {status === "ok" && !dirty && <span className="text-olive-dark">Cambios guardados ✓</span>}
                  {status === "error" && <span className="text-red-700">No se han podido guardar. Inténtalo de nuevo.</span>}
                  {dirty && status !== "error" && <span className="text-muted">Tienes cambios sin guardar.</span>}
                </span>
              </div>
            </div>
          )}
        </div>

        {pendingChecks.length > 0 && (
          <div className="flex flex-col gap-4">
            <section className="rounded-2xl bg-olive-soft p-4">
              <p className="flex items-center gap-2 font-bold text-olive-dark">
                <StarIcon className="h-6 w-6" /> Tu perfil está completo al {completion} %
              </p>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/70" role="progressbar" aria-valuenow={completion} aria-valuemin={0} aria-valuemax={100} aria-label="Perfil completado">
                <div className="h-full rounded-full bg-olive" style={{ width: `${completion}%` }} />
              </div>
              <p className="mt-3 text-sm font-semibold text-olive-dark">Te falta:</p>
              <ul className="mt-1 flex flex-col gap-1">
                {pendingChecks.map((c) => (
                  <li key={c.missing}>
                    <button
                      type="button"
                      onClick={() => {
                        goTo(c.tab);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="flex w-full items-center justify-between gap-2 rounded-lg bg-white/70 px-3 py-2 text-left text-sm text-olive-dark hover:bg-white"
                    >
                      {c.missing}
                      <span aria-hidden>→</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-xl border border-cream-dark bg-white px-3 py-2.5 outline-none focus:border-brand";

function Card({ id, icon, title, subtitle, action, children }: { id: string; icon: React.ReactNode; title: string; subtitle: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <span className="text-ink">{icon}</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold leading-tight">{title}</h2>
          <p className="text-sm text-muted">{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

function Chip({ on, onClick, small, children }: { on: boolean; onClick: () => void; small?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl border font-medium ${small ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm"} ${
        on ? "border-olive bg-olive-soft text-olive-dark" : "border-cream-dark bg-white text-ink hover:bg-cream"
      }`}
    >
      {on ? (
        <span className="flex h-4 w-4 items-center justify-center rounded bg-olive text-white"><CheckIcon className="h-3 w-3" /></span>
      ) : (
        <span className="h-4 w-4 rounded-full border-2 border-cream-dark" />
      )}
      {children}
    </button>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const kg = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 1 });
const kcalFmt = (n: number) => n.toLocaleString("es-ES", { useGrouping: "always" } as Intl.NumberFormatOptions);
function howLong(weeks: number): string {
  if (weeks < 9) return `${weeks} semanas`;
  const months = Math.round(weeks / 4.345);
  return months < 12 ? `unos ${months} meses` : months === 12 ? "un año" : `${kg(Math.round((months / 12) * 10) / 10)} años`;
}

/** Plan para perder peso: peso saludable, a cuál se quiere llegar y a qué ritmo. */
function LossPlan({ v, set }: { v: SettingsInput; set: <K extends keyof SettingsInput>(k: K, val: SettingsInput[K]) => void }) {
  const body: Body = {
    sex: (v.sex as Body["sex"]) ?? null, age: v.age, weightKg: v.weightKg, heightCm: v.heightCm,
    activity: (v.activity as Body["activity"]) ?? null, bodyGoal: "perder", targetWeightKg: v.targetWeightKg, paceKgWeek: v.lossPace,
  };
  if (!hasBodyData(body)) {
    return <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">Rellena sexo, edad, peso y altura y te decimos tu peso saludable y a qué ritmo puedes llegar.</p>;
  }
  const w = v.weightKg!;
  const range = healthyWeight(v.heightCm!);
  const now = bmi(w, v.heightCm!);
  if (now < 18.5) {
    return <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">Con {kg(w)} kg estás por debajo del peso saludable para tu altura ({range.min}-{range.max} kg). No te recomendamos perder peso; elige «Mantenerme» o consúltalo con tu médico.</p>;
  }
  // Metas sugeridas: el tope del rango saludable y, si queda lejos, un primer paso del 5 %
  const first = Math.round(w * 0.95);
  const ideas: [number, string][] = [];
  if (w > range.max) {
    if (first > range.max + 1) ideas.push([first, `${first} kg · primer paso (−5 %)`]);
    ideas.push([range.max, `${range.max} kg · peso saludable`]);
  } else if (w - 2 >= range.min) {
    ideas.push([Math.round(w - 2), `${Math.round(w - 2)} kg`]);
  }
  const target = v.targetWeightKg;
  const tooLow = target != null && target < range.min;
  const options = paceOptions(body);
  const chosen = v.lossPace ?? null;
  return (
    <div className="mt-5 border-t border-cream-dark pt-4">
      <p className="text-sm font-semibold">Tu peso</p>
      <p className="mt-1 text-sm">
        Ahora pesas <b>{kg(w)} kg</b> (IMC {kg(now)}, {bmiLabel(now)}). Para {v.heightCm} cm, el peso saludable va de <b>{range.min} a {range.max} kg</b>.
      </p>
      {now < 25 && <p className="mt-1 text-sm text-muted">Ya estás en un peso saludable: si quieres bajar, que sea poco y despacio.</p>}

      <p className="mb-2 mt-4 text-sm font-semibold">¿A qué peso quieres llegar?</p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-2">
          <input
            inputMode="decimal"
            aria-label="Peso objetivo en kilos"
            value={target ?? ""}
            onChange={(e) => set("targetWeightKg", e.target.value ? Number(e.target.value.replace(",", ".")) || null : null)}
            placeholder={String(ideas[0]?.[0] ?? Math.round(w))}
            className={`${inputCls} w-24`}
          />
          <span className="text-sm text-muted">kg</span>
        </span>
        {ideas.map(([value, label]) => (
          <Chip key={value} small on={target === value} onClick={() => set("targetWeightKg", value)}>{label}</Chip>
        ))}
      </div>
      {tooLow && <p className="mt-2 text-sm text-amber-900">{kg(target!)} kg queda por debajo del peso saludable para tu altura (mínimo {range.min} kg).</p>}
      {target != null && target >= w && <p className="mt-2 text-sm text-muted">Ese peso no está por debajo del actual.</p>}

      <p className="mb-2 mt-4 text-sm font-semibold">¿A qué ritmo?</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => {
          const on = chosen === o.pace;
          return (
            <li key={o.pace}>
              <button
                type="button"
                disabled={!o.allowed}
                aria-pressed={on}
                onClick={() => set("lossPace", on ? null : o.pace)}
                className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm ${
                  on ? "border-olive bg-olive-soft" : o.allowed ? "border-cream-dark bg-white hover:bg-cream" : "border-cream-dark bg-cream opacity-60"
                }`}
              >
                <span className="flex flex-wrap items-center gap-x-2">
                  <b>{o.label} · {o.pace.toLocaleString("es-ES")} kg por semana</b>
                  {o.recommended && <span className="rounded bg-olive px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">Recomendado</span>}
                </span>
                <span className="block text-muted">
                  {o.allowed ? (
                    <>
                      {kcalFmt(o.kcalDay)} kcal al día{o.weeks != null && !tooLow && <> · llegas en {howLong(o.weeks)}</>}
                    </>
                  ) : (
                    <>No recomendable: {o.why}.</>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-muted">
        Cada kilo son unas 7.700 kcal: perder medio kilo por semana supone comer unas 550 kcal menos al día de las que gastas. Sin elegir ritmo se aplica uno moderado. Es orientativo, no consejo médico.
      </p>
    </div>
  );
}

function GoalSummary({ v }: { v: SettingsInput }) {
  const body: Body = {
    sex: (v.sex as Body["sex"]) ?? null, age: v.age, weightKg: v.weightKg, heightCm: v.heightCm,
    activity: (v.activity as Body["activity"]) ?? null, bodyGoal: (v.bodyGoal as Body["bodyGoal"]) ?? null,
    targetWeightKg: v.targetWeightKg, paceKgWeek: v.lossPace, skipMeals: v.skipMeals,
  };
  if (!v.bodyGoal) return <p className="mt-4 text-sm text-muted">Sin objetivo, el menú solo mira tus gustos, tu despensa y tu presupuesto.</p>;
  const t = targetsFor(body);
  return (
    <div className="mt-4">
      <DayBreakdown kcalDay={t.kcalDay} proteinDay={t.proteinDay} fatDay={t.fatDay} carbsDay={t.carbsDay} skip={v.skipMeals} />
      {!hasBodyData(body) && <p className="mt-1 text-xs text-muted">Faltan datos (sexo, edad, peso o altura), así que es una estimación media. Rellénalos y afinará.</p>}
    </div>
  );
}
