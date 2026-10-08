"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { generateWeekAction } from "@/lib/menu-actions";

/** La acción principal de la portada vacía: crea el menú ahí mismo y lleva a verlo. */
export function CreateMenuButton({ weekStart }: { weekStart: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await generateWeekAction(weekStart);
          router.push("/menu");
        })
      }
      className="rounded-xl bg-brand px-6 py-3.5 text-base font-semibold text-white hover:bg-brand-dark disabled:opacity-70"
    >
      {pending ? "Preparando tu menú…" : "Crear mi menú semanal"}
    </button>
  );
}
