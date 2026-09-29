"use client";

import { useEffect, useState } from "react";

/**
 * Envuelve una foto: al pulsarla se abre a pantalla completa. Se cierra tocando fuera,
 * con la X o con Escape.
 */
export function PhotoLightbox({ src, alt, children, className = "" }: { src: string; alt: string; children: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Ver la foto en grande" className={`block w-full cursor-zoom-in text-left ${className}`}>
        {children}
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label={alt} onClick={() => setOpen(false)} className="fixed inset-0 z-50 flex items-center justify-center bg-ink/90 p-3 md:p-8">
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar"
            className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-2xl leading-none text-white hover:bg-white/25 md:right-5 md:top-5"
          >
            ×
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} onClick={(e) => e.stopPropagation()} className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl" />
        </div>
      )}
    </>
  );
}
