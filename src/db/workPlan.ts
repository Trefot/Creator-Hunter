import { getDb, newId, WORKSPACE_ID } from "./database";
import { Adaptation, setStepDone } from "./adaptations";
import { PlannedKind, routineFrom, stepToComplete, WorkKind } from "../features/habit/plan";

export interface WorkSession {
  id: string;
  day: string;
  kind: PlannedKind;
  project_id: string;
  project_title: string;
  adaptation_id: string | null;
  adaptation_title: string | null;
  done_at: string | null;
}

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";

export async function getRoutine(): Promise<WorkKind[]> {
  const db = await getDb();
  const rows = await db.select<{ weekday: number; kind: string }[]>(
    "SELECT weekday, kind FROM work_routine WHERE workspace_id = $1",
    [WORKSPACE_ID],
  );
  return routineFrom(rows);
}

export async function setRoutineDay(weekday: number, kind: WorkKind): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO work_routine (workspace_id, weekday, kind) VALUES ($1, $2, $3)
     ON CONFLICT (workspace_id, weekday) DO UPDATE SET kind = excluded.kind, updated_at = ${NOW}`,
    [WORKSPACE_ID, weekday, kind],
  );
}

/** Sesiones con día entre `from` y `to` (incluidos), fechas locales 'AAAA-MM-DD'. */
export async function listSessions(from: string, to: string): Promise<WorkSession[]> {
  const db = await getDb();
  return db.select<WorkSession[]>(
    `SELECT s.id, s.day, s.kind, s.project_id, p.title AS project_title,
            s.adaptation_id, a.title AS adaptation_title, s.done_at
       FROM work_session s
       JOIN project p ON p.id = s.project_id
       LEFT JOIN adaptation a ON a.id = s.adaptation_id
      WHERE s.workspace_id = $1 AND s.day >= $2 AND s.day <= $3
      ORDER BY s.day, s.created_at`,
    [WORKSPACE_ID, from, to],
  );
}

export async function planSession(day: string, kind: PlannedKind, projectId: string, adaptationId: string | null): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO work_session (id, workspace_id, day, kind, project_id, adaptation_id) VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (workspace_id, day, project_id) DO NOTHING`,
    [newId(), WORKSPACE_ID, day, kind, projectId, adaptationId],
  );
}

export async function removeSession(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM work_session WHERE id = $1 AND workspace_id = $2", [id, WORKSPACE_ID]);
}

/** Marca la sesión como hecha y, si tiene versión, completa su paso (grabación, edición o programación). */
export async function completeSession(session: WorkSession, version: Adaptation | undefined): Promise<void> {
  const step = version?.steps.find((s) => s.step === stepToComplete(session.kind));
  if (step && step.enabled && !step.completed_at) await setStepDone(step.id, true);
  const db = await getDb();
  await db.execute(`UPDATE work_session SET done_at = ${NOW}, updated_at = ${NOW} WHERE id = $1 AND workspace_id = $2`, [
    session.id,
    WORKSPACE_ID,
  ]);
}

/** Deshace solo la marca de la sesión; el paso del proyecto se cambia desde el propio proyecto. */
export async function reopenSession(id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE work_session SET done_at = NULL, updated_at = ${NOW} WHERE id = $1 AND workspace_id = $2`, [
    id,
    WORKSPACE_ID,
  ]);
}
