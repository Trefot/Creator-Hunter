import { FormEvent, useEffect, useState } from "react";
import { obsStatus,obsConfigure,obsDisconnect,obsMark,obsMarkers,obsTime,momentsText,ObsStatus,ObsMarker,obsSaveReplay,obsClips,ObsClip } from "../../db/obs";
import { es } from "../../i18n/es";
const t=es.obs;

export function ObsPanel({markUrl,clipUrl}:{markUrl:string|null;clipUrl:string|null}) {
  const [status,setStatus]=useState<ObsStatus|null>(null);
  const [clips,setClips]=useState<ObsClip[]>([]);
  const [markers,setMarkers]=useState<ObsMarker[]>([]);
  const [port,setPort]=useState(4455);
  const [password,setPassword]=useState("");
  const [title,setTitle]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [setup,setSetup]=useState(false);
  useEffect(()=>{
    let cancelled=false;
    let hydrated=false;
    let timer:ReturnType<typeof setTimeout>;
    async function refresh(){
      try {
        const [s,m,c]=await Promise.all([obsStatus(),obsMarkers(),obsClips()]);
        if(!cancelled){setStatus(s);setMarkers(m);setClips(c);if(!hydrated&&s.port){setPort(s.port);hydrated=true;}}
      }catch(e){if(!cancelled)setError(String(e));}
      finally{if(!cancelled)timer=setTimeout(refresh,2000);}
    }
    void refresh();
    return ()=>{cancelled=true;clearTimeout(timer);};
  },[]);
  async function connect(e:FormEvent){
    e.preventDefault();setBusy(true);setError("");setMessage("");
    try{await obsConfigure(port,password||null);setPassword("");setMessage(t.connecting);}
    catch(e){setError(String(e));}finally{setBusy(false);}
  }
  async function mark(){
    if(busy)return;
    setBusy(true);setError("");setMessage("");
    try{const result=await obsMark(title);setTitle("");setMessage(t.saved(obsTime(result.record_ms??result.stream_ms)));setMarkers(await obsMarkers());}
    catch(e){setError(String(e));}finally{setBusy(false);}
  }
  async function saveClip(){
    if(busy||status?.saving_replay)return;
    setBusy(true);setError("");setMessage(t.savingClip);
    try{
      const result=await obsSaveReplay(title);setTitle("");setMessage(t.clipSaved(result.output_path));
      const [c,m]=await Promise.all([obsClips(),obsMarkers()]);setClips(c);setMarkers(m);
    }catch(e){setMessage("");setError(String(e));}finally{setBusy(false);}
  }
  async function disconnect(){
    setBusy(true);setError("");
    try{await obsDisconnect();setStatus(await obsStatus());setMessage("");}
    catch(e){setError(String(e));}finally{setBusy(false);}
  }
  async function copy(text:string){
    try{await navigator.clipboard.writeText(text);setMessage(t.copied);setError("");}catch(e){setError(String(e));}
  }
  const active=!!status?.connected&&((status.recording&&!status.paused)||status.streaming);
  return <section className="card obs-panel">
    <div className="obs-head"><div><h2>{t.title}</h2><p className="muted small">{t.subtitle}</p></div>
      <button className="ghost small-button" onClick={()=>setSetup(!setup)}>{t.setup}</button></div>
    <div className="obs-status-row" aria-live="polite">
      <strong className={status?.connected?"status-on":"muted"}>{status?.connected?t.connected:status?.enabled?t.reconnecting:t.disconnected}</strong>
      <span>{status?.recording?(status.paused?t.paused:t.recording):t.notRecording} · {obsTime(status?.record_ms??null)}</span>
      <span>{status?.streaming?t.streaming:t.notStreaming} · {obsTime(status?.stream_ms??null)}</span>
    </div>
    {(setup||!status?.enabled)&&<div className="obs-setup">
      <ol className="small">{t.steps.map(s=><li key={s}>{s}</li>)}</ol>
      <form className="obs-config-form" onSubmit={connect}>
        <label>{t.port}<input aria-label={t.port} type="number" min={1} max={65535} required value={port} onChange={e=>setPort(Number(e.target.value))}/></label>
        <label>{t.password}<input aria-label={t.password} type="password" autoComplete="off" value={password} onChange={e=>setPassword(e.target.value)} placeholder={t.passwordHint}/></label>
        <button disabled={busy}>{t.connect}</button>
      </form><p className="muted small">{t.credentialsHint}</p>
    </div>}
    {status?.enabled&&<button className="ghost small-button" disabled={busy} onClick={disconnect}>{t.disconnect}</button>}
    {(error||status?.error)&&<p className="error" role="alert">{error||status?.error}</p>}
    <div className="obs-mark-row"><input aria-label={t.momentTitle} maxLength={200} value={title} onChange={e=>setTitle(e.target.value)} placeholder={t.momentTitle}/>
      <button disabled={busy||!!status?.saving_replay||!active} onClick={mark}>{busy?t.saving:t.mark}</button></div>
    <div className="obs-mark-row"><span className="small">{status?.replay_active?t.replayActive:t.replayInactive}</span><button disabled={busy||!!status?.saving_replay||!status?.connected||!status?.replay_active} onClick={saveClip}>{busy||status?.saving_replay?t.savingClip:t.saveClip}</button></div>
    <p className="muted small">{t.replayHint}</p>
    {!active&&<p className="muted small">{t.markHint}</p>}
    {message&&<p role="status" className="small">{message}</p>}
    <details className="obs-deck"><summary>{t.deck}</summary><p className="small">{t.deckSteps}</p>
      {markUrl?<button className="small-button" onClick={()=>copy(markUrl)}>{t.copyMarkUrl}</button>:<p className="muted small">{t.localUnavailable}</p>}
      {clipUrl&&<button className="small-button" onClick={()=>copy(clipUrl)}>{t.copyClipUrl}</button>}
      <p className="muted small">{t.deckFeedback}</p>
    </details>
    <div className="obs-head"><h3>{t.clips}</h3></div>
    {clips.length===0?<p className="muted small">{t.noClips}</p>:<ul className="obs-moments">{clips.map(c=><li key={c.id}>
      <div><strong>{c.title}</strong>{c.game_title&&<span className="muted"> · {c.game_title}</span>}</div>
      <time className="muted small">{new Date(c.created_at).toLocaleString("es")}</time>
      <p className="small obs-file">{c.output_path}</p>
      <div>{c.marker_id&&<span className="muted small">{t.linkedMarker} · {obsTime(c.record_ms??c.stream_ms)} </span>}<button className="ghost small-button" onClick={()=>copy(c.output_path)}>{t.copyClipPath}</button></div>
    </li>)}</ul>}
    <div className="obs-head"><h3>{t.moments}</h3>{markers.length>0&&<button className="ghost small-button" onClick={()=>copy(momentsText(markers))}>{t.copyMoments}</button>}</div>
    {markers.length===0?<p className="muted small">{t.empty}</p>:<ul className="obs-moments">{markers.map(m=><li key={m.id}>
      <div><strong>{m.title}</strong>{m.game_title&&<span className="muted"> · {m.game_title}</span>}</div>
      <div className="small">{m.record_ms!==null&&<span>{t.recordingTime} {obsTime(m.record_ms)} </span>}{m.stream_ms!==null&&<span> · {t.streamTime} {obsTime(m.stream_ms)}</span>}</div>
      <time className="muted small">{new Date(m.created_at).toLocaleString("es")}</time>
      <p className="muted small obs-file">{m.output_path??t.filePending}</p>
    </li>)}</ul>}
  </section>;
}
