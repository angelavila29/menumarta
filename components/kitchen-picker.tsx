"use client";

import { APPLIANCES, type ApplianceId } from "@/lib/appliances";

/** Dibujos sencillos, trazo terracota como los iconos del onboarding. */
const ART: Record<ApplianceId, React.ReactNode> = {
  fuego: (
    <>
      <rect x="6" y="22" width="52" height="26" rx="4" fill="#fbe9e1" />
      <circle cx="20" cy="31" r="6" />
      <circle cx="44" cy="31" r="6" />
      <circle cx="20" cy="31" r="2" fill="#e0562f" />
      <circle cx="44" cy="31" r="2" fill="#e0562f" />
      <path d="M14 43h4M28 43h8M46 43h4" />
    </>
  ),
  horno: (
    <>
      <rect x="8" y="10" width="48" height="44" rx="4" fill="#fbe9e1" />
      <path d="M8 20h48" />
      <circle cx="16" cy="15" r="1.6" fill="#e0562f" />
      <circle cx="24" cy="15" r="1.6" fill="#e0562f" />
      <rect x="15" y="26" width="34" height="20" rx="3" />
      <path d="M22 30h12" />
    </>
  ),
  microondas: (
    <>
      <rect x="6" y="16" width="52" height="32" rx="4" fill="#fbe9e1" />
      <rect x="11" y="21" width="32" height="22" rx="2" />
      <path d="M50 22v4M50 30v2M50 36v2M50 42v2" />
    </>
  ),
  freidora: (
    <>
      <path d="M16 18c0-4 4-8 16-8s16 4 16 8v28a6 6 0 0 1-6 6H22a6 6 0 0 1-6-6z" fill="#fbe9e1" />
      <path d="M16 32h32" />
      <path d="M28 40h8" />
      <circle cx="32" cy="21" r="3" />
    </>
  ),
  batidora: (
    <>
      <rect x="26" y="6" width="12" height="28" rx="5" fill="#fbe9e1" />
      <path d="M30 34v14M34 34v14" />
      <path d="M24 48c0 4 4 7 8 7s8-3 8-7z" />
      <path d="M30 14h4" />
    </>
  ),
  olla: (
    <>
      <path d="M12 28h40v18a8 8 0 0 1-8 8H20a8 8 0 0 1-8-8z" fill="#fbe9e1" />
      <path d="M8 28h48" />
      <path d="M20 24c0-6 24-6 24 0" />
      <circle cx="32" cy="17" r="3" />
      <path d="M32 14v-4" />
    </>
  ),
};

export function KitchenPicker({ value, onChange }: { value: ApplianceId[]; onChange: (next: ApplianceId[]) => void }) {
  const has = new Set(value);
  const toggle = (id: ApplianceId) => onChange(has.has(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <div className="overflow-hidden rounded-2xl border border-cream-dark bg-cream">
      {/* Azulejos de la pared */}
      <div
        aria-hidden
        className="h-4 border-b border-cream-dark"
        style={{ backgroundImage: "linear-gradient(90deg, rgba(224,86,47,.12) 1px, transparent 1px)", backgroundSize: "24px 100%" }}
      />
      <ul className="grid grid-cols-3 gap-2 p-3 sm:grid-cols-6">
        {APPLIANCES.map((a) => {
          const on = has.has(a.id);
          return (
            <li key={a.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggle(a.id)}
                title={a.hint}
                className={`relative flex w-full flex-col items-center gap-1 rounded-xl border-2 bg-white px-1 pb-2 pt-3 text-center transition ${
                  on ? "border-brand shadow-sm" : "border-transparent opacity-55 grayscale hover:opacity-80"
                }`}
              >
                {on && (
                  <span aria-hidden className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                    ✓
                  </span>
                )}
                <svg viewBox="0 0 64 64" className="h-14 w-14" fill="none" stroke="#e0562f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  {ART[a.id]}
                </svg>
                <span className="text-xs font-semibold leading-tight">{a.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {/* Encimera */}
      <div aria-hidden className="h-3 bg-olive/70" />
      <div aria-hidden className="h-5 bg-olive/25" />
    </div>
  );
}
