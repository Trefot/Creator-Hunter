import { Income } from "../../db/income";

/**
 * Convierte el texto de una cantidad ("12.50", "12,5", "1200") en centavos.
 * Devuelve null si no es una cantidad válida, positiva y con como mucho dos decimales.
 */
export function parseMoney(text: string): number | null {
  const normalized = text.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const minor = Math.round(Number(normalized) * 100);
  return minor > 0 ? minor : null;
}

/** Centavos → texto editable ("12.50"). */
export function minorToInput(amountMinor: number): string {
  return (amountMinor / 100).toFixed(2);
}

/** Suma por moneda de los ingresos cuya fecha empieza por el prefijo dado ('2026' o '2026-11'). */
export function totalsByCurrency(incomes: Income[], datePrefix: string): Map<string, number> {
  const totals = new Map<string, number>();
  for (const i of incomes) {
    if (i.received_on.startsWith(datePrefix)) {
      totals.set(i.currency, (totals.get(i.currency) ?? 0) + i.amount_minor);
    }
  }
  return totals;
}

/** Total en centavos de cada uno de los últimos `months` meses (en una moneda), del más antiguo a hoy. */
export function monthlyTotals(incomes: Income[], currency: string, months: number, today: string): { month: string; minor: number }[] {
  const [y, m] = today.split("-").map(Number);
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(y, m - 1 - (months - 1 - i), 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const minor = incomes
      .filter((x) => x.currency === currency && x.received_on.startsWith(month))
      .reduce((sum, x) => sum + x.amount_minor, 0);
    return { month, minor };
  });
}
