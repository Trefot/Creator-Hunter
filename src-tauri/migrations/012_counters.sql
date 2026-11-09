-- Migración 012: contadores del Live Studio (muertes, jefes, cofres, seguidores…).
-- `source` ya admite los orígenes automáticos de las próximas fases (seguidores, suscriptores
-- y detección por imagen) para no tener que reconstruir la tabla al añadirlos.
-- Solo añade una tabla: compatible hacia atrás.

CREATE TABLE counter (
    id           TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    icon         TEXT NOT NULL DEFAULT '💀',
    color        TEXT NOT NULL DEFAULT '#8b5cf6',
    value        INTEGER NOT NULL DEFAULT 0,
    step         INTEGER NOT NULL DEFAULT 1 CHECK (step > 0),
    source       TEXT NOT NULL DEFAULT 'manual'
                 CHECK (source IN ('manual', 'youtube_subscribers', 'twitch_followers', 'screen')),
    game_id      TEXT REFERENCES game(id) ON DELETE SET NULL,
    position     INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_counter_workspace ON counter (workspace_id, position);
