import { Income } from "../../db/income";
import { Profile } from "../../db/profiles";

/** Moneda de los umbrales de pago. */
export const PAYOUT_CURRENCY = "USD";

export interface PayoutStatus {
  profile: Profile;
  threshold: number;
  /** Ganado y aún no cobrado, en centavos. */
  pending: number;
  ready: boolean;
}

/**
 * Saldo pendiente de una red, calculado (nunca guardado; D-014): suma de sus ingresos en USD
 * recibidos después del último cobro. Los del mismo día del cobro se consideran ya cobrados.
 */
export function pendingFor(profile: Profile, incomes: Income[]): number {
  return incomes
    .filter((i) => i.profile_id === profile.id && i.currency === PAYOUT_CURRENCY)
    .filter((i) => profile.last_payout_on === null || i.received_on > profile.last_payout_on)
    .reduce((sum, i) => sum + i.amount_minor, 0);
}

/** Estado de pago de cada red con umbral configurado. */
export function payoutStatuses(profiles: Profile[], incomes: Income[]): PayoutStatus[] {
  return profiles
    .filter((p) => p.payout_threshold_minor !== null)
    .map((p) => {
      const pending = pendingFor(p, incomes);
      const threshold = p.payout_threshold_minor!;
      return { profile: p, threshold, pending, ready: pending >= threshold };
    });
}
