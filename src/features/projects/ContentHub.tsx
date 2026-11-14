import {useEffect,useState} from 'react';
import {Plus} from 'lucide-react';
import {SectionTabs} from '../../components/SectionTabs';
import {IdeasPage} from '../ideas/IdeasPage';
import {CaptureInbox} from '../live/CaptureInbox';
import {ProjectsPage} from './ProjectsPage';
const tabs=[{id:'projects',label:'Mis proyectos'},{id:'ideas',label:'Ideas'},{id:'moments',label:'Momentos y clips'}] as const;
type Tab=typeof tabs[number]['id'];
export function ContentHub({initialOpenId=null,initialTab='projects',onOpenProject}:{initialOpenId?:string|null;initialTab?:Tab;onOpenProject:(id:string)=>void}){
 const [tab,setTab]=useState<Tab>(initialTab),[detail,setDetail]=useState(!!initialOpenId),[create,setCreate]=useState(0),[revision,setRevision]=useState(0);
 useEffect(()=>setTab(initialTab),[initialTab]);
 function choose(value:Tab){setTab(value);if(value==='projects')setRevision(v=>v+1)}
 return <section className="page page-wide content-hub"><div hidden={detail&&tab==='projects'}><header className="page-header"><div><span className="nexus-eyebrow">DE LA IDEA A LA PUBLICACIÓN</span><h1>Tus historias, en movimiento.</h1><p className="muted">Ideas, proyectos y capturas en un mismo recorrido.</p></div><button onClick={()=>{setTab('ideas');setCreate(c=>c+1)}}><Plus size={17}/>Nueva idea</button></header><SectionTabs tabs={tabs} value={tab} onChange={choose} label="Contenido"/></div>
 <div className="content-hub-panels"><div hidden={tab!=='projects'} role="tabpanel" aria-label="Mis proyectos"><ProjectsPage initialOpenId={initialOpenId} embedded onDetailChange={setDetail} revision={revision}/></div><div hidden={tab!=='ideas'} role="tabpanel" aria-label="Ideas"><IdeasPage createSignal={create}/></div><div hidden={tab!=='moments'} role="tabpanel" aria-label="Momentos y clips"><CaptureInbox onOpenProject={onOpenProject} expanded/></div></div></section>
}
