const SECTIONS = [
  {
    title: "¿De dónde salen los precios?",
    text: "Del proyecto abierto opencesta, que publica cada día los precios de Mercadona (zona Madrid) y Dia. Se actualizan solos a mediodía. Los productos de otras cadenas todavía no tienen precio.",
  },
  {
    title: "¿Cómo funciona el menú?",
    text: "«Generar semana» elige recetas caseras sin repetir. Puedes cambiar cualquier casilla y ajustar las personas. «Crear lista de la compra» convierte los ingredientes en productos reales; revisa las propuestas y la app recordará tus elecciones para la próxima vez.",
  },
  {
    title: "¿Qué significa «¿Dónde sale más barata?»",
    text: "Es cuánto costaría tu lista comprándola entera en cada supermercado, contando solo los productos que existen en todos ellos. El emparejamiento entre cadenas es aproximado.",
  },
  {
    title: "Instalar en el móvil",
    text: "Abre la web en el navegador del móvil y elige «Añadir a pantalla de inicio». Funciona como una app.",
  },
];

export default function HelpPage() {
  return (
    <main className="md:max-w-2xl">
      <h1 className="mb-4 text-2xl font-bold">Ayuda</h1>
      <div className="flex flex-col gap-4 rounded-2xl bg-white p-5 text-sm leading-relaxed shadow-sm">
        {SECTIONS.map((s) => (
          <section key={s.title}>
            <h2 className="font-semibold">{s.title}</h2>
            <p className="text-muted">{s.text}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
