import { getDb, newId, WORKSPACE_ID } from "./database";

export interface PlaySession {
  id: string;
  played_on: string;
  note: string | null;
  objectives: SessionObjective[];
}

export interface SessionObjective {
  id: string;
  title: string;
  trophy_id: string | null;
  guide_entry_id: string | null;
  done: boolean;
  position: number;
}

export interface ObjectiveInput {
  title: string;
  trophy_id: string | null;
  guide_entry_id: string | null;
}

/** Partidas del juego, de la más reciente a la más antigua, con sus objetivos. */
export async function listSessions(gameId: string): Promise<PlaySession[]> {
  const db = await getDb();
  const [sessions, objectives] = await Promise.all([
    db.select<Omit<PlaySession, "objectives">[]>(
      "SELECT id, played_on, note FROM play_session WHERE game_id = $1 AND workspace_id = $2 ORDER BY played_on DESC",
      [gameId, WORKSPACE_ID],
    ),
    db.select<(Omit<SessionObjective, "done"> & { session_id: string; done: 0 | 1 })[]>(
      `SELECT o.id, o.session_id, o.title, o.trophy_id, o.guide_entry_id, o.done, o.position
         FROM session_objective o JOIN play_session s ON s.id = o.session_id
        WHERE s.game_id = $1 AND o.workspace_id = $2 ORDER BY o.position`,
      [gameId, WORKSPACE_ID],
    ),
  ]);
  return sessions.map((s) => ({
    ...s,
    objectives: objectives
      .filter((o) => o.session_id === s.id)
      .map(({ session_id: _, ...o }) => ({ ...o, done: o.done === 1 })),
  }));
}

/** Crea la partida de un día con sus objetivos iniciales; devuelve su id. */
export async function createSession(gameId: string, playedOn: string, objectives: ObjectiveInput[]): Promise<string> {
  const db = await getDb();
  const id = newId();
  await db.execute("INSERT INTO play_session (id, workspace_id, game_id, played_on) VALUES ($1, $2, $3, $4)", [
    id,
    WORKSPACE_ID,
    gameId,
    playedOn,
  ]);
  for (const o of objectives) await addObjective(id, o);
  return id;
}

export async function addObjective(sessionId: string, o: ObjectiveInput): Promise<void> {
  const db = await getDb();
  const [{ next }] = await db.select<{ next: number }[]>(
    "SELECT COALESCE(MAX(position), -1) + 1 AS next FROM session_objective WHERE session_id = $1",
    [sessionId],
  );
  await db.execute(
    `INSERT INTO session_objective (id, workspace_id, session_id, title, trophy_id, guide_entry_id, position)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [newId(), WORKSPACE_ID, sessionId, o.title.trim(), o.trophy_id, o.guide_entry_id, next],
  );
}

export async function setObjectiveDone(id: string, done: boolean): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE session_objective SET done = $1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = $2 AND workspace_id = $3`,
    [done ? 1 : 0, id, WORKSPACE_ID],
  );
}

export async function deleteObjective(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM session_objective WHERE id = $1 AND workspace_id = $2", [id, WORKSPACE_ID]);
}

/** Borra la partida (y sus objetivos) para volver a planearla. */
export async function deleteSession(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM play_session WHERE id = $1 AND workspace_id = $2", [id, WORKSPACE_ID]);
}

export async function updateSessionNote(id: string, note: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE play_session SET note = $1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = $2 AND workspace_id = $3`,
    [note.trim() || null, id, WORKSPACE_ID],
  );
}
