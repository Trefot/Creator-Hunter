import {useEffect,useState} from 'react';
import {invoke} from '@tauri-apps/api/core';
import {revealItemInDir} from '@tauri-apps/plugin-opener';
export function AudioPicker({kind,id,value,onChange,required=false}:{kind:string;id:string;value:number[]|undefined;onChange:(v:number[])=>void;required?:boolean}){
 const [tracks,setTracks]=useState<{index:number;channels:number;title:string|null}[]|null>(null),[error,setError]=useState('');
 useEffect(()=>{let stopped=false;setTracks(null);setError('');invoke<{audio:{index:number;channels:number;title:string|null}[]}>('media_inspect',{kind,id}).then(data=>{if(!stopped){setTracks(data.audio);onChange(data.audio.length?[0]:[])}}).catch(e=>{if(!stopped)setError(String(e))});return()=>{stopped=true}},[kind,id]);
 return <fieldset><legend>Audio {required?'para transcribir':'del Short'}</legend>{tracks===null&&!error&&<p className="muted small">Consultando pistas…</p>}{tracks?.map(t=><label key={t.index} style={{display:'flex',gap:8,alignItems:'center'}}><input type="checkbox" checked={value?.includes(t.index)??false} onChange={e=>onChange(e.target.checked?[...(value??[]),t.index]:(value??[]).filter(n=>n!==t.index))}/>{t.title||`Pista ${t.index+1}`} · {t.channels} canales</label>)}{tracks?.length===0&&<p role="status">Este vídeo no tiene audio.</p>}<p className="muted small">Selecciona la pista que contiene tu voz. Marca varias para mezclarlas; si una ya contiene voz y juego, elige solo esa para evitar duplicarlos.{!required&&' Sin selección, el Short se guarda sin audio.'}</p>{error&&<p role="alert" className="error">{error}</p>}</fieldset>
}
interface Job{id:number;title:string;state:string;progress:number;result:string|null;error:string|null;request?:{command:string;args:Record<string,unknown>}}
const labels:Record<string,string>={queued:'En cola',running:'Procesando',done:'Terminado',error:'Error',cancelled:'Cancelado',interrupted:'Interrumpido al cerrar Nexus',finishing:'Guardando resultado'};
/** Siempre montado en App: navegar no pierde el estado de los procesos nativos. */
export function MediaQueue(){
 const [gpu,setGpu]=useState(''),[gpuBusy,setGpuBusy]=useState(false);
 const [data,setData]=useState<{jobs:Job[];light:boolean;obs_busy:boolean}|null>(null),[error,setError]=useState('');
 useEffect(()=>{let stopped=false,running=false;const poll=async()=>{if(running)return;running=true;try{const v=await invoke<typeof data>('media_jobs_status');if(!stopped)setData(v)}catch(e){if(!stopped)setError(String(e))}finally{running=false}};void poll();const timer=setInterval(poll,1500);return()=>{stopped=true;clearInterval(timer)}},[]);
 async function light(enabled:boolean){try{await invoke('media_jobs_light',{enabled});setData(v=>v?{...v,light:enabled}:v);setError('')}catch(e){setError(String(e))}}
 const unfinished=data?.jobs.filter(j=>['queued','running','finishing'].includes(j.state))??[];
 return <details className="card media-queue" style={{margin:'8px 24px'}}><summary>Procesamiento local · {unfinished.length?`${unfinished.length} pendiente(s)`:'sin trabajos pendientes'}</summary>
 <label style={{display:'flex',gap:8}}><input type="checkbox" checked={data?.light??true} disabled={!data} onChange={e=>void light(e.target.checked)}/>Modo ligero: menos carga de CPU y trabajos nuevos en espera mientras OBS graba o emite</label>
 {data?.light&&data.obs_busy&&<p className="muted small">Los trabajos en cola empezarán cuando termines la grabación o emisión. Los ya iniciados continúan.</p>}
 <p className="muted small">Una exportación o transcripción a la vez. Puedes cambiar de apartado. El historial se conserva al cerrar. Los trabajos interrumpidos se pueden revisar y volver a solicitar; no se reanudan a mitad del archivo.</p>
 <button className="ghost small-button" disabled={gpuBusy} onClick={async()=>{setGpuBusy(true);setError('');try{const r=await invoke<{available:boolean;detail:string}>('media_gpu_test');setGpu(r.detail)}catch(e){setError(String(e))}finally{setGpuBusy(false)}}}>{gpuBusy?'Probando GPU (consulta la cola)…':'Probar aceleración NVIDIA'}</button>{gpu&&<p role="status" className="small">{gpu}</p>}
 <ul className="status-list">{data?.jobs.slice(-12).reverse().map(j=><li key={j.id} className="status-item"><span className="status-text"><strong>{j.title}</strong><span>{labels[j.state]??j.state} {j.state==='running'?`${j.progress}%`:''}</span>{j.error&&<span className="error">{j.error}</span>}</span>{['queued','running'].includes(j.state)&&<button className="ghost small-button" onClick={()=>invoke('media_jobs_cancel',{id:j.id}).catch(e=>setError(String(e)))}>Cancelar</button>}{j.state==='interrupted'&&j.request&&['shorts_render','subtitles_generate'].includes(j.request.command)&&<button className="ghost small-button" onClick={()=>void invoke(j.request!.command,j.request!.args).catch(e=>setError(String(e)))}>Volver a solicitar</button>}{j.result&&<button className="ghost small-button" onClick={()=>revealItemInDir(j.result!)}>Mostrar archivo</button>}</li>)}</ul>{error&&<p role="alert" className="error">{error}</p>}</details>
}

export function ExportNextSteps({path,exportId}:{path:string;exportId?:string}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function next(kind:'project'|'subtitles'){
  setBusy(true);setError('');try{
   if(kind==='project'&&exportId){const id=await invoke<string>('studio_export_project',{exportId});window.dispatchEvent(new CustomEvent('nexus-open-project',{detail:id}));}
   else if(kind==='subtitles'){const id=await invoke<string>('subtitles_import',{path});window.dispatchEvent(new CustomEvent('nexus-select-recording',{detail:id}));}
  }catch(e){setError(String(e))}finally{setBusy(false)}
 }
 return <div className="tools-actions">{exportId&&<button className="ghost small-button" disabled={busy} onClick={()=>void next('project')}>Continuar en proyecto y calendario</button>}<button className="ghost small-button" disabled={busy} onClick={()=>void next('subtitles')}>Crear subtítulos de este Short</button>{error&&<p className="error" role="alert">{error}</p>}</div>
}
