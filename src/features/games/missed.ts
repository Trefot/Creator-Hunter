import { Trophy, TrophyPhase, updateTrophyPlan } from "../../db/games";
import { formatDate, todayIso } from "../../i18n/format";

/** La fase de NG+ de la ruta (la que lleva "NG+" en el nombre), si existe. */
export function ngPlusPhase(phases: TrophyPhase[]): TrophyPhase | null {
  return phases.find((p) => /NG\+/i.test(p.name)) ?? null;
}

/**
 * "Ya lo perdí": el perdible pasa a la fase de NG+ y deja de avisar como perdible
 * (en el nuevo ciclo vuelve a estar disponible). Se apunta en su nota cuándo se perdió.
 */
export async function sendToNgPlus(trophy: Trophy, ngPhase: TrophyPhase): Promise<void> {
  const mark = `Perdido en la 1.ª partida (${formatDate(todayIso())}): recupéralo en NG+. Lo que ya tengas se conserva.`;
  await updateTrophyPlan(trophy.id, {
    phase_id: ngPhase.id,
    missable: false,
    note: trophy.note ? `${mark}\n${trophy.note}` : mark,
  });
}
