import {HistoryChart} from './HistoryChart';
import {useEffect,useRef,useState} from 'react';
import {RefreshCw,Plus,X,ArrowUpRight,Target} from 'lucide-react';
import {siYoutube,siTwitch,siTiktok,siInstagram,siFacebook} from 'simple-icons';
import {listProfiles,Profile,Platform} from '../../db/profiles';
import {listAllSnapshots,AccountSnapshot} from '../../db/accountSnapshots';
import {listGoals,Goal,createGoal,updateGoal} from '../../db/goals';
import {SnapshotsPanel} from '../profiles/SnapshotsPanel';
import {GoalForm} from '../goals/GoalForm';
import {runYouTubeSync} from '../profiles/youtubeSync';
import {youtubeStatus} from '../../db/youtube';
import {syncMetrics,MetricConnections} from '../profiles/socialSync';
import {socialProgress} from './socialProgress';
import {todayIso,formatNumber,formatShortDate} from '../../i18n/format';
import {Section} from '../../sections';
import {invoke} from '@tauri-apps/api/core';
import {HabitPanel} from '../habit/HabitPanel';
import nexus from '../../assets/nexus-mark.png';
import './socialHome.css';
const identity:Record<Platform,{name:string;color:string;rgb:string;path:string}>={youtube:{name:'YouTube',color:'#fa5b64',rgb:'250 91 100',path:siYoutube.path},twitch:{name:'Twitch',color:'#ac7aff',rgb:'172 122 255',path:siTwitch.path},tiktok:{name:'TikTok',color:'#40e0d0',rgb:'64 224 208',path:siTiktok.path},instagram:{name:'Instagram',color:'#fa7c98',rgb:'250 124 152',path:siInstagram.path},facebook:{name:'Facebook',color:'#6fa3ff',rgb:'111 163 255',path:siFacebook.path}};
export function DashboardPage({onNavigate,onOpenProject,dataVersion=0}:{onNavigate:(s:Section,tab?:string)=>void;onOpenProject:(id:string)=>void;dataVersion?:number}){
 const [profiles,setProfiles]=useState<Profile[]>([]),[history,setHistory]=useState<AccountSnapshot[]>([]),[goals,setGoals]=useState<Goal[]>([]),[selected,setSelected]=useState(''),[days,setDays]=useState(28),[revision,setRevision]=useState(0),[loaded,setLoaded]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[editing,setEditing]=useState<'record'|'goal'|null>(null),[today,setToday]=useState(todayIso);
 const [goalId,setGoalId]=useState(''),[connections,setConnections]=useState<MetricConnections|null>(null);
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{let dead=false;Promise.all([listProfiles(),listAllSnapshots(),listGoals()]).then(([p,h,g])=>{if(!dead){setProfiles(p);setHistory(h);setGoals(g);setSelected(id=>p.some(x=>x.id===id)?id:p.find(x=>x.platform==='youtube')?.id??p[0]?.id??'');setLoaded(true);setError('')}}).catch(e=>{if(!dead)setError(String(e))});return()=>{dead=true}},[dataVersion,revision]);
 useEffect(()=>{void invoke<MetricConnections>('metrics_status').then(setConnections).catch(()=>{});},[dataVersion,revision]);
 useEffect(()=>{const t=setInterval(()=>setToday(todayIso()),60000);return()=>clearInterval(t)},[]);
 useEffect(()=>{if(editing&&!dialog.current?.open)dialog.current?.showModal();else if(!editing&&dialog.current?.open)dialog.current.close()},[editing]);
 async function refresh(){
  setBusy(true);setNotice('');setError('');const problems:string[]=[];
  try{
   const [yt,connections]=await Promise.all([youtubeStatus().then(s=>s.connected).catch(()=>false),invoke<MetricConnections>('metrics_status').catch(e=>{problems.push('Conexiones: '+String(e));return null})]);
   if(yt)try{await runYouTubeSync()}catch(e){problems.push('YouTube: '+String(e))}
   for(const p of ['twitch','meta','tiktok'] as const)if(connections?.[p]?.configured)try{await syncMetrics(p)}catch(e){problems.push(p+': '+String(e))}
   setRevision(r=>r+1);setNotice(problems.length?'Se conservaron los últimos datos de las redes que necesitan revisión.':yt||Object.values(connections??{}).some(c=>c.configured)?'Consulta completada. Las cifras disponibles están actualizadas.':'Todavía no hay cuentas autorizadas para actualizar. Abre Conexiones.');if(problems.length)setError(problems.join(' · '));
  }catch(e){setError(String(e))}finally{setBusy(false)}
 }
 const profile=profiles.find(p=>p.id===selected),progress=profile?socialProgress(history,profile.id,today,days):null;
 const availableGoals=goals.filter(g=>g.profile_id===selected&&g.metric!=='income'&&g.status==='active');
 const goal=availableGoals.find(g=>g.id===goalId)??availableGoals[0];
 const detail=history.filter(s=>s.profile_id===selected&&s.recorded_on<=today).reverse();
 const views=detail.find(s=>s.total_views!==null),hours=detail.find(s=>s.watch_hours!==null);
 const current=(goal?.metric==='views'?views?.total_views:goal?.metric==='watch_hours'?hours?.watch_hours:progress?.latest?.followers)??null,ratio=goal&&current!==null?Math.min(100,current/goal.target_value*100):0;
 return <section className="page page-wide social-home">
  <header className="page-header social-home-header"><div><span className="nexus-eyebrow">TU COMUNIDAD · TU PROGRESO</span><h1>Mira cómo crece lo que creas.</h1><p className="muted">Tus redes primero. Cada avance cuenta.</p></div><img src={nexus} alt="" /></header>
  <div className="social-toolbar"><div><h2>Tus redes sociales</h2><p className="small muted">Cada cifra conserva su fecha y su origen.</p></div><div><label>Comparar<select aria-label="Período de las métricas" value={days} onChange={e=>setDays(Number(e.target.value))}><option value={28}>Últimos 28 días</option><option value={7}>Últimos 7 días</option></select></label><button className="ghost small-button" disabled={busy} onClick={()=>void refresh()}><RefreshCw size={14}/>{busy?'Consultando…':'Actualizar métricas'}</button><button className="small-button" disabled={!profile} onClick={()=>setEditing('record')}><Plus size={14}/>Registrar cifras</button></div></div>
  {error&&<div className="card social-error" role="alert"><p>{error}</p><button className="ghost small-button" onClick={()=>onNavigate('connections')}>Revisar conexiones</button><button className="ghost small-button" onClick={()=>setRevision(r=>r+1)}>Volver a cargar</button></div>}
  {notice&&<p role="status" className="muted small">{notice}</p>}
  {!loaded&&!error&&<p role="status">Cargando tus registros…</p>}
  <div className="social-cards">{(['youtube','twitch','tiktok','instagram','facebook'] as Platform[]).flatMap(platform=>{
   const group=profiles.filter(p=>p.platform===platform),id=identity[platform];
   if(!group.length)return [<button key={platform} className="social-network empty" style={{'--net-color':id.color,'--net-rgb':id.rgb} as React.CSSProperties} onClick={()=>onNavigate('profiles')}><span className="social-brand"><svg viewBox="0 0 24 24" aria-hidden><path d={id.path}/></svg><strong>{id.name}</strong></span><span className="muted">Añadir mi cuenta</span></button>];
   return group.map(p=>{const v=socialProgress(history,p.id,today,days),s=v.latest,connection=connections?.[platform==='facebook'||platform==='instagram'?'meta':platform==='youtube'?'twitch':platform];return <button key={p.id} className="social-network" aria-pressed={selected===p.id} aria-label={'Ver métricas de '+id.name+' '+p.handle} style={{'--net-color':id.color,'--net-rgb':id.rgb} as React.CSSProperties} onClick={()=>setSelected(p.id)}>
    <svg className="social-watermark" viewBox="0 0 24 24" aria-hidden><path d={id.path}/></svg>
    <span className="social-brand"><svg viewBox="0 0 24 24" aria-hidden><path d={id.path}/></svg><span><strong>{id.name}</strong><small>{p.handle.startsWith('@')?p.handle:'@'+p.handle}</small></span></span>
    <span className="social-number">{s?.followers!==null&&s?.followers!==undefined?formatNumber(s.followers):'—'}<small>{platform==='youtube'?'suscriptores':'seguidores'}</small></span>
    <span className="social-bottom"><span className={v.delta===null?'muted':v.delta<0?'social-down':'social-up'}>{v.delta===null?'Sin comparación todavía':(v.delta>0?'+':'')+formatNumber(v.delta)+' desde '+formatShortDate(v.baseline!.recorded_on)}</span><small>{s?(s.source==='api'?'API':'Manual')+' · '+(s.observed_at?new Date(s.observed_at).toLocaleString('es-CO'):formatShortDate(s.recorded_on)):'Sin registros'}</small></span>{platform!=='youtube'&&connection?.error&&<small className="error">Consulta pendiente de recuperar · revisa Conexiones</small>}{s&&Date.now()-Date.parse(s.observed_at??s.recorded_on)>86400000&&<small>Último dato de hace más de un día</small>}
   </button>});
  })}</div>
  {profile&&<div className="social-analysis"><section className="card social-detail"><header><h2>Tu avance en {identity[profile.platform].name}</h2><span className="muted small">Registros reales</span></header>
   {progress?.delta!==null&&progress?.delta!==undefined?<><strong className={progress.delta<0?'social-growth social-down':'social-growth social-up'}>{progress.delta>0?'+':''}{formatNumber(progress.delta)}</strong><p className="muted small">De {formatNumber(progress.baseline!.followers!)} a {formatNumber(progress.latest!.followers!)} · {formatShortDate(progress.baseline!.recorded_on)} — {formatShortDate(progress.latest!.recorded_on)}</p></>:<p className="muted">Tu historial empieza con tus registros reales. Para comparar {days} días necesitamos una cifra anterior al inicio del periodo; todavía estamos reuniendo esa referencia.</p>}
   <HistoryChart rows={history.filter(r=>r.profile_id===selected)}/>
   <div className="social-detail-stats"><div><strong>{views?.total_views!==null&&views?.total_views!==undefined?formatNumber(views.total_views):'—'}</strong><small>Visualizaciones totales registradas{views?' · '+formatShortDate(views.recorded_on):''}</small></div><div><strong>{hours?.watch_hours!==null&&hours?.watch_hours!==undefined?formatNumber(hours.watch_hours):'—'}</strong><small>Horas del último registro · no acredita monetización{hours?' · '+formatShortDate(hours.recorded_on):''}</small></div></div>
   <button className="link-button small" onClick={()=>setEditing('record')}>Ver mis registros y evolución <ArrowUpRight size={13}/></button>
  </section><section className="card social-goal"><span className="nexus-eyebrow">TU SIGUIENTE META · {identity[profile.platform].name}</span>{availableGoals.length>1&&<label>Objetivo<select value={goal?.id} onChange={e=>setGoalId(e.target.value)}>{availableGoals.map(g=><option key={g.id} value={g.id}>{g.metric==='followers'?'Seguidores':g.metric==='views'?'Vistas':'Horas'} · {formatNumber(g.target_value)}</option>)}</select></label>}{goal?<><p className="small muted">{goal.metric==='followers'?'Seguidores':goal.metric==='views'?'Vistas':'Horas del registro; comprueba la elegibilidad en YouTube Studio'}</p><h2>{current===null?'Sin dato':formatNumber(current)} <small className="muted">/ {formatNumber(goal.target_value)}</small></h2><div className="social-goal-track" role="progressbar" aria-label={'Meta de '+identity[profile.platform].name} aria-valuemin={0} aria-valuemax={goal.target_value} {...(current===null?{}:{'aria-valuenow':Math.min(current,goal.target_value)})}><span style={{width:ratio+'%'}}/></div><p>{current===null?'Registra tu cifra para calcular el avance.':current>=goal.target_value?'¡Meta alcanzada! Tu progreso queda en el historial. Elige tu siguiente objetivo.':'Te faltan '+formatNumber(goal.target_value-current)+' para tu meta.'}</p></>:<><Target size={25}/><p>Elige tu siguiente objetivo y celebra cada paso hacia él.</p></>}<button className="ghost small-button" onClick={()=>setEditing('goal')}>{goal?'Editar mi meta':'Crear mi meta'}</button></section></div>}
  <section className="card social-next"><div><span className="nexus-eyebrow">SIGUE CREANDO</span><h2>Tu próximo contenido te espera.</h2><p className="muted small">Retoma una captura o abre tu cabina.</p></div><div><button onClick={()=>onNavigate('projects','performance')}>Ver qué contenido funciona</button><button className="ghost" onClick={()=>onNavigate('projects','moments')}>Ver mis capturas</button><button className="ghost" onClick={()=>onNavigate('live')}>Abrir cabina</button><button className="ghost" onClick={()=>onNavigate('connections')}>Conexiones</button></div></section>
  {!profiles.length&&loaded&&<p className="muted">Añade tus perfiles para comenzar. Tus datos aparecerán al conectar la cuenta o registrar tus primeras cifras.</p>}
  <details className="home-routine"><summary>Mi plan de creación y calendario</summary><HabitPanel onNavigate={onNavigate} onOpenProject={onOpenProject}/></details>
  <dialog ref={dialog} className="social-dialog" onCancel={()=>setEditing(null)} onClose={()=>setEditing(null)} aria-label={editing==='goal'?'Editar meta de la cuenta':'Registros de la cuenta'}><header><h2>{profile?identity[profile.platform].name+' · '+profile.handle:'Mi cuenta'}</h2><button className="ghost icon-button" aria-label="Cerrar registros o meta" onClick={()=>setEditing(null)}><X size={18}/></button></header>{profile&&editing==='record'&&<SnapshotsPanel key={profile.id} profileId={profile.id} onChange={()=>setRevision(r=>r+1)}/>} {profile&&editing==='goal'&&<GoalForm goal={goal} initialProfileId={profile.id} profiles={profiles} onCancel={()=>setEditing(null)} onSave={async input=>{if(goal)await updateGoal(goal.id,input);else await createGoal(input);setSelected(input.profile_id??profile.id);setEditing(null);setRevision(r=>r+1)}}/>}</dialog>
 </section>;
}
