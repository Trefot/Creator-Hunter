import { getDb, newId, WORKSPACE_ID } from "./database";

export const SECTION_KINDS = ["hook", "body", "closing", "cta", "note"] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

/** Plantilla inicial de un guion vacío. */
export const TEMPLATE: SectionKind[] = ["hook", "body", "closing", "cta"];

export interface ScriptSection {
  id: string;
  kind: SectionKind;
  position: number;
  content: string;
  est_seconds: number | null;
}

export interface ScriptSectionInput {
  kind: SectionKind;
  content: string;
  est_seconds: number | null;
}

export async function listSections(adaptationId: string): Promise<ScriptSection[]> {
  const db = await getDb();
  return db.select<ScriptSection[]>(
    `SELECT id, kind, position, content, est_seconds FROM script_section
      WHERE adaptation_id = $1 AND workspace_id = $2 ORDER BY position`,
    [adaptationId, WORKSPACE_ID],
  );
}

/** Añade secciones vacías al final del guion, en una sola sentencia. */
export async function addSections(adaptationId: string, kinds: SectionKind[]): Promise<void> {
  const db = await getDb();
  const [{ next }] = await db.select<{ next: number }[]>(
    "SELECT COALESCE(MAX(position), -1) + 1 AS next FROM script_section WHERE adaptation_id = $1",
    [adaptationId],
  );
  const values: unknown[] = [];
  const placeholders = kinds.map((kind, i) => {
    values.push(newId(), WORKSPACE_ID, adaptationId, kind, next + i);
    const b = i * 5;
    return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5})`;
  });
  await db.execute(
    `INSERT INTO script_section (id, workspace_id, adaptation_id, kind, position) VALUES ${placeholders.join(", ")}`,
    values,
  );
}

export async function updateSection(id: string, input: ScriptSectionInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE script_section SET kind = $1, content = $2, est_seconds = $3,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = $4 AND workspace_id = $5`,
    [input.kind, input.content, input.est_seconds, id, WORKSPACE_ID],
  );
}

/** Intercambia la posición de dos secciones en una sola sentencia. */
export async function swapSections(a: ScriptSection, b: ScriptSection): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE script_section
        SET position = CASE id WHEN $1 THEN $2 WHEN $3 THEN $4 END,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id IN ($1, $3) AND workspace_id = $5`,
    [a.id, b.position, b.id, a.position, WORKSPACE_ID],
  );
}

export async function deleteSection(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM script_section WHERE id = $1 AND workspace_id = $2", [id, WORKSPACE_ID]);
}
