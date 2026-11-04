import { upsertApiSnapshot } from "../../db/accountSnapshots";
import { listAllAdaptations } from "../../db/adaptations";
import { upsertApiResult } from "../../db/results";
import { fetchVideoStats, syncYouTubeData, YouTubeSyncData, youtubeStatus } from "../../db/youtube";
import { todayIso } from "../../i18n/format";
import { addDays } from "../calendar/week";
import { extractVideoId } from "./youtubeVideo";

export interface SyncResult extends YouTubeSyncData {
  /** Publicaciones cuyos resultados se actualizaron. */
  videosSynced: number;
}

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
export async function runYouTubeSync(): Promise<SyncResult> {
  const today = todayIso();
  const data = await syncYouTubeData(addDays(today, -364), today);
  await upsertApiSnapshot(data.profile_id, today, {
    followers: data.channel.subscribers,
    watch_hours: data.watch_hours,
    total_views: data.channel.views,
  });

  const videos = await syncPublishedVideos();
  const warning = data.warning ?? videos.warning;
  const videosSynced = videos.synced;
  try {
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  } catch {
    // Sin almacenamiento local solo se pierde el límite de frecuencia.
  }
  return { ...data, warning, videosSynced };
}

/**
 * Resultados del día (origen 'api') de las publicaciones con enlace de YouTube.
 * Con `onlyAdaptationId`, solo los de esa publicación (al abrir sus Resultados).
 */
export async function syncPublishedVideos(onlyAdaptationId?: string): Promise<{ synced: number; warning: string | null }> {
  const today = todayIso();
  const published = (await listAllAdaptations())
    .filter((a) => !onlyAdaptationId || a.id === onlyAdaptationId)
    .map((a) => ({ adaptation: a, videoId: extractVideoId(a.published_url) }))
    .filter((x): x is { adaptation: typeof x.adaptation; videoId: string } => x.videoId !== null);
  if (published.length === 0) return { synced: 0, warning: null };

  const earliest = published
    .map((x) => x.adaptation.published_at?.slice(0, 10) ?? today)
    .reduce((a, b) => (a < b ? a : b));
  const stats = await fetchVideoStats(
    published.map((x) => x.videoId),
    earliest,
    today,
  );
  let synced = 0;
  for (const { adaptation, videoId } of published) {
    const s = stats.videos.find((v) => v.id === videoId);
    if (!s) continue;
    await upsertApiResult(adaptation.id, today, s);
    synced++;
  }
  return { synced, warning: stats.warning };
}

/** Sincroniza al abrir la app si YouTube está conectado y hace más de 3 horas de la última vez. */
export async function autoSyncYouTube(): Promise<SyncResult | null> {
  const last = lastYouTubeSync();
  if (last && Date.now() - last.getTime() < AUTO_SYNC_INTERVAL_MS) return null;
  const status = await youtubeStatus();
  if (!status.connected || !status.connection) return null;
  return runYouTubeSync();
}
