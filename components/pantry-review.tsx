"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { reviewPantry } from "@/lib/pantry-actions";

/**
 * "¿Sigues teniendo esto?": todo lo de la despensa a la vista; se toca lo que se ha acabado
 * y un único botón lo quita. "Todo sigue igual" solo apunta que está revisada.
 */
export function PantryReview({ items, onClose, onDone }: { items: string[]; onClose: () => void; onDone?: (removed: string[]) => void }) {
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggle = (name: string) =>
    setGone((s) => {
      const n = new Set(s);
      if (n.has(name)) n.delete(name);
      else n.add(name);
      return n;
    });

  function finish() {
    const removed = Array.from(gone);
    start(async () => {
      await reviewPantry(removed);
      onDone?.(removed);
      router.refresh();
      onClose();
    });
  }

  const sorted = [...items].sort((a, b) => a.localeCompare(b, "es"));

  return (
    <div role="dialog" aria-modal="true" aria-label="Revisar la despensa" className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-2xl">
        <p className="text-lg font-bold">¿Sigues teniendo todo esto?</p>
        <p className="text-sm text-muted">Toca lo que se te ha acabado y lo quitamos de golpe.</p>
        <ul className="mt-4 flex flex-wrap gap-2 overflow-y-auto pb-1">
          {sorted.map((name) => {
            const off = gone.has(name);
            return (
              <li key={name}>
                <button
                  type="button"
                  aria-pressed={off}
                  onClick={() => toggle(name)}
                  className={`rounded-xl border px-3 py-1.5 text-sm capitalize transition ${
                    off ? "border-red-200 bg-red-50 text-red-800 line-through" : "border-olive bg-olive-soft font-medium text-olive-dark"
                  }`}
                >
                  {name}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            disabled={pending}
            onClick={finish}
            className="flex-1 rounded-xl bg-brand px-4 py-3 font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {pending ? "Guardando…" : gone.size > 0 ? `Quitar ${gone.size} ${gone.size === 1 ? "cosa" : "cosas"}` : "Todo sigue igual"}
          </button>
          <button type="button" onClick={onClose} className="rounded-xl border border-cream-dark px-4 py-3 font-medium hover:bg-cream">
            Ahora no
          </button>
        </div>
      </div>
    </div>
  );
}
