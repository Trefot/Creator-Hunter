-- Un clip confirmado puede existir aunque no haya grabación ni emisión activas.
CREATE TABLE obs_clip (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    marker_id TEXT REFERENCES obs_marker(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    title TEXT NOT NULL,
    output_path TEXT NOT NULL UNIQUE CHECK(length(trim(output_path)) > 0),
    game_id TEXT REFERENCES game(id) ON DELETE SET NULL,
    game_title TEXT,
    record_ms INTEGER CHECK(record_ms >= 0),
    stream_ms INTEGER CHECK(stream_ms >= 0)
);
