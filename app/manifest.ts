import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sobremesa",
    short_name: "Sobremesa",
    description: "Menú semanal y lista de la compra con precios reales",
    start_url: "/",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#16a34a",
    lang: "es",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
