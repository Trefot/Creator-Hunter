import { invoke } from "@tauri-apps/api/core";

/** Conexión con YouTube; el trabajo lo hacen los comandos de Rust (src-tauri/src/youtube.rs, D-015). */

export interface YouTubeChannel {
  id: string;
  title: string;
  custom_url: string | null;
  thumbnail: string | null;
  /** Redondeado por YouTube a 3 cifras significativas. */
  subscribers: number | null;
  views: number | null;
  videos: number | null;
}

export interface YouTubeConnection {
  profile_id: string;
  channel: YouTubeChannel;
}

export interface YouTubeStatus {
  configured: boolean;
  connected: boolean;
  connection: YouTubeConnection | null;
}

export const youtubeStatus = () => invoke<YouTubeStatus>("youtube_status");

export const importGoogleClient = (content: string) => invoke<void>("youtube_import_client", { content });

export const connectYouTube = (profileId: string) =>
  invoke<{ connection: YouTubeConnection; avatar: string | null }>("youtube_connect", { profileId });

export const fetchYouTubeChannel = () => invoke<YouTubeChannel>("youtube_channel");

export const disconnectYouTube = () => invoke<void>("youtube_disconnect");

export interface YouTubeSyncData {
  profile_id: string;
  channel: YouTubeChannel;
  watch_hours: number | null;
  warning: string | null;
}

export interface YouTubeVideoStats {
  id: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  /** Compartidos y horas vienen de Analytics: 1–2 días de retraso. */
  shares: number | null;
  watch_hours: number | null;
}

/** Estadísticas de varios vídeos; start/end acotan los datos de Analytics. */
export const fetchVideoStats = (ids: string[], start: string, end: string) =>
  invoke<{ videos: YouTubeVideoStats[]; warning: string | null }>("youtube_video_stats", { ids, start, end });

/** Datos del canal y horas de visualización del intervalo [start, end] (fechas 'AAAA-MM-DD'). */
export const syncYouTubeData = (start: string, end: string) => invoke<YouTubeSyncData>("youtube_sync", { start, end });
