-- Migración 006: datos automáticos de YouTube (ver D-015).
-- source: 'manual' (anotado por el usuario) o 'api' (sincronizado). Los registros existentes quedan como 'manual'.
-- total_views: vistas totales del canal en ese momento.
-- Como mucho un registro automático por perfil (o publicación) y día: la sincronización lo actualiza.
-- Solo añade columnas e índices: compatible hacia atrás.

ALTER TABLE account_snapshot ADD COLUMN source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'api'));
ALTER TABLE account_snapshot ADD COLUMN total_views INTEGER CHECK (total_views >= 0);
ALTER TABLE result_snapshot ADD COLUMN source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'api'));

CREATE UNIQUE INDEX idx_account_snapshot_api_day ON account_snapshot (profile_id, recorded_on) WHERE source = 'api';
CREATE UNIQUE INDEX idx_result_snapshot_api_day ON result_snapshot (adaptation_id, recorded_on) WHERE source = 'api';
