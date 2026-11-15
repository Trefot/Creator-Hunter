-- Clips para Shorts (D-031): cada recorte que Nexus genera con ffmpeg a partir de un momento
-- (grabación de OBS) o de un clip del Replay Buffer. Solo añade una tabla: compatible hacia atrás.
CREATE TABLE clip_export (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    source_kind TEXT NOT NULL CHECK(source_kind IN ('moment','clip')),
    source_id TEXT NOT NULL,
    title TEXT NOT NULL,
    format TEXT NOT NULL CHECK(format IN ('horizontal','vertical_crop','vertical_blur')),
    path TEXT NOT NULL CHECK(length(trim(path)) > 0)
);
CREATE INDEX idx_clip_export_time ON clip_export(workspace_id, created_at);
