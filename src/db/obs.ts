import { invoke } from "@tauri-apps/api/core";
export interface ObsStatus {
  enabled:boolean; port:number; connected:boolean; recording:boolean; paused:boolean; streaming:boolean;
  record_ms:number|null; stream_ms:number|null; error:string|null; last_update_ms:number;
  replay_active:boolean; saving_replay:boolean;
}
export interface ObsMarker {
  id:string; title:string; created_at:string; record_ms:number|null; stream_ms:number|null;
  game_title:string|null; output_path:string|null; kind:"recording"|"stream"; observed_at:string; end_reason:string|null;
}
export const obsStatus=()=>invoke<ObsStatus>("obs_status");
export const obsConfigure=(port:number,password:string|null)=>invoke<void>("obs_configure",{port,password});
export const obsDisconnect=()=>invoke<void>("obs_disconnect");
export const obsMark=(title?:string)=>invoke<{id:string;record_ms:number|null;stream_ms:number|null}>("obs_mark",{title:title?.trim()||null});
export const obsMarkers=()=>invoke<ObsMarker[]>("obs_markers");
export function obsTime(ms:number|null):string {
  if(ms===null||!Number.isFinite(ms)||ms<0)return "—";
  const seconds=Math.floor(ms/1000);
  return [Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(n=>String(n).padStart(2,"0")).join(":");
}
export function momentsText(markers:ObsMarker[]):string {
  return markers.map(m=>`${m.created_at} · ${m.game_title??""} · ${m.title}\nGrabación: ${obsTime(m.record_ms)} · Directo: ${obsTime(m.stream_ms)}\nArchivo: ${m.output_path??"No confirmado por OBS"}`).join("\n\n");
}

export interface ObsClip {
  id:string; title:string; created_at:string; output_path:string; game_title:string|null;
  marker_id:string|null; record_ms:number|null; stream_ms:number|null;
}
export const obsSaveReplay=(title?:string)=>invoke<ObsClip>("obs_save_replay",{title:title?.trim()||null});
export const obsClips=()=>invoke<ObsClip[]>("obs_clips");
