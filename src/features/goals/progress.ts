import { AccountSnapshot } from "../../db/accountSnapshots";
import { Goal } from "../../db/goals";
import { Income } from "../../db/income";
import { LatestViews } from "../../db/results";
import { formatMoney, formatNumber } from "../../i18n/format";

export type GoalProgress =
  | { kind: "pending" } // métrica sin datos todavía (vistas hasta su sección)
  | { kind: "noData" } // métrica medible, pero sin registros
  | { kind: "value"; current: number; ratio: number };

/** Moneda de las metas de ingresos. */
export const GOAL_CURRENCY = "USD";

/** Las metas de ingresos se muestran como dinero; el resto, como número. */
export function formatGoalValue(goal: Goal, value: number): string {
  return goal.metric === "income" ? formatMoney(Math.round(value * 100), GOAL_CURRENCY) : formatNumber(value);
}

/** Fecha local (AAAA-MM-DD) en que se creó la meta: desde ahí cuentan sus ingresos. */
export function goalStartDate(goal: Goal): string {
  const d = new Date(goal.created_at);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Progreso de una meta, calculado siempre a partir de los datos; nunca se guarda.
 * - Seguidores y horas: último registro del perfil; una meta global suma el de cada perfil.
 * - Ingresos: suma en USD de lo recibido desde que se creó la meta (del perfil, o de todo si es global).
 * - Vistas: suma de las últimas vistas registradas de cada publicación hecha desde que se creó la meta.
 */
export function computeProgress(
  goal: Goal,
  latest: Map<string, AccountSnapshot>,
  incomes: Income[],
  views: LatestViews[],
): GoalProgress {
  if (goal.metric === "views") {
    const start = goalStartDate(goal);
    const current = views
      .filter((v) => v.published_at !== null && v.published_at.slice(0, 10) >= start)
      .filter((v) => goal.profile_id === null || v.profile_id === goal.profile_id)
      .reduce((sum, v) => sum + v.views, 0);
    return { kind: "value", current, ratio: Math.min(current / goal.target_value, 1) };
  }
  if (goal.metric === "income") {
    const start = goalStartDate(goal);
    const minor = incomes
      .filter((i) => i.currency === GOAL_CURRENCY && i.received_on >= start)
      .filter((i) => goal.profile_id === null || i.profile_id === goal.profile_id)
      .reduce((sum, i) => sum + i.amount_minor, 0);
    const current = minor / 100;
    return { kind: "value", current, ratio: Math.min(current / goal.target_value, 1) };
  }
  if (goal.metric !== "followers" && goal.metric !== "watch_hours") return { kind: "pending" };

  const field = goal.metric;
  const snapshots = goal.profile_id === null ? [...latest.values()] : [latest.get(goal.profile_id)];
  const values = snapshots.map((s) => s?.[field]).filter((v): v is number => v != null);
  if (values.length === 0) return { kind: "noData" };

  const current = values.reduce((a, b) => a + b, 0);
  return { kind: "value", current, ratio: Math.min(current / goal.target_value, 1) };
}

/** Días hasta la fecha límite (negativo si ya pasó), contando en fechas locales. */
export function daysUntil(isoDate: string, today: string): number {
  const toDays = (d: string) => {
    const [y, m, day] = d.split("-").map(Number);
    return Date.UTC(y, m - 1, day) / 86_400_000;
  };
  return toDays(isoDate) - toDays(today);
}
