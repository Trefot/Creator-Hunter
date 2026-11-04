-- Migración 008: guía del juego (G4). Entradas por tipo, enlazadas a una fase y a sus trofeos.
-- verified = 0 marca el contenido "por verificar" (borradores aún no comprobados por el usuario).
-- Solo añade tablas: compatible hacia atrás.

CREATE TABLE guide_entry (
    id           TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    game_id      TEXT NOT NULL REFERENCES game(id) ON DELETE CASCADE,
    kind         TEXT NOT NULL CHECK (kind IN ('boss', 'build', 'route', 'farm', 'tip')),
    title        TEXT NOT NULL,
    phase_id     TEXT REFERENCES trophy_phase(id) ON DELETE SET NULL,
    summary      TEXT,
    body         TEXT,
    image        TEXT,
    video_url    TEXT,
    source_url   TEXT,
    verified     INTEGER NOT NULL DEFAULT 0 CHECK (verified IN (0, 1)),
    position     INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_guide_entry_game ON guide_entry (game_id, kind, position);

CREATE TABLE guide_entry_trophy (
    entry_id     TEXT NOT NULL REFERENCES guide_entry(id) ON DELETE CASCADE,
    trophy_id    TEXT NOT NULL REFERENCES trophy(id) ON DELETE CASCADE,
    workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    PRIMARY KEY (entry_id, trophy_id)
);
