import { getDb, newId, WORKSPACE_ID } from "./database";
import type { PsnTrophy } from "./psn";

export const GAME_PLATFORMS = ["ps5", "ps4", "xbox", "pc", "switch", "other"] as const;
export type GamePlatform = (typeof GAME_PLATFORMS)[number];
export const GAME_STATUSES = ["playing", "backlog", "completed", "platinum", "dropped"] as const;
export type GameStatus = (typeof GAME_STATUSES)[number];
export type TrophyType = "bronze" | "silver" | "gold" | "platinum";

export interface Game {
  id: string;
  title: string;
  platform: GamePlatform;
  status: GameStatus;
  /** Portada como data URL (se ve sin conexión). */
  cover: string | null;
  np_communication_id: string | null;
  np_service_name: "trophy" | "trophy2" | null;
  notes: string | null;
  last_synced_at: string | null;
  /** Calculados a partir de los trofeos. */
  platinum_at?: string | null;
  psn_platinum_at?: string | null;
  trophy_count: number;
  earned_count: number;
}

export interface Trophy {
  id: string;
  psn_trophy_id: number | null;
  group_id: string | null;
  name: string;
  detail: string | null;
  type: TrophyType;
  hidden: boolean;
  icon_url: string | null;
  earned_at: string | null;
  earned_rate: number | null;
  phase_id: string | null;
  missable: boolean;
  note: string | null;
  position: number;
}

const GAME_COLUMNS = `g.id, g.title, g.platform, g.status, g.cover, g.np_communication_id, g.np_service_name,
  g.notes, g.last_synced_at,g.platinum_at,
  (SELECT MAX(t.earned_at) FROM trophy t WHERE t.game_id=g.id AND t.type='platinum' AND t.earned_at IS NOT NULL) AS psn_platinum_at,
  (SELECT COUNT(*) FROM trophy t WHERE t.game_id = g.id) AS trophy_count,
  (SELECT COUNT(*) FROM trophy t WHERE t.game_id = g.id AND t.earned_at IS NOT NULL) AS earned_count`;

export async function listGames(): Promise<Game[]> {
  const db = await getDb();
  return db.select<Game[]>(
    `SELECT ${GAME_COLUMNS} FROM game g WHERE g.workspace_id = $1
      ORDER BY g.status = 'playing' DESC, g.updated_at DESC`,
    [WORKSPACE_ID],
  );
}

export async function createGame(title: string, platform: GamePlatform): Promise<string> {
  const db = await getDb();
  const id = newId();
  await db.execute("INSERT INTO game (id, workspace_id, title, platform) VALUES ($1, $2, $3, $4)", [
    id,
    WORKSPACE_ID,
    title.trim(),
    platform,
  ]);
  return id;
}

/** Crea o actualiza un juego importado de PSN; devuelve su id. */
export async function upsertPsnGame(input: {
  title: string;
  platform: GamePlatform;
  np_communication_id: string;
  np_service_name: "trophy" | "trophy2";
  cover: string | null;
}): Promise<string> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO game (id, workspace_id, title, platform, np_communication_id, np_service_name, cover)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (np_communication_id) DO UPDATE SET
       title = excluded.title, np_service_name = excluded.np_service_name,
       cover = COALESCE(excluded.cover, game.cover), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    [newId(), WORKSPACE_ID, input.title, input.platform, input.np_communication_id, input.np_service_name, input.cover],
  );
  const [row] = await db.select<{ id: string }[]>(
    "SELECT id FROM game WHERE np_communication_id = $1 AND workspace_id = $2",
    [input.np_communication_id, WORKSPACE_ID],
  );
  return row.id;
}

