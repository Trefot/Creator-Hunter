import { useEffect, useState } from "react";
import { Radar } from "lucide-react";
import { GAME_MODE_CHANGED, isGameModeEnabled, selectManualGame, setGameModeEnabled } from "./gameMode";
import type { GameModeState } from "./useGameMode";
import { EmptyState } from "../../components/EmptyState";
import { PageTitle } from "../../components/PageTitle";
import { Game, GAME_PLATFORMS, GamePlatform, createGame, listGames } from "../../db/games";
import { psnStatus } from "../../db/psn";
import { es } from "../../i18n/es";
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
  const [search,setSearch]=useState("");
  const [platform,setPlatform]=useState("");
  const [games, setGames] = useState<Game[] | null>(null);
  const [gameModeOn, setGameModeOn] = useState(isGameModeEnabled());
  const [connected, setConnected] = useState(false);
  const [importing, setImporting] = useState(false);
  const [openId, setOpenId] = useState<string | null>(initialOpenId);
  const [error, setError] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newPlatform, setNewPlatform] = useState<GamePlatform>("pc");
  const [saving, setSaving] = useState(false);

  async function addGame(title: string, platform: GamePlatform) {
    if (!title.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      await createGame(title, platform);
      setNewTitle("");
      await refresh();
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
  }, []);

  const visibleGames=(games??[]).filter(g=>(!platform||g.platform===platform)&&g.title.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const open = games?.find((g) => g.id === openId);
  if (open) {
    return (
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
    );
  }

  return (
    <section className="page">
      <header className="page-header">
        <PageTitle section="games" subtitle={t.subtitle} />
      </header>

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
                    : gameMode.error ? t.gameModeError(gameMode.error) : t.gameModeIdle}
          </span>
        </div>
      }

      <details className="card game-activity-controls" open={gameMode.detectedPc&&!gameMode.playing?true:undefined}><summary>{es.gameStudio.addOrChoose}</summary>
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
          <button disabled={saving} onClick={() => addGame(gameMode.detectedPc!.name, "pc")}>{t.addDetectedPc(gameMode.detectedPc.name)}</button>
        )}
        <form className="game-add-form" onSubmit={e => { e.preventDefault(); void addGame(newTitle, newPlatform); }}>
          <label>{t.gameTitle}<input required maxLength={150} value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Fortnite" /></label>
          <label>{t.gamePlatform}<select value={newPlatform} onChange={e => setNewPlatform(e.target.value as GamePlatform)}>
            {GAME_PLATFORMS.map(p => <option key={p} value={p}>{t.platforms[p]}</option>)}
          </select></label>
          <button disabled={saving || !newTitle.trim()}>{saving ? t.addingGame : t.addGame}</button>
        </form>
      </details>

      {importing && (
        <PsnImport
          library={games ?? []}
          onImported={async (gameId) => {
            await refresh();
            setImporting(false);
            setOpenId(gameId);
          }}
          onClose={() => setImporting(false)}
        />
      )}

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
    </section>
  );
}
