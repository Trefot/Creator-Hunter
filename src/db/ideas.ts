import { getDb, newId, WORKSPACE_ID } from "./database";

export const IDEA_STATUSES = ["new", "approved", "discarded"] as const;
export type IdeaStatus = (typeof IDEA_STATUSES)[number];

export interface Idea {
  id: string;
  title: string;
  description: string | null;
  /** Etiquetas separadas por comas, por ejemplo "minecraft, tutorial". */
  tags: string | null;
  status: IdeaStatus;
  created_at: string;
}

export interface IdeaInput {
  title: string;
  description: string;
  tags: string;
}

/** Normaliza etiquetas: minúsculas, sin espacios sobrantes ni repetidas. Vacío = NULL. */
function normalizeTags(tags: string): string | null {
  const list = [...new Set(tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))];
  return list.length ? list.join(", ") : null;
}

export function splitTags(tags: string | null): string[] {
  return tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [];
}

export async function listIdeas(): Promise<Idea[]> {
  const db = await getDb();
  return db.select<Idea[]>(
    `SELECT id, title, description, tags, status, created_at
       FROM idea WHERE workspace_id = $1 ORDER BY created_at DESC`,
    [WORKSPACE_ID],
  );
}

export async function createIdea(input: IdeaInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT INTO idea (id, workspace_id, title, description, tags) VALUES ($1, $2, $3, $4, $5)",
    [newId(), WORKSPACE_ID, input.title.trim(), input.description.trim() || null, normalizeTags(input.tags)],
  );
}

export async function updateIdea(id: string, input: IdeaInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE idea SET title = $1, description = $2, tags = $3, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = $4 AND workspace_id = $5`,
    [input.title.trim(), input.description.trim() || null, normalizeTags(input.tags), id, WORKSPACE_ID],
  );
}

/** Descartar o recuperar una idea. La aprobación va por approveIdea, porque crea el proyecto. */
export async function setIdeaStatus(id: string, status: "new" | "discarded"): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE idea SET status = $1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = $2 AND workspace_id = $3 AND status != 'approved'`,
    [status, id, WORKSPACE_ID],
  );
}

/**
 * Aprueba una idea y crea su proyecto enlazado. Ambos pasos son idempotentes:
 * si se interrumpe a medias, repetir la aprobación lo completa sin duplicar el proyecto
 * (project.idea_id es UNIQUE).
 */
export async function approveIdea(id: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT OR IGNORE INTO project (id, workspace_id, idea_id, title, summary, game_id)
     SELECT $1, workspace_id, id, title, description, game_id FROM idea WHERE id = $2 AND workspace_id = $3`,
    [newId(), id, WORKSPACE_ID],
  );
  await db.execute(
    `UPDATE idea SET status = 'approved', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = $1 AND workspace_id = $2`,
    [id, WORKSPACE_ID],
  );
}

export async function deleteIdea(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM idea WHERE id = $1 AND workspace_id = $2", [id, WORKSPACE_ID]);
}
