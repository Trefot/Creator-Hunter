-- Migración 005: fecha del último cobro de cada red (ver D-014).
-- El saldo pendiente se calcula con los ingresos de la red recibidos después de esta fecha.
-- account_snapshot.pending_minor (migración 004) queda sin uso: el saldo ya no se anota a mano.

ALTER TABLE profile ADD COLUMN last_payout_on TEXT;
