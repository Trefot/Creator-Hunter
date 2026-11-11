import { useState } from "react";
import { Game,GAME_STATUSES,GameStatus,deleteGame,updateGameStatus } from "../../db/games";
import { GameDayPlan } from "./GameDayPlan";
import { GameContent } from "./GameContent";
import { GameAppearance } from "./GameAppearance";
import { GameArtwork } from "./GameArtwork";
import { es } from "../../i18n/es";
const t=es.gameStudio;
export interface CreativeGameProps {game:Game;onBack:()=>void;onChanged:()=>Promise<void>;onOpenProject:(id:string)=>void;onOpenIdeas:()=>void}
export function CreativeGameDetail({game,onBack,onChanged,onOpenProject,onOpenIdeas}:CreativeGameProps) {
  const [tab,setTab]=useState<"today"|"content"|"notes">("today");
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[confirm,setConfirm]=useState(false);
  async function status(value:GameStatus){setBusy(true);setError("");try{await updateGameStatus(game.id,value);await onChanged();}catch(e){setError(String(e));}finally{setBusy(false);}}
  async function remove(){setBusy(true);setError("");try{await deleteGame(game.id);await onChanged();onBack();}catch(e){setError(String(e));}finally{setBusy(false);}}
  return <section className="page game-creative-detail">
    <button className="link back-link" onClick={onBack}>{es.games.back}</button>
    <header className="game-creative-hero"><GameArtwork game={game}/><div className="game-creative-hero-content"><span className="game-platform-pill">{es.games.platforms[game.platform]}</span><h1>{game.title}</h1><p>{t.heroHint}</p></div></header>
    <div className="game-detail-toolbar"><label>{t.status}<select aria-label={t.status} disabled={busy} value={game.status} onChange={e=>status(e.target.value as GameStatus)}>{GAME_STATUSES.map(s=><option key={s} value={s}>{es.games.statuses[s]}</option>)}</select></label><span className="muted small">{t.yourSpace}</span></div>
    {error&&<p role="alert" className="error">{error}</p>}
    <div className="tabs">{(["today","content","notes"] as const).map(value=><button key={value} className={`tab${tab===value?" active":""}`} onClick={()=>setTab(value)}>{t.tabs[value]}</button>)}</div>
    {tab==="today"?<GameDayPlan game={game}/>:tab==="content"?<GameContent game={game} onOpenProject={onOpenProject} onOpenIdeas={onOpenIdeas}/>:<GameAppearance game={game} onChanged={onChanged}/>}
    <details className="game-delete-zone"><summary>{t.manageGame}</summary><p className="muted small">{t.deleteHint}</p>{confirm?<><button className="danger small-button" disabled={busy} onClick={remove}>{t.confirmRemoveGame}</button><button className="ghost small-button" disabled={busy} onClick={()=>setConfirm(false)}>{t.cancel}</button></>:<button className="ghost small-button" onClick={()=>setConfirm(true)}>{es.games.delete}</button>}</details>
  </section>;
}
