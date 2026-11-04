import { blackMythWukongCollections } from "./blackMythWukong";
import { blackMythWukongBrews } from "./blackMythWukongBrews";
import { blackMythWukongCurios } from "./blackMythWukongCurios";
import { blackMythWukongStory } from "./blackMythWukongStory";
import type { GameCollections, TrophyCollection } from "./types";

const ALL: GameCollections[] = [
  {
    npCommunicationId: blackMythWukongCollections.npCommunicationId,
    collections: [...blackMythWukongStory, blackMythWukongCurios, blackMythWukongBrews, ...blackMythWukongCollections.collections],
  },
];

/** La lista de un trofeo, si la app la incluye. */
export function collectionFor(npCommunicationId: string | null, psnTrophyId: number | null): TrophyCollection | null {
  if (!npCommunicationId || psnTrophyId === null) return null;
  return ALL.find((g) => g.npCommunicationId === npCommunicationId)?.collections.find((c) => c.trophy === psnTrophyId) ?? null;
}
