"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { ChainLogo } from "@/components/chain-logo";
import { CartIcon, ChartIcon, PiggyIcon, PlusIcon } from "@/components/icons";
import { BulbIcon, DotsIcon, ExternalIcon, ReceiptIcon, ShareIcon, WhatsAppIcon } from "@/components/icons-extra";
import { clearChecked, clearList, removeItem, setItemChecked, setItemQuantity } from "@/lib/actions";
import { familyOf } from "@/lib/categories";
import type { Comparison } from "@/lib/compare";
import { euro, formatWeekRange, packSize, superName, superStyle, unitPrice } from "@/lib/format";
import type { Product } from "@/lib/types";

export type ListItem = {
  id: number;
  quantity: number;
  checked: boolean;
  product: Product;
  cheaper: { name: string; supermarket_id: string; unit_price: number; unit: string; price: number | null } | null;
};
type Chain = { id: string; name: string; has_prices: boolean };
type Filter = "todos" | "pendientes" | "comprados";
type GroupBy = "super" | "categoria";

const SHOP_URL: Record<string, string> = { mercadona: "https://tienda.mercadona.es", dia: "https://www.dia.es" };
const TIPS = [
  "Revisa las ofertas de la semana antes de ir a la compra. Puedes ahorrar todavía más.",
  "Los productos con precio por kilo o litro más bajo suelen ser los envases grandes: compara antes de coger el pequeño.",
  "Tacha lo que ya tienes en casa antes de salir. La lista se genera para la semana entera.",
  "Compartir la lista por WhatsApp te permite repartir la compra con quien viva contigo.",
];

// Tachados pendientes de enviar cuando no hay cobertura
const QUEUE_KEY = "sobremesa.tachados";
type Pending = Record<string, boolean>;
function readQueue(): Pending {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "{}") as Pending;
  } catch {
    return {};
  }
}
function writeQueue(q: Pending) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  } catch {
    /* sin almacenamiento */
  }
}
// Último estado visto de cada casilla: sirve para pintar bien la copia guardada cuando no hay red
const SEEN_KEY = "sobremesa.tachados.vistos";
function readSeen(): Pending {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "{}") as Pending;
  } catch {
    return {};
  }
}
function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

function lineTotal(i: ListItem) {
  return (i.product.price ?? 0) * i.quantity;
}

