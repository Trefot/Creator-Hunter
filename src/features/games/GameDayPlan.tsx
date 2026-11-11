import { FormEvent, useEffect, useState } from "react";
import type { Game } from "../../db/games";
import { listSessions,addObjective,setObjectiveDone,deleteObjective,updateSessionNote,PlaySession } from "../../db/sessions";
import { ensureGameDay } from "../../db/gameStudio";
import { todayIso } from "../../i18n/format";
import { es } from "../../i18n/es";
const t=es.gameStudio;
export function GameDayPlan({game}:{game:Game}) {
  const day=todayIso();
  const [session,setSession]=useState<PlaySession|null>(null),[history,setHistory]=useState<PlaySession[]>([]);
  const [title,setTitle]=useState(""),[note,setNote]=useState("");
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(""),[message,setMessage]=useState("");
  async function refresh(){const rows=await listSessions(game.id);setSession(rows.find(s=>s.played_on===day)??null);setHistory(rows.filter(s=>s.played_on!==day).slice(0,3));}
  useEffect(()=>{let cancelled=false;setLoading(true);listSessions(game.id).then(rows=>{if(cancelled)return;const current=rows.find(s=>s.played_on===day)??null;setSession(current);setNote(current?.note??"");setHistory(rows.filter(s=>s.played_on!==day).slice(0,3));}).catch(e=>{if(!cancelled)setError(String(e));}).finally(()=>{if(!cancelled)setLoading(false);});return()=>{cancelled=true;};},[game.id,day]);
  async function run(work:()=>Promise<void>){if(busy)return;setBusy(true);setError("");setMessage("");try{await work();await refresh();}catch(e){setError(String(e));}finally{setBusy(false);}}
  async function add(e:FormEvent){e.preventDefault();if(!title.trim())return;await run(async()=>{const id=await ensureGameDay(game.id,day);await addObjective(id,{title:title.trim(),trophy_id:null,guide_entry_id:null});setTitle("");});}
  const goals=session?.objectives??[];
  return <section className="card game-day-plan">
    <div className="game-studio-heading"><div><span className="muted small">{day}</span><h2>{t.today}</h2></div>{goals.length>0&&<span>{goals.filter(g=>g.done).length}/{goals.length} {t.completed}</span>}</div>
    <p className="muted small">{t.todayHint}</p>
    {loading?<p className="muted">{t.loading}</p>:<>
      {goals.length===0&&<p className="muted">{t.noObjectives}</p>}
      <ul className="game-objectives">{goals.map(o=><li key={o.id}><label><input type="checkbox" checked={o.done} disabled={busy} onChange={()=>run(()=>setObjectiveDone(o.id,!o.done))}/><span className={o.done?"objective-done":""}>{o.title}</span></label><button className="ghost small-button" disabled={busy} onClick={()=>run(()=>deleteObjective(o.id))} aria-label={`${t.remove}: ${o.title}`}>{t.remove}</button></li>)}</ul>
      <form className="game-studio-inline" onSubmit={add}><input aria-label={t.objective} maxLength={300} placeholder={t.objectivePlaceholder} value={title} onChange={e=>setTitle(e.target.value)}/><button disabled={busy||!title.trim()}>{t.add}</button></form>
      {!goals.length&&<div className="game-plan-presets">{t.suggestedObjectives.map(text=><button key={text} className="ghost small-button" disabled={busy} onClick={()=>setTitle(text)}>{text}</button>)}</div>}
      <label className="game-studio-label">{t.sessionNotes}<textarea aria-label={t.sessionNotes} rows={3} maxLength={10000} value={note} onChange={e=>setNote(e.target.value)}/></label>
      <button className="small-button" disabled={busy} onClick={()=>run(async()=>{const id=await ensureGameDay(game.id,day);await updateSessionNote(id,note);setMessage(t.saved);})}>{t.saveSessionNotes}</button>
    </>}
    {message&&<p className="small" role="status">{message}</p>}{error&&<p className="error" role="alert">{error}</p>}
    {history.length>0&&<details><summary>{t.previousPlans}</summary>{history.map(s=><div className="game-history" key={s.id}><strong>{s.played_on}</strong><p className="small">{s.objectives.map(o=>`${o.done?"✓":"○"} ${o.title}`).join(" · ")}</p>{s.note&&<p className="muted small game-notes">{s.note}</p>}</div>)}</details>}
  </section>;
}
