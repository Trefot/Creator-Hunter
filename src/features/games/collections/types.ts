/**
 * Listas de trofeo (G4+): qué hay que conseguir para cada trofeo, dónde, si el botín es fijo
 * o aleatorio y qué build conviene. Redactadas para TrophyHunter a partir de guías públicas
 * (citadas en `sources`), nunca copiadas.
 */

/** Cómo se consigue un punto de la lista. */
export type ItemSource =
  /** Botín fijo o paso que siempre sale (jefe, misión, historia). */
  | "fixed"
  /** Aleatorio al recoger una planta, romper un objeto… */
  | "random"
  /** Aleatorio al matar a un enemigo: la build de botín sí ayuda. */
  | "enemy";

export interface CollectionItem {
  /** Clave estable: se guarda en la base de datos para marcar el progreso. */
  key: string;
  /** Qué conseguir (en español; traducción nuestra si el juego no está claro). */
  name: string;
  /** Nombre en inglés del juego, para buscarlo si la traducción no coincide. */
  nameEn?: string;
  /** Capítulo; agrupa la lista si no hay `group`. */
  chapter?: number;
  /** Grupo propio (p. ej. "Requisitos", "Combate final"). */
  group?: string;
  /** Dónde: zona › subzona. */
  where?: string;
  source?: ItemSource;
  /** Cómo conseguirlo, en una o dos frases. */
  how: string;
  /** false si alguna parte del dato no está clara en las fuentes. */
  verified: boolean;
  /** psn_trophy_id que, si ya está ganado, deja este punto hecho solo. */
  doneWithTrophy?: number;
  /** Aviso: se pierde si avanzas sin hacerlo. */
  missable?: string;
}

export interface FarmPiece {
  slot: string;
  name: string;
  nameEn: string;
  effect: string;
  howToGet: string;
}

export interface TrophyCollection {
  /** psn_trophy_id del trofeo. */
  trophy: number;
  /** Qué hay que juntar o hacer, p. ej. "Las 15 semillas". */
  title: string;
  /** Resumen en pasos cortos. */
  steps: string[];
  items: CollectionItem[];
  /** Build recomendada para farmear (si aplica). */
  farmBuild?: { summary: string; pieces: FarmPiece[]; helpsWith: string };
  tips: string[];
  sources: { label: string; url: string }[];
}

export interface GameCollections {
  npCommunicationId: string;
  collections: TrophyCollection[];
}
