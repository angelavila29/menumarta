"use client";

import { useEffect, useRef } from "react";
import type { Store } from "@/lib/geo";

const CSS = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
const JS = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";

type Layer = { addTo: (m: LeafletMap) => Layer; bindPopup: (html: string) => Layer };
type LeafletLike = {
  map: (el: HTMLElement, opts?: object) => LeafletMap;
  tileLayer: (url: string, opts: object) => Layer;
  circleMarker: (latlng: [number, number], opts: object) => Layer;
  marker: (latlng: [number, number], opts?: object) => Layer;
  divIcon: (opts: object) => object;
};
type LeafletMap = { setView: (c: [number, number], z: number) => LeafletMap; remove: () => void };

function loadLeaflet(): Promise<LeafletLike> {
  return new Promise((resolve, reject) => {
    const w = window as unknown as { L?: LeafletLike };
    if (w.L) return resolve(w.L);
    if (!document.querySelector(`link[href="${CSS}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = CSS;
      document.head.appendChild(link);
    }
    const s = document.createElement("script");
    s.src = JS;
    s.onload = () => (w.L ? resolve(w.L) : reject(new Error("Leaflet no disponible")));
    s.onerror = () => reject(new Error("No se pudo cargar el mapa"));
    document.head.appendChild(s);
  });
}

const COLOR: Record<string, string> = { mercadona: "#0b7a3b", dia: "#d5201c" };

/** Mapa con tu posición y las tiendas detectadas (OpenStreetMap). */
export function StoreMap({ center, stores, selected }: { center: { lat: number; lng: number }; stores: Store[]; selected: Set<string> }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: LeafletMap | null = null;
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !ref.current) return;
        map = L.map(ref.current, { zoomControl: false, attributionControl: true }).setView([center.lat, center.lng], 14);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);
        L.marker([center.lat, center.lng], {
          icon: L.divIcon({ className: "", html: '<div style="width:18px;height:18px;border-radius:50%;background:#e0562f;border:3px solid #fff;box-shadow:0 0 0 2px #e0562f"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }),
        }).addTo(map);
        for (const s of stores) {
          const on = selected.has(s.chainId);
          L.circleMarker([s.lat, s.lng], {
            radius: on ? 8 : 5,
            color: "#fff",
            weight: 2,
            fillColor: COLOR[s.chainId] ?? (on ? "#5f7f3e" : "#a8a29e"),
            fillOpacity: on ? 1 : 0.7,
          })
            .addTo(map)
            .bindPopup(`<b>${s.name}</b><br>${s.address ?? ""}${s.address ? "<br>" : ""}${s.distM < 1000 ? `${s.distM} m` : `${(s.distM / 1000).toFixed(1)} km`}`);
        }
      })
      .catch(() => {
        if (ref.current) ref.current.textContent = "No se ha podido cargar el mapa.";
      });
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [center.lat, center.lng, stores, selected]);

  return <div ref={ref} className="h-56 w-full rounded-xl bg-cream-dark" aria-label="Mapa de supermercados cercanos" />;
}
