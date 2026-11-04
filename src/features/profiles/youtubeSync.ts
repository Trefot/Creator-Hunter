import { upsertApiSnapshot } from "../../db/accountSnapshots";
import { syncYouTubeData, YouTubeSyncData, youtubeStatus } from "../../db/youtube";
import { todayIso } from "../../i18n/format";
import { addDays } from "../calendar/week";

/** Sincronización automática como mucho cada 3 horas (D-015). */
const AUTO_SYNC_INTERVAL_MS = 3 * 60 * 60 * 1000;
const LAST_SYNC_KEY = "youtube-last-sync";

/** Momento de la última sincronización correcta, o null. Guardado solo en este equipo. */
export function lastYouTubeSync(): Date | null {
  try {
    const value = localStorage.getItem(LAST_SYNC_KEY);
    return value ? new Date(value) : null;
  } catch {
    return null;
  }
}

/**
 * Sincroniza el canal y guarda el registro del día con origen 'api'.
 * Las horas son las de los últimos 365 días, la cuenta que se usa para las 4.000 h.
 */
export async function runYouTubeSync(): Promise<YouTubeSyncData> {
  const today = todayIso();
  const data = await syncYouTubeData(addDays(today, -364), today);
  await upsertApiSnapshot(data.profile_id, today, {
    followers: data.channel.subscribers,
    watch_hours: data.watch_hours,
    total_views: data.channel.views,
  });
  try {
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  } catch {
    // Sin almacenamiento local solo se pierde el límite de frecuencia.
  }
  return data;
}

/** Sincroniza al abrir la app si YouTube está conectado y hace más de 3 horas de la última vez. */
export async function autoSyncYouTube(): Promise<YouTubeSyncData | null> {
  const last = lastYouTubeSync();
  if (last && Date.now() - last.getTime() < AUTO_SYNC_INTERVAL_MS) return null;
  const status = await youtubeStatus();
  if (!status.connected || !status.connection) return null;
  return runYouTubeSync();
}