export async function updateGameStatus(id: string, status: GameStatus): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE game SET status = $1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = $2 AND workspace_id = $3`,
    [status, id, WORKSPACE_ID],
  );
}

/** Borra el juego y, en cascada, sus trofeos, fases y objetivos. */
export async function deleteGame(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM game WHERE id = $1 AND workspace_id = $2", [id, WORKSPACE_ID]);
}

export async function listTrophies(gameId: string): Promise<Trophy[]> {
  const db = await getDb();
  const rows = await db.select<(Omit<Trophy, "hidden" | "missable"> & { hidden: 0 | 1; missable: 0 | 1 })[]>(
    `SELECT id, psn_trophy_id, group_id, name, detail, type, hidden, icon_url, earned_at, earned_rate,
            phase_id, missable, note, position
       FROM trophy WHERE game_id = $1 AND workspace_id = $2 ORDER BY position`,
    [gameId, WORKSPACE_ID],
  );
  return rows.map((r) => ({ ...r, hidden: r.hidden === 1, missable: r.missable === 1 }));
}

/**
 * Guarda los trofeos que vienen de PSN. Actualiza nombre, tipo, icono, estado y rareza,
 * pero conserva los datos propios del usuario (fase, perdible y nota).
 */
export async function upsertPsnTrophies(gameId: string, trophies: PsnTrophy[]): Promise<void> {
  const db = await getDb();
  for (const [i, t] of trophies.entries()) {
    await db.execute(
      `INSERT INTO trophy (id, workspace_id, game_id, psn_trophy_id, group_id, name, detail, type, hidden,
                           icon_url, earned_at, earned_rate, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (game_id, psn_trophy_id) DO UPDATE SET
         group_id = excluded.group_id, name = excluded.name, detail = excluded.detail, type = excluded.type,
         hidden = excluded.hidden, icon_url = excluded.icon_url, earned_at = excluded.earned_at,
         earned_rate = excluded.earned_rate, position = excluded.position,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
      [
        newId(),
        WORKSPACE_ID,
        gameId,
        t.psn_trophy_id,
        t.group_id,
        t.name,
        t.detail,
        t.trophy_type,
        t.hidden ? 1 : 0,
        t.icon_url,
        t.earned_at,
        t.earned_rate,
        i,
      ],
    );
  }
  await db.execute(
    `UPDATE game SET last_synced_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = $1 AND workspace_id = $2`,
    [gameId, WORKSPACE_ID],
  );
}

/** "PS5", "PS4", "PS5,PS4"… → plataforma de la app (PS5 si aparece). */
export function platformFromPsn(platform: string): GamePlatform {
  return platform.toUpperCase().includes("PS5") ? "ps5" : "ps4";
}

export interface TrophyPhase {
  id: string;
  name: string;
  position: number;
  note: string | null;
}

export async function listPhases(gameId: string): Promise<TrophyPhase[]> {
  const db = await getDb();
  return db.select<TrophyPhase[]>(
    "SELECT id, name, position, note FROM trophy_phase WHERE game_id = $1 AND workspace_id = $2 ORDER BY position",
    [gameId, WORKSPACE_ID],
  );
}

/** Añade una fase al final de la ruta. */
export async function createPhase(gameId: string, name: string, note: string | null = null): Promise<string> {
  const db = await getDb();
  const [{ next }] = await db.select<{ next: number }[]>(
    "SELECT COALESCE(MAX(position), -1) + 1 AS next FROM trophy_phase WHERE game_id = $1",
    [gameId],
  );
  const id = newId();
  await db.execute(
    "INSERT INTO trophy_phase (id, workspace_id, game_id, name, position, note) VALUES ($1, $2, $3, $4, $5, $6)",
    [id, WORKSPACE_ID, gameId, name.trim(), next, note],
  );
  return id;
}

export async function updatePhase(id: string, name: string, note: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE trophy_phase SET name = $1, note = $2, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = $3 AND workspace_id = $4`,
    [name.trim(), note.trim() || null, id, WORKSPACE_ID],
  );
}

/** Intercambia la posición de dos fases en una sola sentencia. */
export async function swapPhases(a: TrophyPhase, b: TrophyPhase): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE trophy_phase SET position = CASE id WHEN $1 THEN $2 WHEN $3 THEN $4 END
      WHERE id IN ($1, $3) AND workspace_id = $5`,
    [a.id, b.position, b.id, a.position, WORKSPACE_ID],
  );
}

/** Borra la fase; sus trofeos quedan sin fase (ON DELETE SET NULL). */
export async function deletePhase(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM trophy_phase WHERE id = $1 AND workspace_id = $2", [id, WORKSPACE_ID]);
}

/** Datos propios del usuario sobre un trofeo (la sincronización con PSN no los toca). */
export async function updateTrophyPlan(
  id: string,
  plan: { phase_id: string | null; missable: boolean; note: string | null },
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE trophy SET phase_id = $1, missable = $2, note = $3, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = $4 AND workspace_id = $5`,
    [plan.phase_id, plan.missable ? 1 : 0, plan.note?.trim() || null, id, WORKSPACE_ID],
  );
}
