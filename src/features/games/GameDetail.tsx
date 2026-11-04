import { useEffect, useState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { ProgressRing } from "../../components/charts/ProgressRing";
import {
  deleteGame,
  Game,
  GAME_STATUSES,
  GameStatus,
  listPhases,
  listTrophies,
  Trophy,
  TrophyPhase,
  TrophyType,
  updateGameStatus,
} from "../../db/games";
import { es } from "../../i18n/es";
import { formatDate } from "../../i18n/format";
import { refreshFromPsn } from "./importGame";
import { GuideEntry, listGuide } from "../../db/guide";
import { GuideView } from "./GuideView";
import { RouteView } from "./RouteView";
import { TrophyRow } from "./TrophyRow";

const t = es.games;
const TYPES: TrophyType[] = ["platinum", "gold", "silver", "bronze"];

type Filter = "all" | "pending" | "earned";
type View = "route" | "guide" | "list";

interface Props {
  game: Game;
  psnConnected: boolean;
  onBack: () => void;
  onChanged: () => Promise<void>;
}

/** Ficha de un juego: progreso hacia el platino y lista de trofeos. */
export function GameDetail({ game, psnConnected, onBack, onChanged }: Props) {
  const [trophies, setTrophies] = useState<Trophy[] | null>(null);
  const [phases, setPhases] = useState<TrophyPhase[]>([]);
  const [view, setView] = useState<View>("route");
  const [guide, setGuide] = useState<GuideEntry[]>([]);
  const [filter, setFilter] = useState<Filter>("pending");
  const [syncing, setSyncing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      const [tr, ph, gu] = await Promise.all([listTrophies(game.id), listPhases(game.id), listGuide(game.id)]);
      setTrophies(tr);
      setPhases(ph);
      setGuide(gu);
    } catch (err) {
      setError(String(err));
    }
  }

  useEffect(() => {
    refresh();
  }, [game.id]);

  async function onSync() {
    if (!game.np_communication_id || !game.np_service_name) return;
    setError("");
    setSyncing(true);
    try {
      await refreshFromPsn(game.id, game.np_communication_id, game.np_service_name);
      await refresh();
      await onChanged();
    } catch (err) {
      setError(String(err));
    } finally {
      setSyncing(false);
    }
  }

  async function onStatus(status: GameStatus) {
    await updateGameStatus(game.id, status);
    await onChanged();
  }

  async function onDelete() {
    await deleteGame(game.id);
    await onChanged();
    onBack();
  }

  const list = trophies ?? [];
  const earned = list.filter((x) => x.earned_at !== null).length;
  const ratio = list.length ? earned / list.length : 0;
  const byType = (type: TrophyType) => ({
    earned: list.filter((x) => x.type === type && x.earned_at).length,
    total: list.filter((x) => x.type === type).length,
  });
  const visible = list.filter((x) => (filter === "all" ? true : filter === "earned" ? x.earned_at : !x.earned_at));

  return (
    <section className="page">
      <button className="link back-link" onClick={onBack}>
        {t.back}
      </button>

      <header className="game-hero">
        {game.cover ? <img className="game-cover" src={game.cover} alt="" /> : <span className="game-cover game-cover-empty" />}
        <div className="game-hero-main">
          <h1>{game.title}</h1>
          <span className="muted small">
            {t.platforms[game.platform]}
            {game.last_synced_at && ` · ${t.lastSynced(formatDate(game.last_synced_at.slice(0, 10)))}`}
          </span>
          <div className="trophy-counts">
            {TYPES.map((type) => {
              const c = byType(type);
              return c.total > 0 ? (
                <span key={type} className={`trophy-count trophy-${type}`}>
                  {t.types[type]} {c.earned}/{c.total}
                </span>
              ) : null;
            })}
          </div>
          <div className="profile-actions wrap game-actions">
            <select value={game.status} onChange={(e) => onStatus(e.target.value as GameStatus)}>
              {GAME_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t.statuses[s]}
                </option>
              ))}
            </select>
            {game.np_communication_id && psnConnected && (
              <button className="small-button" onClick={onSync} disabled={syncing}>
                <RefreshCw size={14} className={syncing ? "spin" : ""} />
                {syncing ? t.syncing : t.syncPsn}
              </button>
            )}
            {confirmingDelete ? (
              <>
                <button className="danger small-button" onClick={onDelete}>
                  {t.confirmDelete}
                </button>
                <button className="ghost small-button" onClick={() => setConfirmingDelete(false)}>
                  {t.cancel}
                </button>
              </>
            ) : (
              <button className="ghost small-button icon-button" onClick={() => setConfirmingDelete(true)} title={t.delete}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
        <ProgressRing ratio={ratio} size={104} label={t.platinumProgress(Math.floor(ratio * 100))} />
      </header>

      {error && <p className="error">{error}</p>}

      <div className="tabs">
        {(["route", "guide", "list"] as View[]).map((v) => (
          <button key={v} className={`tab${view === v ? " active" : ""}`} onClick={() => setView(v)}>
            {t.views[v]}
          </button>
        ))}
      </div>

      {trophies === null ? (
        <p className="muted">{t.loading}</p>
      ) : list.length === 0 ? (
        <p className="muted small">{t.noTrophies}</p>
      ) : view === "route" ? (
        <RouteView game={game} trophies={list} phases={phases} guide={guide} onChanged={refresh} />
      ) : view === "guide" ? (
        <GuideView game={game} guide={guide} phases={phases} trophies={list} onChanged={refresh} />
      ) : (
        <>
          <div className="tabs">
            {(["pending", "earned", "all"] as Filter[]).map((f) => (
              <button key={f} className={`tab${filter === f ? " active" : ""}`} onClick={() => setFilter(f)}>
                {t.filters[f]}{" "}
                <span className="tab-count">
                  {f === "all" ? list.length : f === "earned" ? earned : list.length - earned}
                </span>
              </button>
            ))}
          </div>
          <ul className="trophy-list">
            {visible.map((x) => (
              <TrophyRow key={x.id} trophy={x} phases={phases} onChanged={refresh} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
