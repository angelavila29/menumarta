/** Esqueleto mientras carga cualquier pantalla de la app. */
export default function Loading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Cargando">
      <div className="h-10 w-64 rounded-xl bg-cream-dark" />
      <div className="mt-3 h-5 w-96 max-w-full rounded-lg bg-cream-dark/70" />
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-2xl bg-white shadow-sm" />)}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <div key={i} className="h-40 rounded-2xl bg-white shadow-sm" />)}
      </div>
    </div>
  );
}
