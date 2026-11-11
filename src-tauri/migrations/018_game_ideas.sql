-- Ideas vinculadas al juego y conversión idempotente de clips/momentos.
ALTER TABLE idea ADD COLUMN game_id TEXT REFERENCES game(id) ON DELETE SET NULL;
ALTER TABLE idea ADD COLUMN capture_key TEXT;
CREATE INDEX idx_idea_game ON idea(game_id);
CREATE UNIQUE INDEX idx_idea_capture ON idea(capture_key);
