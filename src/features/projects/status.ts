import { Adaptation, AdaptationStep } from "../../db/adaptations";

/**
 * Estado de producción de una adaptación, calculado (nunca guardado):
 * el primer paso activo sin completar, o null si todos los activos están hechos.
 */
export function currentStep(adaptation: Adaptation): AdaptationStep | null {
  return adaptation.steps.find((s) => s.enabled && s.completed_at === null) ?? null;
}

/** Pasos activos completados y totales, para la barra de progreso. */
export function stepProgress(adaptation: Adaptation): { done: number; total: number } {
  const active = adaptation.steps.filter((s) => s.enabled);
  return { done: active.filter((s) => s.completed_at !== null).length, total: active.length };
}
