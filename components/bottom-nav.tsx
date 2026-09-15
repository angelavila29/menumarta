"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Buscar", icon: "🔍" },
  { href: "/favoritos", label: "Favoritos", icon: "★" },
  { href: "/lista", label: "Lista", icon: "🛒" },
  { href: "/menu", label: "Menú", icon: "🍽️" },
  { href: "/ajustes", label: "Ajustes", icon: "⚙️" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Barra inferior (móvil). */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="mx-auto flex max-w-lg">
        {TABS.map((t) => {
          const active = isActive(pathname, t.href);
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                className={`flex flex-col items-center gap-0.5 py-2 text-xs ${active ? "font-semibold text-green-700" : "text-zinc-500"}`}
              >
                <span className="text-xl leading-none">{t.icon}</span>
                {t.label}
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
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-zinc-200 bg-white px-4 py-6 md:flex">
      <Link href="/" className="mb-8 flex items-center gap-2 px-2 text-2xl font-bold">
        <Image src="/logo.png" alt="" width={40} height={40} />
        Sobremesa
      </Link>
      <ul className="flex flex-col gap-1">
        {TABS.map((t) => {
          const active = isActive(pathname, t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-base ${
                  active ? "bg-green-50 font-semibold text-green-800" : "text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                <span className="w-6 text-center text-lg leading-none">{t.icon}</span>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
      {email && <p className="mt-auto truncate px-2 text-xs text-zinc-400">{email}</p>}
    </aside>
  );
}
