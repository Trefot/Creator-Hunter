import {PageTitle} from '../../components/PageTitle';
import {EmptyState} from '../../components/EmptyState';
import {ArrowRight,FolderKanban,LayoutGrid,List} from 'lucide-react';
import {useEffect,useState} from 'react';
import {PlatformLogo} from '../../components/PlatformBadge';
import {Adaptation,listAllAdaptations} from '../../db/adaptations';
import {listProfiles,Platform,Profile} from '../../db/profiles';
import {listProjects,Project} from '../../db/projects';
import {es} from '../../i18n/es';
import {CaptureInbox} from '../live/CaptureInbox';
import {ProjectDetail} from './ProjectDetail';
import {projectStage,nextProjectStep,BoardStage} from './projectBoard';
const titles:Record<BoardStage,string>={prepare:'Por preparar',production:'En producción',ready:'Listo para publicar',published:'Publicados'};
export function ProjectsPage({initialOpenId=null,embedded=false,onDetailChange,revision=0}:{initialOpenId?:string|null;embedded?:boolean;onDetailChange?:(open:boolean)=>void;revision?:number}){
 const [projects,setProjects]=useState<Project[]|null>(null),[openId,setOpenId]=useState<string|null>(initialOpenId),[adaptations,setAdaptations]=useState<Adaptation[]>([]),[profiles,setProfiles]=useState<Profile[]>([]),[error,setError]=useState(''),[search,setSearch]=useState(''),[view,setView]=useState<'board'|'gallery'>('board');
 async function refresh(){try{const[p,a,f]=await Promise.all([listProjects(),listAllAdaptations(),listProfiles()]);setProjects(p);setAdaptations(a);setProfiles(f);setError('')}catch(e){setError(String(e))}}
 useEffect(()=>{void refresh()},[revision]);
 const open=projects?.find(p=>p.id===openId);
 useEffect(()=>onDetailChange?.(!!open),[!!open,onDetailChange]);
 if(open)return <ProjectDetail key={open.id} project={open} onBack={()=>setOpenId(null)} onChanged={refresh}/>;
 const versions=(id:string)=>adaptations.filter(a=>a.project_id===id);
 const normalized=(v:string)=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();
 const visible=(projects??[]).filter(p=>normalized(p.title).includes(normalized(search)));
 function card(p:Project){const own=versions(p.id),cover=own.find(a=>a.thumbnail)?.thumbnail,platforms=[...new Set(own.map(a=>profiles.find(f=>f.id===a.profile_id)?.platform))].filter((p):p is Platform=>!!p);return <button key={p.id} className="card gallery-card gallery-button nexus-project" onClick={()=>setOpenId(p.id)}><div className={`gallery-cover${cover?'':' project-art'}`}>{cover?<img src={cover} alt=""/>:<FolderKanban size={30}/>}</div><div className="gallery-body"><span className={`project-stage ${projectStage(own)}`}>{titles[projectStage(own)]}</span><strong className="gallery-title">{p.title}</strong>{p.summary&&<span className="muted gallery-description">{p.summary}</span>}<span className="chips">{platforms.map(pl=><PlatformLogo key={pl} platform={pl} size={18}/>)}</span><span className="project-next"><small>SIGUIENTE PASO</small><span>{nextProjectStep(own)}</span></span><span className="muted small">{es.projects.adaptationCount(p.adaptation_count)} · {es.projects.publishedCount(own.filter(a=>a.published_at).length)}</span><span className="project-open">Abrir proyecto<ArrowRight size={15}/></span></div></button>}
 return <section className="page page-wide projects-page">{!embedded&&<header className="page-header"><PageTitle section="projects" subtitle={es.projects.subtitle}/></header>}{!embedded&&<CaptureInbox onOpenProject={async id=>{await refresh();setOpenId(id)}}/>}<div className="project-tools"><input aria-label="Buscar proyectos" placeholder="Buscar un proyecto…" value={search} onChange={e=>setSearch(e.target.value)}/><div className="project-view-controls" role="group" aria-label="Vista de proyectos"><button className="ghost small-button" aria-pressed={view==='board'} onClick={()=>setView('board')}><LayoutGrid size={16}/>Tablero</button><button className="ghost small-button" aria-pressed={view==='gallery'} onClick={()=>setView('gallery')}><List size={16}/>Todos</button></div></div>{error&&<p className="error" role="alert">{error}</p>}
 {projects===null?<p className="muted">Cargando proyectos…</p>:!projects.length?<EmptyState section="projects" text={es.projects.empty}/>:!visible.length?<p className="muted">No hay proyectos que coincidan.</p>:view==='gallery'?<ul className="gallery">{visible.map(p=><li key={p.id}>{card(p)}</li>)}</ul>:<><div className="project-board">{(['prepare','production','ready'] as const).map(stage=><section className="project-column" key={stage}><h2><span className={`stage-dot ${stage}`}/>{titles[stage]}<small>{visible.filter(p=>projectStage(versions(p.id))===stage).length}</small></h2><ul>{visible.filter(p=>projectStage(versions(p.id))===stage).map(p=><li key={p.id}>{card(p)}</li>)}</ul>{!visible.some(p=>projectStage(versions(p.id))===stage)&&<p className="muted small">Sin proyectos en esta etapa.</p>}</section>)}</div>{visible.some(p=>projectStage(versions(p.id))==='published')&&<details className="card published-projects" open={search?true:undefined}><summary>Publicados · {visible.filter(p=>projectStage(versions(p.id))==='published').length}</summary><ul className="gallery">{visible.filter(p=>projectStage(versions(p.id))==='published').map(p=><li key={p.id}>{card(p)}</li>)}</ul></details>}</>}
 </section>
}
