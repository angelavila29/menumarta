"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { ChainLogo } from "@/components/chain-logo";
import { ArrowRight, CalendarIcon, CartIcon, ChartIcon, CheckIcon, PlusIcon } from "@/components/icons";
import { formatDistance, type NearbyChain } from "@/lib/geo";
import { locateByAddress, locateByCoords, saveOnboarding, type LocateResult } from "@/lib/onboarding-actions";
import { CartBigIcon, HouseIcon, LeafBigIcon, PinIcon, StoreBigIcon, TargetIcon } from "./step-icons";
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
  isFirstTime: boolean;
};

type Located = Extract<LocateResult, { ok: true }>;
const TOTAL = 7;

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
  const [avoidInput, setAvoidInput] = useState("");
  const [goals, setGoals] = useState<Set<string>>(new Set(initial.goals));
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const next = () => setStep((s) => Math.min(TOTAL, s + 1));

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
        await saveOnboarding({
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
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se ha podido guardar.");
      }
    });
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Progreso */}
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-cream-dark">
          <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${(step / TOTAL) * 100}%` }} />
        </div>
        <span className="text-xs text-muted">{step} de {TOTAL}</span>
      </div>

      {step === 1 && (
        <Screen icon={<Image src="/logo.png" alt="" width={88} height={88} priority />} title={<>Bienvenido a <span className="text-brand">Sobremesa</span></>} subtitle="Organiza tus comidas, prepara la compra y compara cuánto te cuesta en tus supermercados habituales.">
          <ul className="flex flex-col gap-2">
            <Feature icon={<CalendarIcon className="h-6 w-6" />} title="Menú semanal" text="Planifica comidas ricas, variadas y equilibradas." />
            <Feature icon={<CartIcon className="h-6 w-6" />} title="Lista de la compra" text="Genera tu lista de forma automática y sencilla." />
            <Feature icon={<ChartIcon className="h-6 w-6" />} title="Precios reales" text="Compara en tus supermercados habituales y ahorra." />
          </ul>
          <p className="mt-3 flex items-center justify-center gap-1 text-xs text-muted">⏱ Te llevará menos de 1 minuto.</p>
          <Primary onClick={next}>Configurar Sobremesa</Primary>
          {!initial.isFirstTime && (
            <Link href="/" className="mt-3 block text-center text-sm font-medium text-brand">Ya tengo cuenta</Link>
          )}
        </Screen>
      )}

      {step === 2 && (
        <Screen icon={<HouseIcon className="h-20 w-20" />} title="Cuéntanos sobre tu hogar" subtitle="Así ajustamos mejor tus cantidades y tu menú.">
          <label className="mb-1 block text-sm font-semibold">¿Cómo te llamas?</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" autoComplete="given-name" className="mb-4 w-full rounded-xl border border-cream-dark bg-white px-4 py-3 outline-none focus:border-brand" />
          <p className="mb-2 text-sm font-semibold">¿Para cuántas personas compras?</p>
          <div className="mb-5 grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setHousehold(n)} className={`rounded-xl border py-3 text-lg font-semibold ${household === n ? "border-brand bg-brand text-white" : "border-cream-dark bg-white"}`}>
                {n === 5 ? "5+" : n}
              </button>
            ))}
          </div>
          <p className="mb-2 text-sm font-semibold">¿Qué quieres planificar?</p>
          <div className="grid grid-cols-2 gap-2">
            {[["comida", "🍽️ Comidas"], ["cena", "🌙 Cenas"], ["desayuno", "☕ Desayunos"], ["merienda", "🍎 Meriendas"]].map(([id, label]) => (
              <Chip key={id} on={meals.has(id)} onClick={() => setMeals(toggleSet(meals, id))} big>{label}</Chip>
            ))}
          </div>
          <Primary onClick={next} disabled={meals.size === 0}>Continuar</Primary>
        </Screen>
      )}

      {step === 3 && (
        <Screen icon={<PinIcon className="h-20 w-20" />} title="¿Dónde haces la compra?" subtitle="Usamos tu zona para mostrarte supermercados cercanos.">
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
          <Primary onClick={byAddress} disabled={pending || address.trim().length < 3}>{pending ? "Buscando…" : "Continuar"}</Primary>
        </Screen>
      )}

      {step === 4 && located && (
        <Screen icon={<CartBigIcon className="h-20 w-20" />} title="Tus supermercados cercanos" subtitle="Selecciona los que usas habitualmente.">
          <div className="mb-3 grid grid-cols-2 rounded-full bg-cream-dark p-1 text-sm font-medium">
            {(["lista", "mapa"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)} className={`rounded-full py-1.5 ${tab === t ? "bg-white shadow-sm" : "text-muted"}`}>
                {t === "lista" ? "Lista" : "Mapa"}
              </button>
            ))}
          </div>
          {tab === "mapa" && <div className="mb-3"><StoreMap center={located.point} stores={located.stores} selected={selected} /></div>}
          <p className="mb-2 text-xs text-muted">📍 {located.point.label}</p>
          {chainList.length === 0 && <p className="mb-2 text-sm text-muted">No he podido consultar el mapa. Elige entre las cadenas con precios.</p>}
          <ul className="max-h-72 divide-y divide-cream-dark overflow-y-auto rounded-xl border border-cream-dark bg-white">
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
          <Primary onClick={next} disabled={selected.size === 0}>Continuar</Primary>
        </Screen>
      )}

      {step === 5 && (
        <Screen icon={<StoreBigIcon className="h-20 w-20" />} title="Tu supermercado habitual" subtitle="También puedes decirnos cómo quieres comparar.">
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
          <p className="mb-2 mt-4 text-sm font-semibold">¿Qué prefieres?</p>
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
          <Primary onClick={next}>Continuar</Primary>
        </Screen>
      )}

      {step === 6 && (
        <Screen icon={<LeafBigIcon className="h-20 w-20" />} title="Tu alimentación" subtitle="Adaptaremos tus menús y tu lista.">
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
          <p className="mb-2 text-sm font-semibold">Evitar alimentos <span className="font-normal text-muted">(opcional)</span></p>
          <div className="mb-2 flex flex-wrap gap-2">
            {Array.from(new Set(["brócoli", "champiñones", "cerdo", ...avoid])).map((a) => (
              <Chip key={a} on={avoid.has(a)} onClick={() => setAvoid(toggleSet(avoid, a))}>{cap(a)}</Chip>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-cream-dark bg-white px-3">
            <PlusIcon className="h-4 w-4 text-muted" />
            <input
              type="text"
              value={avoidInput}
              onChange={(e) => setAvoidInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && avoidInput.trim()) {
                  setAvoid(new Set([...avoid, avoidInput.trim().toLowerCase()]));
                  setAvoidInput("");
                }
              }}
              placeholder="Añadir alimento"
              className="w-full bg-transparent py-2.5 text-sm outline-none"
            />
          </div>
          <Primary onClick={next}>Continuar</Primary>
        </Screen>
      )}

      {step === 7 && (
        <Screen icon={<TargetIcon className="h-20 w-20" />} title={<>¿Qué buscas con <span className="text-brand">Sobremesa</span>?</>} subtitle="Elige hasta dos opciones.">
          <div className="grid grid-cols-2 gap-2">
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
          <Primary onClick={finish} disabled={pending || !located || chosen.length === 0}>{pending ? "Preparando tu menú…" : "Crear mi primer menú"}</Primary>
          <button type="button" onClick={() => setStep(2)} className="mt-3 block w-full text-center text-sm font-medium text-brand">Revisar preferencias</button>
        </Screen>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
function Screen({ icon, title, subtitle, children }: { icon: React.ReactNode; title: React.ReactNode; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col pt-6">
      <div className="mx-auto mb-3">{icon}</div>
      <h1 className="text-center text-2xl font-bold leading-tight">{title}</h1>
      <p className="mx-auto mb-5 mt-1 max-w-xs text-center text-sm text-muted">{subtitle}</p>
      <div className="flex-1">{children}</div>
    </div>
  );
}
function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-cream-dark bg-white p-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">{icon}</span>
      <span><span className="block text-sm font-semibold">{title}</span><span className="block text-xs text-muted">{text}</span></span>
    </li>
  );
}
function Primary({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3.5 text-base font-semibold text-white active:bg-brand-dark disabled:opacity-50">
      {children} <ArrowRight className="h-5 w-5" />
    </button>
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
