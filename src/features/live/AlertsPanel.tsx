import {useEffect,useState} from "react";
import {invoke} from "@tauri-apps/api/core";
import {AlertPreview} from "./AlertPreview";
import {getDb} from "../../db/database";
import {AlertConfig,AlertEvent,AlertStatus,Platform} from "./alertTypes";
interface Live{running:boolean;port:number;key:string}
const platformNames={twitch:'Twitch',youtube:'YouTube',tiktok:'TikTok'};
const designs=[['reference','Saludo de la muestra'],['celebrate','Celebración'],['gift','Regalo'],['support','Aporte y diamante'],['raid','Portal de raid'],['heart','Corazones']] as const;
const tones=[['soft','Bienvenida'],['celebrate','Celebración'],['sparkle','Destellos'],['portal','Portal'],['heart','Corazones']] as const;
export function AlertsPanel(){
 const [status,setStatus]=useState<AlertStatus|null>(null),[live,setLive]=useState<Live|null>(null),[error,setError]=useState(''),[loadError,setLoadError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{let cancelled=false,timer:ReturnType<typeof setTimeout>;async function poll(){try{await getDb();const [s,l]=await Promise.all([invoke<AlertStatus>('alerts_status'),invoke<Live>('live_status')]);if(!cancelled){setStatus(s);setLive(l);setLoadError('')}}catch(e){if(!cancelled)setLoadError(String(e))}finally{if(!cancelled)timer=setTimeout(poll,2000)}}void poll();return()=>{cancelled=true;clearTimeout(timer)}},[]);
 async function action(platform:Platform,action:string,eventKind?:string){try{setStatus(await invoke<AlertStatus>('alerts_action',{platform,action,eventKind:eventKind??null}));setError('');setNotice(action==='test'?'Prueba guardada en la cola de esa plataforma.':'Control aplicado.')}catch(e){setError(String(e))}}
 async function copy(platform:Platform,action?:string,eventKind?:string){if(!live?.running)return;const base=`http://127.0.0.1:${live.port}`,url=action?`${base}/api/alerts/${platform}/${action}?key=${encodeURIComponent(live.key)}${action==='test'&&eventKind?'&event='+encodeURIComponent(eventKind):''}`:`${base}/alerts/${platform}?key=${encodeURIComponent(live.key)}`;try{await navigator.clipboard.writeText(url);setNotice('URL copiada. La fuente de OBS es la misma para todos los eventos de esta plataforma.');setError('')}catch(e){setError(String(e))}}
 return <section className="card alerts-manager"><h2>Alertas por plataforma</h2><p className="muted">Un enlace y una cola por plataforma, con una plantilla para cada evento. La recepción automática de Twitch, YouTube y TikTok sigue pendiente; las pruebas y los anuncios manuales funcionan desde Nexus.</p>
 {(error||loadError)&&<p className="error" role="alert">{error||loadError}</p>}{notice&&<p className="small" role="status">{notice}</p>}
 {status&&<><label className="alerts-check"><input type="checkbox" checked={status.settings.coordinate_audio} onChange={async e=>{try{setStatus(await invoke<AlertStatus>('alerts_audio',{coordinate:e.target.checked}));setError('')}catch(e){setError(String(e))}}}/> Evitar sonidos simultáneos entre plataformas</label>
 <div className="alerts-grid">{(['twitch','youtube','tiktok'] as const).map(platform=><Channel key={platform} platform={platform} control={status.settings[platform]} events={status.events[platform]} pending={status[`${platform}_pending`]} ready={!!live?.running} action={(a,kind)=>action(platform,a,kind)} copy={(a,kind)=>copy(platform,a,kind)} save={async(kind,config)=>{setStatus(await invoke<AlertStatus>('alerts_save_event',{platform,eventKind:kind,config}));setNotice(`Plantilla guardada en ${platformNames[platform]}.`);setError('');}}/>)}</div></>}
 <p className="muted small">En OBS conserva una Fuente de navegador por plataforma, de 640×300. No necesitas añadir otra por cada evento. Activa «Controlar audio mediante OBS». Pausa y silencio afectan a toda la plataforma; ilustración, duración, texto y sonido se guardan por evento. Nexus debe permanecer abierto.</p>
 </section>
}
function Channel({platform,control,events,pending,ready,action,copy,save}:{platform:Platform;control:AlertConfig;events:AlertEvent[];pending:number;ready:boolean;action:(a:string,kind?:string)=>Promise<void>;copy:(a?:string,kind?:string)=>Promise<void>;save:(kind:string,c:AlertConfig)=>Promise<void>}){
 const [selected,setSelected]=useState(events[0]?.kind||''),[drafts,setDrafts]=useState<Record<string,AlertConfig>>({}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[title,setTitle]=useState(''),[message,setMessage]=useState('');
 const entry=events.find(e=>e.kind===selected)||events[0];if(!entry)return <p className="error">No hay plantillas para esta plataforma.</p>;
 const kind=entry.kind,draft=drafts[kind]||entry.config,editing=!!drafts[kind];
 const update=(patch:Partial<AlertConfig>)=>setDrafts(prev=>({...prev,[kind]:{...(prev[kind]||entry.config),...patch}}));
 async function store(){const submitted=draft,target=kind;setBusy(true);try{await save(target,submitted);setDrafts(prev=>{if(prev[target]!==submitted)return prev;const next={...prev};delete next[target];return next});setError('')}catch(e){setError(String(e))}finally{setBusy(false)}}
 async function announce(){setBusy(true);try{await invoke('alerts_announce',{platform,title,message});setTitle('');setMessage('');setError('')}catch(e){setError(String(e))}finally{setBusy(false)}}
 return <section className={`alerts-channel ${platform}`}><header><h3>{platformNames[platform]}</h3><span className="muted small">{pending} en cola · {control.paused?'Cola pausada':'Cola activa'} · {control.muted?'Silenciada':'Sin silencio global'}</span></header><span className="alerts-disconnected">Eventos de la red sin conectar</span>
 <label className="alert-event-picker">Tipo de alerta de {platform}<select aria-label={`Tipo de alerta de ${platform}`} value={kind} disabled={busy} onChange={e=>{setSelected(e.target.value);setError('')}}>{events.map(e=><option value={e.kind} key={e.kind}>{e.name}{drafts[e.kind]?' · sin guardar':''}</option>)}</select></label>
 <p className="muted small">La fuente de OBS y su posición son las mismas. Cada evento conserva su configuración y los borradores sobreviven al cambiar de evento.</p>
 <AlertPreview key={kind} platform={platform} config={draft}/>
 <button className="ghost small-button" disabled={busy} onClick={()=>setDrafts(prev=>({...prev,[kind]:{...entry.defaults}}))}>Cargar diseño de la muestra de {platform}</button><p className="muted small">Carga el diseño y los textos de {entry.name.toLowerCase()} en el borrador. Pulsa Guardar para aplicarlos.</p>
 <div className="alerts-fields">
 <label className="alerts-check"><input type="checkbox" checked={draft.enabled} onChange={e=>update({enabled:e.target.checked})}/> Activar alerta de {entry.name.toLowerCase()}</label>
 <label>Ilustración de {platform}<select aria-label={`Ilustración de ${platform}`} value={draft.design} onChange={e=>update({design:e.target.value})}>{designs.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
 <label>Título de {platform}<input maxLength={60} value={draft.title} onChange={e=>update({title:e.target.value})}/></label>
 <label>Duración de {platform} (segundos)<input type="number" min={3} max={15} value={draft.duration} onChange={e=>update({duration:Number(e.target.value)})}/></label>
 <label>Volumen de {platform}<input type="range" min={0} max={100} value={draft.volume} onChange={e=>update({volume:Number(e.target.value)})}/>{draft.volume}%</label>
 <label>Melodía de {platform}<select aria-label={`Melodía de ${platform}`} value={draft.tone} onChange={e=>update({tone:e.target.value})}>{tones.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
 <label className="alerts-check"><input type="checkbox" checked={draft.sound} onChange={e=>update({sound:e.target.checked})}/> Sonido de {platform}</label>
 </div>
 <details open><summary>Identidad y texto de {platform}</summary><div className="alerts-fields">
 <label>Color de la etiqueta de {platform}<input type="color" value={draft.label_color} onChange={e=>update({label_color:e.target.value})}/></label>
 <label>Color del nombre de {platform}<input type="color" value={draft.text_color} onChange={e=>update({text_color:e.target.value})}/></label>
 <label>Color del mensaje de {platform}<input type="color" value={draft.message_color} onChange={e=>update({message_color:e.target.value})}/></label>
 <label>Tipografía de {platform}<select aria-label={`Tipografía de ${platform}`} value={draft.font_family} onChange={e=>update({font_family:e.target.value})}><option value="sans">Moderna</option><option value="serif">Clásica</option><option value="mono">Monoespaciada</option></select></label>
 <label>Tamaño del nombre de {platform}<input type="number" min={24} max={48} value={draft.name_size} onChange={e=>update({name_size:Number(e.target.value)})}/></label>
 <label>Tamaño del mensaje de {platform}<input type="number" min={12} max={22} value={draft.message_size} onChange={e=>update({message_size:Number(e.target.value)})}/></label>
 <label>Etiqueta del evento de {platform}<input maxLength={50} value={draft.event_label} onChange={e=>update({event_label:e.target.value})}/></label>
 <label>Nombre de prueba de {platform}<input maxLength={40} value={draft.sample_name} onChange={e=>update({sample_name:e.target.value})}/></label>
 <label>Cantidad de prueba de {platform}<input maxLength={24} value={draft.sample_amount} onChange={e=>update({sample_amount:e.target.value})}/></label>
 <label>Mensaje recibido de prueba de {platform}<input maxLength={120} value={draft.sample_note} onChange={e=>update({sample_note:e.target.value})}/></label>
 <label>Mensaje de la plantilla de {platform}<textarea aria-label={`Mensaje de la plantilla de ${platform}`} maxLength={160} value={draft.message_template} onChange={e=>update({message_template:e.target.value})}/><span className="muted small">Variables: {"{usuario}"}, {"{cantidad}"} y {"{mensaje}"}. Se insertan como texto.</span></label>
 </div></details>
 <div className="alerts-buttons"><button disabled={busy||!editing} onClick={store}>Guardar {platform}</button><button className="ghost" disabled={!ready} onClick={()=>copy()}>Copiar URL de {platform}</button><button className="ghost" disabled={!ready||busy||editing||!entry.config.enabled} onClick={()=>action('test',kind)}>Probar {platform}</button><button className="ghost" onClick={()=>action('pause')}>{control.paused?'Reanudar':'Pausar'} {platform}</button><button className="ghost" onClick={()=>action('mute')}>{control.muted?'Activar sonido':'Silenciar'} {platform}</button><button className="ghost" onClick={()=>action('replay')}>Repetir última de {platform}</button><button className="ghost" onClick={()=>action('clear')}>Vaciar pendientes de {platform}</button></div>
 {editing&&<p className="muted small">Hay cambios sin guardar en este evento. Guarda antes de probarlo en OBS.</p>}
 <details><summary>Controles de {platform} para Stream Deck</summary><p className="muted small">La prueba copiada corresponde a {entry.name.toLowerCase()}. Pausa y silencio son interruptores de toda la plataforma.</p><div className="alerts-buttons">{([['test','Prueba'],['pause','Pausa'],['mute','Silencio'],['replay','Repetir']] as const).map(([a,label])=><button className="ghost small-button" disabled={!ready} key={a} onClick={()=>copy(a,kind)}>Copiar {label}</button>)}</div></details>
 <details><summary>Anuncio manual en {platform}</summary><label>Título del anuncio de {platform}<input value={title} maxLength={80} onChange={e=>setTitle(e.target.value)}/></label><label>Mensaje de {platform}<textarea value={message} maxLength={240} onChange={e=>setMessage(e.target.value)}/></label><button disabled={busy||!ready||!title.trim()} onClick={announce}>Enviar anuncio a {platform}</button></details>
 {error&&<p className="error" role="alert">{error}</p>}</section>
}
