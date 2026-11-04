-- Migración 009: partidas del día y sus objetivos.
-- Una partida por juego y día; cada objetivo puede apuntar a un trofeo o a una entrada de la guía.
-- Solo añade tablas: compatible hacia atrás.

CREATE TABLE play_session (
    id           TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    game_id      TEXT NOT NULL REFERENCES game(id) ON DELETE CASCADE,
    played_on    TEXT NOT NULL,
    note         TEXT,
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (game_id, played_on)
);

CREATE TABLE session_objective (
    id             TEXT PRIMARY KEY,
    workspace_id   TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    session_id     TEXT NOT NULL REFERENCES play_session(id) ON DELETE CASCADE,
    title          TEXT NOT NULL,
    trophy_id      TEXT REFERENCES trophy(id) ON DELETE SET NULL,
    guide_entry_id TEXT REFERENCES guide_entry(id) ON DELETE SET NULL,
    done           INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1)),
    position       INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_session_objective_session ON session_objective (session_id, position);
