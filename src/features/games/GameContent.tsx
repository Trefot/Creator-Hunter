import { FormEvent, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import type { Game } from "../../db/games";
import { gameContent,createGameIdea,linkGameProject,unassignedGameProjects } from "../../db/gameStudio";
import type { Project } from "../../db/projects";
import { obsTime } from "../../db/obs";
import { es } from "../../i18n/es";
const t=es.gameStudio;
export function GameContent({game,onOpenProject,onOpenIdeas}:{game:Game;onOpenProject:(id:string)=>void;onOpenIdeas:()=>void}) {
  const [data,setData]=useState<Awaited<ReturnType<typeof gameContent>>|null>(null),[available,setAvailable]=useState<Project[]>([]);
  const [title,setTitle]=useState(""),[project,setProject]=useState("");
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
  const generation=useRef(0);
  async function refresh(){const request=++generation.current;const [d,p]=await Promise.all([gameContent(game.id),unassignedGameProjects()]);if(request!==generation.current)return;setData(d);setAvailable(p.filter(x=>!d.projects.some(y=>y.id===x.id)));}
  useEffect(()=>{
    let disposed=false;let unlisten:(()=>void)|undefined;
    void refresh().catch(e=>{if(!disposed)setError(String(e));});
    listen("obs-markers-changed",()=>{if(!disposed)void refresh().catch(e=>setError(String(e)));}).then(fn=>{if(disposed)fn();else unlisten=fn;}).catch(e=>{if(!disposed)setError(String(e));});
    return()=>{disposed=true;++generation.current;unlisten?.();};
  },[game.id]);
  async function run(work:()=>Promise<void>){if(busy)return;setBusy(true);setError("");setMessage("");try{await work();await refresh();}catch(e){setError(String(e));}finally{setBusy(false);}}
  async function addIdea(e:FormEvent){e.preventDefault();if(!title.trim())return;await run(async()=>{await createGameIdea(game.id,title,"");setTitle("");setMessage(t.ideaSaved);});}
  async function copy(path:string){try{await navigator.clipboard.writeText(path);setMessage(t.copied);}catch(e){setError(String(e));}}
  return <section className="card game-content-panel">
    <div className="game-studio-heading"><div><h2>{t.content}</h2><p className="muted small">{t.contentHint}</p></div><button className="ghost small-button" onClick={()=>run(async()=>{})} disabled={busy}>{t.refresh}</button></div>
    {error&&<p className="error" role="alert">{error}</p>}{message&&<p role="status" className="small">{message}</p>}
    {!data?<p className="muted">{t.loading}</p>:<>
      <h3>{t.clips} <span className="muted small">({data.clips.length})</span></h3>
      {!data.clips.length&&<p className="muted small">{t.noClips}</p>}
      <ul className="game-media-list">{data.clips.map(c=><li key={c.id}><div><strong>{c.title}</strong><p className="muted small">{new Date(c.created_at).toLocaleString("es")}</p><p className="small game-file">{c.output_path}</p></div><div className="game-media-actions"><button className="ghost small-button" onClick={()=>copy(c.output_path)}>{t.copyPath}</button><button className="small-button" disabled={busy} onClick={()=>run(async()=>{await createGameIdea(game.id,c.title,`${t.clipSource}\n${c.output_path}\n${t.fullRecordingTime}: ${obsTime(c.record_ms)}\n${t.streamTime}: ${obsTime(c.stream_ms)}`,{kind:"clip",id:c.id});setMessage(t.ideaSaved);})}>{t.makeIdea}</button></div></li>)}</ul>
      <details><summary>{t.moments} ({data.markers.length})</summary>{!data.markers.length&&<p className="muted small">{t.noMoments}</p>}<ul className="game-media-list">{data.markers.map(m=><li key={m.id}><div><strong>{m.title}</strong><p className="muted small">{t.fullRecordingTime}: {obsTime(m.record_ms)} · {t.streamTime}: {obsTime(m.stream_ms)}</p><p className="small game-file">{m.output_path??t.fileUnknown}</p></div><button className="small-button" disabled={busy} onClick={()=>run(async()=>{await createGameIdea(game.id,m.title,`${t.momentSource}\n${t.fullRecordingTime}: ${obsTime(m.record_ms)}\n${t.streamTime}: ${obsTime(m.stream_ms)}\n${m.output_path??t.fileUnknown}`,{kind:"momento",id:m.id});setMessage(t.ideaSaved);})}>{t.makeIdea}</button></li>)}</ul></details>
      <div className="game-studio-heading"><h3>{t.ideas}</h3><button className="ghost small-button" onClick={onOpenIdeas}>{t.openIdeas}</button></div>
      <form className="game-studio-inline" onSubmit={addIdea}><input aria-label={t.ideaTitle} maxLength={300} value={title} onChange={e=>setTitle(e.target.value)} placeholder={t.ideaPlaceholder}/><button disabled={busy||!title.trim()}>{t.addIdea}</button></form>
      <ul className="game-linked-list">{data.ideas.map(i=><li key={i.id}><strong>{i.title}</strong><span className="muted small">{es.ideas.statuses[i.status]}</span></li>)}</ul>{!data.ideas.length&&<p className="muted small">{t.noIdeas}</p>}
      <h3>{t.projects}</h3><ul className="game-linked-list">{data.projects.map(p=><li key={p.id}><button className="link" onClick={()=>onOpenProject(p.id)}>{p.title}</button><span className="muted small">{p.adaptation_count} {t.adaptations}</span></li>)}</ul>{!data.projects.length&&<p className="muted small">{t.noProjects}</p>}
      {available.length>0&&<form className="game-studio-inline" onSubmit={e=>{e.preventDefault();if(project)void run(async()=>{await linkGameProject(project,game.id);setProject("");});}}><select aria-label={t.chooseProject} value={project} onChange={e=>setProject(e.target.value)}><option value="">{t.chooseProject}</option>{available.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select><button disabled={busy||!project}>{t.linkProject}</button></form>}
    </>}
  </section>;
}