export function ListView({ items: serverItems, chains: userChains, comparison, weekStart }: { items: ListItem[]; chains: Chain[]; comparison: Comparison | null; weekStart: string }) {
  const [pending, startTransition] = useTransition();
  // Tachar es instantáneo: se pinta al momento y se envía por detrás. Sin cobertura se guarda
  // en el móvil y se envía al volver la conexión.
  const [ticks, setTicks] = useState<Pending>({});
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const items = serverItems.map((i) => (String(i.id) in ticks ? { ...i, checked: ticks[String(i.id)] } : i));

  const flush = useCallback(async () => {
    const queue = readQueue();
    for (const [id, checked] of Object.entries(queue)) {
      try {
        await setItemChecked(Number(id), checked);
        const rest = readQueue();
        delete rest[id];
        writeQueue(rest);
      } catch {
        return; // seguimos sin conexión
      }
    }
  }, []);

  useEffect(() => {
    const queued = readQueue();
    // Sin red la página viene de la copia guardada: se repinta con lo último que se tachó aquí.
    // Con red manda el servidor y el estado visto se olvida.
    const seen = navigator.onLine ? {} : readSeen();
    if (navigator.onLine) localStorage.removeItem(SEEN_KEY);
    if (Object.keys(queued).length > 0 || Object.keys(seen).length > 0) {
      queueMicrotask(() => setTicks((t) => ({ ...seen, ...queued, ...t })));
      void flush();
    }
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [flush]);

  function toggle(id: number, checked: boolean) {
    setTicks((t) => ({ ...t, [String(id)]: checked }));
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify({ ...readSeen(), [String(id)]: checked }));
    } catch {
      /* sin almacenamiento */
    }
    setItemChecked(id, checked).catch(() => writeQueue({ ...readQueue(), [String(id)]: checked }));
  }
  const [filter, setFilter] = useState<Filter>("todos");
  const [groupBy, setGroupBy] = useState<GroupBy>("super");
  const [menuOpen, setMenuOpen] = useState(false);
  const [shared, setShared] = useState("");

  const nameOf = (id: string) => userChains.find((c) => c.id === id)?.name ?? superName(id);
  const totals: Record<string, number> = {};
  for (const i of items) totals[i.product.supermarket_id] = (totals[i.product.supermarket_id] ?? 0) + lineTotal(i);
  const grand = Object.values(totals).reduce((a, b) => a + b, 0);
  const checkedCount = items.filter((i) => i.checked).length;
  const pendingCount = items.length - checkedCount;
  const progress = items.length ? Math.round((checkedCount / items.length) * 100) : 0;
  const visible = items.filter((i) => (filter === "todos" ? true : filter === "pendientes" ? !i.checked : i.checked));
  const chainsWithItems = Array.from(new Set(items.map((i) => i.product.supermarket_id)));
  const tip = TIPS[new Date().getDate() % TIPS.length];

  // Grupos: por supermercado o por familia de producto
  type Group = { key: string; title: string; icon: React.ReactNode; band?: string; items: ListItem[] };
  let groups: Group[];
  if (groupBy === "super") {
    groups = chainsWithItems
      .map((c) => ({
        key: c,
        title: nameOf(c),
        band: superStyle(c).band,
        icon: <ChainLogo id={c} name={nameOf(c)} size={22} />,
        items: sortByFamily(visible.filter((i) => i.product.supermarket_id === c)),
      }))
      .filter((g) => g.items.length > 0);
  } else {
    const byFam = new Map<string, Group>();
    for (const i of sortByFamily(visible)) {
      const f = familyOf(i.product.category);
      const g: Group = byFam.get(f.id) ?? { key: f.id, title: f.name, icon: <span className="text-lg">{f.emoji}</span>, items: [] };
      g.items.push(i);
      byFam.set(f.id, g);
    }
    groups = Array.from(byFam.values());
  }

  function shareText(onlyChain?: string) {
    const mine = onlyChain ? items.filter((i) => i.product.supermarket_id === onlyChain) : items;
    const lines = ["🛒 Lista de la compra · Sobremesa", ""];
    for (const c of chainsWithItems) {
      const rows = mine.filter((i) => i.product.supermarket_id === c);
      if (rows.length === 0) continue;
      lines.push(`*${nameOf(c)}* — ${euro(totals[c] ?? 0)}`);
      for (const i of rows) lines.push(`${i.checked ? "✅" : "▢"} ${i.quantity !== 1 ? `${i.quantity}× ` : ""}${i.product.name} (${euro(lineTotal(i))})`);
      lines.push("");
    }
    lines.push(`Total: ${euro(onlyChain ? totals[onlyChain] ?? 0 : grand)}`);
    return lines.join("\n");
  }

  function share() {
    const text = shareText();
    startTransition(async () => {
      if (typeof navigator !== "undefined" && navigator.share) {
        try {
          await navigator.share({ title: "Lista de la compra", text });
          return;
        } catch {
          /* cancelado */
        }
      }
      await navigator.clipboard.writeText(text);
      setShared("Copiada ✓");
      setTimeout(() => setShared(""), 2000);
    });
  }

  const cheapest = comparison?.cheapest ?? null;

  return (
    <main>
      {/* Cabecera */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold md:text-4xl">Lista de la compra</h1>
          <p className="mt-1 text-muted">Esta semana · {formatWeekRange(weekStart)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={share}
            disabled={items.length === 0}
            className="flex items-center gap-2 rounded-xl border border-cream-dark bg-white px-4 py-2.5 font-medium hover:bg-cream disabled:opacity-50"
          >
            <ShareIcon className="h-5 w-5" /> {shared || "Compartir"}
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Más opciones"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-cream-dark bg-white hover:bg-cream"
            >
              <DotsIcon className="h-5 w-5" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 z-10 mt-1 w-56 overflow-hidden rounded-xl border border-cream-dark bg-white shadow-lg" onMouseLeave={() => setMenuOpen(false)}>
                <MenuBtn onClick={() => setGroupBy(groupBy === "super" ? "categoria" : "super")}>
                  Agrupar por {groupBy === "super" ? "categoría" : "supermercado"}
                </MenuBtn>
                <Link href="/despensa" className="block w-full px-4 py-2.5 text-left text-sm hover:bg-cream">Despensa y básicos</Link>
                <MenuBtn disabled={checkedCount === 0} onClick={() => startTransition(() => clearChecked())}>
                  Vaciar comprados ({checkedCount})
                </MenuBtn>
                <MenuBtn disabled={items.length === 0} danger onClick={() => { if (confirm("¿Vaciar toda la lista?")) startTransition(() => clearList()); }}>
                  Vaciar toda la lista
                </MenuBtn>
              </div>
            )}
          </div>
          <Link href="/buscar" className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 font-semibold text-white hover:bg-brand-dark">
            <PlusIcon className="h-5 w-5" /> <span className="hidden sm:inline">Añadir producto</span><span className="sm:hidden">Añadir</span>
          </Link>
        </div>
      </div>

      {!online && (
        <p role="status" className="mt-4 rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          Sin conexión. Puedes seguir tachando: se guardará en cuanto vuelva la cobertura.
        </p>
      )}

      <div className="mt-5 flex flex-col gap-4 lg:grid lg:grid-cols-[1fr_360px] lg:items-start">
        {/* Columna principal */}
        <div className="flex flex-col gap-4">
          {/* Progreso */}
          <section className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <CartIcon className="h-7 w-7" />
            </span>
            <div className="min-w-0">
              <p className="text-lg font-bold leading-tight">{items.length} productos</p>
              <p className="text-sm text-muted">{pendingCount} pendientes</p>
            </div>
            <div className="ml-auto flex flex-1 items-center gap-3">
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-cream-dark">
                <div className="h-full rounded-full bg-olive transition-[width]" style={{ width: `${progress}%` }} />
              </div>
              <span className="w-12 text-right text-xl font-bold">{progress}%</span>
            </div>
          </section>

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["todos", `Todos (${items.length})`],
                ["pendientes", `Pendientes (${pendingCount})`],
                ["comprados", `Comprados (${checkedCount})`],
              ] as [Filter, string][]
            ).map(([f, label]) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-full px-4 py-2 text-sm font-medium ${
                  filter === f ? "bg-brand text-white" : "border border-cream-dark bg-white text-ink hover:bg-cream"
                }`}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setGroupBy(groupBy === "super" ? "categoria" : "super")}
              className="ml-auto text-sm text-muted hover:text-ink"
            >
              ⇅ Agrupar por {groupBy === "super" ? "categoría" : "supermercado"}
            </button>
          </div>

          {/* Grupos */}
          {items.length === 0 ? (
            <section className="rounded-2xl bg-white p-8 text-center shadow-sm">
              <p className="text-4xl">🛒</p>
              <p className="mt-2 font-semibold">Tu lista está vacía</p>
              <p className="text-sm text-muted">Genera el menú de la semana o añade productos desde el buscador.</p>
              <div className="mt-4 flex justify-center gap-2">
                <Link href="/menu" className="rounded-xl bg-brand px-4 py-2.5 font-semibold text-white">Ir al menú</Link>
                <Link href="/buscar" className="rounded-xl border border-cream-dark bg-white px-4 py-2.5 font-medium">Buscar productos</Link>
              </div>
            </section>
          ) : (
            groups.map((g) => (
              <section key={g.key} className="overflow-hidden rounded-2xl bg-white shadow-sm">
                <header className={`flex items-center gap-3 px-4 py-3 ${g.band ? `${g.band} text-white` : "bg-cream"}`}>
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${g.band ? "bg-white" : "bg-brand-soft"}`}>{g.icon}</span>
                  <span className="text-base font-bold">{g.title}</span>
                  <span className={`ml-auto text-sm ${g.band ? "text-white/90" : "text-muted"}`}>
                    {g.items.length} {g.items.length === 1 ? "producto" : "productos"}
                    {g.band && <> · <b>{euro(g.items.reduce((a, i) => a + lineTotal(i), 0))}</b></>}
                  </span>
                </header>
                <ul className="divide-y divide-cream-dark">
                  {g.items.map((i) => (
                    <Row key={i.id} item={i} showChain={groupBy === "categoria"} chainName={nameOf(i.product.supermarket_id)} disabled={pending} start={startTransition} onToggle={toggle} />
                  ))}
                </ul>
                {g.band && (
                  <footer className="border-t border-cream-dark px-4 py-2">
                    <button type="button" onClick={() => { navigator.clipboard.writeText(shareText(g.key)); setShared("Copiada ✓"); setTimeout(() => setShared(""), 2000); }} className="text-sm font-medium text-brand hover:underline">
                      Copiar solo la lista de {g.title}
                    </button>
                  </footer>
                )}
              </section>
            ))
          )}
        </div>

        {/* Columna derecha */}
        <aside className="flex flex-col gap-4">
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-olive text-white"><ChartIcon className="h-6 w-6" /></span>
              <div>
                <h2 className="text-lg font-bold leading-tight">Comparativa de precios</h2>
                <p className="text-sm text-muted">
                  {comparison && comparison.comparable > 0
                    ? `Sobre ${comparison.comparable} de ${comparison.items} productos que existen en las dos cadenas`
                    : "Precio total de tu lista en cada supermercado"}
                </p>
              </div>
            </div>
            {comparison && comparison.comparable > 0 ? (
              <>
                <ul className="mt-3 flex flex-col gap-2">
                  {comparison.chains.slice().sort((a, b) => a.total - b.total).map((c) => {
                    const best = cheapest?.id === c.id;
                    return (
                      <li key={c.id} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${best ? "bg-olive-soft" : "bg-cream"}`}>
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white shadow-sm"><ChainLogo id={c.id} name={nameOf(c.id)} size={26} /></span>
                        <span className="flex-1 font-medium">{nameOf(c.id)}</span>
                        <span className={`text-lg font-bold ${best ? "text-olive-dark" : ""}`}>{euro(c.total)}</span>
                        {best && <span className="rounded-full bg-olive px-2 py-0.5 text-xs font-medium text-white">Más barato</span>}
                        {c.missing > 0 && <span className="text-xs text-muted">faltan {c.missing}</span>}
                      </li>
                    );
                  })}
                </ul>
                {cheapest && comparison.saving > 0.005 && (
                  <p className="mt-3 flex items-center gap-3 rounded-xl bg-olive-soft px-3 py-3 text-olive-dark">
                    <PiggyIcon className="h-7 w-7 shrink-0" />
                    <span><b className="text-lg">Ahorras {euro(comparison.saving)}</b><br /><span className="text-sm">comprando lo comparable en {nameOf(cheapest.id)}</span></span>
                  </p>
                )}
              </>
            ) : (
              <p className="mt-3 text-sm text-muted">
                {items.length === 0 ? "Añade productos para comparar." : "No encuentro productos comparables en las dos cadenas."}
              </p>
            )}
          </section>

          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-olive-soft text-olive"><ReceiptIcon className="h-6 w-6" /></span>
              <h2 className="text-lg font-bold">Resumen de tu compra</h2>
            </div>
            <dl className="mt-3 flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Productos totales</dt><dd className="font-semibold">{items.length}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Pendientes</dt><dd className="font-semibold">{pendingCount}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">En el carrito</dt><dd className="font-semibold">{checkedCount}</dd></div>
              {chainsWithItems.map((c) => (
                <div key={c} className="flex justify-between"><dt className="text-muted">{nameOf(c)}</dt><dd className="font-semibold">{euro(totals[c] ?? 0)}</dd></div>
              ))}
            </dl>
            <div className="my-3 border-t border-cream-dark" />
            <div className="flex items-baseline justify-between">
              <span className="font-semibold">Total estimado</span>
              <span className="text-3xl font-bold">{euro(grand)}</span>
            </div>
            {cheapest && SHOP_URL[cheapest.id] && (
              <a href={SHOP_URL[cheapest.id]} target="_blank" rel="noopener" className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 font-semibold text-white hover:bg-brand-dark">
                <CartIcon className="h-5 w-5" /> Ver productos en {nameOf(cheapest.id)} <ExternalIcon className="h-4 w-4" />
              </a>
            )}
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareText())}`}
              target="_blank"
              rel="noopener"
              aria-disabled={items.length === 0}
              className={`mt-2 flex items-center justify-center gap-2 rounded-xl bg-olive-soft px-4 py-3 font-semibold text-olive-dark hover:bg-olive/20 ${items.length === 0 ? "pointer-events-none opacity-50" : ""}`}
            >
              <WhatsAppIcon className="h-5 w-5" /> Compartir lista por WhatsApp
            </a>
          </section>

          <section className="flex gap-3 rounded-2xl bg-brand-soft p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand"><BulbIcon className="h-6 w-6" /></span>
            <div>
              <p className="font-semibold">Consejo Sobremesa</p>
              <p className="text-sm text-ink/80">{tip}</p>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}

function sortByFamily(items: ListItem[]) {
  return items.slice().sort((a, b) => Number(a.checked) - Number(b.checked) || familyOf(a.product.category).order - familyOf(b.product.category).order || a.product.name.localeCompare(b.product.name, "es"));
}

function MenuBtn({ children, onClick, disabled, danger }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`block w-full px-4 py-2.5 text-left text-sm hover:bg-cream disabled:opacity-40 ${danger ? "text-red-700" : ""}`}
    >
      {children}
    </button>
  );
}

function Row({ item, showChain, chainName, disabled, start, onToggle }: { item: ListItem; showChain: boolean; chainName: string; disabled: boolean; start: (fn: () => Promise<void>) => void; onToggle: (id: number, checked: boolean) => void }) {
  const p = item.product;
  const fam = familyOf(p.category);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <li className={`flex items-center gap-3 px-4 py-3 ${item.checked ? "bg-cream/50" : ""}`}>
      <input
        type="checkbox"
        checked={item.checked}
        onChange={(e) => onToggle(item.id, e.target.checked)}
        className="h-7 w-7 shrink-0 accent-olive"
        aria-label="Comprado"
      />
      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-cream">
        {p.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image_url} alt="" className="h-full w-full object-contain" loading="lazy" />
        ) : (
          <span className="text-2xl">{fam.emoji}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <Link href={`/producto/${p.id}`} className={`block font-medium leading-snug hover:text-brand ${item.checked ? "text-muted line-through" : ""}`}>{p.name}</Link>
        <p className="text-xs text-muted">
          {item.quantity !== 1 && <>{item.quantity} × </>}{packSize(p.pack_size) || unitPrice(p.unit_price, p.unit)}
          {showChain && <> · {chainName}</>}
          {p.brand && <> · {p.brand}</>}
        </p>
        {item.cheaper && !item.checked && (
          <p className="mt-0.5 text-xs text-olive-dark">
            En {superName(item.cheaper.supermarket_id)}: {item.cheaper.name} a {unitPrice(item.cheaper.unit_price, item.cheaper.unit)}
          </p>
        )}
      </div>
      <p className={`shrink-0 text-lg font-bold ${item.checked ? "text-muted line-through" : ""}`}>{euro(lineTotal(item))}</p>
      <div className="relative shrink-0" ref={ref}>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-label="Opciones" className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-cream">
          <DotsIcon className="h-5 w-5" />
        </button>
        {open && (
          <div className="absolute right-0 z-10 mt-1 w-48 rounded-xl border border-cream-dark bg-white p-2 shadow-lg">
            <div className="flex items-center justify-between px-2 py-1 text-sm">
              <span className="text-muted">Cantidad</span>
              <span className="flex items-center gap-1">
                <button type="button" disabled={disabled} onClick={() => start(() => setItemQuantity(item.id, item.quantity - 1))} className="h-7 w-7 rounded-md bg-cream font-bold" aria-label="Menos">−</button>
                <span className="w-6 text-center font-semibold">{item.quantity}</span>
                <button type="button" disabled={disabled} onClick={() => start(() => setItemQuantity(item.id, item.quantity + 1))} className="h-7 w-7 rounded-md bg-cream font-bold" aria-label="Más">+</button>
              </span>
            </div>
            {p.product_url && (
              <a href={p.product_url} target="_blank" rel="noopener" className="block rounded-lg px-2 py-1.5 text-sm hover:bg-cream">Ver en la tienda ↗</a>
            )}
            <button type="button" disabled={disabled} onClick={() => start(() => removeItem(item.id))} className="block w-full rounded-lg px-2 py-1.5 text-left text-sm text-red-700 hover:bg-cream">
              Eliminar
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
