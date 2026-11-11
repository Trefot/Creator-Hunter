import { getDb, newId, WORKSPACE_ID } from "./database";

export interface Counter {
  id: string;
  name: string;
  icon: string;
  color: string;
  value: number;
  step: number;
  game_id: string | null;
  /** PNG propio (data URL); si hay, sustituye al emoji. */
  image: string | null;
  bg_color: string;
  /** Opacidad del fondo en OBS: 0 transparente, 100 sólido. */
  bg_opacity: number;
  style: CounterStyle;
  /** Sonido propio (data URL); sin él suena el de por defecto. */
  sound: string | null;
  sound_on: boolean;
  sound_volume: number;
  /** Tamaño del icono o PNG en % (50–300). */
  icon_scale: number;
  title_color: string;
  number_color: string;
}

export type CounterStyle = "card" | "gamer";

export type CounterInput = Pick<Counter, "name" | "icon" | "color" | "step" | "game_id" | "image" | "bg_color" | "bg_opacity" | "style" | "sound" | "sound_on" | "sound_volume" | "icon_scale" | "title_color" | "number_color">;

export async function listCounters(): Promise<Counter[]> {
  const db = await getDb();
  const rows = await db.select<(Omit<Counter, "sound_on"> & { sound_on: 0 | 1 })[]>(
    `SELECT id, name, icon, color, value, step, game_id, image, bg_color, bg_opacity, style, sound, sound_on, sound_volume,
            icon_scale, title_color, number_color
       FROM counter WHERE workspace_id = $1 ORDER BY position, created_at`,
    [WORKSPACE_ID],
  );
  return rows.map((r) => ({ ...r, sound_on: r.sound_on === 1 }));
}

export async function createCounter(input: CounterInput): Promise<void> {
  const db = await getDb();
  const [{ next }] = await db.select<{ next: number }[]>(
    "SELECT COALESCE(MAX(position), -1) + 1 AS next FROM counter WHERE workspace_id = $1",
    [WORKSPACE_ID],
  );
  await db.execute(
    `INSERT INTO counter (id, workspace_id, name, icon, color, step, game_id, image, bg_color, bg_opacity,
                          style, sound, sound_on, sound_volume, icon_scale, title_color, number_color, position)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
    [
      newId(), WORKSPACE_ID, input.name.trim(), input.icon, input.color, input.step, input.game_id, input.image, input.bg_color,
      input.bg_opacity, input.style, input.sound, input.sound_on ? 1 : 0, input.sound_volume, input.icon_scale,
      input.title_color, input.number_color, next,
    ],
  );
}

export async function updateCounter(id: string, input: CounterInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE counter SET name = $1, icon = $2, color = $3, step = $4, game_id = $5, image = $6, bg_color = $7,
            bg_opacity = $8, style = $9, sound = $10, sound_on = $11, sound_volume = $12, icon_scale = $13,
            title_color = $14, number_color = $15, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = $16 AND workspace_id = $17`,
    [
      input.name.trim(), input.icon, input.color, input.step, input.game_id, input.image, input.bg_color, input.bg_opacity,
      input.style, input.sound, input.sound_on ? 1 : 0, input.sound_volume, input.icon_scale, input.title_color,
      input.number_color, id, WORKSPACE_ID,
    ],
  );
}

/** Suma (o resta, con signo negativo) `times` veces el paso del contador; nunca baja de 0. */
export async function bumpCounter(id: string, times: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE counter SET value = MAX(value + step * $1, 0), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = $2 AND workspace_id = $3`,
    [times, id, WORKSPACE_ID],
  );
}

export async function setCounterValue(id: string, value: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE counter SET value = $1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = $2 AND workspace_id = $3`,
    [Math.max(0, Math.floor(value)), id, WORKSPACE_ID],
  );
}

export async function deleteCounter(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM counter WHERE id = $1 AND workspace_id = $2", [id, WORKSPACE_ID]);
}
