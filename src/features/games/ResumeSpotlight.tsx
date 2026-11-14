import {useEffect,useState} from 'react';
import {invoke} from '@tauri-apps/api/core';
import {ArrowRight} from 'lucide-react';
import {Game} from '../../db/games';
import {GameArtwork} from './GameArtwork';
import {es} from '../../i18n/es';
export function ResumeSpotlight({game,onOpen}:{game:Game;onOpen:()=>void}){
 const [note,setNote]=useState<string|null>(null),[error,setError]=useState('');
 useEffect(()=>{let dead=false;setNote(null);setError('');invoke<{note?:string}|null>('studio_resume',{gameId:game.id,note:null}).then(v=>{if(!dead)setNote(v?.note??'')}).catch(e=>{if(!dead){setNote('');setError(String(e))}});return()=>{dead=true}},[game.id]);
 return <section className="card resume-spotlight"><div className="resume-spotlight-art"><GameArtwork game={game}/></div><div className="resume-spotlight-copy"><span className="nexus-eyebrow">RETOMAR PARTIDA</span><h2>{game.title}</h2><span className="project-stage ready">{es.games.platforms[game.platform]}</span><div className="resume-spotlight-note"><strong>¿Dónde nos quedamos?</strong><p>{note===null?'Cargando tu nota…':note||'Guarda tu próximo objetivo en la ficha para retomarlo aquí.'}</p>{error&&<p className="error">{error}</p>}</div><button onClick={onOpen}>Retomar mi partida<ArrowRight size={16}/></button></div></section>
}
