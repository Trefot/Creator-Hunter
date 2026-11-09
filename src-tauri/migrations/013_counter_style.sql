-- Migración 013: aspecto de los contadores en el overlay.
-- image: PNG propio del usuario (data URL, con transparencia) en lugar del emoji.
-- bg_color y bg_opacity: fondo de la tarjeta en OBS (0 = transparente, 100 = sólido).
-- Solo añade columnas con valor por defecto: compatible hacia atrás.

ALTER TABLE counter ADD COLUMN image TEXT;
ALTER TABLE counter ADD COLUMN bg_color TEXT NOT NULL DEFAULT '#0e0c14';
ALTER TABLE counter ADD COLUMN bg_opacity INTEGER NOT NULL DEFAULT 85 CHECK (bg_opacity BETWEEN 0 AND 100);
