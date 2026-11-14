import { invoke } from "@tauri-apps/api/core";
import type { Game } from "./games";
export interface PcGame { name:string; process?:string; game_id?:string|null }
export interface ProcessBinding {game_id:string;name:string;process:string}
const KEY="nexus-pc-process-bindings";
export function pcBindings():ProcessBinding[]{
 try{const value=JSON.parse(localStorage.getItem(KEY)||"[]");return Array.isArray(value)?value.filter((v):v is ProcessBinding=>typeof v?.game_id==="string"&&typeof v?.name==="string"&&typeof v?.process==="string"):[];}catch{return [];}
}
export function bindPcGame(game:Pick<Game,"id"|"title">,process:string|null){
 const bindings=pcBindings().filter(b=>b.game_id!==game.id);
 if(process){const value=process.trim();if(value.length>255||!value.toLowerCase().endsWith(".exe")||/[\\/:\x00-\x1f]/.test(value))throw Error("Introduce solo el nombre del ejecutable, por ejemplo 7ds.exe, sin su ruta.");if(bindings.some(b=>b.process.toLowerCase()===value.toLowerCase()))throw Error("Ese proceso ya está asociado a otro juego. Retira esa asociación primero.");bindings.push({game_id:game.id,name:game.title,process:value});}
 localStorage.setItem(KEY,JSON.stringify(bindings));window.dispatchEvent(new Event("nexus-game-mode-changed"));
}
export const pcNowPlaying=()=>invoke<PcGame[]>("pc_now_playing",{bindings:pcBindings()});
export const pcRunningApps=()=>invoke<string[]>("pc_running_apps");
