-- Migración 004: umbrales de pago (ver D-014).
-- profile.payout_threshold_minor: umbral de pago de la plataforma, en centavos (USD).
-- account_snapshot.pending_minor: saldo ganado aún no pagado, copiado del panel de la plataforma, en centavos.
-- Solo añade columnas opcionales: compatible hacia atrás.

ALTER TABLE profile ADD COLUMN payout_threshold_minor INTEGER CHECK (payout_threshold_minor > 0);
ALTER TABLE account_snapshot ADD COLUMN pending_minor INTEGER CHECK (pending_minor >= 0);
