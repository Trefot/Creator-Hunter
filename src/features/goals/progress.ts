import { AccountSnapshot } from "../../db/accountSnapshots";
import { Goal } from "../../db/goals";

export type GoalProgress =
  | { kind: "pending" } // métrica sin datos todavía (ingresos y vistas hasta sus secciones)
  | { kind: "noData" } // métrica medible, pero sin registros
  | { kind: "value"; current: number; ratio: number };

/**
 * Progreso de una meta, calculado siempre a partir de los registros; nunca se guarda.
 * Una meta global suma el último valor de cada perfil que tenga ese dato.
 */
export function computeProgress(goal: Goal, latest: Map<string, AccountSnapshot>): GoalProgress {
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
