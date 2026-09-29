/** Decodificar y recortar imágenes en el navegador, sin librerías. */

export type Decoded = { source: ImageBitmap | HTMLImageElement; width: number; height: number; url: string | null };

/**
 * Decodifica la imagen como pueda: createImageBitmap primero; si falla (iPhone con HEIC o fotos
 * muy grandes), con un <img>, que en Safari sí entiende esos formatos. null si no hay manera.
 */
export async function decodeImage(file: File): Promise<Decoded | null> {
  try {
    const bmp = await createImageBitmap(file);
    if (bmp.width && bmp.height) return { source: bmp, width: bmp.width, height: bmp.height, url: null };
  } catch {
    /* probamos con <img> */
  }
  const url = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement | null>((resolve) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => resolve(null);
    el.src = url;
    setTimeout(() => resolve(null), 15000);
  });
  if (!img || !img.naturalWidth) {
    URL.revokeObjectURL(url);
    return null;
  }
  return { source: img, width: img.naturalWidth, height: img.naturalHeight, url };
}

export function releaseDecoded(d: Decoded) {
  if ("close" in d.source) d.source.close();
  if (d.url) URL.revokeObjectURL(d.url);
}

/** Recorta el cuadrado (sx, sy, size) de la imagen y lo devuelve como JPEG de `out` px de lado. */
export async function cropSquare(d: Decoded, sx: number, sy: number, size: number, out = 1200): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  const side = Math.min(out, Math.round(size));
  canvas.width = side;
  canvas.height = side;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(d.source, sx, sy, size, size, 0, 0, side, side);
  return new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
}
