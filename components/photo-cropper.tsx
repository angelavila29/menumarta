"use client";

import { useEffect, useRef, useState } from "react";
import { cropSquare, type Decoded } from "@/lib/image";

type Props = {
  image: Decoded;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
};

const VIEW = 320; // lado del recuadro en pantalla (px CSS)

/**
 * Recorte cuadrado: la foto se ve dentro de un cuadrado, se arrastra para encuadrar y se acerca
 * con el control de zoom (o con dos dedos). Lo que queda dentro del cuadrado es la foto final.
 */
export function PhotoCropper({ image, onConfirm, onCancel }: Props) {
  // zoom 1 = la foto cubre justo el cuadrado por su lado corto
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 }); // desplazamiento del centro, en px de pantalla
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const base = VIEW / Math.min(image.width, image.height); // escala para cubrir el cuadrado
  const scale = base * zoom;
  const drawW = image.width * scale;
  const drawH = image.height * scale;

  // No dejar huecos: el centro no puede alejarse más de lo que sobra por cada lado
  function clamp(o: { x: number; y: number }, z = zoom) {
    const s = base * z;
    const maxX = Math.max(0, (image.width * s - VIEW) / 2);
    const maxY = Math.max(0, (image.height * s - VIEW) / 2);
    return { x: Math.min(maxX, Math.max(-maxX, o.x)), y: Math.min(maxY, Math.max(-maxY, o.y)) };
  }
  function setZoomClamped(z: number) {
    const nz = Math.min(4, Math.max(1, z));
    setZoom(nz);
    setOffset((o) => clamp(o, nz));
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  async function confirm() {
    setBusy(true);
    // Del cuadrado en pantalla a coordenadas de la imagen original
    const size = VIEW / scale;
    const sx = (image.width - size) / 2 - offset.x / scale;
    const sy = (image.height - size) / 2 - offset.y / scale;
    const blob = await cropSquare(image, sx, sy, size);
    setBusy(false);
    if (blob) onConfirm(blob);
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Recortar la foto" className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl">
        <p className="text-lg font-bold">Encuadra la foto</p>
        <p className="mb-3 text-sm text-muted">Arrastra para mover y acerca si quieres. Lo que queda dentro del cuadrado es lo que se guarda.</p>

        <div
          ref={boxRef}
          className="relative mx-auto touch-none select-none overflow-hidden rounded-xl bg-cream-dark"
          style={{ width: VIEW, height: VIEW, cursor: dragging ? "grabbing" : "grab" }}
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
            setDragging(true);
          }}
          onPointerMove={(e) => {
            if (!drag.current || pinch.current) return;
            setOffset(clamp({ x: drag.current.ox + (e.clientX - drag.current.x), y: drag.current.oy + (e.clientY - drag.current.y) }));
          }}
          onPointerUp={() => {
            drag.current = null;
            setDragging(false);
          }}
          onPointerCancel={() => {
            drag.current = null;
            setDragging(false);
          }}
          onTouchStart={(e) => {
            if (e.touches.length === 2) {
              const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
              pinch.current = { dist: d, zoom };
            }
          }}
          onTouchMove={(e) => {
            if (e.touches.length === 2 && pinch.current) {
              const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
              setZoomClamped(pinch.current.zoom * (d / pinch.current.dist));
            }
          }}
          onTouchEnd={() => (pinch.current = null)}
          onWheel={(e) => setZoomClamped(zoom * (e.deltaY < 0 ? 1.08 : 0.92))}
        >
          {/* Si viene de createImageBitmap no hay URL: se pinta en un canvas (abajo) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.url ?? undefined}
            alt=""
            draggable={false}
            className="pointer-events-none absolute max-w-none"
            style={{ width: drawW, height: drawH, left: (VIEW - drawW) / 2 + offset.x, top: (VIEW - drawH) / 2 + offset.y, display: image.url ? "block" : "none" }}
          />
          {!image.url && <BitmapCanvas bitmap={image.source as ImageBitmap} width={drawW} height={drawH} left={(VIEW - drawW) / 2 + offset.x} top={(VIEW - drawH) / 2 + offset.y} />}
          <div aria-hidden className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-inset ring-white/80" />
        </div>

        <label className="mt-4 flex items-center gap-3 text-sm">
          <span className="text-muted">Zoom</span>
          <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => setZoomClamped(Number(e.target.value))} className="flex-1 accent-brand" aria-label="Zoom" />
        </label>

        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-cream-dark bg-white px-4 py-2.5 font-medium hover:bg-cream">
            Cancelar
          </button>
          <button type="button" onClick={confirm} disabled={busy} className="flex-1 rounded-xl bg-brand px-4 py-2.5 font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
            {busy ? "Recortando…" : "Usar esta foto"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Un ImageBitmap no se puede poner en un <img>: se pinta en un canvas del tamaño mostrado. */
function BitmapCanvas({ bitmap, width, height, left, top }: { bitmap: ImageBitmap; width: number; height: number; left: number; top: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    // Se dibuja a resolución fija (lado corto 640 px) y se escala por CSS: fluido al hacer zoom
    const s = 640 / Math.min(bitmap.width, bitmap.height);
    c.width = Math.round(bitmap.width * s);
    c.height = Math.round(bitmap.height * s);
    c.getContext("2d")?.drawImage(bitmap, 0, 0, c.width, c.height);
  }, [bitmap]);
  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute max-w-none" style={{ width, height, left, top }} />;
}
