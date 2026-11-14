import { bindPcGame,pcRunningApps,pcBindings } from "../../db/pcGames";
import { useEffect, useState } from "react";
import { Radar } from "lucide-react";
import { GAME_MODE_CHANGED, isAutoAddEnabled,setAutoAddEnabled,isGameModeEnabled, selectManualGame, setGameModeEnabled } from "./gameMode";
import type { GameModeState } from "./useGameMode";
import { EmptyState } from "../../components/EmptyState";
import { PageTitle } from "../../components/PageTitle";
import { Game, GAME_PLATFORMS, GamePlatform, createGame, listGames } from "../../db/games";
import { psnStatus } from "../../db/psn";
import { es } from "../../i18n/es";
import { PlatinumCollection } from "./PlatinumCollection";
import { GameBroadcastPanel } from "./GameBroadcastPanel";
import { ResumeSpotlight } from "./ResumeSpotlight";
import { GameArtwork } from "./GameArtwork";
import { GameDetail, GameView } from "./GameDetail";
import { PsnConnect } from "./PsnConnect";
import { PsnImport } from "./PsnImport";

const t = es.games;

/** Biblioteca de juegos; al abrir uno se muestra su ficha con los trofeos. */
export function GamesPage({
  initialOpenId = null,
  initialView,
  gameMode,
  onOpenProject,
  onOpenIdeas,
}: {
  initialOpenId?: string | null;
  initialView?: GameView;
  gameMode: GameModeState;
  onOpenProject:(id:string)=>void;
  onOpenIdeas:()=>void;
}) {
  const [tab,setTab]=useState<"library"|"platinum"|"broadcast">("library");
  const [search,setSearch]=useState("");
  const [platform,setPlatform]=useState("");
  const [games, setGames] = useState<Game[] | null>(null);
  const [gameModeOn, setGameModeOn] = useState(isGameModeEnabled());
  const [autoAdd,setAutoAdd]=useState(isAutoAddEnabled());
  const [connected, setConnected] = useState(false);
  const [importing, setImporting] = useState(false);
  const [openId, setOpenId] = useState<string | null>(initialOpenId);
  const [error, setError] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newPlatform, setNewPlatform] = useState<GamePlatform>("pc");
  const [saving, setSaving] = useState(false);
  const [apps,setApps]=useState<string[]>([]),[newProcess,setNewProcess]=useState("");
  const [scanning,setScanning]=useState(false);
  async function scanApps(){setScanning(true);setError("");try{setApps(await pcRunningApps());}catch(e){setError(String(e));}finally{setScanning(false);}}

  async function addGame(title: string, platform: GamePlatform,process=newProcess) {
    if (!title.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      if(platform==="pc"&&process){
        if(process.length>255||!process.toLowerCase().endsWith(".exe")||/[\\/:\x00-\x1f]/.test(process))throw Error("Introduce solo el nombre del ejecutable, sin su ruta.");
        const previous=(await listGames()).find(g=>g.platform==="pc"&&g.title.trim().toLowerCase()===title.trim().toLowerCase());
        if(pcBindings().some(b=>b.process.toLowerCase()===process.trim().toLowerCase()&&b.game_id!==previous?.id))throw Error("Ese ejecutable está asociado a otro juego. Retira esa asociación desde su ficha.");
      }
      const id=await createGame(title, platform);
      if(platform==="pc"&&process){bindPcGame({id,title:title.trim()},process);selectManualGame(null);setGameModeEnabled(true);setGameModeOn(true);}
      setNewProcess("");
      setNewTitle("");
      await refresh();
      setSearch("");setPlatform("");setTab("library");setOpenId(id);
      window.dispatchEvent(new Event(GAME_MODE_CHANGED));
    } catch (err) { setError(String(err)); }
    finally { setSaving(false); }
  }

  async function refresh() {
    try {
      const [g, c] = await Promise.all([listGames(), psnStatus().catch(() => false)]);
      setGames(g);
      setConnected(c);
    } catch (err) {
      setError(String(err));
    }
  }

  useEffect(() => {
    refresh();
    const sync=()=>{setGameModeOn(isGameModeEnabled());setAutoAdd(isAutoAddEnabled());};
    window.addEventListener("nexus-game-library-changed",refresh);window.addEventListener(GAME_MODE_CHANGED,sync);
    return()=>{window.removeEventListener("nexus-game-library-changed",refresh);window.removeEventListener(GAME_MODE_CHANGED,sync);};
  }, []);

  const visibleGames=(games??[]).filter(g=>(!platform||g.platform===platform)&&g.title.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const resumeGame=gameMode.playing??games?.find(g=>g.status==="playing")??null;
  const open = games?.find((g) => g.id === openId);
  const importDialog=importing?<PsnImport library={games??[]} onImported={async id=>{await refresh();setImporting(false);setOpenId(id);}} onClose={()=>setImporting(false)}/>:null;
  if (open) {
    return (
      <>
      {importDialog}
      {connected&&(open.platform==="ps4"||open.platform==="ps5")&&!open.np_communication_id&&<div className="card"><p>Esta es tu ficha local. Para cargar los trofeos y la portada oficial, importa este juego desde tu cuenta de PSN.</p><button onClick={()=>setImporting(true)}>Importar trofeos de PSN</button></div>}
      <GameDetail
        key={open.id}
        game={open}
        psnConnected={connected}
        initialView={open.id === initialOpenId ? initialView : undefined}
        onBack={() => setOpenId(null)}
        onChanged={refresh}
        onOpenProject={onOpenProject}
        onOpenIdeas={onOpenIdeas}
      />
      </>
    );
  }

  return (
    <section className="page">
      <header className="page-header">
        <PageTitle section="games" subtitle={t.subtitle} />
      </header>

      <div className="tabs">{([['library','Biblioteca'],['platinum','Platinados'],['broadcast','Overlay y objetos']] as const).map(([key,label])=><button key={key} className={`tab${tab===key?' active':''}`} onClick={()=>setTab(key)}>{label}</button>)}<button className="ghost small-button" onClick={refresh}>Actualizar biblioteca</button></div>
      {tab==='platinum'?<PlatinumCollection games={games??[]} onChanged={refresh} onOpen={setOpenId}/>:tab==='broadcast'?<GameBroadcastPanel games={games??[]}/>:<>
      {resumeGame&&<ResumeSpotlight game={resumeGame} onOpen={()=>setOpenId(resumeGame.id)}/>}
      <details className="card library-preferences" open={!games?.length||!!((gameMode.detectedPc||gameMode.detectedPsn)&&!gameMode.playing)||undefined}><summary>Añadir juegos · detección e importación</summary>
      <details className="game-psn-options"><summary>{es.gameStudio.psnOptions}</summary><PsnConnect connected={connected} onChange={refresh} onImport={() => setImporting(true)} /></details>

      {
        <div className="game-mode">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={gameModeOn}
              onChange={(e) => {
                setGameModeEnabled(e.target.checked);
                setGameModeOn(e.target.checked);
              }}
            />
            <Radar size={16} /> <strong>{t.gameMode}</strong>
          </label>
          <span className="muted small">
            {!gameModeOn
              ? t.gameModeOff
              : gameMode.playing
                  ? t.gameModePlaying(gameMode.playing.title)
                  : gameMode.detectedPc
                    ? t.pcDetected(gameMode.detectedPc.name)
                    : gameMode.detectedPsn ? `Detectado en PSN: ${gameMode.detectedPsn.name}` : gameMode.error ? t.gameModeError(gameMode.error) : t.gameModeIdle}
          </span>
        </div>
      }

      <div className="card"><label className="checkbox"><input type="checkbox" checked={autoAdd} onChange={e=>{setAutoAddEnabled(e.target.checked);setAutoAdd(e.target.checked);}}/>Añadir a la biblioteca los juegos detectados</label><p className="muted small">Crea una ficha local para juegos reconocidos de PC y la actividad visible de PSN. Otros juegos de PC necesitan asociarse a su ejecutable. La portada y los trofeos de PSN se cargan al importar sus datos.</p>{gameMode.source==="manual"&&<button onClick={()=>selectManualGame(null)}>Volver a la detección automática</button>}</div>
      <details className="card game-activity-controls" open={(gameMode.detectedPc||gameMode.detectedPsn)&&!gameMode.playing?true:undefined}><summary>{es.gameStudio.addOrChoose}</summary>
        <h2>{t.currentGame}</h2>
        <label>{t.chooseCurrentGame}
          <select value={gameMode.source === "manual" ? gameMode.playing?.id ?? "" : ""}
            onChange={e => selectManualGame(e.target.value || null)}>
            <option value="">{t.automaticGame}</option>
            {(games ?? []).map(g => <option key={g.id} value={g.id}>{g.title} · {t.platforms[g.platform]}</option>)}
          </select>
        </label>
        <p className="muted small">{t.manualGameHint}</p>
        {gameMode.detectedPc && !games?.some(g => g.platform === "pc" && g.title.toLowerCase() === gameMode.detectedPc!.name.toLowerCase()) && (
          <button disabled={saving} onClick={() => addGame(gameMode.detectedPc!.name, "pc",gameMode.detectedPc!.process??"")}>{t.addDetectedPc(gameMode.detectedPc.name)}</button>
        )}
        {gameMode.detectedPsn&&!gameMode.playing&&<div className="card"><p>Detectado en PSN: <strong>{gameMode.detectedPsn.name}</strong> · {gameMode.detectedPsnPlatform?.toUpperCase()??"PS5"}</p><button disabled={saving} onClick={()=>addGame(gameMode.detectedPsn!.name,gameMode.detectedPsnPlatform??"ps5","")}>Crear ficha del juego detectado</button><button onClick={()=>setImporting(true)}>Importar desde PSN con trofeos</button></div>}
        <p className="muted small">Añade un juego para abrir su ficha con objetivos, notas y contenido. En PC elige el ejecutable del juego, no Steam ni su lanzador; la detección no importa logros ni portadas. Para PS5, usa la importación de PSN si quieres sus trofeos.</p>
        <form className="game-add-form" onSubmit={e => { e.preventDefault(); void addGame(newTitle, newPlatform); }}>
          <label>{t.gameTitle}<input required maxLength={150} value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Fortnite" /></label>
          <label>{t.gamePlatform}<select aria-label="Plataforma del juego" value={newPlatform} onChange={e => setNewPlatform(e.target.value as GamePlatform)}>
            {GAME_PLATFORMS.map(p => <option key={p} value={p}>{t.platforms[p]}</option>)}
          </select></label>
          {newPlatform==="pc"&&<><button type="button" onClick={scanApps} disabled={scanning}>{scanning?"Consultando…":"Ver juegos y aplicaciones abiertos"}</button><label>Asociar ejecutable (opcional)<input aria-label="Asociar ejecutable" list="new-game-processes" value={newProcess} onChange={e=>setNewProcess(e.target.value)} placeholder="7ds.exe"/><datalist id="new-game-processes">{apps.map(a=><option key={a} value={a}/>)}</datalist></label>{apps.length>0&&<select aria-label="Elegir proceso abierto" value={apps.includes(newProcess)?newProcess:""} onChange={e=>setNewProcess(e.target.value)}><option value="">Elegir proceso abierto</option>{apps.map(a=><option key={a} value={a}>{a}</option>)}</select>}</>}
          <button disabled={saving || !newTitle.trim()}>{saving ? t.addingGame : "Añadir y abrir ficha"}</button>
        </form>
      </details>

      </details>
      {importDialog}

      {error && <p className="error">{error}</p>}

      <div className="game-library-filters"><input aria-label={es.gameStudio.search} placeholder={es.gameStudio.search} value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label={es.gameStudio.filterPlatform} value={platform} onChange={e=>setPlatform(e.target.value)}><option value="">{es.gameStudio.allPlatforms}</option>{GAME_PLATFORMS.map(p=><option key={p} value={p}>{t.platforms[p]}</option>)}</select></div>
      {games === null ? (
        <p className="muted">{t.loading}</p>
      ) : games.length === 0 ? (
        <EmptyState section="games" text={t.empty} />
      ) : !visibleGames.length ? (<p className="muted">{es.gameStudio.noMatches}</p>) : (
        <ul className="gallery">
          {visibleGames.map((g) => {
            const ratio = g.trophy_count ? g.earned_count / g.trophy_count : 0;
            return (
              <li key={g.id}>
                <button className="card gallery-card gallery-button" onClick={() => setOpenId(g.id)}>
                  <div className="gallery-cover game-gallery-cover">
                    <GameArtwork game={g}/>
                    <span className={`gallery-status game-status-${g.status}`}>{t.statuses[g.status]}</span>
                  </div>
                  <div className="gallery-body">
                    <strong className="gallery-title">{g.title}</strong>
                    <span className="muted small">
                      {t.platforms[g.platform]}{g.trophy_count>0?` · ${t.trophyProgress(g.earned_count,g.trophy_count)}`:` · ${es.gameStudio.cardHint}`}
                    </span>
                    {g.trophy_count>0&&<span className="progress">
                      <span
                        className={`progress-bar${ratio >= 1 ? " progress-done" : ""}`}
                        style={{ width: `${ratio * 100}%` }}
                      />
                    </span>}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      </>}
    </section>
  );
}
