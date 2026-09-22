"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteMyAccount, exportMyData } from "@/lib/account-actions";

/** Descargar tus datos y borrar la cuenta. Vive al final de Ajustes. */
export function AccountSection() {
  const [busy, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [word, setWord] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function download() {
    setError(null);
    start(async () => {
      try {
        const json = await exportMyData();
        const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = `sobremesa-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        setError("No se han podido preparar tus datos. Inténtalo otra vez.");
      }
    });
  }

  function remove() {
    setError(null);
    start(async () => {
      try {
        const { to } = await deleteMyAccount(word);
        router.push(to);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        setError(msg || "No se ha podido borrar la cuenta.");
      }
    });
  }

  return (
    <section id="datos" className="mt-8 scroll-mt-6 rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold leading-tight">Tus datos</h2>
      <p className="text-sm text-muted">Lo que guardamos es tuyo: puedes llevártelo o borrarlo cuando quieras.</p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={download}
          disabled={busy}
          className="rounded-xl border border-cream-dark bg-white px-4 py-2.5 text-sm font-semibold text-ink hover:bg-cream disabled:opacity-60"
        >
          Descargar mis datos
        </button>
        <span className="text-xs text-muted">
          Un archivo con tus recetas, menús, listas, despensa y preferencias.
        </span>
      </div>

      <div className="mt-5 border-t border-cream-dark pt-4">
        {!confirming ? (
          <button type="button" onClick={() => setConfirming(true)} className="text-sm font-medium text-red-700 hover:underline">
            Borrar mi cuenta
          </button>
        ) : (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-800">Esto borra tu cuenta y todo lo que has guardado.</p>
            <p className="mt-1 text-sm text-red-800">
              Se van tus recetas, menús, listas y amistades. No se puede deshacer. Si quieres conservarlo, descarga tus
              datos antes.
            </p>
            <label className="mt-3 block text-sm font-medium text-red-800">
              Escribe BORRAR para confirmar
              <input
                value={word}
                onChange={(e) => setWord(e.target.value)}
                className="mt-1 w-full rounded-xl border border-red-300 bg-white px-3 py-2.5 outline-none focus:border-red-500"
                placeholder="BORRAR"
              />
            </label>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={remove}
                disabled={busy || word.trim().toUpperCase() !== "BORRAR"}
                className="rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Borrando…" : "Borrar mi cuenta"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirming(false);
                  setWord("");
                }}
                className="rounded-xl border border-cream-dark bg-white px-4 py-2.5 text-sm font-semibold"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {error && <p className="mt-3 text-sm font-medium text-red-700">{error}</p>}
    </section>
  );
}
