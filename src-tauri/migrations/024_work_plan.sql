-- Hábito de producción (D-032): la rutina semanal (qué tipo de sesión toca cada día) y las sesiones
-- planificadas (qué proyecto se trabaja ese día). Solo añade tablas: compatible hacia atrás.
CREATE TABLE work_routine (
    workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    weekday INTEGER NOT NULL CHECK(weekday BETWEEN 0 AND 6),
    kind TEXT NOT NULL CHECK(kind IN ('record','edit','schedule','stream','rest')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    PRIMARY KEY (workspace_id, weekday)
);
CREATE TABLE work_session (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    day TEXT NOT NULL CHECK(length(day) = 10),
    kind TEXT NOT NULL CHECK(kind IN ('record','edit','schedule')),
    project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    adaptation_id TEXT REFERENCES adaptation(id) ON DELETE SET NULL,
    done_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE (workspace_id, day, project_id)
);
CREATE INDEX idx_work_session_day ON work_session(workspace_id, day);
