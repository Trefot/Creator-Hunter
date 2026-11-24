import { GamePlan } from "./GamePlan";
import { GameResume } from "./GameResume";
import { useEffect, useState } from "react";
import { RefreshCw, Settings, Trash2 } from "lucide-react";
import { ProgressRing } from "../../components/charts/ProgressRing";
import { deleteGame, Game, GAME_STATUSES, GameStatus, listPhases, listTrophies, Trophy, TrophyPhase, TrophyType, updateGameStatus } from "../../db/games";
import { defaultKind, GAME_KINDS, GameKind, gameKinds, KIND_LABELS, setGameKind } from "../../db/gameKind";
import { es } from "../../i18n/es";
import { formatDate } from "../../i18n/format";
import { refreshFromPsn } from "./importGame";
import { GuideEntry, listGuide } from "../../db/guide";
import { GuideView } from "./GuideView";
import { TodayView } from "./TodayView";
import { RouteView } from "./RouteView";
import { TrophyRow } from "./TrophyRow";
import { TrophySheet } from "./TrophySheet";
import { GameDayPlan } from "./GameDayPlan";
import { GameAppearance } from "./GameAppearance";
import { GameArtwork } from "./GameArtwork";
import { GameContent } from "./GameContent";
import { GameContextProvider, useGameState } from "./GameContext";

const t = es.games;
const TYPES: TrophyType[] = ["platinum", "gold", "silver", "bronze"];
type Filter = "all" | "pending" | "earned";
/** Vistas antiguas que otras pantallas aún pueden pedir; se traducen a las pestañas nuevas. */
export type GameView = "today" | "route" | "guide" | "list" | "studio" | "live";
type Tab = "today" | "trophies" | "guide" | "content" | "notes";
const TABS: Record<GameKind, [Tab, string][]> = {
  platinum: [["today", "Hoy"], ["trophies", "Trofeos"], ["guide", "Guía"]],
  casual: [["today", "Hoy"], ["notes", "Notas"]],
  series: [["today", "Hoy"], ["content", "Episodios y momentos"], ["notes", "Notas"]],
};
const fromView = (v?: GameView): Tab => v === "route" || v === "list" ? "trophies" : v === "guide" ? "guide" : v === "studio" ? "content" : "today";

interface Props {
  game: Game;
  psnConnected: boolean;
  initialView?: GameView;
  onBack: () => void;
  onChanged: () => Promise<void>;
  onOpenProject: (id: string) => void;
  onOpenIdeas: () => void;
}

