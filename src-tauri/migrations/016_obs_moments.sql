-- Lectura de OBS y marcas de contenido. No cambia tablas ni datos existentes.
CREATE TABLE obs_session (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK(kind IN ('recording','stream')),
    observed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    ended_at TEXT,
    end_reason TEXT,
    output_path TEXT,
    game_id TEXT REFERENCES game(id) ON DELETE SET NULL
);
CREATE TABLE obs_marker (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL REFERENCES obs_session(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    title TEXT NOT NULL,
    record_ms INTEGER CHECK(record_ms >= 0),
    stream_ms INTEGER CHECK(stream_ms >= 0),
    game_id TEXT REFERENCES game(id) ON DELETE SET NULL,
    game_title TEXT,
    CHECK(record_ms IS NOT NULL OR stream_ms IS NOT NULL)
);
CREATE INDEX idx_obs_marker_session ON obs_marker(session_id,created_at);
