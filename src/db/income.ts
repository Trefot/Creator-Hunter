import { getDb, newId, WORKSPACE_ID } from "./database";

/** Todos los tipos que acepta la base de datos (migración 002). */
export const INCOME_SOURCES = [
  "platform_ads",
  "twitch_payout",
  "twitch_subs",
  "twitch_bits",
  "twitch_ads",
  "membership",
  "donation",
  "sponsorship",
  "affiliate",
  "other",
] as const;
export type IncomeSource = (typeof INCOME_SOURCES)[number];

/**
 * Tipos que se ofrecen al registrar un ingreso. Twitch paga subs, bits y anuncios en un solo total,
 * así que los tipos separados de Twitch solo se conservan para registros antiguos.
 */
export const SELECTABLE_INCOME_SOURCES: readonly IncomeSource[] = [
  "platform_ads",
  "twitch_payout",
  "membership",
  "donation",
  "sponsorship",
  "affiliate",
  "other",
];

export interface Income {
  id: string;
  profile_id: string | null;
  source: IncomeSource;
  /** Cantidad en unidades menores (centavos) para evitar errores de redondeo. */
  amount_minor: number;
  currency: string;
  received_on: string;
  note: string | null;
}

export type IncomeInput = Omit<Income, "id">;

export async function listIncome(): Promise<Income[]> {
  const db = await getDb();
  return db.select<Income[]>(
    `SELECT id, profile_id, source, amount_minor, currency, received_on, note
       FROM income WHERE workspace_id = $1
      ORDER BY received_on DESC, created_at DESC`,
    [WORKSPACE_ID],
  );
}

export async function createIncome(input: IncomeInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO income (id, workspace_id, profile_id, source, amount_minor, currency, received_on, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      newId(),
      WORKSPACE_ID,
      input.profile_id,
      input.source,
      input.amount_minor,
      input.currency,
      input.received_on,
      input.note,
    ],
  );
}

export async function updateIncome(id: string, input: IncomeInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE income
        SET profile_id = $1, source = $2, amount_minor = $3, currency = $4, received_on = $5, note = $6,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = $7 AND workspace_id = $8`,
    [
      input.profile_id,
      input.source,
      input.amount_minor,
      input.currency,
      input.received_on,
      input.note,
      id,
      WORKSPACE_ID,
    ],
  );
}

export async function deleteIncome(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM income WHERE id = $1 AND workspace_id = $2", [id, WORKSPACE_ID]);
}
