-- Migración 010: progreso de coleccionables por juego (semillas, curiosidades…).
-- El contenido de cada ficha va en la app; aquí solo se guarda qué objetos ya tiene el usuario.
-- Solo añade una tabla: compatible hacia atrás.

CREATE TABLE collection_item (
    id           TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    game_id      TEXT NOT NULL REFERENCES game(id) ON DELETE CASCADE,
    item_key     TEXT NOT NULL,
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (game_id, item_key)
);
