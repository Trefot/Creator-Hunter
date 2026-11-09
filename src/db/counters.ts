import { getDb, newId, WORKSPACE_ID } from "./database";

export interface Counter {
  id: string;
  name: string;
  icon: string;
  color: string;
  value: number;
  step: number;
  game_id: string | null;
}

export type CounterInput = Pick<Counter, "name" | "icon" | "color" | "step" | "game_id">;

export async function listCounters(): Promise<Counter[]> {
  const db = await getDb();
  return db.select<Counter[]>(
    "SELECT id, name, icon, color, value, step, game_id FROM counter WHERE workspace_id = $1 ORDER BY position, created_at",
    [WORKSPACE_ID],
  );
}

export async function createCounter(input: CounterInput): Promise<void> {
  const db = await getDb();
  const [{ next }] = await db.select<{ next: number }[]>(
    "SELECT COALESCE(MAX(position), -1) + 1 AS next FROM counter WHERE workspace_id = $1",
    [WORKSPACE_ID],
  );
  await db.execute(
    "INSERT INTO counter (id, workspace_id, name, icon, color, step, game_id, position) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    [newId(), WORKSPACE_ID, input.name.trim(), input.icon, input.color, input.step, input.game_id, next],
  );
}

export async function updateCounter(id: string, input: CounterInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE counter SET name = $1, icon = $2, color = $3, step = $4, game_id = $5,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = $6 AND workspace_id = $7`,
    [input.name.trim(), input.icon, input.color, input.step, input.game_id, id, WORKSPACE_ID],
  );
}

/** Suma (o resta, con signo negativo) `times` veces el paso del contador; nunca baja de 0. */
export async function bumpCounter(id: string, times: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE counter SET value = MAX(value + step * $1, 0), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = $2 AND workspace_id = $3`,
    [times, id, WORKSPACE_ID],
  );
}

export async function setCounterValue(id: string, value: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE counter SET value = $1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = $2 AND workspace_id = $3`,
    [Math.max(0, Math.floor(value)), id, WORKSPACE_ID],
  );
}

export async function deleteCounter(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM counter WHERE id = $1 AND workspace_id = $2", [id, WORKSPACE_ID]);
}
