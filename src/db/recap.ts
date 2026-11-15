import { invoke } from "@tauri-apps/api/core";

/** Total por plataforma y tipo de evento durante el directo. */
export interface RecapTotal {
  platform: string;
  kind: string;
  count: number;
  /** Bits, subs regaladas o espectadores del raid (0 si no aplica). */
  sum: number;
}

export interface RecapSupporter {
  platform: string;
  kind: string;
  name: string;
  amount: number;
  /** Importes mostrados de Super Chats y Super Stickers. */
  detail: string;
}

export interface StreamRecap {
  id: string;
  started_at: string;
  ended_at: string | null;
  end_reason: string | null;
  seen: boolean;
  game_id: string | null;
  game: string | null;
  duration_ms: number;
  summary: { totals: RecapTotal[]; supporters: RecapSupporter[]; new_people: number; events: number };
  counters: { id: string; name: string; icon: string; color: string; start: number; end: number; delta: number }[];
  moments: { title: string; stream_ms: number | null }[];
  clips: { title: string; output_path: string }[];
  trophies: { name: string; type: string; icon_url: string | null; game: string }[];
}

export const streamRecaps = () => invoke<StreamRecap[]>("stream_recaps");
export const streamRecap = (id: string) => invoke<StreamRecap>("stream_recap", { id });
export const markRecapSeen = (id: string) => invoke<void>("stream_recap_seen", { id });
export const recapDiscordPreview = (id: string) =>
  invoke<{ embeds: { title: string; description: string }[] }>("stream_recap_discord_preview", { id });
/** true si se publicó; false si ya se había publicado antes. */
export const publishRecapToDiscord = (id: string) => invoke<boolean>("stream_recap_discord", { id });

/** Un directo vale la pena enseñarlo si duró algo o pasó algo durante él. */
export function recapHasContent(r: StreamRecap): boolean {
  return (
    r.duration_ms >= 2 * 60_000 ||
    r.summary.events > 0 ||
    r.counters.some((c) => c.delta !== 0) ||
    r.moments.length > 0 ||
    r.clips.length > 0 ||
    r.trophies.length > 0
  );
}
