import { getDb, newId, WORKSPACE_ID } from "./database";

/** Campos numéricos de un resultado; los de directo solo se usan con format = 'live'. */
export const RESULT_FIELDS = ["views", "likes", "comments", "shares", "watch_hours"] as const;
export const LIVE_FIELDS = ["avg_viewers", "peak_viewers", "duration_min"] as const;
export type ResultField = (typeof RESULT_FIELDS)[number] | (typeof LIVE_FIELDS)[number];

/** Registro fechado de los resultados de una publicación; nunca se sobrescribe. */
export type ResultSnapshot = {
  id: string;
  adaptation_id: string;
  recorded_on: string;
  /** 'manual' o 'api' (sincronizado desde YouTube; migración 006). */
  source: "manual" | "api";
} & Record<ResultField, number | null>;

export type ResultInput = { recorded_on: string } & Record<ResultField, number | null>;

const FIELDS: ResultField[] = [...RESULT_FIELDS, ...LIVE_FIELDS];
const COLUMNS = `id, adaptation_id, recorded_on, source, ${FIELDS.join(", ")}`;

/** Historial de una adaptación, del más reciente al más antiguo. */
export async function listResults(adaptationId: string): Promise<ResultSnapshot[]> {
  const db = await getDb();
  return db.select<ResultSnapshot[]>(
    `SELECT ${COLUMNS} FROM result_snapshot
      WHERE adaptation_id = $1 AND workspace_id = $2
      ORDER BY recorded_on DESC, created_at DESC`,
    [adaptationId, WORKSPACE_ID],
  );
}

export async function createResult(adaptationId: string, input: ResultInput): Promise<void> {
  const db = await getDb();
  const placeholders = FIELDS.map((_, i) => `$${i + 5}`).join(", ");
  await db.execute(
    `INSERT INTO result_snapshot (id, workspace_id, adaptation_id, recorded_on, ${FIELDS.join(", ")})
     VALUES ($1, $2, $3, $4, ${placeholders})`,
    [newId(), WORKSPACE_ID, adaptationId, input.recorded_on, ...FIELDS.map((f) => input[f])],
  );
}

/** Resultado automático del día: como mucho uno por publicación y día; una nueva sincronización lo actualiza. */
export async function upsertApiResult(
  adaptationId: string,
  recordedOn: string,
  data: { views: number | null; likes: number | null; comments: number | null; shares: number | null; watch_hours: number | null },
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO result_snapshot (id, workspace_id, adaptation_id, recorded_on, views, likes, comments, shares, watch_hours, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'api')
     ON CONFLICT (adaptation_id, recorded_on) WHERE source = 'api' DO UPDATE SET
       views = excluded.views, likes = excluded.likes, comments = excluded.comments,
       shares = excluded.shares, watch_hours = excluded.watch_hours,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    [newId(), WORKSPACE_ID, adaptationId, recordedOn, data.views, data.likes, data.comments, data.shares, data.watch_hours],
  );
}

export async function deleteResult(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM result_snapshot WHERE id = $1 AND workspace_id = $2", [id, WORKSPACE_ID]);
}

/** Últimas vistas registradas de cada publicación, con su red y fecha de publicación (para las metas). */
export interface LatestViews {
  adaptation_id: string;
  profile_id: string;
  published_at: string | null;
  views: number;
}

export async function latestViews(): Promise<LatestViews[]> {
  const db = await getDb();
  return db.select<LatestViews[]>(
    `SELECT a.id AS adaptation_id, a.profile_id, a.published_at, r.views
       FROM adaptation a
       JOIN (SELECT adaptation_id, views, ROW_NUMBER() OVER (
               PARTITION BY adaptation_id ORDER BY recorded_on DESC, created_at DESC) AS rn
               FROM result_snapshot WHERE views IS NOT NULL AND workspace_id = $1) r
         ON r.adaptation_id = a.id AND r.rn = 1
      WHERE a.workspace_id = $1`,
    [WORKSPACE_ID],
  );
}
