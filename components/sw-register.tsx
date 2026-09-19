"use client";

import { useEffect } from "react";

/** Registra el service worker (solo en producción) para abrir la lista sin cobertura. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
