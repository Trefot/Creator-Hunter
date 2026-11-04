-- Migración 007: juegos, trofeos, fases de la ruta al platino y objetivos de juego (ver D-016).
-- Solo añade tablas y una columna opcional: compatible hacia atrás.

CREATE TABLE game (
    id                  TEXT PRIMARY KEY,
    workspace_id        TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    title               TEXT NOT NULL,
    platform            TEXT NOT NULL DEFAULT 'ps5' CHECK (platform IN ('ps5', 'ps4', 'xbox', 'pc', 'switch', 'other')),
    status              TEXT NOT NULL DEFAULT 'playing' CHECK (status IN ('playing', 'backlog', 'completed', 'platinum', 'dropped')),
    cover               TEXT,
    -- Identificadores de PSN (null en juegos añadidos a mano).
    np_communication_id TEXT UNIQUE,
    np_service_name     TEXT CHECK (np_service_name IN ('trophy', 'trophy2')),
    notes               TEXT,
    last_synced_at      TEXT,
    created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Fases de la ruta al platino (capítulos, post-juego, NG+…), en orden.
CREATE TABLE trophy_phase (
    id           TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    game_id      TEXT NOT NULL REFERENCES game(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    position     INTEGER NOT NULL,
    note         TEXT,
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_trophy_phase_game ON trophy_phase (game_id, position);

CREATE TABLE trophy (
    id             TEXT PRIMARY KEY,
    workspace_id   TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    game_id        TEXT NOT NULL REFERENCES game(id) ON DELETE CASCADE,
    psn_trophy_id  INTEGER,
    group_id       TEXT,
    name           TEXT NOT NULL,
    detail         TEXT,
    type           TEXT NOT NULL CHECK (type IN ('bronze', 'silver', 'gold', 'platinum')),
    hidden         INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1)),
    icon_url       TEXT,
    earned_at      TEXT,
    -- % de jugadores que lo tienen (rareza), según PSN.
    earned_rate    REAL,
    -- Datos propios del usuario (la sincronización con PSN no los toca).
    phase_id       TEXT REFERENCES trophy_phase(id) ON DELETE SET NULL,
    missable       INTEGER NOT NULL DEFAULT 0 CHECK (missable IN (0, 1)),
    note           TEXT,
    position       INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (game_id, psn_trophy_id)
);
CREATE INDEX idx_trophy_game ON trophy (game_id, position);

CREATE TABLE game_goal (
    id            TEXT PRIMARY KEY,
    workspace_id  TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    game_id       TEXT NOT NULL REFERENCES game(id) ON DELETE CASCADE,
    title         TEXT NOT NULL,
    current_value REAL NOT NULL DEFAULT 0 CHECK (current_value >= 0),
    target_value  REAL NOT NULL CHECK (target_value > 0),
    unit          TEXT,
    deadline      TEXT,
    status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'abandoned')),
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Proyectos del Creator Studio sobre un juego (por ejemplo, la serie del platino).
ALTER TABLE project ADD COLUMN game_id TEXT REFERENCES game(id) ON DELETE SET NULL;
