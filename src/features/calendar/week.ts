/** Utilidades de semana con fechas locales 'AAAA-MM-DD'. La semana empieza en lunes. */

function toIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fromIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, days: number): string {
  const d = fromIso(iso);
  d.setDate(d.getDate() + days);
  return toIso(d);
}

/** Lunes de la semana que contiene la fecha. */
export function mondayOf(iso: string): string {
  const day = fromIso(iso).getDay(); // 0 = domingo
  return addDays(iso, day === 0 ? -6 : 1 - day);
}

/** Los siete días de la semana que empieza en `monday`. */
export function weekDays(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}
