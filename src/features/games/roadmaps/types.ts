/** Ruta al platino sugerida para un juego concreto (D-016): fases en orden y datos por trofeo. */
export interface Roadmap {
  /** Identificador del juego en PSN al que se aplica. */
  npCommunicationId: string;
  /** Fuentes públicas consultadas para redactarla. */
  sources: { label: string; url: string }[];
  /** Fases en orden; `trophies` son psn_trophy_id. */
  phases: { name: string; note: string; trophies: number[] }[];
  /** Perdible y nota por psn_trophy_id. */
  trophies: Record<number, { missable?: boolean; note?: string }>;
}
