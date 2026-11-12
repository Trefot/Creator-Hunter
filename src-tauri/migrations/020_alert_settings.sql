-- Preferencias de las dos fuentes. Las colas temporales no se reemiten al reiniciar.
ALTER TABLE workspace ADD COLUMN alert_settings TEXT;
