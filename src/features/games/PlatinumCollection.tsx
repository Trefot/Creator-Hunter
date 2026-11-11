import { FormEvent,useState } from "react";
import type { Game } from "../../db/games";
import { isPlatinum,registerPlatinum } from "../../db/gameBroadcast";
import { GameArtwork } from "./GameArtwork";
import { es } from "../../i18n/es";
export function PlatinumCollection({games,onChanged,onOpen}:{games:Game[];onChanged:()=>Promise<void>;onOpen:(id:string)=>void}){
 const [game,setGame]=useState(""),[date,setDate]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const completed=games.filter(isPlatinum).sort((a,b)=>(b.psn_platinum_at??b.platinum_at??"").localeCompare(a.psn_platinum_at??a.platinum_at??""));
 const verified=completed.filter(g=>!!g.psn_platinum_at).length;
 async function save(e:FormEvent){e.preventDefault();setBusy(true);setError("");try{await registerPlatinum(game,date||null);await onChanged();setGame("");setDate("");}catch(e){setError(String(e));}finally{setBusy(false);}}
 return <section><div className="card platinum-summary"><h2>🏆 Tu colección de platinados</h2><strong>{completed.length} juegos · {verified} confirmados por trofeos · {completed.length-verified} manuales</strong><p className="muted small">Un platino obtenido en PSN aparece al sincronizar sus trofeos. Los registros manuales se identifican como tales; no equivalen a una confirmación de PSN.</p></div>
 <details className="card platinum-manual"><summary>Registrar o fechar un platino manual</summary><form className="game-studio-inline" onSubmit={save}><select aria-label="Juego platinado" required value={game} onChange={e=>setGame(e.target.value)}><option value="">Elegir juego</option>{games.filter(g=>!g.psn_platinum_at).map(g=><option value={g.id} key={g.id}>{g.title} · {es.games.platforms[g.platform]}</option>)}</select><label>Fecha (opcional)<input aria-label="Fecha del platino" type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><button disabled={busy||!game}>Guardar registro manual</button></form><p className="muted small">Para corregir un registro manual cambia el estado del juego desde su ficha.</p></details>
 <ul className="gallery platinum-gallery">{completed.map(g=><li key={g.id}><button className="card gallery-card gallery-button" onClick={()=>onOpen(g.id)}><div className="gallery-cover"><GameArtwork game={g}/><span className="gallery-status">🏆 {g.psn_platinum_at?'Por trofeos':'Manual'}</span></div><div className="gallery-body"><strong>{g.title}</strong><span className="muted small">{es.games.platforms[g.platform]} · {(g.psn_platinum_at??g.platinum_at)?.slice(0,10)??'Fecha sin registrar'}</span></div></button></li>)}</ul>
 {!completed.length&&<p className="muted">Todavía no hay platinados registrados. Sincroniza PSN o añade un registro manual.</p>}{error&&<p role="alert" className="error">{error}</p>}
 </section>;
}
