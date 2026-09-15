import Image from "next/image";

const LOGOS: Record<string, string> = {
  mercadona: "/chains/mercadona.png",
  dia: "/chains/dia.png",
};

/** Logo de la cadena (o sus iniciales si no tenemos logo). */
export function ChainLogo({ id, name, size = 24, className = "" }: { id: string; name?: string; size?: number; className?: string }) {
  const src = LOGOS[id];
  if (src) {
    return <Image src={src} alt={name ?? id} width={size} height={size} className={`shrink-0 ${className}`} />;
  }
  const initials = (name ?? id).replace(/[^A-Za-zÁÉÍÓÚáéíóúñÑ ]/g, "").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-cream-dark text-[10px] font-bold text-muted ${className}`}
      style={{ width: size, height: size }}
      aria-label={name ?? id}
    >
      {initials}
    </span>
  );
}
