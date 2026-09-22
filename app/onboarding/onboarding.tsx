"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import { ChainLogo } from "@/components/chain-logo";
import { ArrowRight, CalendarIcon, CartIcon, ChartIcon, CheckIcon, LeafIcon } from "@/components/icons";
import { FoodInput } from "@/components/food-input";
import { COOK_RANGES, cookRangeOf } from "@/lib/cook-sessions";
import { formatDistance, type NearbyChain } from "@/lib/geo";
import { locateByAddress, locateByCoords, saveOnboarding, type LocateResult } from "@/lib/onboarding-actions";
import { CartBigIcon, HouseIcon, LeafBigIcon, PinIcon, PotIcon, StoreBigIcon, TargetIcon } from "./step-icons";
import { StoreMap } from "./store-map";

export type Initial = {
  address: string;
  name: string;
  chains: string[];
  householdSize: number;
  planningMeals: string[];
  mainSupermarket: string | null;
  compareMode: string;
  diet: string;
  allergies: string[];
  avoidFoods: string[];
  goals: string[];
  cookSessions: number | null;
  weeklyBudget: number | null;
  maxRecipeMinutes: number | null;
  foods: string[];
  isFirstTime: boolean;
};

type Located = Extract<LocateResult, { ok: true }>;
const TOTAL = 8;
const STEP_NAMES = ["Bienvenida", "Tu hogar", "Cocina", "Tu zona", "Supermercados", "Tu habitual", "Alimentación", "Objetivos"];
const BUDGETS = [30, 40, 50, 60, 80, 100, 150];
const MINUTES = [15, 20, 30, 45, 60];

