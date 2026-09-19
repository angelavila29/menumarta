"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SEARCH_EVENT } from "@/lib/events";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  BookIcon, BoxIcon, CalendarIcon, CartIcon, ChartIcon, ChevronDown, ChevronLeft, ChevronRight, HeartIcon, HelpIcon, HomeIcon, LeafIcon,
  SearchIcon, SettingsIcon, StoreIcon, UsersIcon,
} from "./icons";
import { DotsIcon } from "./icons-extra";

const MAIN = [
  { href: "/", label: "Inicio", Icon: HomeIcon },
  { href: "/menu", label: "Menú", Icon: CalendarIcon },
  { href: "/recetas", label: "Recetas", Icon: BookIcon },
  { href: "/lista", label: "Compra", Icon: CartIcon },
  { href: "/buscar", label: "Buscar", Icon: SearchIcon },
];
const SECONDARY = [
  { href: "/amigos", label: "Amigos", Icon: UsersIcon },
  { href: "/despensa", label: "Despensa", Icon: BoxIcon },
  { href: "/favoritos", label: "Favoritos", Icon: HeartIcon },
  { href: "/ajustes#supermercados", label: "Supermercados", Icon: StoreIcon },
  { href: "/historico", label: "Histórico", Icon: ChartIcon },
];
const FOOTER = [
  { href: "/ajustes", label: "Configuración", Icon: SettingsIcon },
  { href: "/ayuda", label: "Ayuda", Icon: HelpIcon },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Barra inferior (móvil). El botón "Más" abre el resto de secciones. */
export function BottomNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const extra = [...SECONDARY, ...FOOTER];
  const inExtra = extra.some((t) => isActive(pathname, t.href.split("#")[0]));

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 md:hidden" role="dialog" aria-modal="true" aria-label="Más secciones">
          <button type="button" aria-label="Cerrar" onClick={() => setOpen(false)} className="absolute inset-0 bg-ink/30" />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl">
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-cream-dark" />
            <ul className="grid grid-cols-3 gap-2">
              {extra.map(({ href, label, Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={() => setOpen(false)}
                    className="flex flex-col items-center gap-2 rounded-2xl bg-cream px-2 py-4 text-center text-xs font-medium text-ink"
                  >
                    <Icon className="h-6 w-6 text-brand" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-cream-dark bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <ul className="mx-auto flex max-w-lg">
          {MAIN.map(({ href, label, Icon }) => {
            const active = !open && isActive(pathname, href);
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  className={`flex flex-col items-center gap-1 px-0.5 py-2.5 text-[10px] ${active ? "font-semibold text-brand" : "text-muted"}`}
                >
                  <Icon className="h-6 w-6" />
                  {label}
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className={`flex w-full flex-col items-center gap-1 px-0.5 py-2.5 text-[10px] ${open || inExtra ? "font-semibold text-brand" : "text-muted"}`}
            >
              <DotsIcon className="h-6 w-6" />
              Más
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}

type Item = { href: string; label: string; Icon: (p: { className?: string }) => React.JSX.Element; soon?: boolean };

function NavItem({ href, label, Icon, soon, collapsed }: Item & { collapsed: boolean }) {
  const pathname = usePathname();
  const active = isActive(pathname, href);
  const layout = collapsed ? "justify-center px-0" : "px-3";
  if (soon) {
    return (
      <span className={`flex items-center gap-3 rounded-xl py-2.5 text-base text-muted/60 ${layout}`} title={`${label} (próximamente)`}>
        <Icon className="h-5 w-5 shrink-0" />
        {!collapsed && (
          <>
            {label}
            <span className="ml-auto rounded-full bg-cream-dark px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">pronto</span>
          </>
        )}
      </span>
    );
  }
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={`flex items-center gap-3 rounded-xl py-2.5 text-base ${layout} ${
        active ? "bg-brand-soft font-semibold text-brand-dark" : "text-ink hover:bg-cream"
      }`}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed && label}
    </Link>
  );
}

const STORAGE_KEY = "sobremesa.sidebar";
const EVENT = "sobremesa:sidebar";

function readCollapsed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "collapsed";
  } catch {
    return false;
  }
}
function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Barra lateral (escritorio), plegable. El estado se guarda en el navegador. */
export function SideNav() {
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false);

  function toggle() {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? "open" : "collapsed");
    } catch {
      /* sin almacenamiento */
    }
    window.dispatchEvent(new Event(EVENT));
  }

  return (
    <aside
      className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-cream-dark bg-white py-5 transition-[width] duration-200 md:flex ${
        collapsed ? "w-20 px-3" : "w-64 px-4"
      }`}
    >
      <button
        type="button"
        onClick={toggle}
        aria-label={collapsed ? "Desplegar menú" : "Plegar menú"}
        className="absolute -right-3 top-7 flex h-6 w-6 items-center justify-center rounded-full border border-cream-dark bg-white text-muted shadow-sm hover:text-brand"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>

      <Link href="/" className="mb-6 flex items-center justify-center gap-2" aria-label="Sobremesa, inicio">
        <Image src="/logo.png" alt="" width={collapsed ? 44 : 48} height={collapsed ? 44 : 48} priority />
        {!collapsed && <span className="text-2xl font-bold tracking-tight">Sobremesa</span>}
      </Link>

      <ul className="flex flex-col gap-1">
        {MAIN.map((t) => (
          <li key={t.href}><NavItem {...t} collapsed={collapsed} /></li>
        ))}
      </ul>
      <div className="my-4 border-t border-cream-dark" />
      <ul className="flex flex-col gap-1">
        {SECONDARY.map((t) => (
          <li key={t.href}><NavItem {...t} collapsed={collapsed} /></li>
        ))}
      </ul>
      <div className="mt-auto">
        <ul className="flex flex-col gap-1">
          {FOOTER.map((t) => (
            <li key={t.href}><NavItem {...t} collapsed={collapsed} /></li>
          ))}
        </ul>
        {!collapsed && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-cream px-4 py-4 text-sm text-ink">
            <LeafIcon className="h-6 w-6 shrink-0 text-olive" />
            <span>Comer bien,<br />vivir mejor.</span>
          </div>
        )}
      </div>
    </aside>
  );
}

/** Barra superior (escritorio): buscador y usuario. En /buscar filtra mientras escribes. */
export function TopBar({ name }: { name: string }) {
  const pathname = usePathname();
  const onSearchPage = pathname.startsWith("/buscar");
  return (
    <div className="hidden items-center gap-4 md:flex">
      <form
        action="/buscar"
        className="relative flex-1"
        onSubmit={(e) => {
          if (onSearchPage) e.preventDefault();
        }}
      >
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
        <input
          type="search"
          name="q"
          placeholder={onSearchPage ? "Buscar productos, marcas, ingredientes…" : "Buscar productos, recetas, marcas…"}
          onChange={(e) => {
            if (onSearchPage) window.dispatchEvent(new CustomEvent(SEARCH_EVENT, { detail: e.target.value }));
          }}
          className="w-full rounded-2xl border border-cream-dark bg-white py-2.5 pl-12 pr-4 text-sm shadow-sm outline-none focus:border-brand"
        />
      </form>
      <Link href="/ajustes" className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 hover:bg-white">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-olive text-base font-semibold text-white">
          {name.charAt(0).toUpperCase() || "?"}
        </span>
        <span className="text-sm font-medium">{name}</span>
        <ChevronDown className="h-4 w-4 text-muted" />
      </Link>
    </div>
  );
}
