import { es } from "./es";

const numberFormat = new Intl.NumberFormat(es.locale, { maximumFractionDigits: 1 });
const dateFormat = new Intl.DateTimeFormat(es.locale, { day: "numeric", month: "short", year: "numeric" });

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

/** Formatea una fecha 'AAAA-MM-DD' sin desplazarla por la zona horaria. */
export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return dateFormat.format(new Date(y, m - 1, d));
}

/** Fecha de hoy en hora local, como 'AAAA-MM-DD'. */
export function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
