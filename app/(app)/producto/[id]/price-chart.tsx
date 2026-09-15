"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { euro } from "@/lib/format";

export type PricePoint = { date: string; price: number };

// Una sola serie: línea de 2px en el color de marca, área al 10 %, rejilla hairline sólida
const H = 180;
const PAD = { top: 16, right: 60, bottom: 28, left: 54 };
const INK = "#1c1917";
const MUTED = "#78716c";
const GRID = "#efe8df";
const LINE = "#e0562f";
const SURFACE = "#ffffff";

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function niceTicks(min: number, max: number, count = 4): number[] {
  const raw = (max - min || 1) / (count - 1);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = Math.floor(min / step) * step; v <= max + step * 0.5; v += step) ticks.push(Number(v.toFixed(4)));
  return ticks;
}

/** Evolución del precio con cruceta y tooltip; incluye la tabla con los mismos valores. */
export function PriceChart({ points }: { points: PricePoint[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const geo = useMemo(() => {
    if (width === 0 || points.length < 2) return null;
    const prices = points.map((p) => p.price);
    const pad = Math.max((Math.max(...prices) - Math.min(...prices)) * 0.15, 0.05);
    const ticks = niceTicks(Math.max(0, Math.min(...prices) - pad), Math.max(...prices) + pad);
    const yMin = ticks[0];
    const yMax = ticks[ticks.length - 1];
    const iw = Math.max(10, width - PAD.left - PAD.right);
    const ih = H - PAD.top - PAD.bottom;
    const x = (i: number) => PAD.left + (i * iw) / (points.length - 1);
    const y = (v: number) => PAD.top + ih - ((v - yMin) / (yMax - yMin || 1)) * ih;
    const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.price).toFixed(1)}`).join(" ");
    const area = `${line} L${x(points.length - 1).toFixed(1)},${PAD.top + ih} L${x(0).toFixed(1)},${PAD.top + ih} Z`;
    return { ticks, x, y, line, area, iw, ih };
  }, [width, points]);

  const lastIdx = points.length - 1;
  const xLabels = Array.from(new Set([0, Math.floor(lastIdx / 2), lastIdx]));
  const shown = active ?? lastIdx;

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!geo) return;
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
    const i = Math.round(((px - PAD.left) / geo.iw) * lastIdx);
    setActive(Math.max(0, Math.min(lastIdx, i)));
  }

  return (
    <div>
      <div ref={ref} className="relative w-full" style={{ height: H }}>
        {geo && (
          <svg
            width={width}
            height={H}
            role="img"
            aria-label={`Evolución del precio: de ${euro(points[0].price)} el ${fmtDate(points[0].date)} a ${euro(points[lastIdx].price)} el ${fmtDate(points[lastIdx].date)}`}
            tabIndex={0}
            onPointerMove={onMove}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(lastIdx)}
            onBlur={() => setActive(null)}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") setActive((a) => Math.max(0, (a ?? lastIdx) - 1));
              if (e.key === "ArrowRight") setActive((a) => Math.min(lastIdx, (a ?? lastIdx) + 1));
            }}
            className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {geo.ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={PAD.left + geo.iw} y1={geo.y(t)} y2={geo.y(t)} stroke={GRID} strokeWidth={1} />
                <text x={PAD.left - 8} y={geo.y(t)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill={MUTED} style={{ fontVariantNumeric: "tabular-nums" }}>
                  {euro(t)}
                </text>
              </g>
            ))}
            {xLabels.map((i) => (
              <text key={i} x={geo.x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === lastIdx ? "end" : "middle"} fontSize={11} fill={MUTED}>
                {fmtDate(points[i].date)}
              </text>
            ))}
            <path d={geo.area} fill={LINE} fillOpacity={0.1} />
            <path d={geo.line} fill="none" stroke={LINE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {active !== null && <line x1={geo.x(active)} x2={geo.x(active)} y1={PAD.top} y2={PAD.top + geo.ih} stroke={MUTED} strokeWidth={1} />}
            <circle cx={geo.x(shown)} cy={geo.y(points[shown].price)} r={4} fill={LINE} stroke={SURFACE} strokeWidth={2} />
            {active === null && (
              <text x={geo.x(lastIdx) + 10} y={geo.y(points[lastIdx].price)} dominantBaseline="middle" fontSize={12} fontWeight={600} fill={INK}>
                {euro(points[lastIdx].price)}
              </text>
            )}
          </svg>
        )}
        {geo && active !== null && (
          <div
            className="pointer-events-none absolute top-0 rounded-lg border border-cream-dark bg-white px-2.5 py-1.5 text-xs shadow-md"
            style={{ left: Math.min(Math.max(geo.x(active) - 45, 0), Math.max(0, width - 100)) }}
          >
            <p className="font-bold text-ink">{euro(points[active].price)}</p>
            <p className="text-muted">{fmtDate(points[active].date)}</p>
          </div>
        )}
      </div>
      <details className="mt-2 text-xs text-muted">
        <summary className="cursor-pointer hover:text-ink">Ver tabla de precios</summary>
        <table className="mt-2 w-full">
          <thead>
            <tr>
              <th className="py-1 text-left font-medium">Fecha</th>
              <th className="py-1 text-right font-medium">Precio</th>
            </tr>
          </thead>
          <tbody>
            {points
              .slice()
              .reverse()
              .map((p) => (
                <tr key={p.date} className="border-t border-cream-dark">
                  <td className="py-1">{fmtDate(p.date)}</td>
                  <td className="py-1 text-right text-ink" style={{ fontVariantNumeric: "tabular-nums" }}>{euro(p.price)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
