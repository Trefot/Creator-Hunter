import { getDb, newId, WORKSPACE_ID } from "./database";

export const PLATFORMS = ["youtube", "twitch", "tiktok", "instagram", "facebook"] as const;
export type Platform = (typeof PLATFORMS)[number];

export interface Profile {
  id: string;
  platform: Platform;
  handle: string;
  display_name: string | null;
  url: string | null;
  is_monetized: boolean;
  created_at: string;
}

interface ProfileRow extends Omit<Profile, "is_monetized"> {
  is_monetized: 0 | 1;
}

export async function listProfiles(): Promise<Profile[]> {
  const db = await getDb();
  const rows = await db.select<ProfileRow[]>(
    `SELECT id, platform, handle, display_name, url, is_monetized, created_at
       FROM profile WHERE workspace_id = $1 ORDER BY platform, handle`,
    [WORKSPACE_ID],
  );
  return rows.map((r) => ({ ...r, is_monetized: r.is_monetized === 1 }));
}

export async function createProfile(platform: Platform, handle: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT INTO profile (id, workspace_id, platform, handle) VALUES ($1, $2, $3, $4)",
    [newId(), WORKSPACE_ID, platform, handle.trim()],
  );
}

export async function deleteProfile(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM profile WHERE id = $1 AND workspace_id = $2", [id, WORKSPACE_ID]);
}
