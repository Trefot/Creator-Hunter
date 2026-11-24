import { InstalledGames } from "./InstalledGames";
import { bindPcGame, pcRunningApps, pcBindings } from "../../db/pcGames";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { GAME_MODE_CHANGED, selectManualGame, setGameModeEnabled } from "./gameMode";
import type { GameModeState } from "./useGameMode";
import { EmptyState } from "../../components/EmptyState";
import { PageTitle } from "../../components/PageTitle";
import { Game, GAME_PLATFORMS, GamePlatform, GameStatus, createGame, listGames } from "../../db/games";
import { defaultKind, GameKind, gameKinds, KIND_LABELS, KINDS_CHANGED } from "../../db/gameKind";
import { psnStatus } from "../../db/psn";
import { es } from "../../i18n/es";
import { PlatinumCollection } from "./PlatinumCollection";
import { ResumeSpotlight } from "./ResumeSpotlight";
import { GameArtwork } from "./GameArtwork";
import { GameDetail, GameView } from "./GameDetail";
import { PsnConnect } from "./PsnConnect";
import { PsnImport } from "./PsnImport";

const t = es.games;
const GROUPS: { title: string; statuses: GameStatus[] }[] = [
  { title: "En curso", statuses: ["playing"] },
  { title: "En pausa", statuses: ["backlog", "dropped"] },
  { title: "Terminados", statuses: ["completed", "platinum"] },
];

