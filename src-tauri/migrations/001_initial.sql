-- Migración 001: esquema inicial de Alpha 0.1 (ver ARCHITECTURE.md, D-005).
-- Las migraciones aplicadas nunca se editan; los cambios van en una migración nueva.
-- Fechas en texto ISO 8601 UTC. Fechas sin hora (recorded_on, received_on, deadline) como 'AAAA-MM-DD'.

CREATE TABLE workspace (
    id               TEXT PRIMARY KEY,
    name             TEXT NOT NULL,
    default_currency TEXT NOT NULL DEFAULT 'USD',
    created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Espacio de trabajo único de Alpha 0.1. El id fijo permite referenciarlo desde la app.
INSERT INTO workspace (id, name) VALUES ('00000000-0000-4000-8000-000000000001', 'TrefotG');

CREATE TABLE profile (
    id           TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    platform     TEXT NOT NULL CHECK (platform IN ('youtube', 'twitch', 'tiktok', 'instagram', 'facebook')),
    handle       TEXT NOT NULL,
    display_name TEXT,
    url          TEXT,
    is_monetized INTEGER NOT NULL DEFAULT 0 CHECK (is_monetized IN (0, 1)),
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (workspace_id, platform, handle)
);

CREATE TABLE account_snapshot (
    id           TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    profile_id   TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
    recorded_on  TEXT NOT NULL,
    followers    INTEGER CHECK (followers >= 0),
    watch_hours  REAL CHECK (watch_hours >= 0),
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_account_snapshot_profile ON account_snapshot (profile_id, recorded_on);

CREATE TABLE goal (
    id           TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    profile_id   TEXT REFERENCES profile(id) ON DELETE CASCADE,
    metric       TEXT NOT NULL CHECK (metric IN ('followers', 'watch_hours', 'income', 'views')),
    target_value REAL NOT NULL CHECK (target_value > 0),
    deadline     TEXT,
    status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'abandoned')),
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE income (
    id           TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    profile_id   TEXT REFERENCES profile(id) ON DELETE SET NULL,
    source       TEXT NOT NULL CHECK (source IN ('platform_ads', 'twitch_subs', 'twitch_bits', 'twitch_ads',
                                                 'membership', 'donation', 'sponsorship', 'affiliate', 'other')),
    amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
    currency     TEXT NOT NULL DEFAULT 'USD',
    received_on  TEXT NOT NULL,
    note         TEXT,
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_income_received_on ON income (workspace_id, received_on);

CREATE TABLE idea (
    id           TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    description  TEXT,
    tags         TEXT,
    status       TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'approved', 'discarded')),
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE project (
    id           TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    idea_id      TEXT UNIQUE REFERENCES idea(id) ON DELETE SET NULL,
    title        TEXT NOT NULL,
    summary      TEXT,
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE adaptation (
    id            TEXT PRIMARY KEY,
    workspace_id  TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    project_id    TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    profile_id    TEXT NOT NULL REFERENCES profile(id) ON DELETE RESTRICT,
    format        TEXT NOT NULL CHECK (format IN ('long_video', 'short', 'tiktok', 'reel', 'post', 'live')),
    title         TEXT NOT NULL,
    scheduled_at  TEXT,
    published_at  TEXT,
    published_url TEXT,
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_adaptation_project ON adaptation (project_id);
CREATE INDEX idx_adaptation_scheduled ON adaptation (workspace_id, scheduled_at);

CREATE TABLE adaptation_step (
    id            TEXT PRIMARY KEY,
    workspace_id  TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    adaptation_id TEXT NOT NULL REFERENCES adaptation(id) ON DELETE CASCADE,
    step          TEXT NOT NULL CHECK (step IN ('script', 'recording', 'editing', 'scheduling', 'publishing', 'analysis')),
    enabled       INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    completed_at  TEXT,
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (adaptation_id, step)
);

CREATE TABLE script_section (
    id            TEXT PRIMARY KEY,
    workspace_id  TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    adaptation_id TEXT NOT NULL REFERENCES adaptation(id) ON DELETE CASCADE,
    kind          TEXT NOT NULL CHECK (kind IN ('hook', 'body', 'closing', 'cta', 'note')),
    position      INTEGER NOT NULL,
    content       TEXT NOT NULL DEFAULT '',
    est_seconds   INTEGER CHECK (est_seconds >= 0),
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_script_section_adaptation ON script_section (adaptation_id, position);

CREATE TABLE result_snapshot (
    id            TEXT PRIMARY KEY,
    workspace_id  TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    adaptation_id TEXT NOT NULL REFERENCES adaptation(id) ON DELETE CASCADE,
    recorded_on   TEXT NOT NULL,
    views         INTEGER CHECK (views >= 0),
    likes         INTEGER CHECK (likes >= 0),
    comments      INTEGER CHECK (comments >= 0),
    shares        INTEGER CHECK (shares >= 0),
    watch_hours   REAL CHECK (watch_hours >= 0),
    avg_viewers   INTEGER CHECK (avg_viewers >= 0),
    peak_viewers  INTEGER CHECK (peak_viewers >= 0),
    duration_min  INTEGER CHECK (duration_min >= 0),
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_result_snapshot_adaptation ON result_snapshot (adaptation_id, recorded_on);
