/** Tamaños de las imágenes propias (D-013). Se recortan para rellenar y se guardan como JPEG. */
export const AVATAR_SIZE = { width: 256, height: 256 };
export const THUMBNAIL_SIZE = { width: 640, height: 360 };

/**
 * Lee una imagen elegida por el usuario, la recorta al centro para rellenar el tamaño pedido
 * y la devuelve como data URL JPEG. Así una foto de 5 MB queda en unos 20–60 KB.
 */
export async function resizeImage(file: File, size: { width: number; height: number }): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.max(size.width / bitmap.width, size.height / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;

  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la imagen.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, (size.width - w) / 2, (size.height - h) / 2, w, h);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}