/** Biblioteca de juegos: «Jugando ahora» arriba y el resto agrupado por estado. */
export function GamesPage({ initialOpenId = null, initialView, gameMode, onOpenProject, onOpenIdeas }: {
  initialOpenId?: string | null;
  initialView?: GameView;
  gameMode: GameModeState;
  onOpenProject: (id: string) => void;
  onOpenIdeas: () => void;
}) {
  const [games, setGames] = useState<Game[] | null>(null);
  const [kinds, setKinds] = useState<Record<string, GameKind>>({});
  const [connected, setConnected] = useState(false);
  const [importing, setImporting] = useState(false);
  const [adding, setAdding] = useState(false), [platinums, setPlatinums] = useState(false), [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(initialOpenId);
  const [error, setError] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newPlatform, setNewPlatform] = useState<GamePlatform>("pc");
  const [saving, setSaving] = useState(false);
  const [apps, setApps] = useState<string[]>([]), [newProcess, setNewProcess] = useState(""), [scanning, setScanning] = useState(false);
  async function scanApps() { setScanning(true); setError(""); try { setApps(await pcRunningApps()); } catch (e) { setError(String(e)); } finally { setScanning(false); } }

  async function addGame(title: string, platform: GamePlatform, process = newProcess) {
    if (!title.trim() || saving) return;
    setSaving(true); setError("");
    try {
      if (platform === "pc" && process) {
        if (process.length > 255 || !process.toLowerCase().endsWith(".exe") || /[\\/:\x00-\x1f]/.test(process)) throw Error("Introduce solo el nombre del ejecutable, sin su ruta.");
        const previous = (await listGames()).find((g) => g.platform === "pc" && g.title.trim().toLowerCase() === title.trim().toLowerCase());
        if (pcBindings().some((b) => b.process.toLowerCase() === process.trim().toLowerCase() && b.game_id !== previous?.id)) throw Error("Ese ejecutable está asociado a otro juego. Retira esa asociación en Ajustes → Conexiones → Juegos detectados.");
      }
      const id = await createGame(title, platform);
      if (platform === "pc" && process) { bindPcGame({ id, title: title.trim() }, process); selectManualGame(null); setGameModeEnabled(true); }
      setNewProcess(""); setNewTitle(""); setAdding(false);
      await refresh();
      setOpenId(id);
      window.dispatchEvent(new Event(GAME_MODE_CHANGED));
    } catch (err) { setError(String(err)); } finally { setSaving(false); }
  }

  async function refresh() {
    try {
      const [g, c, k] = await Promise.all([listGames(), psnStatus().catch(() => false), gameKinds().catch(() => ({}))]);
      setGames(g); setConnected(c); setKinds(k);
    } catch (err) { setError(String(err)); }
  }

  useEffect(() => {
    void refresh();
    window.addEventListener("nexus-game-library-changed", refresh); window.addEventListener(KINDS_CHANGED, refresh);
    return () => { window.removeEventListener("nexus-game-library-changed", refresh); window.removeEventListener(KINDS_CHANGED, refresh); };
  }, []);

  const resumeGame = gameMode.playing ?? games?.find((g) => g.status === "playing") ?? null;
  const open = games?.find((g) => g.id === openId);
  const importDialog = importing ? <PsnImport library={games ?? []} onImported={async (id) => { await refresh(); setImporting(false); setOpenId(id); }} onClose={() => setImporting(false)} /> : null;
  if (open) {
    return <>
      {importDialog}
      {connected && (open.platform === "ps4" || open.platform === "ps5") && !open.np_communication_id && <div className="card"><p>Para cargar los trofeos y la portada oficial, importa este juego desde tu cuenta de PSN.</p><button onClick={() => setImporting(true)}>Importar trofeos de PSN</button></div>}
      <GameDetail key={open.id} game={open} psnConnected={connected} initialView={open.id === initialOpenId ? initialView : undefined} onBack={() => setOpenId(null)} onChanged={refresh} onOpenProject={onOpenProject} onOpenIdeas={onOpenIdeas} />
    </>;
  }

  const query = search.trim().toLocaleLowerCase();
  const rest = (games ?? []).filter((g) => g.id !== resumeGame?.id && g.title.toLocaleLowerCase().includes(query));
  const kindOf = (g: Game) => kinds[g.id] ?? defaultKind(g);
  const detectedNew = gameMode.detectedPc && !games?.some((g) => g.platform === "pc" && g.title.toLowerCase() === gameMode.detectedPc!.name.toLowerCase());

  return (
    <section className="page">
      <header className="page-header">
        <PageTitle section="games" subtitle={t.subtitle} />
        <button onClick={() => setAdding((v) => !v)} aria-expanded={adding}><Plus size={16} /> Añadir juego</button>
      </header>

      {detectedNew && <div className="card"><p>Nexus ve abierto <strong>{gameMode.detectedPc!.name}</strong> y no está en tu biblioteca.</p><button disabled={saving} onClick={() => addGame(gameMode.detectedPc!.name, "pc", gameMode.detectedPc!.process ?? "")}>{t.addDetectedPc(gameMode.detectedPc!.name)}</button></div>}
      {gameMode.detectedPsn && !gameMode.playing && <div className="card"><p>Detectado en PSN: <strong>{gameMode.detectedPsn.name}</strong></p><button disabled={saving} onClick={() => addGame(gameMode.detectedPsn!.name, gameMode.detectedPsnPlatform ?? "ps5", "")}>Añadir a mi biblioteca</button><button className="ghost" onClick={() => setImporting(true)}>Importar con trofeos</button></div>}

      {adding && <section className="card game-add-panel">
        <h2>Añadir juego</h2>
        <form className="game-add-form" onSubmit={(e) => { e.preventDefault(); void addGame(newTitle, newPlatform); }}>
          <label>{t.gameTitle}<input required maxLength={150} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Fortnite" /></label>
          <label>{t.gamePlatform}<select aria-label="Plataforma del juego" value={newPlatform} onChange={(e) => setNewPlatform(e.target.value as GamePlatform)}>{GAME_PLATFORMS.map((p) => <option key={p} value={p}>{t.platforms[p]}</option>)}</select></label>
          {newPlatform === "pc" && <><button type="button" className="ghost" onClick={scanApps} disabled={scanning}>{scanning ? "Consultando…" : "Ver juegos abiertos"}</button><label>Ejecutable (opcional)<input aria-label="Asociar ejecutable" list="new-game-processes" value={newProcess} onChange={(e) => setNewProcess(e.target.value)} placeholder="7ds.exe" /><datalist id="new-game-processes">{apps.map((a) => <option key={a} value={a} />)}</datalist></label></>}
          <button disabled={saving || !newTitle.trim()}>{saving ? t.addingGame : "Añadir y abrir"}</button>
        </form>
        <p className="muted small">Al abrirlo eliges qué es para ti: 🏆 Platino, 🎮 Partida o 🎬 Serie (botón «Editar juego»).</p>
        <details><summary>{es.gameStudio.psnOptions}</summary><PsnConnect connected={connected} onChange={refresh} onImport={() => setImporting(true)} /></details>
        <InstalledGames onChanged={refresh} />
      </section>}
      {importDialog}
      {error && <p className="error" role="alert">{error}</p>}

      {resumeGame && <>
        <span className="nexus-eyebrow">JUGANDO AHORA · {KIND_LABELS[kindOf(resumeGame)].icon} {KIND_LABELS[kindOf(resumeGame)].name.toUpperCase()}</span>
        <ResumeSpotlight game={resumeGame} onOpen={() => setOpenId(resumeGame.id)} />
      </>}
      {!!games?.length && <label className="small muted">¿Juegas a otro ahora?<select aria-label={t.chooseCurrentGame} value={gameMode.source === "manual" ? gameMode.playing?.id ?? "" : ""} onChange={(e) => selectManualGame(e.target.value || null)}><option value="">{t.automaticGame}</option>{games.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}</select></label>}

      {games === null ? <p className="muted">{t.loading}</p> : games.length === 0 ? <EmptyState section="games" text={t.empty} /> : <>
        {games.length > 8 && <div className="game-library-filters"><input aria-label={es.gameStudio.search} placeholder={es.gameStudio.search} value={search} onChange={(e) => setSearch(e.target.value)} /></div>}
        {GROUPS.map((group) => {
          const items = rest.filter((g) => group.statuses.includes(g.status));
          const finished = group.title === "Terminados";
          if (!items.length && !finished) return null;
          return <section key={group.title} className="game-group">
            <div className="game-studio-heading"><h2>{group.title} <span className="tab-count">{items.length}</span></h2>{finished && <button className="ghost small-button" onClick={() => setPlatinums((v) => !v)}>🏆 {platinums ? "Ocultar mis platinos" : "Mi colección de platinos"}</button>}</div>
            {finished && platinums && <PlatinumCollection games={games} onChanged={refresh} onOpen={setOpenId} />}
            {items.length > 0 && <ul className="gallery">{items.map((g) => {
              const ratio = g.trophy_count ? g.earned_count / g.trophy_count : 0, k = kindOf(g);
              return <li key={g.id}><button className="card gallery-card gallery-button" onClick={() => setOpenId(g.id)}>
                <div className="gallery-cover game-gallery-cover"><GameArtwork game={g} /><span className={`gallery-status game-status-${g.status}`}>{KIND_LABELS[k].icon} {KIND_LABELS[k].name}</span></div>
                <div className="gallery-body">
                  <strong className="gallery-title">{g.title}</strong>
                  <span className="muted small">{t.platforms[g.platform]}{k === "platinum" && g.trophy_count > 0 ? ` · ${t.trophyProgress(g.earned_count, g.trophy_count)}` : ` · ${t.statuses[g.status]}`}</span>
                  {k === "platinum" && g.trophy_count > 0 && <span className="progress"><span className={`progress-bar${ratio >= 1 ? " progress-done" : ""}`} style={{ width: `${ratio * 100}%` }} /></span>}
                </div>
              </button></li>;
            })}</ul>}
          </section>;
        })}
      </>}
    </section>
  );
}
