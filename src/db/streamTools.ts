import { invoke } from "@tauri-apps/api/core";

/** Comandos de chat (D-030). */
export interface ChatCommand {
  trigger: string;
  response: string;
  cooldown: number;
  enabled: boolean;
}
export interface ChatCommandsConfig {
  enabled: boolean;
  commands: ChatCommand[];
}
export interface ChatCommandsState {
  config: ChatCommandsConfig;
  status: Record<string, { trigger: string; at: number; error: string | null }> | null;
}
export const chatCommandsGet = () => invoke<ChatCommandsState>("chat_commands_get");
export const chatCommandsSave = (config: ChatCommandsConfig) => invoke<ChatCommandsConfig>("chat_commands_save", { config });
export const chatCommandsPreview = (response: string, platform: string) =>
  invoke<string>("chat_commands_preview", { response, platform });

/** Permisos de Twitch concedidos y los que faltan. */
export interface TwitchScopes {
  connected: boolean;
  error?: string;
  login?: string;
  missing: { scope: string; for: string }[];
}
export const twitchScopes = () => invoke<TwitchScopes>("twitch_scopes");
export const streamTitleGet = () => invoke<{ title: string | null; game: string | null }>("stream_title_get");
export const streamTitleSet = (title: string) => invoke<void>("stream_title_set", { title });

/** Clips para Shorts (D-031). */
export type ShortFormat = "horizontal" | "vertical_crop" | "vertical_blur";
export interface ShortExport {
  id: string;
  created_at: string;
  source_kind: "moment" | "clip";
  title: string;
  format: ShortFormat;
  path: string;
  exists: boolean;
}
export const shortsStatus = () => invoke<{ ffmpeg: string | null }>("shorts_status");
export const shortsInstallFfmpeg = () => invoke<void>("shorts_install_ffmpeg");
export const shortsRender = (kind: "moment" | "clip", id: string, format: ShortFormat, before: number, after: number) =>
  invoke<{ path: string }>("shorts_render", { kind, id, format, before, after });
export const shortsList = () => invoke<ShortExport[]>("shorts_list");
