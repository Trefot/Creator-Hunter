import { blackMythWukong } from "./blackMythWukong";
import type { Roadmap } from "./types";

/** Rutas sugeridas incluidas en la app, por npCommunicationId. */
const ROADMAPS: Roadmap[] = [blackMythWukong];

export function roadmapFor(npCommunicationId: string | null): Roadmap | null {
  return ROADMAPS.find((r) => r.npCommunicationId === npCommunicationId) ?? null;
}
