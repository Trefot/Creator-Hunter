-- Resumen del directo (D-029): registro de eventos sociales recibidos y valor de los contadores
-- al empezar y al terminar cada emisión. Solo añade tablas y una columna: compatible hacia atrás.
CREATE TABLE stream_event (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    platform TEXT NOT NULL CHECK(platform IN ('twitch','youtube','tiktok')),
    kind TEXT NOT NULL CHECK(length(kind) BETWEEN 1 AND 40),
    name TEXT NOT NULL DEFAULT '',
    amount TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_stream_event_time ON stream_event(workspace_id, created_at);
CREATE TABLE obs_session_counter (
    session_id TEXT NOT NULL REFERENCES obs_session(id) ON DELETE CASCADE,
    counter_id TEXT NOT NULL REFERENCES counter(id) ON DELETE CASCADE,
    workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    start_value INTEGER NOT NULL,
    end_value INTEGER,
    PRIMARY KEY(session_id, counter_id)
);
ALTER TABLE obs_session ADD COLUMN recap_seen INTEGER NOT NULL DEFAULT 0 CHECK(recap_seen IN (0,1));
