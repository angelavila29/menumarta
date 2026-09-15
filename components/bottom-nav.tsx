"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarIcon, CartIcon, HomeIcon, SearchIcon, SettingsIcon, StarIcon } from "./icons";

const TABS = [
  { href: "/", label: "Inicio", Icon: HomeIcon },
  { href: "/menu", label: "Menú", Icon: CalendarIcon },
  { href: "/lista", label: "Compra", Icon: CartIcon },
  { href: "/buscar", label: "Buscar", Icon: SearchIcon },
];
const EXTRA = [
  { href: "/favoritos", label: "Favoritos", Icon: StarIcon },
  { href: "/ajustes", label: "Ajustes", Icon: SettingsIcon },
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
        {TABS.map(({ href, label, Icon }) => {
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

/** Barra lateral (escritorio). */
export function SideNav({ email }: { email: string | null }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-cream-dark bg-white px-4 py-6 md:flex">
      <Link href="/" className="mb-8 flex items-center gap-2 px-2 text-2xl font-bold">
        <Image src="/logo.png" alt="" width={40} height={40} />
        Sobremesa
      </Link>
      <ul className="flex flex-col gap-1">
        {[...TABS, ...EXTRA].map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-base ${
                  active ? "bg-brand-soft font-semibold text-brand-dark" : "text-ink hover:bg-cream"
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
      {email && <p className="mt-auto truncate px-2 text-xs text-muted">{email}</p>}
    </aside>
  );
}
