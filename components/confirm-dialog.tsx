"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Ask = { title: string; body?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean };

/**
 * Confirmación con un modal propio en vez del `confirm()` del navegador.
 * `const [ask, dialog] = useConfirm()`; se pinta `{dialog}` y se usa `if (await ask({...}))`.
 */
export function useConfirm(): [(q: Ask) => Promise<boolean>, React.ReactNode] {
  const [q, setQ] = useState<Ask | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const ask = useCallback((next: Ask) => {
    setQ(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);
  const close = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setQ(null);
  }, []);

  useEffect(() => {
    if (!q) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [q, close]);

  const dialog = q ? (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={q.title}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/50 sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) close(false);
      }}
    >
      <div className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:pb-5">
        <p className="text-lg font-bold">{q.title}</p>
        {q.body && <p className="mt-1 text-sm text-muted">{q.body}</p>}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            autoFocus
            onClick={() => close(true)}
            className={`flex-1 rounded-xl px-4 py-3 font-semibold text-white ${q.danger ? "bg-red-600 hover:bg-red-700" : "bg-brand hover:bg-brand-dark"}`}
          >
            {q.confirmLabel ?? "Aceptar"}
          </button>
          <button type="button" onClick={() => close(false)} className="flex-1 rounded-xl border border-cream-dark px-4 py-3 font-medium hover:bg-cream">
            {q.cancelLabel ?? "Cancelar"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return [ask, dialog];
}
