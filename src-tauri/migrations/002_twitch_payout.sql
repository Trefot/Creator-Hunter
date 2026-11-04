-- Migración 002: nuevo tipo de ingreso 'twitch_payout' (Twitch paga subs, bits y anuncios en un solo total).
-- SQLite no permite cambiar un CHECK, así que la tabla se reconstruye conservando todos los datos.
-- Ninguna otra tabla referencia a income, por lo que reemplazarla es seguro.

CREATE TABLE income_new (
    id           TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    profile_id   TEXT REFERENCES profile(id) ON DELETE SET NULL,
    source       TEXT NOT NULL CHECK (source IN ('platform_ads', 'twitch_payout', 'twitch_subs', 'twitch_bits',
                                                 'twitch_ads', 'membership', 'donation', 'sponsorship',
                                                 'affiliate', 'other')),
    amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
    currency     TEXT NOT NULL DEFAULT 'USD',
    received_on  TEXT NOT NULL,
    note         TEXT,
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO income_new (id, workspace_id, profile_id, source, amount_minor, currency, received_on, note,
                        created_at, updated_at)
SELECT id, workspace_id, profile_id, source, amount_minor, currency, received_on, note, created_at, updated_at
  FROM income;

DROP TABLE income;
ALTER TABLE income_new RENAME TO income;
CREATE INDEX idx_income_received_on ON income (workspace_id, received_on);
