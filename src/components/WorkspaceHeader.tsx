import {useEffect,useRef,useState} from 'react';
import {ArrowRight,HelpCircle,Search,X} from 'lucide-react';
import {Section} from '../sections';
export const workspaceNames:Record<Section,string>={connections:'Conexiones',dashboard:'Inicio',projects:'Crear contenido',ideas:'Crear contenido · Ideas',live:'En directo',games:'Juegos',calendar:'Calendario',profiles:'Cuentas y perfiles',goals:'Metas',income:'Ingresos',backups:'Copias de seguridad'};
const destinations:{label:string;hint:string;section:Section;tab?:string}[]=[
 {label:'Momentos y Shorts',hint:'Captura automática por voz clips micrófono replay',section:'projects',tab:'moments'},
 {label:'Inicio',hint:'Tus redes sociales, crecimiento y metas',section:'dashboard'},
 {label:'Mis proyectos',hint:'Crear contenido, edición y publicación',section:'projects',tab:'projects'},
 {label:'Ideas',hint:'Capturar y desarrollar ideas',section:'ideas'},
 {label:'En directo',hint:'Chat, sonido, momentos y resúmenes',section:'live',tab:'chat'},
 {label:'Chat',hint:'Twitch y YouTube',section:'live',tab:'chat'},
 {label:'Voz y música',hint:'TTS, Spotify y peticiones',section:'live',tab:'sound'},
 {label:'Alertas',hint:'Diseños y eventos por plataforma',section:'live',tab:'alerts'},
 {label:'Conexiones',hint:'Cuentas de emisión y Discord',section:'connections'},
 {label:'OBS',hint:'Rendimiento y actividades',section:'live',tab:'obs'},
 {label:'Contadores y overlays',hint:'Cofres y enlaces para OBS',section:'live',tab:'counters'},
 {label:'Categoría de Twitch',hint:'Asociar juegos y categorías',section:'live',tab:'category'},
 {label:'Juegos y platinos',hint:'Biblioteca, objetivos y progreso',section:'games'},
 {label:'Calendario',hint:'Planificar publicaciones',section:'calendar'},
 {label:'Cuentas y perfiles',hint:'Métricas y conexiones sociales',section:'profiles'},
 {label:'Metas',hint:'Objetivos de crecimiento',section:'goals'},
 {label:'Ingresos',hint:'Pagos y seguimiento',section:'income'},
 {label:'Copias de seguridad',hint:'Exportar y restaurar datos',section:'backups'},
];
const normalized=(v:string)=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();
export function WorkspaceHeader({section,onNavigate}:{section:Section;onNavigate:(section:Section,tab?:string)=>void}){
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[help,setHelp]=useState(false);
 const search=useRef<HTMLDialogElement>(null),helpDialog=useRef<HTMLDialogElement>(null),input=useRef<HTMLInputElement>(null);
 useEffect(()=>{const handler=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setQuery('');setHelp(false);setOpen(true)}};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler)},[]);
 useEffect(()=>{if(open&&!search.current?.open){search.current?.showModal();input.current?.focus()}else if(!open&&search.current?.open)search.current.close()},[open]);
 useEffect(()=>{if(help&&!helpDialog.current?.open)helpDialog.current?.showModal();else if(!help&&helpDialog.current?.open)helpDialog.current.close()},[help]);
 const results=destinations.filter(d=>normalized(`${d.label} ${d.hint}`).includes(normalized(query)));
 return <><header className="workspace-topbar"><div className="workspace-crumb"><span>Tu espacio</span><span>/</span><strong>{workspaceNames[section]}</strong></div><div className="workspace-top-actions"><button className="workspace-search" onClick={()=>{setQuery('');setOpen(true)}}><Search size={16}/><span>Buscar en Nexus</span><kbd>Ctrl K</kbd></button><button className="ghost icon-button" aria-label="Ayuda para orientarme" onClick={()=>setHelp(true)}><HelpCircle size={19}/></button></div></header>
 <dialog ref={search} className="workspace-dialog" aria-label="Buscar en Nexus" onCancel={()=>setOpen(false)} onClose={()=>setOpen(false)}><header><h2>Encuentra tu siguiente paso</h2><button className="ghost icon-button" aria-label="Cerrar búsqueda" onClick={()=>setOpen(false)}><X size={18}/></button></header><input ref={input} aria-label="Buscar secciones" placeholder="Prueba música, clips, OBS o platinos…" value={query} onChange={e=>setQuery(e.target.value)}/><div className="workspace-search-results">{results.map(d=><button key={d.label} onClick={()=>{setOpen(false);onNavigate(d.section,d.tab)}}><ArrowRight size={16}/><span><strong>{d.label}</strong><small>{d.hint}</small></span></button>)}{!results.length&&<p className="muted">No se encontraron secciones.</p>}</div></dialog>
 <dialog ref={helpDialog} className="workspace-dialog" aria-label="Ayuda de navegación" onCancel={()=>setHelp(false)} onClose={()=>setHelp(false)}><header><h2>¿Dónde está cada cosa?</h2><button className="ghost icon-button" aria-label="Cerrar ayuda" onClick={()=>setHelp(false)}><X size={18}/></button></header><p><strong>Inicio:</strong> tu siguiente acción y los datos de tu estudio.</p><p><strong>Crear contenido:</strong> ideas, proyectos y momentos guardados.</p><p><strong>En directo:</strong> chat, OBS, alertas, TTS, música y contadores.</p><p><strong>Juegos:</strong> biblioteca, partida, platinos y objetivos.</p><p><strong>Mi estudio:</strong> cuentas, metas e ingresos.</p><p className="muted">Ctrl + K abre la búsqueda de secciones. El modo enfoque reduce el detalle secundario de Inicio.</p></dialog></>
}
