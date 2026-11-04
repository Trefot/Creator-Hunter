import { blackMythWukongGuide } from "./blackMythWukong";
import type { GuideDrafts } from "./types";

/** Borradores de guía incluidos en la app, por npCommunicationId. */
const DRAFTS: GuideDrafts[] = [blackMythWukongGuide];

export function guideDraftsFor(npCommunicationId: string | null): GuideDrafts | null {
  return DRAFTS.find((d) => d.npCommunicationId === npCommunicationId) ?? null;
}
