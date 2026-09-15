"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarIcon, CartIcon, ChartIcon, ChevronDown, HeartIcon, HelpIcon, HomeIcon, LeafIcon,
  SearchIcon, SettingsIcon, StoreIcon,
} from "./icons";

const MAIN = [
  { href: "/", label: "Inicio", Icon: HomeIcon },
  { href: "/menu", label: "Menú", Icon: CalendarIcon },
  { href: "/lista", label: "Compra", Icon: CartIcon },
  { href: "/buscar", label: "Buscar", Icon: SearchIcon },
];
const SECONDARY = [
  { href: "/favoritos", label: "Favoritos", Icon: HeartIcon },
  { href: "/onboarding", label: "Supermercados", Icon: StoreIcon },
  { href: "/historico", label: "Histórico", Icon: ChartIcon, soon: true },
];
const FOOTER = [
  { href: "/ajustes", label: "Configuración", Icon: SettingsIcon },
  { href: "/ayuda", label: "Ayuda", Icon: HelpIcon },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Barra inferior (móvil). */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-cream-dark bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="mx-auto flex max-w-lg">
        {MAIN.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] ${active ? "font-semibold text-brand" : "text-muted"}`}
              >
                <Icon className="h-6 w-6" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function NavItem({ href, label, Icon, soon }: { href: string; label: string; Icon: (p: { className?: string }) => React.JSX.Element; soon?: boolean }) {
  const pathname = usePathname();
  const active = isActive(pathname, href);
  if (soon) {
    return (
      <span className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-base text-muted/60" title="Próximamente">
        <Icon className="h-5 w-5" />
        {label}
        <span className="ml-auto rounded-full bg-cream-dark px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">pronto</span>
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-base ${
        active ? "bg-brand-soft font-semibold text-brand-dark" : "text-ink hover:bg-cream"
      }`}
    >
      <Icon className="h-5 w-5" />
      {label}
    </Link>
  );
}

/** Barra lateral (escritorio). */
export function SideNav() {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-cream-dark bg-white px-4 py-6 md:flex">
      <Link href="/" className="mb-8 block px-2" aria-label="Sobremesa, inicio">
        <Image src="/logo.png" alt="Sobremesa" width={80} height={80} priority />
      </Link>
      <ul className="flex flex-col gap-1">
        {MAIN.map((t) => (
          <li key={t.href}><NavItem {...t} /></li>
        ))}
      </ul>
      <div className="my-4 border-t border-cream-dark" />
      <ul className="flex flex-col gap-1">
        {SECONDARY.map((t) => (
          <li key={t.href}><NavItem {...t} /></li>
        ))}
      </ul>
      <div className="mt-auto">
        <ul className="flex flex-col gap-1">
          {FOOTER.map((t) => (
            <li key={t.href}><NavItem {...t} /></li>
          ))}
        </ul>
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-cream px-4 py-4 text-sm text-ink">
          <LeafIcon className="h-6 w-6 shrink-0 text-olive" />
          <span>Comer bien,<br />vivir mejor.</span>
        </div>
      </div>
    </aside>
  );
}

/** Barra superior (escritorio): buscador y usuario. */
export function TopBar({ name }: { name: string }) {
  return (
    <div className="hidden items-center gap-4 md:flex">
      <form action="/buscar" className="relative flex-1">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
        <input
          type="search"
          name="q"
          placeholder="Buscar productos, recetas, marcas…"
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
