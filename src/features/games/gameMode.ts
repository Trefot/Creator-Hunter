import type { Game } from "../../db/games";
import type { PlayingGame } from "../../db/psn";

/** Cada cuánto se pregunta a PSN qué estás jugando (G5). */
export const GAME_MODE_POLL_MS = 60_000;
const ENABLED_KEY = "game-mode-enabled";

/** Modo juego activado (por defecto sí). Preferencia solo de este equipo. */
export function isGameModeEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) !== "false";
  } catch {
    return true;
  }
}

export function setGameModeEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(ENABLED_KEY, String(enabled));
  } catch {
    // Sin almacenamiento local, el modo juego sigue activo por defecto.
  }
}

/** "Black Myth: Wukong™" → "blackmythwukong": sin mayúsculas, acentos, símbolos ni espacios. */
export function normalizeTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Juego de la biblioteca que se está jugando. La presencia usa un ID distinto al de los trofeos,
 * así que se empareja por nombre: igual o uno contenido en el otro (ediciones "Deluxe", etc.).
 */
export function matchPlaying(library: Game[], playing: PlayingGame[]): Game | null {
  for (const p of playing) {
    const name = normalizeTitle(p.name);
    if (!name) continue;
    const exact = library.find((g) => normalizeTitle(g.title) === name);
    if (exact) return exact;
    const partial = library.find((g) => {
      const title = normalizeTitle(g.title);
      return title.length >= 6 && (name.includes(title) || title.includes(name));
    });
    if (partial) return partial;
  }
  return null;
}
