import { getDb, newId, WORKSPACE_ID } from "./database";

export const GOAL_METRICS = ["followers", "watch_hours", "income", "views"] as const;
export type GoalMetric = (typeof GOAL_METRICS)[number];
export type GoalStatus = "active" | "achieved" | "abandoned";

export interface Goal {
  id: string;
  /** Sin perfil, la meta es global (suma de todas las redes). */
  profile_id: string | null;
  metric: GoalMetric;
  target_value: number;
  deadline: string | null;
  status: GoalStatus;
  created_at: string;
}

export interface GoalInput {
  profile_id: string | null;
  metric: GoalMetric;
  target_value: number;
  deadline: string | null;
}

export async function listGoals(): Promise<Goal[]> {
  const db = await getDb();
  return db.select<Goal[]>(
    `SELECT id, profile_id, metric, target_value, deadline, status, created_at
       FROM goal WHERE workspace_id = $1
      ORDER BY status = 'abandoned', deadline IS NULL, deadline, created_at`,
    [WORKSPACE_ID],
  );
}

export async function createGoal(input: GoalInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO goal (id, workspace_id, profile_id, metric, target_value, deadline)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [newId(), WORKSPACE_ID, input.profile_id, input.metric, input.target_value, input.deadline],
  );
}

export async function updateGoal(id: string, input: GoalInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE goal
        SET profile_id = $1, metric = $2, target_value = $3, deadline = $4,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = $5 AND workspace_id = $6`,
    [input.profile_id, input.metric, input.target_value, input.deadline, id, WORKSPACE_ID],
  );
}

export async function setGoalStatus(id: string, status: GoalStatus): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE goal SET status = $1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = $2 AND workspace_id = $3`,
    [status, id, WORKSPACE_ID],
  );
}

export async function deleteGoal(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM goal WHERE id = $1 AND workspace_id = $2", [id, WORKSPACE_ID]);
}
