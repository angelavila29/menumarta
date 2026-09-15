export default function HelpPage() {
  return (
    <main className="md:max-w-2xl">
      <h1 className="mb-4 text-2xl font-bold">Ayuda</h1>
      <div className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm text-sm leading-relaxed">
        <section>
          <h2 className="font-semibold">¿De dónde salen los precios?</h2>
          <p className="text-muted">
            Del proyecto abierto opencesta, que publica cada día los precios de Mercadona (zona Madrid) y Dia.
            Se actualizan solos a mediodía. Los productos de otras cadenas todavía no tienen precio.
          </p>
        </section>
        <section>
          <h2 className="font-semibold">¿Cómo funciona el menú?</h2>
          <p className="text-muted">
            "Generar semana" elige recetas caseras sin repetir. Puedes cambiar cualquier casilla y ajustar las personas.
            "Crear lista de la compra" convierte los ingredientes en productos reales; revisa las propuestas y la app
            recordará tus elecciones para la próxima vez.
          </p>
        </section>
        <section>
          <h2 className="font-semibold">¿Qué significa "¿Dónde sale más barata?"</h2>
          <p className="text-muted">
            Es cuánto costaría tu lista comprándola entera en cada supermercado, contando solo los productos que
            existen en todos ellos. El emparejamiento entre cadenas es aproximado.
          </p>
        </section>
        <section>
          <h2 className="font-semibold">Instalar en el móvil</h2>
          <p className="text-muted">
            Abre la web en el navegador del móvil y elige "Añadir a pantalla de inicio". Funciona como una app.
          </p>
        </section>
      </div>
    </main>
  );
}
