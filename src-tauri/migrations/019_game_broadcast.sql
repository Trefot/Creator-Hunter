-- Colección personal de platinos y seguimiento elegido para la emisión.
ALTER TABLE game ADD COLUMN platinum_at TEXT;
CREATE TABLE game_target (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
 game_id TEXT NOT NULL REFERENCES game(id) ON DELETE CASCADE,
 title TEXT NOT NULL,
 guide TEXT,
 collection_key TEXT,
 done_with_trophy INTEGER,
 done INTEGER NOT NULL DEFAULT 0 CHECK(done IN (0,1)),
 position INTEGER NOT NULL DEFAULT 0,
 detector_source TEXT,
 detector_reference TEXT,
 detector_x INTEGER, detector_y INTEGER, detector_w INTEGER, detector_h INTEGER,
 detector_mode TEXT NOT NULL DEFAULT 'off' CHECK(detector_mode IN ('off','test','auto')),
 detector_threshold REAL NOT NULL DEFAULT 0.985 CHECK(detector_threshold BETWEEN 0.9 AND 1.0),
 UNIQUE(game_id,collection_key)
);
CREATE TABLE game_overlay (
 workspace_id TEXT PRIMARY KEY REFERENCES workspace(id) ON DELETE CASCADE,
 game_id TEXT REFERENCES game(id) ON DELETE SET NULL,
 target_id TEXT REFERENCES game_target(id) ON DELETE SET NULL
);
INSERT INTO game_overlay(workspace_id) SELECT id FROM workspace;
