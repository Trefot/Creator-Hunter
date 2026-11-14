import { useState } from "react";
import type { Game } from "../../db/games";
import {bindPcGame,pcBindings,pcRunningApps} from "../../db/pcGames";
import {selectManualGame,setGameModeEnabled} from "./gameMode";
export function PcDetection({game}:{game:Game}){
 const [process,setProcess]=useState(()=>pcBindings().find(b=>b.game_id===game.id)?.process||"");
 const [apps,setApps]=useState<string[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 if(game.platform!=="pc")return null;
 async function scan(){setBusy(true);setError("");try{setApps(await pcRunningApps());}catch(e){setError(String(e));}finally{setBusy(false);}}
 function save(){try{bindPcGame(game,process||null);if(process){selectManualGame(null);setGameModeEnabled(true);}setError("");setMessage(process?"Proceso asociado. Nexus reconocerá este juego cuando esté abierto.":"Asociación retirada.");}catch(e){setError(String(e));}}
 return <details className="card"><summary>Detección de este juego en PC</summary><p className="muted small">Abre el juego y elige su ejecutable una vez, no Steam ni su lanzador. La asociación se guarda solo en este equipo. No importa automáticamente portadas, logros ni datos de la partida.</p><button disabled={busy} onClick={scan}>{busy?"Consultando…":"Ver aplicaciones abiertas"}</button><label>Ejecutable del juego<input aria-label="Ejecutable del juego" list={'process-'+game.id} value={process} onChange={e=>setProcess(e.target.value)} placeholder="7ds.exe"/><datalist id={'process-'+game.id}>{apps.map(a=><option key={a} value={a}/>)}</datalist></label>{apps.length>0&&<select aria-label="Aplicación abierta" value={apps.includes(process)?process:""} onChange={e=>setProcess(e.target.value)}><option value="">Elegir aplicación abierta</option>{apps.map(a=><option key={a} value={a}>{a}</option>)}</select>}<button onClick={save} disabled={busy}>{process?"Guardar y detectar automáticamente":"Retirar asociación"}</button>{message&&<p role="status">{message}</p>}{error&&<p className="error" role="alert">{error}</p>}</details>;
}
