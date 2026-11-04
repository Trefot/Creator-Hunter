import { getDb, newId, WORKSPACE_ID } from "./database";

/** Registro fechado de una cuenta: nunca se sobrescribe, se añade uno nuevo. */
export interface AccountSnapshot {
  id: string;
  profile_id: string;
  recorded_on: string;
  followers: number | null;
  watch_hours: number | null;
  /** Vistas totales del canal (solo en registros sincronizados). */
  total_views: number | null;
  /** 'manual' o 'api' (sincronizado; migración 006). */
  source: "manual" | "api";
}

export interface AccountSnapshotInput {
  recorded_on: string;
  followers: number | null;
  watch_hours: number | null;
}

const COLUMNS = "id, profile_id, recorded_on, followers, watch_hours, total_views, source";

/** Historial de un perfil, del más reciente al más antiguo. */
export async function listSnapshots(profileId: string): Promise<AccountSnapshot[]> {
  const db = await getDb();
  return db.select<AccountSnapshot[]>(
    `SELECT ${COLUMNS} FROM account_snapshot
      WHERE profile_id = $1 AND workspace_id = $2
      ORDER BY recorded_on DESC, created_at DESC`,
    [profileId, WORKSPACE_ID],
  );
}

/** Todos los registros, del más antiguo al más reciente (para las gráficas del dashboard). */
export async function listAllSnapshots(): Promise<AccountSnapshot[]> {
  const db = await getDb();
  return db.select<AccountSnapshot[]>(
    `SELECT ${COLUMNS} FROM account_snapshot WHERE workspace_id = $1 ORDER BY recorded_on, created_at`,
    [WORKSPACE_ID],
  );
}

/** Último registro de cada perfil, indexado por profile_id. */
export async function latestSnapshots(): Promise<Map<string, AccountSnapshot>> {
  const db = await getDb();
  const rows = await db.select<AccountSnapshot[]>(
    `SELECT ${COLUMNS} FROM (
       SELECT ${COLUMNS}, ROW_NUMBER() OVER (
         PARTITION BY profile_id ORDER BY recorded_on DESC, created_at DESC) AS rn
       FROM account_snapshot WHERE workspace_id = $1)
     WHERE rn = 1`,
    [WORKSPACE_ID],
  );
  return new Map(rows.map((r) => [r.profile_id, r]));
}

export async function createSnapshot(profileId: string, input: AccountSnapshotInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO account_snapshot (id, workspace_id, profile_id, recorded_on, followers, watch_hours)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [newId(), WORKSPACE_ID, profileId, input.recorded_on, input.followers, input.watch_hours],
  );
}

/** Registro automático del día: como mucho uno por perfil y día; una nueva sincronización lo actualiza. */
export async function upsertApiSnapshot(
  profileId: string,
  recordedOn: string,
  data: { followers: number | null; watch_hours: number | null; total_views: number | null },
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO account_snapshot (id, workspace_id, profile_id, recorded_on, followers, watch_hours, total_views, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'api')
     ON CONFLICT (profile_id, recorded_on) WHERE source = 'api' DO UPDATE SET
       followers = excluded.followers, watch_hours = excluded.watch_hours, total_views = excluded.total_views,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    [newId(), WORKSPACE_ID, profileId, recordedOn, data.followers, data.watch_hours, data.total_views],
  );
}

export async function deleteSnapshot(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM account_snapshot WHERE id = $1 AND workspace_id = $2", [id, WORKSPACE_ID]);
}
