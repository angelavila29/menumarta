"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { reportError } from "@/lib/report-actions";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const pathname = usePathname();
  useEffect(() => {
    console.error(error);
    void reportError({ path: pathname, message: error.message, digest: error.digest });
  }, [error, pathname]);

  return (
    <main className="mx-auto max-w-lg py-10 text-center">
      <p aria-hidden className="text-5xl">🍲</p>
      <h1 className="mt-3 text-2xl font-bold">Algo se nos ha quemado</h1>
      <p className="mt-2 text-muted">
        No hemos podido cargar esta pantalla. Vuelve a intentarlo; si sigue fallando, prueba más tarde.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={reset} className="rounded-xl bg-brand px-5 py-3 font-semibold text-white hover:bg-brand-dark">
          Reintentar
        </button>
        <Link href="/" className="rounded-xl border border-cream-dark bg-white px-5 py-3 font-medium hover:bg-cream">
          Ir al inicio
        </Link>
      </div>
      {error.digest && <p className="mt-4 text-xs text-muted">Referencia del error: {error.digest}</p>}
    </main>
  );
}
