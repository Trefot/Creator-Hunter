import type { GuideKind } from "../../../db/guide";

/** Borradores de guía incluidos en la app para un juego (G4). */
export interface GuideDrafts {
  npCommunicationId: string;
  entries: {
    kind: GuideKind;
    title: string;
    /** Nombre de la fase de la ruta sugerida a la que pertenece (si existe en el juego). */
    phase?: string;
    summary: string;
    body: string;
    /** psn_trophy_id enlazados. */
    trophies?: number[];
    source_url?: string;
    /** true solo para lo comprobado (por el usuario o con fuente clara). */
    verified: boolean;
  }[];
}
