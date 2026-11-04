import { platformFromPsn, upsertPsnGame, upsertPsnTrophies } from "../../db/games";
import { psnDownloadImage, PsnTitle, psnTitleTrophies } from "../../db/psn";

/** Importa (o actualiza) un juego de PSN con su portada y todos sus trofeos; devuelve el id del juego. */
export async function importFromPsn(title: PsnTitle): Promise<string> {
  // La portada se guarda como imagen local; si falla la descarga, el juego se importa igual.
  const cover = title.icon_url ? await psnDownloadImage(title.icon_url).catch(() => null) : null;
  const gameId = await upsertPsnGame({
    title: title.name,
    platform: platformFromPsn(title.platform),
    np_communication_id: title.np_communication_id,
    np_service_name: title.np_service_name,
    cover,
  });
  const trophies = await psnTitleTrophies(title.np_communication_id, title.np_service_name);
  await upsertPsnTrophies(gameId, trophies);
  return gameId;
}

/** Vuelve a leer de PSN los trofeos de un juego ya importado. */
export async function refreshFromPsn(gameId: string, npCommunicationId: string, npServiceName: string): Promise<void> {
  const trophies = await psnTitleTrophies(npCommunicationId, npServiceName);
  await upsertPsnTrophies(gameId, trophies);
}
