-- Migración 011: puntos propios de la lista de un trofeo (lo que el jugador añade a mano).
-- Los puntos que trae la app se marcan en collection_item; estos son del usuario.
-- Solo añade una tabla: compatible hacia atrás.

CREATE TABLE trophy_task (
    id           TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    game_id      TEXT NOT NULL REFERENCES game(id) ON DELETE CASCADE,
    trophy_id    TEXT NOT NULL REFERENCES trophy(id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    done         INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1)),
    position     INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_trophy_task_trophy ON trophy_task (trophy_id, position);
