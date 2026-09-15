"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ChainLogo } from "@/components/chain-logo";
import { formatDistance, type NearbyChain } from "@/lib/geo";
import { locateByAddress, locateByCoords, saveOnboarding, type LocateResult } from "@/lib/onboarding-actions";

type Props = { initialAddress: string; initialName: string; initialChains: string[]; isFirstTime: boolean };

export function Onboarding({ initialAddress, initialName, initialChains, isFirstTime }: Props) {
  const [address, setAddress] = useState(initialAddress);
  const [displayName, setDisplayName] = useState(initialName);
  const [result, setResult] = useState<Extract<LocateResult, { ok: true }> | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set(initialChains));
  const [pending, start] = useTransition();
  const [saving, startSave] = useTransition();

  function apply(r: LocateResult) {
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setError("");
    setResult(r);
    // Preselección: lo que ya tenía, o las cadenas cercanas con precios
    if (selected.size === 0) {
      setSelected(new Set(r.chains.filter((c) => r.withPrices.includes(c.id)).map((c) => c.id)));
    }
  }

  function byAddress(e: React.FormEvent) {
    e.preventDefault();
    start(async () => apply(await locateByAddress(address)));
  }

  function byGps() {
    if (!navigator.geolocation) return setError("Tu navegador no permite usar la ubicación.");
    setError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => start(async () => apply(await locateByCoords(pos.coords.latitude, pos.coords.longitude))),
      () => setError("No he podido leer tu ubicación. Escribe tu dirección."),
      { enableHighAccuracy: false, timeout: 10000 }
    );
  }

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function save() {
    if (!result) return;
    const all = allChains(result);
    const chains = all.filter((c) => selected.has(c.id)).map((c) => ({ id: c.id, name: c.name }));
    const postal = address.trim().match(/\b\d{5}\b/)?.[0] ?? null;
    startSave(async () => {
      try {
        await saveOnboarding({ point: result.point, postalCode: postal, chains, displayName });
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se ha podido guardar.");
      }
    });
  }

  return (
    <div>
      <h1 className="text-3xl font-bold">{isFirstTime ? "¡Hola! Vamos a empezar" : "Tu ubicación y supermercados"}</h1>
      <p className="mt-1 text-zinc-600">Dinos dónde vives y buscamos los supermercados que tienes cerca.</p>

      {/* Paso 1: ubicación */}
      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="mb-3 text-lg font-semibold">1. ¿Cómo te llamas y dónde vives?</h2>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Tu nombre (ej. Marta)"
          autoComplete="given-name"
          className="mb-2 w-full rounded-xl border border-zinc-300 px-4 py-3 text-lg outline-none focus:border-brand sm:max-w-xs"
        />
        <form onSubmit={byAddress} className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Código postal o dirección (ej. 28001, o Calle Alcalá 50, Madrid)"
            className="min-w-0 flex-1 rounded-xl border border-zinc-300 px-4 py-3 text-lg outline-none focus:border-brand"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-brand px-5 py-3 text-lg font-semibold text-white active:bg-brand-dark disabled:opacity-60"
          >
            {pending ? "Buscando…" : "Buscar"}
          </button>
        </form>
        <button type="button" onClick={byGps} disabled={pending} className="mt-3 text-sm text-brand underline">
          📍 Usar mi ubicación actual
        </button>
        {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {result && (
          <p className="mt-3 rounded-lg bg-brand-soft p-3 text-sm text-brand-dark">
            📍 {result.point.label}
          </p>
        )}
      </section>

      {/* Paso 2: cadenas */}
      {result && (
        <section className="mt-4 rounded-2xl border border-zinc-200 bg-white p-5">
          <h2 className="mb-1 text-lg font-semibold">2. ¿Dónde compras?</h2>
          <p className="mb-3 text-sm text-zinc-500">
            {result.chains.length > 0
              ? `Hemos encontrado ${result.chains.length} cadenas a menos de 2,5 km. Marca las que uses.`
              : "No he podido consultar el mapa ahora mismo. Elige entre las cadenas con precios."}
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {allChains(result).map((c) => {
              const hasPrices = result.withPrices.includes(c.id);
              const on = selected.has(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => toggle(c.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left ${
                      on ? "border-brand bg-brand-soft" : "border-zinc-200"
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-sm ${
                        on ? "border-brand bg-brand text-white" : "border-zinc-300 bg-white"
                      }`}
                    >
                      {on ? "✓" : ""}
                    </span>
                    <ChainLogo id={c.id} name={c.name} size={28} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{c.name}</span>
                      <span className="block text-xs text-zinc-500">
                        {"stores" in c && c.stores > 0
                          ? `${c.stores} ${c.stores === 1 ? "tienda" : "tiendas"} · la más cercana a ${formatDistance(c.nearestM)}`
                          : "No detectada cerca"}
                        {hasPrices ? " · precios disponibles" : " · sin precios todavía"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-zinc-500">
            De momento solo tenemos precios de Mercadona y Dia. Las demás se guardan para cuando los tengamos.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
            {!isFirstTime && (
              <Link href="/ajustes" className="rounded-xl px-5 py-3 text-center text-zinc-600">
                Cancelar
              </Link>
            )}
            <button
              type="button"
              onClick={save}
              disabled={saving || selected.size === 0}
              className="rounded-xl bg-brand px-5 py-3 text-lg font-semibold text-white active:bg-brand-dark disabled:opacity-60"
            >
              {saving ? "Guardando…" : "Guardar y empezar"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

/** Cadenas detectadas + las que tienen precios aunque no estén cerca (siempre elegibles). */
function allChains(r: Extract<LocateResult, { ok: true }>): (NearbyChain | { id: string; name: string })[] {
  const seen = new Set(r.chains.map((c) => c.id));
  const extra = r.withPrices
    .filter((id) => !seen.has(id))
    .map((id) => ({ id, name: id === "mercadona" ? "Mercadona" : id === "dia" ? "Dia" : id }));
  return [...r.chains, ...extra];
}
