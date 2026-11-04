import { invoke } from "@tauri-apps/api/core";

/** Conexión NO oficial con PSN (D-016); el trabajo lo hacen los comandos de Rust (src-tauri/src/psn.rs). */

export interface PsnTitle {
  np_communication_id: string;
  np_service_name: "trophy" | "trophy2";
  name: string;
  icon_url: string | null;
  /** "PS5", "PS4" o ambos separados por comas. */
  platform: string;
  progress: number;
  earned: number;
  defined: number;
  last_updated: string | null;
}

export interface PsnTrophy {
  psn_trophy_id: number;
  group_id: string | null;
  name: string;
  detail: string | null;
  trophy_type: "bronze" | "silver" | "gold" | "platinum";
  hidden: boolean;
  icon_url: string | null;
  earned_at: string | null;
  earned_rate: number | null;
}

export const psnStatus = () => invoke<boolean>("psn_status");
/** El NPSSO se canjea y se descarta; solo se guarda el refresh token en Windows. */
export const psnConnect = (npsso: string) => invoke<void>("psn_connect", { npsso });
export const psnDisconnect = () => invoke<void>("psn_disconnect");
export const psnTitles = () => invoke<PsnTitle[]>("psn_titles");
export const psnTitleTrophies = (npCommunicationId: string, npServiceName: string) =>
  invoke<PsnTrophy[]>("psn_title_trophies", { npCommunicationId, npServiceName });
export const psnDownloadImage = (url: string) => invoke<string>("psn_download_image", { url });
