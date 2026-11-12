import { FormEvent, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
interface Settings { enabled:boolean; twitch_live:boolean; youtube_live:boolean; twitch_videos:boolean; youtube_videos:boolean }
interface Status { settings:Settings; live_configured:boolean; videos_configured:boolean; activity:{message?:string}|null }
const empty:Settings={enabled:false,twitch_live:false,youtube_live:false,twitch_videos:false,youtube_videos:false};
export function DiscordPanel(){
 const [status,setStatus]=useState<Status|null>(null),[settings,setSettings]=useState(empty),[live,setLive]=useState(""),[videos,setVideos]=useState("");
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 const [platform,setPlatform]=useState("youtube"),[title,setTitle]=useState(""),[url,setUrl]=useState("");
 const refresh=async()=>{const s=await invoke<Status>("discord_status");setStatus(s);return s;};
 useEffect(()=>{let cancelled=false;invoke<Status>("discord_status").then(s=>{if(!cancelled){setStatus(s);setSettings(s.settings);}}).catch(e=>{if(!cancelled)setError(String(e));});return()=>{cancelled=true;};},[]);
 async function run(action:()=>Promise<void>){if(busy)return;setBusy(true);setError("");setMessage("");try{await action();await refresh();}catch(e){setError(String(e));}finally{setBusy(false);}}
 const save=(e:FormEvent)=>{e.preventDefault();void run(async()=>{await invoke("discord_configure",{settings,liveWebhook:live||null,videosWebhook:videos||null});setLive("");setVideos("");setMessage("Configuración guardada. Los avisos automáticos se revisan cada 2 minutos mientras Nexus está abierto.");});};
 const test=(kind:string)=>void run(async()=>{await invoke("discord_test",{kind});setMessage("Mensaje de prueba enviado a Discord.");});
 const remove=(kind:string)=>void run(async()=>{await invoke("discord_remove",{kind});setMessage("Webhook retirado de este equipo.");});
 const publish=(e:FormEvent)=>{e.preventDefault();void run(async()=>{const sent=await invoke<boolean>("discord_publish",{platform,title,url});setMessage(sent?"Publicación enviada a vídeos.":"Este contenido ya se envió o su entrega necesita comprobarse en Discord.");if(sent){setTitle("");setUrl("");}});};
 return <section className="card discord-panel" aria-label="Avisos de Discord">
  <h2>Discord · tu comunidad</h2>
  <p className="muted">Anuncia directos en <strong>🔴・directos</strong> y publicaciones en <strong>🎬・videos</strong>, sin menciones masivas.</p>
  {error&&<p role="alert" className="error">{error}</p>}{message&&<p role="status">{message}</p>}
  <details><summary>Conectar canales y elegir avisos</summary>
   <p className="muted small">En los ajustes de cada canal de Discord: Integraciones → Webhooks → Nuevo webhook → Copiar URL. No necesitas un bot con Administrador. Pega cada enlace aquí; se guarda en las credenciales de Windows y no se vuelve a mostrar.</p>
   <form onSubmit={save}>
    <label>Webhook de directos · {status?.live_configured?"guardado":"sin configurar"}<input type="password" autoComplete="new-password" value={live} onChange={e=>setLive(e.target.value)} placeholder="Pegar enlace para guardar o reemplazar" disabled={busy}/></label>
    <label>Webhook de vídeos · {status?.videos_configured?"guardado":"sin configurar"}<input type="password" autoComplete="new-password" value={videos} onChange={e=>setVideos(e.target.value)} placeholder="Pegar enlace para guardar o reemplazar" disabled={busy}/></label>
    <label className="discord-check"><input type="checkbox" checked={settings.enabled} onChange={e=>setSettings({...settings,enabled:e.target.checked})} disabled={busy}/>Activar avisos automáticos</label>
    <fieldset disabled={busy}><legend>Conexiones de Twitch y YouTube de Nexus</legend>
     {([["twitch_live","Directos de Twitch"],["youtube_live","Directos de YouTube"],["twitch_videos","Clips, destacados y subidas de Twitch"],["youtube_videos","Vídeos públicos de YouTube, incluidos Shorts"]] as const).map(([key,label])=><label className="discord-check" key={key}><input type="checkbox" checked={settings[key]} onChange={e=>setSettings({...settings,[key]:e.target.checked})}/>{label}</label>)}
    </fieldset>
    <p className="muted small">Al activar publicaciones por primera vez se toma una referencia sin anunciar el historial. Un directo ya iniciado sí puede anunciarse. La consulta cubre las últimas 20 subidas y hasta 100 clips de Twitch del último día; no recupera todo lo publicado con Nexus cerrado. Los archivos completos de emisiones de Twitch no se anuncian.</p>
    <button disabled={busy||!status} type="submit">Guardar configuración</button>
   </form>
   <div className="discord-actions"><button disabled={busy||!status?.live_configured} onClick={()=>test("live")}>Enviar prueba a directos</button><button disabled={busy||!status?.videos_configured} onClick={()=>test("videos")}>Enviar prueba a vídeos</button></div>
   <div className="discord-actions"><button className="ghost" disabled={busy||!status?.live_configured} onClick={()=>remove("live")}>Desconectar directos</button><button className="ghost" disabled={busy||!status?.videos_configured} onClick={()=>remove("videos")}>Desconectar vídeos</button></div>
  </details>
  <details><summary>Compartir una publicación</summary><p className="muted small">TikTok e Instagram: envío por enlace. La detección automática todavía no está conectada. También sirve para compartir un vídeo o clip de YouTube/Twitch que no se haya anunciado.</p>
   <form onSubmit={publish}><label>Plataforma<select value={platform} disabled={busy} onChange={e=>setPlatform(e.target.value)}><option value="youtube">YouTube</option><option value="twitch">Twitch</option><option value="tiktok">TikTok</option><option value="instagram">Instagram</option></select></label><label>Título<input required maxLength={200} value={title} onChange={e=>setTitle(e.target.value)} disabled={busy}/></label><label>Enlace de la publicación<input required type="url" value={url} onChange={e=>setUrl(e.target.value)} disabled={busy} placeholder="https://…"/></label><button disabled={busy||!status?.videos_configured} type="submit">Publicar aviso en vídeos</button></form>
  </details>
  <p className="muted small">{status?.activity?.message||"Todavía no hay actividad de Discord."}</p><button className="ghost small-button" disabled={busy} onClick={()=>void run(async()=>{await refresh();})}>Actualizar estado</button>
 </section>;
}
