import { getDb, WORKSPACE_ID } from "./database";

export interface Project {
  id: string;
  idea_id: string | null;
  title: string;
  summary: string | null;
  created_at: string;
  /** Calculado: número de adaptaciones del proyecto. */
  adaptation_count: number;
}

export interface ProjectInput {
  title: string;
  summary: string;
}

export async function listProjects(): Promise<Project[]> {
  const db = await getDb();
  return db.select<Project[]>(
    `SELECT p.id, p.idea_id, p.title, p.summary, p.created_at,
            (SELECT COUNT(*) FROM adaptation a WHERE a.project_id = p.id) AS adaptation_count
       FROM project p WHERE p.workspace_id = $1 ORDER BY p.created_at DESC`,
    [WORKSPACE_ID],
  );
}

export async function updateProject(id: string, input: ProjectInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE project SET title = $1, summary = $2, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = $3 AND workspace_id = $4`,
    [input.title.trim(), input.summary.trim() || null, id, WORKSPACE_ID],
  );
}

/** Borra el proyecto y, en cascada, sus adaptaciones, pasos, guiones y resultados. */
export async function deleteProject(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM project WHERE id = $1 AND workspace_id = $2", [id, WORKSPACE_ID]);
}