// ¿Pantalla de escritorio? (para mostrar el mapa siempre junto a la lista)
const DESKTOP_QUERY = "(min-width: 1024px)";
function subscribeDesktop(cb: () => void) {
  const mq = window.matchMedia(DESKTOP_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
function useIsDesktop() {
  return useSyncExternalStore(subscribeDesktop, () => window.matchMedia(DESKTOP_QUERY).matches, () => false);
}

export function Onboarding({ initial }: { initial: Initial }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState(initial.name);
  const [household, setHousehold] = useState(initial.householdSize);
  const [meals, setMeals] = useState<Set<string>>(new Set(initial.planningMeals));
  const [address, setAddress] = useState(initial.address);
  const [located, setLocated] = useState<Located | null>(null);
  const [tab, setTab] = useState<"lista" | "mapa">("lista");
  const [selected, setSelected] = useState<Set<string>>(new Set(initial.chains));
  const [main, setMain] = useState<string | null>(initial.mainSupermarket);
  const [compareMode, setCompareMode] = useState(initial.compareMode);
  const [diet, setDiet] = useState(initial.diet);
  const [allergies, setAllergies] = useState<Set<string>>(new Set(initial.allergies));
  const [avoid, setAvoid] = useState<Set<string>>(new Set(initial.avoidFoods));
  const [cookRange, setCookRange] = useState(cookRangeOf(initial.cookSessions));
  const [budget, setBudget] = useState<number | null>(initial.weeklyBudget);
  const [maxMinutes, setMaxMinutes] = useState<number | null>(initial.maxRecipeMinutes);
  const [goals, setGoals] = useState<Set<string>>(new Set(initial.goals));
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  const next = () => setStep((s) => Math.min(TOTAL, s + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));
  const isDesktop = useIsDesktop();

  // ---- paso 3: localizar ----
  function applyLocation(r: LocateResult) {
    if (!r.ok) return setError(r.error);
    setError("");
    setLocated(r);
    if (selected.size === 0) setSelected(new Set(r.chains.filter((c) => r.withPrices.includes(c.id)).map((c) => c.id)));
    next();
  }
  function byAddress() {
    start(async () => applyLocation(await locateByAddress(address)));
  }
  function byGps() {
    if (!navigator.geolocation) return setError("Tu navegador no permite usar la ubicación.");
    setError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => start(async () => applyLocation(await locateByCoords(pos.coords.latitude, pos.coords.longitude))),
      () => setError("No he podido leer tu ubicación. Escribe tu código postal."),
      { timeout: 10000 }
    );
  }

  const chainList = located ? allChains(located) : [];
  const chosen = chainList.filter((c) => selected.has(c.id));
  const chosenNames = chosen.map((c) => c.name);

  function finish() {
    if (!located) return;
    const postal = address.trim().match(/\b\d{5}\b/)?.[0] ?? null;
    start(async () => {
      try {
        const { to } = await saveOnboarding({
          point: located.point,
          postalCode: postal,
          chains: chosen.map((c) => ({ id: c.id, name: c.name })),
          displayName: name,
          householdSize: household,
          planningMeals: Array.from(meals),
          mainSupermarket: main ?? chosen[0]?.id ?? null,
          compareMode,
          diet,
          allergies: Array.from(allergies),
          avoidFoods: Array.from(avoid),
          goals: Array.from(goals),
          cookSessions: COOK_RANGES.find((r) => r.id === cookRange)?.value ?? null,
          weeklyBudget: budget,
          maxRecipeMinutes: maxMinutes,
        });
        router.push(to);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se ha podido guardar.");
      }
    });
  }

  return (
    <div className="lg:grid lg:min-h-screen lg:grid-cols-[380px_1fr]">
      {/* Panel de marca (escritorio) */}
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-cream-dark bg-white px-8 py-10 lg:flex">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="" width={52} height={52} priority />
          <span className="text-2xl font-bold tracking-tight">Sobremesa</span>
        </div>
        <p className="font-hand mt-8 -rotate-2 text-3xl leading-tight text-brand">Buenas comidas,<br />mejores días.</p>
        <ol className="mt-10 flex flex-col gap-1">
          {STEP_NAMES.map((label, i) => {
            const n = i + 1;
            const done = n < step;
            const current = n === step;
            return (
              <li key={label}>
                <button
                  type="button"
                  disabled={!done}
                  onClick={() => setStep(n)}
                  aria-current={current ? "step" : undefined}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${current ? "bg-brand-soft font-semibold text-brand-dark" : done ? "text-ink hover:bg-cream" : "text-muted"}`}
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${done ? "bg-olive text-white" : current ? "bg-brand text-white" : "bg-cream-dark text-muted"}`}>
                    {done ? <CheckIcon className="h-4 w-4" /> : n}
                  </span>
                  {label}
                </button>
              </li>
            );
          })}
        </ol>
        <div className="mt-auto flex items-center gap-3 rounded-2xl bg-cream px-4 py-4 text-sm">
          <LeafIcon className="h-6 w-6 shrink-0 text-olive" />
          <span>Te llevará menos de un minuto y podrás cambiarlo todo después.</span>
        </div>
      </aside>

      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-8 pt-4 lg:max-w-4xl lg:px-14 lg:py-12">
      {/* Progreso */}
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-cream-dark">
          <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${(step / TOTAL) * 100}%` }} />
        </div>
        <span className="text-xs text-muted">{step} de {TOTAL}</span>
      </div>

      {step === 1 && (
        <Screen icon={<Image src="/logo.png" alt="" width={88} height={88} priority />} title={<>Bienvenido a <span className="text-brand">Sobremesa</span></>} subtitle="Organiza tus comidas, prepara la compra y compara cuánto te cuesta en tus supermercados habituales.">
          <ul className="flex flex-col gap-2 lg:grid lg:grid-cols-3 lg:gap-4">
            <Feature icon={<CalendarIcon className="h-6 w-6" />} title="Menú semanal" text="Planifica comidas ricas, variadas y equilibradas." />
            <Feature icon={<CartIcon className="h-6 w-6" />} title="Lista de la compra" text="Genera tu lista de forma automática y sencilla." />
            <Feature icon={<ChartIcon className="h-6 w-6" />} title="Precios reales" text="Compara en tus supermercados habituales y ahorra." />
          </ul>
          <p className="mt-3 flex items-center justify-center gap-1 text-xs text-muted lg:justify-start lg:text-sm">⏱ Te llevará menos de 1 minuto.</p>
          <Primary onClick={next}>Configurar Sobremesa</Primary>
          {!initial.isFirstTime && (
            <Link href="/" className="mt-3 block text-center text-sm font-medium text-brand lg:text-right">Ya tengo cuenta</Link>
          )}
        </Screen>
      )}

      {step === 2 && (
        <Screen icon={<HouseIcon className="h-20 w-20" />} title="Cuéntanos sobre tu hogar" subtitle="Así ajustamos mejor tus cantidades y tu menú.">
          <div className="lg:grid lg:grid-cols-2 lg:gap-8">
          <div>
          <label className="mb-1 block text-sm font-semibold">¿Cómo te llamas?</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" autoComplete="given-name" className="mb-4 w-full rounded-xl border border-cream-dark bg-white px-4 py-3 outline-none focus:border-brand" />
          </div>
          <div>
          <p className="mb-2 text-sm font-semibold">¿Para cuántas personas compras?</p>
          <div className="mb-5 grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setHousehold(n)} className={`rounded-xl border py-3 text-lg font-semibold ${household === n ? "border-brand bg-brand text-white" : "border-cream-dark bg-white"}`}>
                {n === 5 ? "5+" : n}
              </button>
            ))}
          </div>
          </div>
          </div>
          <p className="mb-2 text-sm font-semibold">¿Qué quieres planificar?</p>
          <p className="mb-2 text-xs text-muted">Por ahora el menú organiza comidas y cenas; lo demás llegará más adelante.</p>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {[["comida", "🍽️ Comidas"], ["cena", "🌙 Cenas"], ["desayuno", "☕ Desayunos"], ["merienda", "🍎 Meriendas"]].map(([id, label]) => (
              <Chip key={id} on={meals.has(id)} onClick={() => setMeals(toggleSet(meals, id))} big>{label}</Chip>
            ))}
          </div>
          <Primary onClick={next} onBack={back} disabled={meals.size === 0}>Continuar</Primary>
        </Screen>
      )}

      {step === 3 && (
        <Screen icon={<PotIcon className="h-20 w-20" />} title="¿Cómo cocinas?" subtitle="Con esto el menú te propone cocinar las veces justas y recetas que te cuadren.">
          <p className="mb-2 text-sm font-semibold">¿Cuántas veces cocinas a la semana?</p>
          <div className="mb-1 grid grid-cols-2 gap-2 lg:grid-cols-5">
            {COOK_RANGES.map((r) => (
              <Chip key={r.id} on={cookRange === r.id} onClick={() => setCookRange(r.id)} big>{r.label}</Chip>
            ))}
          </div>
          <p className="mb-5 text-xs text-muted">{COOK_RANGES.find((r) => r.id === cookRange)?.hint} El resto de comidas salen de sobras y platos que aguantan.</p>

          <div className="lg:grid lg:grid-cols-2 lg:gap-8">
          <div>
          <p className="mb-2 text-sm font-semibold">Presupuesto semanal <span className="font-normal text-muted">(opcional)</span></p>
          <div className="mb-5 flex flex-wrap gap-2">
            <Chip on={budget === null} onClick={() => setBudget(null)}>Sin definir</Chip>
            {BUDGETS.map((b) => (
              <Chip key={b} on={budget === b} onClick={() => setBudget(b)}>{b} €</Chip>
            ))}
          </div>
          </div>
          <div>
          <p className="mb-2 text-sm font-semibold">Tiempo máximo por receta</p>
          <div className="mb-1 flex flex-wrap gap-2">
            <Chip on={maxMinutes === null} onClick={() => setMaxMinutes(null)}>Sin límite</Chip>
            {MINUTES.map((m) => (
              <Chip key={m} on={maxMinutes === m} onClick={() => setMaxMinutes(m)}>{m} min</Chip>
            ))}
          </div>
          <p className="text-xs text-muted">El menú solo elegirá recetas que quepan en ese tiempo.</p>
          </div>
          </div>
          <Primary onClick={next} onBack={back}>Continuar</Primary>
        </Screen>
      )}

      {step === 4 && (
        <Screen icon={<PinIcon className="h-20 w-20" />} title="¿Dónde haces la compra?" subtitle="Usamos tu zona para mostrarte supermercados cercanos.">
          <div className="lg:max-w-xl">
          <button type="button" onClick={byGps} disabled={pending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3.5 font-semibold text-white disabled:opacity-60">
            📍 {pending ? "Buscando…" : "Usar mi ubicación"}
          </button>
          <p className="my-4 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-cream-dark" />O introduce tu código postal<span className="h-px flex-1 bg-cream-dark" /></p>
          <div className="relative">
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && byAddress()}
              placeholder="Código postal o dirección"
              inputMode="text"
              className="w-full rounded-xl border border-cream-dark bg-white py-3.5 pl-4 pr-10 text-lg outline-none focus:border-brand"
            />
            {address && <button type="button" onClick={() => setAddress("")} aria-label="Borrar" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">✕</button>}
          </div>
          <p className="mt-3 rounded-xl bg-cream px-3 py-2.5 text-xs text-muted">ⓘ Puedes cambiarlo después en cualquier momento.</p>
          {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          </div>
          <Primary onClick={byAddress} onBack={back} disabled={pending || address.trim().length < 3}>{pending ? "Buscando…" : "Continuar"}</Primary>
        </Screen>
      )}

      {step === 5 && located && (
        <Screen icon={<CartBigIcon className="h-20 w-20" />} title="Tus supermercados cercanos" subtitle="Selecciona los que usas habitualmente.">
          <div className="mb-3 grid grid-cols-2 rounded-full bg-cream-dark p-1 text-sm font-medium lg:hidden">
            {(["lista", "mapa"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)} className={`rounded-full py-1.5 ${tab === t ? "bg-white shadow-sm" : "text-muted"}`}>
                {t === "lista" ? "Lista" : "Mapa"}
              </button>
            ))}
          </div>
          <div className="lg:grid lg:grid-cols-2 lg:gap-5">
          {(isDesktop || tab === "mapa") && (
            <div className="mb-3 lg:order-2 lg:mb-0">
              <StoreMap center={located.point} stores={located.stores} selected={selected} className={isDesktop ? "h-[440px]" : "h-56"} />
            </div>
          )}
          <div className="lg:order-1">
          <p className="mb-2 text-xs text-muted lg:text-sm">📍 {located.point.label}</p>
          {chainList.length === 0 && <p className="mb-2 text-sm text-muted">No he podido consultar el mapa. Elige entre las cadenas con precios.</p>}
          <ul className="max-h-72 divide-y divide-cream-dark overflow-y-auto rounded-xl border border-cream-dark bg-white lg:max-h-[412px]">
            {chainList.map((c) => {
              const on = selected.has(c.id);
              const near = "nearestM" in c ? c : null;
              return (
                <li key={c.id}>
                  <button type="button" onClick={() => setSelected(toggleSet(selected, c.id))} className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
                    <ChainLogo id={c.id} name={c.name} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">
                        {c.name}{near && <span className="font-normal text-muted"> · {formatDistance(near.nearestM)}</span>}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {near?.nearestAddress ?? (near ? `${near.stores} ${near.stores === 1 ? "tienda" : "tiendas"} cerca` : "No detectado cerca")}
                        {located.withPrices.includes(c.id) ? " · precios disponibles" : ""}
                      </span>
                    </span>
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${on ? "border-brand bg-brand text-white" : "border-cream-dark bg-white"}`}>{on && <CheckIcon className="h-4 w-4" />}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          </div>
          </div>
          <Primary onClick={next} onBack={back} disabled={selected.size === 0}>Continuar</Primary>
        </Screen>
      )}

      {step === 6 && (
        <Screen icon={<StoreBigIcon className="h-20 w-20" />} title="Tu supermercado habitual" subtitle="También puedes decirnos cómo quieres comparar.">
          <div className="lg:grid lg:grid-cols-2 lg:gap-8">
          <div>
          <p className="mb-2 hidden text-sm font-semibold lg:block">Tu supermercado de siempre</p>
          <ul className="divide-y divide-cream-dark rounded-xl border border-cream-dark bg-white">
            {chosen.map((c) => {
              const on = (main ?? chosen[0]?.id) === c.id;
              const near = "nearestM" in c ? c : null;
              return (
                <li key={c.id}>
                  <button type="button" onClick={() => setMain(c.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
                    <Radio on={on} />
                    <ChainLogo id={c.id} name={c.name} size={28} />
                    <span className="min-w-0"><span className="block text-sm font-semibold">{c.name}</span><span className="block truncate text-xs text-muted">{near?.nearestAddress ?? (near ? formatDistance(near.nearestM) : "")}</span></span>
                  </button>
                </li>
              );
            })}
          </ul>
          </div>
          <div>
          <p className="mb-2 mt-4 text-sm font-semibold lg:mt-0">¿Qué prefieres?</p>
          <ul className="flex flex-col gap-2">
            {[
              ["habitual", "Mi supermercado habitual primero", "Te mostraremos precios de otros también."],
              ["barato", "El supermercado más barato", "Siempre que sea posible."],
              ["avisar", "Dime si merece la pena cambiar", "Te avisaremos si puedes ahorrar."],
            ].map(([id, t, d]) => (
              <li key={id}>
                <button type="button" onClick={() => setCompareMode(id)} className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left ${compareMode === id ? "border-brand bg-brand-soft" : "border-cream-dark bg-white"}`}>
                  <Radio on={compareMode === id} />
                  <span><span className="block text-sm font-semibold">{t}</span><span className="block text-xs text-muted">{d}</span></span>
                </button>
              </li>
            ))}
          </ul>
          </div>
          </div>
          <Primary onClick={next} onBack={back}>Continuar</Primary>
        </Screen>
      )}

      {step === 7 && (
        <Screen icon={<LeafBigIcon className="h-20 w-20" />} title="Tu alimentación" subtitle="Adaptaremos tus menús y tu lista.">
          <div className="lg:grid lg:grid-cols-2 lg:gap-10">
          <div>
          <p className="mb-2 text-sm font-semibold">¿Cómo coméis en casa?</p>
          <div className="mb-4 flex flex-wrap gap-2">
            {[["todo", "De todo"], ["vegetariano", "Vegetariano"], ["vegano", "Vegano"], ["pescetariano", "Pescetariano"], ["otro", "Otro"]].map(([id, l]) => (
              <Chip key={id} on={diet === id} onClick={() => setDiet(id)}>{l}</Chip>
            ))}
          </div>
          <p className="mb-2 text-sm font-semibold">Alergias e intolerancias</p>
          <div className="mb-4 flex flex-wrap gap-2">
            <Chip on={allergies.size === 0} onClick={() => setAllergies(new Set())}>Ninguna</Chip>
            {["gluten", "lactosa", "frutos secos", "huevo", "marisco", "soja"].map((a) => (
              <Chip key={a} on={allergies.has(a)} onClick={() => setAllergies(toggleSet(allergies, a))}>{cap(a)}</Chip>
            ))}
          </div>
          </div>
          <div>
          <p className="mb-2 text-sm font-semibold">Evitar alimentos <span className="font-normal text-muted">(opcional)</span></p>
          <div className="mb-2 flex flex-wrap gap-2">
            {["brócoli", "champiñones", "cerdo", "pescado", "picante"].map((a) => (
              <Chip key={a} on={avoid.has(a)} onClick={() => setAvoid(toggleSet(avoid, a))}>{cap(a)}</Chip>
            ))}
          </div>
          <FoodInput
            label="Añadir alimento a evitar"
            placeholder="Escribe un alimento: coliflor, atún…"
            value={Array.from(avoid)}
            onChange={(next) => setAvoid(new Set(next))}
            suggestions={initial.foods}
          />
          </div>
          </div>
          <Primary onClick={next} onBack={back}>Continuar</Primary>
        </Screen>
      )}

      {step === 8 && (
        <Screen icon={<TargetIcon className="h-20 w-20" />} title={<>¿Qué buscas con <span className="text-brand">Sobremesa</span>?</>} subtitle="Elige hasta dos opciones.">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-3 lg:gap-3">
            {[["ahorrar", "🐷", "Ahorrar dinero"], ["organizar", "🗓️", "Organizarme mejor"], ["saludable", "🥗", "Comer más saludable"], ["variado", "🥦", "Comer más variado"], ["tiempo", "⏱️", "Ahorrar tiempo"], ["todo", "❤️", "Todo un poco"]].map(([id, e, l]) => {
              const on = goals.has(id);
              return (
                <button key={id} type="button" onClick={() => setGoals(on ? toggleSet(goals, id) : goals.size >= 2 ? goals : toggleSet(goals, id))} className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-left text-sm font-medium ${on ? "border-brand bg-brand-soft" : "border-cream-dark bg-white"}`}>
                  <span className="text-xl">{e}</span>{l}
                </button>
              );
            })}
          </div>
          <div className="mt-4 rounded-xl bg-olive-soft p-3">
            <p className="flex items-center gap-2 font-semibold text-olive-dark"><CheckIcon className="h-5 w-5" /> Todo listo</p>
            <p className="mt-1 text-sm text-olive-dark">
              Hemos preparado Sobremesa para {household === 5 ? "5 o más" : household} {household === 1 ? "persona" : "personas"}, comprando en {joinNames(chosenNames)}.
            </p>
          </div>
          {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <Primary onClick={finish} onBack={back} disabled={pending || !located || chosen.length === 0}>{pending ? "Preparando tu menú…" : "Crear mi primer menú"}</Primary>
          <button type="button" onClick={() => setStep(2)} className="mt-3 block w-full text-center text-sm font-medium text-brand lg:text-right">Revisar preferencias</button>
        </Screen>
      )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function Screen({ icon, title, subtitle, children }: { icon: React.ReactNode; title: React.ReactNode; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col pt-6 lg:pt-10">
      <div className="lg:mb-8 lg:flex lg:items-center lg:gap-5">
        <div className="mx-auto mb-3 w-fit lg:mx-0 lg:mb-0 lg:shrink-0">{icon}</div>
        <div>
          <h1 className="text-center text-2xl font-bold leading-tight lg:text-left lg:text-4xl">{title}</h1>
          <p className="mx-auto mb-5 mt-1 max-w-xs text-center text-sm text-muted lg:mx-0 lg:mb-0 lg:max-w-none lg:text-left lg:text-lg">{subtitle}</p>
        </div>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}
function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-cream-dark bg-white p-3 lg:flex-col lg:items-start lg:rounded-2xl lg:p-5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">{icon}</span>
      <span><span className="block text-sm font-semibold lg:text-base">{title}</span><span className="block text-xs text-muted lg:text-sm">{text}</span></span>
    </li>
  );
}
function Primary({ children, onClick, onBack, disabled }: { children: React.ReactNode; onClick: () => void; onBack?: () => void; disabled?: boolean }) {
  return (
    <div className="mt-6 lg:mt-10 lg:flex lg:items-center lg:justify-between">
      {onBack ? (
        <button type="button" onClick={onBack} className="hidden rounded-xl px-4 py-3 font-medium text-muted hover:bg-white hover:text-ink lg:block">
          ← Atrás
        </button>
      ) : (
        <span className="hidden lg:block" />
      )}
      <button type="button" onClick={onClick} disabled={disabled} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3.5 text-base font-semibold text-white hover:bg-brand-dark active:bg-brand-dark disabled:opacity-50 lg:w-auto lg:min-w-64 lg:px-8">
        {children} <ArrowRight className="h-5 w-5" />
      </button>
    </div>
  );
}
function Chip({ children, on, onClick, big }: { children: React.ReactNode; on: boolean; onClick: () => void; big?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-full border text-sm font-medium ${big ? "rounded-xl px-4 py-3" : "px-3 py-1.5"} ${on ? "border-brand bg-brand text-white" : "border-cream-dark bg-white text-ink"}`}>
      {children}
    </button>
  );
}
function Radio({ on }: { on: boolean }) {
  return <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? "border-brand" : "border-cream-dark"}`}>{on && <span className="h-2.5 w-2.5 rounded-full bg-brand" />}</span>;
}
function toggleSet<T>(s: Set<T>, v: T) {
  const n = new Set(s);
  if (n.has(v)) n.delete(v);
  else n.add(v);
  return n;
}
function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function joinNames(xs: string[]) {
  if (xs.length <= 1) return xs[0] ?? "";
  return `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`;
}
/** Cadenas detectadas + las que tienen precios aunque no estén cerca. */
function allChains(r: Located): (NearbyChain | { id: string; name: string })[] {
  const seen = new Set(r.chains.map((c) => c.id));
  const extra = r.withPrices.filter((id) => !seen.has(id)).map((id) => ({ id, name: id === "mercadona" ? "Mercadona" : id === "dia" ? "Dia" : id }));
  return [...r.chains, ...extra];
}
