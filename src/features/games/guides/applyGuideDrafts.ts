import type { Trophy, TrophyPhase } from "../../../db/games";
import { createGuideEntry } from "../../../db/guide";
import type { GuideDrafts } from "./types";

/** Crea las entradas de los borradores, enlazando cada una a su fase (por nombre) y a sus trofeos. */
export async function applyGuideDrafts(gameId: string, drafts: GuideDrafts, phases: TrophyPhase[], trophies: Trophy[]): Promise<void> {
  for (const d of drafts.entries) {
    await createGuideEntry(gameId, {
      kind: d.kind,
      title: d.title,
      phase_id: phases.find((p) => p.name === d.phase)?.id ?? null,
      summary: d.summary,
      body: d.body,
      image: null,
      video_url: null,
      source_url: d.source_url ?? null,
      verified: d.verified,
      trophy_ids: (d.trophies ?? [])
        .map((psnId) => trophies.find((x) => x.psn_trophy_id === psnId)?.id)
        .filter((id): id is string => !!id),
    });
  }
}
