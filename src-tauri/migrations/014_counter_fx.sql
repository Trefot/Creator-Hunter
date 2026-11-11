-- Migración 014: estilo y sonido de los contadores en el overlay.
-- style: 'card' (tarjeta, la de siempre) o 'gamer' (número gigante con contorno, sin caja).
-- sound: audio propio (data URL); sin él suena el sonido por defecto. sound_on y sound_volume (0–100).
-- Solo añade columnas con valor por defecto: compatible hacia atrás.

ALTER TABLE counter ADD COLUMN style TEXT NOT NULL DEFAULT 'card' CHECK (style IN ('card', 'gamer'));
ALTER TABLE counter ADD COLUMN sound TEXT;
ALTER TABLE counter ADD COLUMN sound_on INTEGER NOT NULL DEFAULT 1 CHECK (sound_on IN (0, 1));
ALTER TABLE counter ADD COLUMN sound_volume INTEGER NOT NULL DEFAULT 70 CHECK (sound_volume BETWEEN 0 AND 100);
