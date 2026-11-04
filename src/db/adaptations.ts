import { getDb, newId, WORKSPACE_ID } from "./database";

export const FORMATS = ["long_video", "short", "tiktok", "reel", "post", "live"] as const;
export type Format = (typeof FORMATS)[number];

/** Pasos de producción, en orden. Idea y Aprobación viven en la idea. */
export const STEPS = ["script", "recording", "editing", "scheduling", "publishing", "analysis"] as const;
export type Step = (typeof STEPS)[number];

/** Pasos desactivados por defecto según el formato; el usuario puede cambiarlos. */
export const DEFAULT_DISABLED_STEPS: Record<Format, Step[]> = {
  long_video: [],
  short: ["script"],
  tiktok: ["script"],
  reel: ["script"],
  post: ["script", "recording"],
  live: ["editing"],
};

export interface AdaptationStep {
  id: string;
  step: Step;
  enabled: boolean;
  completed_at: string | null;
}

export interface Adaptation {
  id: string;
  project_id: string;
  profile_id: string;
  format: Format;
  title: string;
  /** Fecha y hora local sin zona, 'AAAA-MM-DDTHH:MM' (ver D-009). */
  scheduled_at: string | null;
  published_at: string | null;
  published_url: string | null;
  /** Siempre en el orden de STEPS. */
  steps: AdaptationStep[];
}

export interface AdaptationInput {
  profile_id: string;
  format: Format;
  title: string;
  scheduled_at: string | null;
}

interface StepRow {
  id: string;
  adaptation_id: string;
  step: Step;
  enabled: 0 | 1;
  completed_at: string | null;
}

export async function listAdaptations(projectId: string): Promise<Adaptation[]> {
  const db = await getDb();
  const [rows, stepRows] = await Promise.all([
    db.select<Omit<Adaptation, "steps">[]>(
      `SELECT id, project_id, profile_id, format, title, scheduled_at, published_at, published_url
         FROM adaptation WHERE project_id = $1 AND workspace_id = $2
        ORDER BY scheduled_at IS NULL, scheduled_at, created_at`,
      [projectId, WORKSPACE_ID],
    ),
    db.select<StepRow[]>(
      `SELECT s.id, s.adaptation_id, s.step, s.enabled, s.completed_at
         FROM adaptation_step s JOIN adaptation a ON a.id = s.adaptation_id
        WHERE a.project_id = $1 AND s.workspace_id = $2`,
      [projectId, WORKSPACE_ID],
    ),
  ]);

  return rows.map((a) => ({
    ...a,
    steps: STEPS.flatMap((step) => {
      const row = stepRows.find((s) => s.adaptation_id === a.id && s.step === step);
      return row ? [{ id: row.id, step, enabled: row.enabled === 1, completed_at: row.completed_at }] : [];
    }),
  }));
}

/** Crea la adaptación y sus seis pasos (activos o no según `disabled`). */
export async function createAdaptation(projectId: string, input: AdaptationInput, disabled: Step[]): Promise<void> {
  const db = await getDb();
  const id = newId();
  await db.execute(
    `INSERT INTO adaptation (id, workspace_id, project_id, profile_id, format, title, scheduled_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, WORKSPACE_ID, projectId, input.profile_id, input.format, input.title.trim(), input.scheduled_at],
  );

  // Todos los pasos en una sola sentencia: o se crean todos o ninguno.
  const values: unknown[] = [];
  const placeholders = STEPS.map((step, i) => {
    values.push(newId(), WORKSPACE_ID, id, step, disabled.includes(step) ? 0 : 1);
    const b = i * 5;
    return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5})`;
  });
  await db.execute(
    `INSERT INTO adaptation_step (id, workspace_id, adaptation_id, step, enabled) VALUES ${placeholders.join(", ")}`,
    values,
  );
}

export async function updateAdaptation(id: string, input: AdaptationInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE adaptation
        SET profile_id = $1, format = $2, title = $3, scheduled_at = $4,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = $5 AND workspace_id = $6`,
    [input.profile_id, input.format, input.title.trim(), input.scheduled_at, id, WORKSPACE_ID],
  );
}

export async function deleteAdaptation(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM adaptation WHERE id = $1 AND workspace_id = $2", [id, WORKSPACE_ID]);
}

/** Marca un paso como hecho (fecha actual) o pendiente. */
export async function setStepDone(stepId: string, done: boolean): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE adaptation_step
        SET completed_at = CASE WHEN $1 THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now') END,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = $2 AND workspace_id = $3`,
    [done ? 1 : 0, stepId, WORKSPACE_ID],
  );
}

/** Activa o desactiva un paso para esta adaptación. */
export async function setStepEnabled(stepId: string, enabled: boolean): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE adaptation_step SET enabled = $1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = $2 AND workspace_id = $3`,
    [enabled ? 1 : 0, stepId, WORKSPACE_ID],
  );
}
