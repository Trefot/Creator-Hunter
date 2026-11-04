/** Skin del juego (G5+): los colores de la app se adaptan a la portada del juego que se está jugando. */

export interface GameSkin {
  accent: string;
  accentHover: string;
  accentSoft: string;
  gradient: string;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return [h, s, l];
}

/**
 * Los dos tonos dominantes (0–360) de una imagen RGBA, ignorando píxeles casi grises,
 * muy oscuros o muy claros. Devuelve null si la imagen no tiene color.
 */
export function dominantHues(pixels: Uint8ClampedArray): [number, number] | null {
  const bins = new Array(36).fill(0);
  const sums = new Array(36).fill(0);
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const [h, s, l] = rgbToHsl(pixels[i], pixels[i + 1], pixels[i + 2]);
    if (s < 0.3 || l < 0.18 || l > 0.85) continue;
    const bin = Math.floor(h / 10) % 36;
    bins[bin] += s; // los más saturados pesan más
    sums[bin] += h * s;
  }
  const order = bins.map((w, i) => [w, i]).sort((a, b) => b[0] - a[0]);
  if (order[0][0] === 0) return null;
  const hueOf = (bin: number) => sums[bin] / bins[bin];
  const first = hueOf(order[0][1]);
  // Segundo tono: el siguiente con peso que esté al menos a 30° del primero; si no hay, uno vecino.
  const second = order.slice(1).find(([w, i]) => w > 0 && Math.abs(((hueOf(i) - first + 540) % 360) - 180) < 150);
  return [first, second ? hueOf(second[1]) : (first + 35) % 360];
}

/** Paleta legible sobre el fondo oscuro a partir de dos tonos. */
export function skinFromHues([h1, h2]: [number, number]): GameSkin {
  const a = Math.round(h1);
  const b = Math.round(h2);
  return {
    accent: `hsl(${a} 72% 60%)`,
    accentHover: `hsl(${a} 78% 68%)`,
    accentSoft: `hsl(${a} 72% 60% / 0.16)`,
    gradient: `linear-gradient(135deg, hsl(${a} 72% 55%) 0%, hsl(${b} 70% 50%) 100%)`,
  };
}

/** Analiza la portada (data URL) en pequeño y devuelve su skin, o null si no tiene color. */
export async function skinFromCover(cover: string): Promise<GameSkin | null> {
  const blob = await (await fetch(cover)).blob();
  const bitmap = await createImageBitmap(blob, { resizeWidth: 48, resizeHeight: 48 });
  const canvas = document.createElement("canvas");
  canvas.width = 48;
  canvas.height = 48;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const hues = dominantHues(ctx.getImageData(0, 0, 48, 48).data);
  return hues ? skinFromHues(hues) : null;
}

const VARS: [keyof GameSkin, string][] = [
  ["accent", "--accent"],
  ["accentHover", "--accent-hover"],
  ["accentSoft", "--accent-soft"],
  ["gradient", "--brand-gradient"],
];

/** Aplica la skin (y el arte de fondo) a toda la app, o la quita con null. */
export function applySkin(skin: GameSkin | null, art: string | null): void {
  const root = document.documentElement;
  for (const [key, cssVar] of VARS) {
    if (skin) root.style.setProperty(cssVar, skin[key]);
    else root.style.removeProperty(cssVar);
  }
  if (skin) root.style.setProperty("--chart-1", skin.accent);
  else root.style.removeProperty("--chart-1");
  if (skin && art) {
    root.style.setProperty("--game-art", `url("${art}")`);
    root.dataset.gameSkin = "on";
  } else {
    root.style.removeProperty("--game-art");
    delete root.dataset.gameSkin;
  }
}