/** Ficha de un juego: cada juego tiene su modo (platino, partida o serie) y como mucho tres pestañas. */
export function GameDetail({ game, psnConnected, initialView, onBack, onChanged, onOpenProject, onOpenIdeas }: Props) {
  const [kind, setKind] = useState<GameKind | null>(null);
  const [tab, setTab] = useState<Tab>(fromView(initialView));
  const [trophies, setTrophies] = useState<Trophy[] | null>(null);
  const [phases, setPhases] = useState<TrophyPhase[]>([]);
  const [guide, setGuide] = useState<GuideEntry[]>([]);
  const [trophyView, setTrophyView] = useState<"route" | "list">(initialView === "list" ? "list" : "route");
  const [filter, setFilter] = useState<Filter>("pending");
  const [editing, setEditing] = useState(false), [syncing, setSyncing] = useState(false), [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState("");
  const [sheetId, setSheetId] = useState<string | null>(null);
  const gameState = useGameState(game, trophies, (x) => setSheetId(x.id));

  async function refresh() {
    try {
      const [tr, ph, gu] = await Promise.all([listTrophies(game.id), listPhases(game.id), listGuide(game.id)]);
      setTrophies(tr); setPhases(ph); setGuide(gu);
    } catch (err) { setError(String(err)); }
  }
  useEffect(() => { void refresh(); void gameKinds().then((k) => setKind(k[game.id] ?? defaultKind(game))).catch(() => setKind(defaultKind(game))); }, [game.id]);
  const current = kind ?? defaultKind(game);
  const tabs = TABS[current];
  const activeTab = tabs.some(([v]) => v === tab) ? tab : "today";

  async function chooseKind(k: GameKind) { setError(""); try { await setGameKind(game.id, k); setKind(k); await onChanged(); } catch (e) { setError(String(e)); } }
  async function onSync() {
    if (!game.np_communication_id || !game.np_service_name) return;
    setError(""); setSyncing(true);
    try { await refreshFromPsn(game.id, game.np_communication_id, game.np_service_name); await refresh(); await onChanged(); }
    catch (err) { setError(String(err)); } finally { setSyncing(false); }
  }
  async function onStatus(status: GameStatus) { try { await updateGameStatus(game.id, status); await onChanged(); } catch (e) { setError(String(e)); } }
  async function onDelete() { try { await deleteGame(game.id); await onChanged(); onBack(); } catch (e) { setError(String(e)); } }

  const list = trophies ?? [];
  const earned = list.filter((x) => x.earned_at !== null).length;
  const ratio = list.length ? earned / list.length : 0;
  const byType = (type: TrophyType) => ({ earned: list.filter((x) => x.type === type && x.earned_at).length, total: list.filter((x) => x.type === type).length });
  const visible = list.filter((x) => (filter === "all" ? true : filter === "earned" ? x.earned_at : !x.earned_at));

  return (
    <section className="page">
      <button className="link back-link" onClick={onBack}>{t.back}</button>
      <header className="game-hero">
        {game.cover ? <img className="game-cover" src={game.cover} alt="" /> : <GameArtwork game={game} className="game-cover" />}
        <div className="game-hero-main">
          <span className="game-platform-pill">{KIND_LABELS[current].icon} {KIND_LABELS[current].name} · {t.platforms[game.platform]}</span>
          <h1>{game.title}</h1>
          {current === "platinum" && list.length > 0 && <div className="trophy-counts">{TYPES.map((type) => { const c = byType(type); return c.total > 0 ? <span key={type} className={`trophy-count trophy-${type}`}>{t.types[type]} {c.earned}/{c.total}</span> : null; })}</div>}
          <div className="profile-actions wrap game-actions">
            <select aria-label={es.gameStudio.status} value={game.status} onChange={(e) => void onStatus(e.target.value as GameStatus)}>{GAME_STATUSES.map((s) => <option key={s} value={s}>{t.statuses[s]}</option>)}</select>
            <button className="ghost small-button" aria-expanded={editing} onClick={() => setEditing((v) => !v)}><Settings size={14} /> Editar juego</button>
          </div>
        </div>
        {current === "platinum" && list.length > 0 && <ProgressRing ratio={ratio} size={104} label={t.platinumProgress(Math.floor(ratio * 100))} />}
      </header>
      {error && <p className="error" role="alert">{error}</p>}

      {editing && <section className="card game-edit">
        <h2>Editar juego</h2>
        <fieldset className="game-kind-picker"><legend>¿Qué es este juego para ti?</legend>
          {GAME_KINDS.map((k) => <label key={k} className="checkbox"><input type="radio" name={"kind-" + game.id} checked={current === k} onChange={() => void chooseKind(k)} /><span><strong>{KIND_LABELS[k].icon} {KIND_LABELS[k].name}</strong> · <span className="muted small">{KIND_LABELS[k].hint}</span></span></label>)}
        </fieldset>
        <GameAppearance game={game} onChanged={onChanged} />
        {current === "platinum" && <GamePlan gameId={game.id} />}
        <div className="profile-actions wrap">
          {game.np_communication_id && psnConnected && <button className="small-button" onClick={onSync} disabled={syncing}><RefreshCw size={14} className={syncing ? "spin" : ""} />{syncing ? t.syncing : t.syncPsn}</button>}
          {confirmingDelete ? <><button className="danger small-button" onClick={onDelete}>{t.confirmDelete}</button><button className="ghost small-button" onClick={() => setConfirmingDelete(false)}>{t.cancel}</button></>
            : <button className="ghost small-button" onClick={() => setConfirmingDelete(true)}><Trash2 size={14} /> {t.delete}</button>}
        </div>
        {game.last_synced_at && <p className="muted small">{t.lastSynced(formatDate(game.last_synced_at.slice(0, 10)))}</p>}
      </section>}

      <GameContextProvider value={gameState}>
        <div className="tabs" role="tablist" aria-label="Pestañas del juego">{tabs.map(([v, label]) => <button key={v} role="tab" aria-selected={activeTab === v} className={`tab${activeTab === v ? " active" : ""}`} onClick={() => setTab(v)}>{label}</button>)}</div>

        {activeTab === "today" && <>
          <GameResume gameId={game.id} />
          {current === "platinum" && list.length > 0
            ? <TodayView game={game} trophies={list} phases={phases} onGoPending={() => { setFilter("pending"); setTrophyView("list"); setTab("trophies"); }} />
            : <GameDayPlan game={game} />}
        </>}
        {activeTab === "notes" && <GameAppearance game={game} onChanged={onChanged} />}
        {activeTab === "content" && <GameContent game={game} onOpenProject={onOpenProject} onOpenIdeas={onOpenIdeas} />}
        {activeTab === "guide" && (trophies === null ? <p className="muted">{t.loading}</p> : <GuideView game={game} guide={guide} phases={phases} trophies={list} onChanged={refresh} />)}
        {activeTab === "trophies" && (trophies === null ? <p className="muted">{t.loading}</p> : list.length === 0 ? <p className="muted small">{t.noTrophies}</p> : <>
          <div className="tabs">{([["route", "Ruta al platino"], ["list", "Lista de trofeos"]] as const).map(([v, label]) => <button key={v} className={`tab${trophyView === v ? " active" : ""}`} onClick={() => setTrophyView(v)}>{label}</button>)}</div>
          {trophyView === "route" ? <RouteView game={game} trophies={list} phases={phases} guide={guide} onChanged={refresh} /> : <>
            <div className="tabs">{(["pending", "earned", "all"] as Filter[]).map((f) => <button key={f} className={`tab${filter === f ? " active" : ""}`} onClick={() => setFilter(f)}>{t.filters[f]} <span className="tab-count">{f === "all" ? list.length : f === "earned" ? earned : list.length - earned}</span></button>)}</div>
            <ul className="trophy-list">{visible.map((x) => <TrophyRow key={x.id} trophy={x} phases={phases} onChanged={refresh} />)}</ul>
          </>}
        </>)}

        {sheetId && trophies?.find((x) => x.id === sheetId) && <TrophySheet trophy={trophies.find((x) => x.id === sheetId)!} phases={phases} guide={guide} onChanged={refresh} onClose={() => setSheetId(null)} />}
      </GameContextProvider>
    </section>
  );
}
