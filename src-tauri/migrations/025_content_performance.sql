-- Publications are provider-owned; local grouping never edits the remote publication.
CREATE TABLE content_series (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspace(id),
 title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 120),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE content_post (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspace(id),
 profile_id TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
 remote_id TEXT NOT NULL, platform TEXT NOT NULL CHECK(platform IN ('youtube','twitch','tiktok','instagram','facebook')),
 title TEXT NOT NULL, url TEXT NOT NULL, thumbnail TEXT, published_at TEXT NOT NULL,
 format TEXT NOT NULL DEFAULT 'unknown', series_id TEXT REFERENCES content_series(id) ON DELETE SET NULL,
 project_id TEXT REFERENCES project(id) ON DELETE SET NULL,
 last_seen_at TEXT NOT NULL, UNIQUE(profile_id,remote_id)
);
CREATE TABLE content_observation (
 id TEXT PRIMARY KEY, post_id TEXT NOT NULL REFERENCES content_post(id) ON DELETE CASCADE,
 observed_at TEXT NOT NULL, views INTEGER CHECK(views>=0), likes INTEGER CHECK(likes>=0),
 comments INTEGER CHECK(comments>=0), shares INTEGER CHECK(shares>=0),
 watch_hours REAL CHECK(watch_hours>=0), UNIQUE(post_id,observed_at)
);
CREATE INDEX content_post_recent ON content_post(profile_id,published_at DESC);
CREATE INDEX content_observation_recent ON content_observation(post_id,observed_at DESC);
CREATE TABLE local_preference (
 id TEXT PRIMARY KEY, content TEXT NOT NULL
);
