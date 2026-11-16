import {listen} from '@tauri-apps/api/event';
import {invoke} from '@tauri-apps/api/core';
import {todayIso} from '../../i18n/format';
export interface MetricConnection{configured:boolean;auto:boolean;pending?:boolean;redirect_uri?:string;last_auth_ms?:number;profile_id?:string;facebook_profile?:string;instagram_profile?:string;name?:string;last_sync_ms?:number;error?:string}
export type MetricConnections=Record<'twitch'|'meta'|'tiktok',MetricConnection>;
const pending=new Map<string,Promise<unknown>>();
export function syncMetrics(platform:string,profileId?:string):Promise<unknown>{
 let request=pending.get(platform);if(request)return request;
 request=invoke('metrics_sync',{platform,profileId:profileId??null,date:todayIso()}).then(r=>{window.dispatchEvent(new Event('nexus-metrics-changed'));return r}).finally(()=>pending.delete(platform));
 pending.set(platform,request);return request;
}
/** Connected accounts only; once per three hours. Errors never replace the last good snapshot. */
export function startSocialSync(onChanged:()=>void){
 let stopped=false,busy=false,again=false;
 const failed=new Map<string,number>();
 async function tick(){
  if(busy||stopped)return;busy=true;
  try{
   const states=await invoke<MetricConnections>('metrics_status');if(stopped)return;
   for(const platform of ['twitch','meta','tiktok'] as const){
    const c=states?.[platform];if(!c?.configured||!c.auto||Date.now()-(c.last_sync_ms??0)<3*3600000||Date.now()-(failed.get(platform)??0)<15*60000)continue;
    if(stopped)return;
    try{await syncMetrics(platform)}catch(e){failed.set(platform,Date.now());window.dispatchEvent(new CustomEvent('nexus-sync-error',{detail:platform+': '+String(e)}))}
   }
  }catch{/* Not configured or unavailable: the connection center explains what to resolve. */}
  finally{busy=false;if(again&&!stopped){again=false;void tick()}}
 }
 const changed=()=>{if(!stopped)onChanged()};
 const unlisten=listen('metrics-changed',()=>{if(!stopped){onChanged();if(busy)again=true;else void tick()}});
 const resumed=()=>void tick();window.addEventListener('focus',resumed);
 window.addEventListener('nexus-metrics-changed',changed);const timer=setInterval(()=>void tick(),10*60000);void tick();
 return()=>{stopped=true;window.removeEventListener('focus',resumed);void unlisten.then(fn=>fn());clearInterval(timer);window.removeEventListener('nexus-metrics-changed',changed)};
}
