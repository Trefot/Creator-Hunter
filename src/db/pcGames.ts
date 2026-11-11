import { invoke } from "@tauri-apps/api/core";

export interface PcGame { name: string }
export const pcNowPlaying = () => invoke<PcGame[]>("pc_now_playing");
