import { createPhase, listTrophies, updateTrophyPlan } from "../../db/games";
import type { Roadmap } from "./roadmaps/types";

/**
 * Aplica una ruta sugerida a un juego sin fases: crea las fases en orden y asigna cada trofeo,
 * marcando perdibles. Las notas sugeridas solo se ponen donde el usuario no ha escrito la suya.
 */
export async function applyRoadmap(gameId: string, roadmap: Roadmap): Promise<void> {
  const trophies = await listTrophies(gameId);
  const byPsnId = new Map(trophies.map((t) => [t.psn_trophy_id, t]));
  for (const phase of roadmap.phases) {
    const phaseId = await createPhase(gameId, phase.name, phase.note);
    for (const psnId of phase.trophies) {
      const trophy = byPsnId.get(psnId);
      if (!trophy) continue;
      const suggested = roadmap.trophies[psnId] ?? {};
      await updateTrophyPlan(trophy.id, {
        phase_id: phaseId,
        missable: trophy.missable || !!suggested.missable,
        note: trophy.note ?? suggested.note ?? null,
      });
    }
  }
}
