import { blackMythWukongCollections } from "./blackMythWukong";
import { blackMythWukongStory } from "./blackMythWukongStory";
import type { GameCollections, TrophyCollection } from "./types";

const ALL: GameCollections[] = [
  {
    npCommunicationId: blackMythWukongCollections.npCommunicationId,
    collections: [...blackMythWukongStory, ...blackMythWukongCollections.collections],
  },
];

/** La lista de un trofeo, si la app la incluye. */
export function collectionFor(npCommunicationId: string | null, psnTrophyId: number | null): TrophyCollection | null {
  if (!npCommunicationId || psnTrophyId === null) return null;
  return ALL.find((g) => g.npCommunicationId === npCommunicationId)?.collections.find((c) => c.trophy === psnTrophyId) ?? null;
}
