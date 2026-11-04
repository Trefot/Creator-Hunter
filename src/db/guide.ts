import { getDb, newId, WORKSPACE_ID } from "./database";

export const GUIDE_KINDS = ["boss", "build", "route", "farm", "tip"] as const;
export type GuideKind = (typeof GUIDE_KINDS)[number];

export interface GuideEntry {
  id: string;
  kind: GuideKind;
  title: string;
  phase_id: string | null;
  summary: string | null;
  body: string | null;
  /** Captura como data URL reducida (D-013). */
  image: string | null;
  video_url: string | null;
  source_url: string | null;
  /** false = "por verificar" (borrador aún no comprobado). */
  verified: boolean;
  position: number;
  /** Trofeos enlazados (ids de la tabla trophy). */
  trophy_ids: string[];
}

export type GuideEntryInput = Omit<GuideEntry, "id" | "position">;

export async function listGuide(gameId: string): Promise<GuideEntry[]> {
  const db = await getDb();
  const [rows, links] = await Promise.all([
    db.select<(Omit<GuideEntry, "verified" | "trophy_ids"> & { verified: 0 | 1 })[]>(
      `SELECT id, kind, title, phase_id, summary, body, image, video_url, source_url, verified, position
         FROM guide_entry WHERE game_id = $1 AND workspace_id = $2 ORDER BY position, created_at`,
      [gameId, WORKSPACE_ID],
    ),
    db.select<{ entry_id: string; trophy_id: string }[]>(
      `SELECT l.entry_id, l.trophy_id FROM guide_entry_trophy l JOIN guide_entry e ON e.id = l.entry_id
        WHERE e.game_id = $1 AND l.workspace_id = $2`,
      [gameId, WORKSPACE_ID],
    ),
  ]);
  return rows.map((r) => ({
    ...r,
    verified: r.verified === 1,
    trophy_ids: links.filter((l) => l.entry_id === r.id).map((l) => l.trophy_id),
  }));
}

async function setLinks(entryId: string, trophyIds: string[]): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM guide_entry_trophy WHERE entry_id = $1 AND workspace_id = $2", [entryId, WORKSPACE_ID]);
  for (const trophyId of trophyIds) {
    await db.execute("INSERT INTO guide_entry_trophy (entry_id, trophy_id, workspace_id) VALUES ($1, $2, $3)", [
      entryId,
      trophyId,
      WORKSPACE_ID,
    ]);
  }
}

const clean = (v: string | null) => (v && v.trim() ? v.trim() : null);

export async function createGuideEntry(gameId: string, input: GuideEntryInput): Promise<string> {
  const db = await getDb();
  const [{ next }] = await db.select<{ next: number }[]>(
    "SELECT COALESCE(MAX(position), -1) + 1 AS next FROM guide_entry WHERE game_id = $1",
    [gameId],
  );
  const id = newId();
  await db.execute(
    `INSERT INTO guide_entry (id, workspace_id, game_id, kind, title, phase_id, summary, body, image, video_url, source_url, verified, position)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      id,
      WORKSPACE_ID,
      gameId,
      input.kind,
      input.title.trim(),
      input.phase_id,
      clean(input.summary),
      clean(input.body),
      input.image,
      clean(input.video_url),
      clean(input.source_url),
      input.verified ? 1 : 0,
      next,
    ],
  );
  await setLinks(id, input.trophy_ids);
  return id;
}

export async function updateGuideEntry(id: string, input: GuideEntryInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE guide_entry SET kind = $1, title = $2, phase_id = $3, summary = $4, body = $5, image = $6,
            video_url = $7, source_url = $8, verified = $9, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = $10 AND workspace_id = $11`,
    [
      input.kind,
      input.title.trim(),
      input.phase_id,
      clean(input.summary),
      clean(input.body),
      input.image,
      clean(input.video_url),
      clean(input.source_url),
      input.verified ? 1 : 0,
      id,
      WORKSPACE_ID,
    ],
  );
  await setLinks(id, input.trophy_ids);
}

export async function deleteGuideEntry(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM guide_entry WHERE id = $1 AND workspace_id = $2", [id, WORKSPACE_ID]);
}
