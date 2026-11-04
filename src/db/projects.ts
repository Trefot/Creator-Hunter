import { getDb, WORKSPACE_ID } from "./database";

export interface Project {
  id: string;
  idea_id: string | null;
  title: string;
  summary: string | null;
  created_at: string;
}

export async function listProjects(): Promise<Project[]> {
  const db = await getDb();
  return db.select<Project[]>(
    `SELECT id, idea_id, title, summary, created_at
       FROM project WHERE workspace_id = $1 ORDER BY created_at DESC`,
    [WORKSPACE_ID],
  );
}
