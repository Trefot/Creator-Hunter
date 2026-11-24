import { getDb } from './database';
import type { Game } from './games';

/** Qué es cada juego para el creador: cazar el platino, jugar sin más o una serie de vídeos. */
export const GAME_KINDS = ['platinum', 'casual', 'series'] as const;
export type GameKind = (typeof GAME_KINDS)[number];
export const KIND_LABELS: Record<GameKind, { icon: string; name: string; hint: string }> = {
  platinum: { icon: '🏆', name: 'Platino', hint: 'Ruta, trofeos y guía para conseguir el platino.' },
  casual: { icon: '🎮', name: 'Partida', hint: 'Dónde lo dejaste y qué quieres hacer en cada sesión.' },
  series: { icon: '🎬', name: 'Serie', hint: 'Episodios, momentos y clips de este juego.' },
};
export const KINDS_CHANGED = 'nexus-game-kinds-changed';

export function defaultKind(game: Pick<Game, 'trophy_count' | 'np_communication_id'>): GameKind {
  return game.trophy_count > 0 || game.np_communication_id ? 'platinum' : 'casual';
}

/** Modo elegido por juego (se guarda en la base de datos, entra en las copias). */
export async function gameKinds(): Promise<Record<string, GameKind>> {
  const rows = await (await getDb()).select<{ id: string; content: string }[]>("SELECT id,content FROM alert_cursor WHERE id LIKE 'game-kind:%'");
  const out: Record<string, GameKind> = {};
  for (const r of rows) {
    try { const k = JSON.parse(r.content); if (GAME_KINDS.includes(k)) out[r.id.slice('game-kind:'.length)] = k; } catch { /* valor antiguo ilegible: se usa el modo por defecto */ }
  }
  return out;
}

export async function setGameKind(gameId: string, kind: GameKind) {
  if (!GAME_KINDS.includes(kind)) throw Error('Modo de juego no válido.');
  await (await getDb()).execute("INSERT INTO alert_cursor(id,content) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET content=excluded.content", ['game-kind:' + gameId, JSON.stringify(kind)]);
  window.dispatchEvent(new Event(KINDS_CHANGED));
}
