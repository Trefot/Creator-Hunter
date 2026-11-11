import { FormEvent, useState } from "react";
import type { Game } from "../../db/games";
import { updateGameAppearance } from "../../db/gameStudio";
import { resizeImage, THUMBNAIL_SIZE } from "../../components/images";
import { GameArtwork } from "./GameArtwork";
import { es } from "../../i18n/es";
const t=es.gameStudio;
export function GameAppearance({game,onChanged}:{game:Game;onChanged:()=>Promise<void>}) {
  const [editing,setEditing]=useState(false),[cover,setCover]=useState(game.cover),[notes,setNotes]=useState(game.notes??"");
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  async function save(e:FormEvent){e.preventDefault();setBusy(true);setError("");try{await updateGameAppearance(game.id,cover,notes);await onChanged();setEditing(false);}catch(e){setError(String(e));}finally{setBusy(false);}}
  return <section className="card game-appearance">
    <div className="game-studio-heading"><h2>{t.notesAndCover}</h2><button className="ghost small-button" onClick={()=>{if(!editing){setCover(game.cover);setNotes(game.notes??"");}setEditing(!editing);}} disabled={busy}>{editing?t.cancel:t.edit}</button></div>
    {editing?<form onSubmit={save} className="game-appearance-form">
      <GameArtwork game={{title:game.title,cover}} className="game-appearance-preview"/>
      <label>{t.cover}<input aria-label={t.cover} type="file" accept="image/*" disabled={busy} onChange={async e=>{const file=e.target.files?.[0];if(!file)return;setBusy(true);setError("");try{setCover(await resizeImage(file,THUMBNAIL_SIZE));}catch(err){setError(String(err));}finally{setBusy(false);}}}/></label>
      <button type="button" className="ghost small-button" disabled={busy} onClick={()=>setCover(null)}>{t.resetCover}</button>
      <label>{t.notes}<textarea aria-label={t.notes} rows={4} maxLength={10000} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
      <button disabled={busy}>{busy?t.saving:t.save}</button>
    </form>:<p className="muted game-notes">{game.notes||t.noNotes}</p>}
    {error&&<p className="error" role="alert">{error}</p>}
  </section>;
}
