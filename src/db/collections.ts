import { getDb, newId, WORKSPACE_ID } from "./database";

/** Claves de los puntos de lista (incluidos en la app) que el usuario ya marcó en este juego. */
export async function listCollected(gameId: string): Promise<Set<string>> {
  const db = await getDb();
  const rows = await db.select<{ item_key: string }[]>(
    "SELECT item_key FROM collection_item WHERE game_id = $1 AND workspace_id = $2",
    [gameId, WORKSPACE_ID],
  );
  return new Set(rows.map((r) => r.item_key));
}

/** Marca o desmarca un punto de lista como conseguido. */
export async function setCollected(gameId: string, itemKey: string, has: boolean): Promise<void> {
  const db = await getDb();
  if (has) {
    await db.execute(
      `INSERT INTO collection_item (id, workspace_id, game_id, item_key) VALUES ($1, $2, $3, $4)
       ON CONFLICT (game_id, item_key) DO NOTHING`,
      [newId(), WORKSPACE_ID, gameId, itemKey],
    );
  } else {
    await db.execute("DELETE FROM collection_item WHERE game_id = $1 AND item_key = $2 AND workspace_id = $3", [
      gameId,
      itemKey,
      WORKSPACE_ID,
    ]);
  }
}

/** Punto que el usuario añadió a mano a la lista de un trofeo. */
export interface TrophyTask {
  id: string;
  trophy_id: string;
  title: string;
  done: boolean;
}

export async function listTasks(gameId: string): Promise<TrophyTask[]> {
  const db = await getDb();
  const rows = await db.select<(Omit<TrophyTask, "done"> & { done: 0 | 1 })[]>(
    "SELECT id, trophy_id, title, done FROM trophy_task WHERE game_id = $1 AND workspace_id = $2 ORDER BY position, created_at",
    [gameId, WORKSPACE_ID],
  );
  return rows.map((r) => ({ ...r, done: r.done === 1 }));
}

export async function addTask(gameId: string, trophyId: string, title: string): Promise<void> {
  const db = await getDb();
  const [{ next }] = await db.select<{ next: number }[]>(
    "SELECT COALESCE(MAX(position), -1) + 1 AS next FROM trophy_task WHERE trophy_id = $1",
    [trophyId],
  );
  await db.execute(
    "INSERT INTO trophy_task (id, workspace_id, game_id, trophy_id, title, position) VALUES ($1, $2, $3, $4, $5, $6)",
    [newId(), WORKSPACE_ID, gameId, trophyId, title.trim(), next],
  );
}

export async function setTaskDone(id: string, done: boolean): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE trophy_task SET done = $1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = $2 AND workspace_id = $3`,
    [done ? 1 : 0, id, WORKSPACE_ID],
  );
}

export async function deleteTask(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM trophy_task WHERE id = $1 AND workspace_id = $2", [id, WORKSPACE_ID]);
}
