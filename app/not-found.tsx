import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-5 text-center">
      <p aria-hidden className="text-5xl">🥕</p>
      <h1 className="mt-3 text-2xl font-bold">Aquí no hay nada</h1>
      <p className="mt-2 text-muted">La página que buscas no existe, o la receta o el producto ya no está disponible.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link href="/" className="rounded-xl bg-brand px-5 py-3 font-semibold text-white hover:bg-brand-dark">Ir al inicio</Link>
        <Link href="/recetas" className="rounded-xl border border-cream-dark bg-white px-5 py-3 font-medium hover:bg-cream">Ver recetas</Link>
      </div>
    </main>
  );
}
