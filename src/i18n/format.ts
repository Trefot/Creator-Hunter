import { es } from "./es";

const numberFormat = new Intl.NumberFormat(es.locale, { maximumFractionDigits: 1 });
const dateFormat = new Intl.DateTimeFormat(es.locale, { day: "numeric", month: "short", year: "numeric" });

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

/** Formatea una cantidad guardada en centavos, por ejemplo 1250 → "USD 12.50". */
export function formatMoney(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat(es.locale, { style: "currency", currency, currencyDisplay: "code" }).format(
    amountMinor / 100,
  );
}

const shortDateFormat = new Intl.DateTimeFormat(es.locale, { day: "numeric", month: "short" });
const monthFormat = new Intl.DateTimeFormat(es.locale, { month: "short" });
const compactFormat = new Intl.NumberFormat(es.locale, { notation: "compact", maximumFractionDigits: 1 });

/** 'AAAA-MM-DD' → '3 nov'. */
export function formatShortDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return shortDateFormat.format(new Date(y, m - 1, d));
}

/** 'AAAA-MM' → 'nov'. */
export function formatMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return monthFormat.format(new Date(y, m - 1, 1)).replace(".", "");
}

/** 12500 → '12.5 mil'; para ejes de gráficas. */
export function formatCompact(value: number): string {
  return compactFormat.format(value);
}

/** Formatea una fecha 'AAAA-MM-DD' sin desplazarla por la zona horaria. */
export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return dateFormat.format(new Date(y, m - 1, d));
}

const dateTimeFormat = new Intl.DateTimeFormat(es.locale, {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** Formatea una fecha y hora local sin zona, 'AAAA-MM-DDTHH:MM'. */
export function formatDateTime(local: string): string {
  const [date, time = "00:00"] = local.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  return dateTimeFormat.format(new Date(y, m - 1, d, h, min));
}

/** Fecha y hora actual en hora local, como 'AAAA-MM-DDTHH:MM'. */
export function nowLocal(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${todayIso()}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

/** Fecha de hoy en hora local, como 'AAAA-MM-DD'. */
export function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
