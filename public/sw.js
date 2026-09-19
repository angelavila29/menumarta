// Service worker de Sobremesa: la lista de la compra se abre aunque no haya cobertura.
// Estrategia: red primero y copia guardada como respaldo para páginas; caché primero para estáticos.
const VERSION = "sobremesa-v1";
const STATIC = [/^\/_next\/static\//, /^\/icons\//, /^\/chains\//, /^\/logo\.png$/, /^\/manifest\.webmanifest$/];

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "clear") event.waitUntil(caches.delete(VERSION));
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/auth") || url.pathname.startsWith("/login")) return;

  if (STATIC.some((re) => re.test(url.pathname))) {
    event.respondWith(
      caches.open(VERSION).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })
    );
    return;
  }

  // Páginas y datos de navegación: red primero (con tope de 5 s), copia guardada si falla
  const isPage = req.mode === "navigate" || req.headers.get("RSC") === "1";
  if (!isPage) return;
  event.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const key = url.pathname; // una copia por pantalla, sin parámetros internos de Next
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 5000);
        const res = await fetch(req, { signal: ctrl.signal });
        clearTimeout(timer);
        if (res.ok && req.mode === "navigate") cache.put(key, res.clone());
        return res;
      } catch (e) {
        const hit = req.mode === "navigate" ? await cache.match(key) : null;
        if (hit) return hit;
        throw e;
      }
    })
  );
});
