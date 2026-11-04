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
  /** Foto como data URL JPEG reducida (D-013). */
  avatar: string | null;
  /** Umbral de pago de la plataforma en centavos USD (D-014). */
  payout_threshold_minor: number | null;
  /** Fecha local 'AAAA-MM-DD' del último cobro; el saldo pendiente cuenta desde aquí (D-014). */
  last_payout_on: string | null;
  created_at: string;
}

/** Campos que el usuario puede editar. */
export interface ProfileInput {
  platform: Platform;
  handle: string;
  display_name: string;
  url: string;
  is_monetized: boolean;
  payout_threshold_minor: number | null;
}

interface ProfileRow extends Omit<Profile, "is_monetized"> {
  is_monetized: 0 | 1;
}

/** Un texto vacío se guarda como NULL. */
function optional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export async function listProfiles(): Promise<Profile[]> {
  const db = await getDb();
  const rows = await db.select<ProfileRow[]>(
    `SELECT id, platform, handle, display_name, url, is_monetized, avatar, payout_threshold_minor, last_payout_on, created_at
       FROM profile WHERE workspace_id = $1 ORDER BY platform, handle`,
    [WORKSPACE_ID],
  );
  return rows.map((r) => ({ ...r, is_monetized: r.is_monetized === 1 }));
}

export async function createProfile(input: ProfileInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO profile (id, workspace_id, platform, handle, display_name, url, is_monetized, payout_threshold_minor)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      newId(),
      WORKSPACE_ID,
      input.platform,
      input.handle.trim(),
      optional(input.display_name),
      optional(input.url),
      input.is_monetized ? 1 : 0,
      input.payout_threshold_minor,
    ],
  );
}

export async function updateProfile(id: string, input: ProfileInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE profile
        SET platform = $1, handle = $2, display_name = $3, url = $4, is_monetized = $5,
            payout_threshold_minor = $6, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = $7 AND workspace_id = $8`,
    [
      input.platform,
      input.handle.trim(),
      optional(input.display_name),
      optional(input.url),
      input.is_monetized ? 1 : 0,
      input.payout_threshold_minor,
      id,
      WORKSPACE_ID,
    ],
  );
}

export async function setProfileAvatar(id: string, avatar: string | null): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE profile SET avatar = $1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = $2 AND workspace_id = $3`,
    [avatar, id, WORKSPACE_ID],
  );
}

/** Marca la red como cobrada en la fecha dada: el saldo pendiente vuelve a cero. */
export async function markPaid(id: string, date: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE profile SET last_payout_on = $1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = $2 AND workspace_id = $3`,
    [date, id, WORKSPACE_ID],
  );
}

export async function deleteProfile(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM profile WHERE id = $1 AND workspace_id = $2", [id, WORKSPACE_ID]);
}
