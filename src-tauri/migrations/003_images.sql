-- Migración 003: imágenes propias (ver D-013).
-- Se guardan como data URL JPEG ya reducida (foto 256×256, miniatura 640×360) dentro de la base de datos,
-- para que viajen en las copias de seguridad sin archivos sueltos. Solo añade columnas: compatible hacia atrás.

ALTER TABLE profile ADD COLUMN avatar TEXT;
ALTER TABLE adaptation ADD COLUMN thumbnail TEXT;
