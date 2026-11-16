import { productionReady } from "../projects/projectBoard";
import type { Adaptation, Step } from "../../db/adaptations";

/** Tipos de sesión de la rutina semanal (D-032). */
export const WORK_KINDS = ["record", "edit", "schedule", "stream", "rest"] as const;
export type WorkKind = (typeof WORK_KINDS)[number];
/** Los tipos que se planifican con un proyecto concreto. */
export type PlannedKind = "record" | "edit" | "schedule";

/** Rutina inicial del plan de colchón: lunes y martes grabar, miércoles editar, jueves directo… */
export const DEFAULT_ROUTINE: WorkKind[] = ["record", "record", "edit", "stream", "edit", "record", "schedule"];
/** Meta del colchón: dos semanas de contenido listo (2 largos y 5 Shorts por semana). */
export const BUFFER_GOAL = { long: 4, short: 10 };

export function isPlanned(kind: WorkKind): kind is PlannedKind {
  return kind === "record" || kind === "edit" || kind === "schedule";
}

/** Día de la semana de una fecha local 'AAAA-MM-DD', con 0 = lunes. */
export function weekdayIndex(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return (new Date(y, m - 1, d).getDay() + 6) % 7;
}

/** Rutina completa a partir de lo guardado; los días sin guardar usan la rutina inicial. */
export function routineFrom(rows: { weekday: number; kind: string }[]): WorkKind[] {
  return DEFAULT_ROUTINE.map((fallback, day) => {
    const kind = rows.find((r) => r.weekday === day)?.kind ?? "";
    return (WORK_KINDS as readonly string[]).includes(kind) ? (kind as WorkKind) : fallback;
  });
}

function current(a: Adaptation): Step | null {
  return a.steps.find((s) => s.enabled && !s.completed_at)?.step ?? null;
}

export interface Candidate {
  projectId: string;
  adaptationId: string | null;
  label: string;
  /** Aún le falta un paso anterior (por ejemplo, se edita lo que se grabará antes esa semana). */
  early: boolean;
}

/**
 * Qué se puede trabajar en una sesión. Lo elige el usuario: Nexus no sugiere nada por su cuenta.
 * Grabar: versiones con el guion o la grabación pendientes, y proyectos que aún no tienen versiones.
 * Editar y programar: primero las versiones que ya están en ese paso y después las que aún tienen
 * pasos anteriores, para poder planificar la semana entera el domingo.
 */
export function candidates(
  kind: PlannedKind,
  projects: { id: string; title: string; adaptation_count: number }[],
  versions: Adaptation[],
): Candidate[] {
  const ready: Step[] = kind === "record" ? ["script", "recording"] : kind === "edit" ? ["editing"] : ["scheduling", "publishing"];
  const earlier: Step[] = kind === "record" ? [] : kind === "edit" ? ["recording", "script"] : ["editing", "recording", "script"];
  const order = [...ready, ...earlier];
  const list: Candidate[] = versions
    .filter((a) => {
      const step = current(a);
      return !a.published_at && a.format !== "live" && ((step !== null && order.includes(step)) || (kind === "schedule" && productionReady(a) && (step === null || step === "analysis")));
    })
    .sort((a,b)=>{const rank=(v:Adaptation)=>{const n=order.indexOf(current(v)!);return n<0?1:n};return rank(a)-rank(b)})
    .map((a) => ({
      projectId: a.project_id,
      adaptationId: a.id,
      label: a.title === a.project_title ? a.title : `${a.project_title} · ${a.title}`,
      early: earlier.includes(current(a)!),
    }));
  if (kind === "record") {
    for (const p of projects) if (p.adaptation_count === 0) list.push({ projectId: p.id, adaptationId: null, label: p.title, early: false });
  }
  return list;
}

/** Paso de producción que se marca como hecho al completar la sesión. */
export function stepToComplete(kind: PlannedKind): Step {
  return kind === "record" ? "recording" : kind === "edit" ? "editing" : "scheduling";
}

export interface BufferStatus {
  long: number;
  short: number;
  level: "empty" | "low" | "ok" | "full";
}

/**
 * El colchón: versiones sin publicar que ya están grabadas y editadas (solo falta programarlas o
 * publicarlas). Menos de 4 piezas listas = semana de grabar.
 */
export function bufferStatus(versions: Adaptation[],goal=BUFFER_GOAL): BufferStatus {
  const ready = versions.filter(productionReady);
  const long = ready.filter((a) => a.format === "long_video").length;
  const short = ready.filter((a) => a.format === "short" || a.format === "tiktok" || a.format === "reel").length;
  const level =
    long + short === 0 ? "empty" : long + short < 4 ? "low" : long >= goal.long && short >= goal.short ? "full" : "ok";
  return { long, short, level };
}

/** Días de la semana con alguna sesión completada frente a días de trabajo de la rutina. */
export function weekProgress(
  routine: WorkKind[],
  sessions: { day: string; done_at: string | null }[],
  days: string[],
): { done: number; planned: number } {
  const completed=new Set(sessions.filter(s=>s.done_at&&days.includes(s.day)).map(s=>s.day));
  const planned=new Set([...days.filter(d=>isPlanned(routine[weekdayIndex(d)])),...completed]).size;
  return {done:completed.size,planned};
}
