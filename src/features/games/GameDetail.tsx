import { useEffect, useState } from "react";
import { EyeOff, RefreshCw, Trash2 } from "lucide-react";
import { ProgressRing } from "../../components/charts/ProgressRing";
import { deleteGame, Game, GAME_STATUSES, GameStatus, listTrophies, Trophy, TrophyType, updateGameStatus } from "../../db/games";
import { es } from "../../i18n/es";
import { formatDate } from "../../i18n/format";
import { refreshFromPsn } from "./importGame";

const t = es.games;
const TYPES: TrophyType[] = ["platinum", "gold", "silver", "bronze"];

type Filter = "all" | "pending" | "earned";

interface Props {
  game: Game;
  psnConnected: boolean;
  onBack: () => void;
  onChanged: () => Promise<void>;
}

/** Ficha de un juego: progreso hacia el platino y lista de trofeos. */
export function GameDetail({ game, psnConnected, onBack, onChanged }: Props) {
  const [trophies, setTrophies] = useState<Trophy[] | null>(null);
  const [filter, setFilter] = useState<Filter>("pending");
  const [syncing, setSyncing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      setTrophies(await listTrophies(game.id));
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
        {(["pending", "earned", "all"] as Filter[]).map((f) => (
          <button key={f} className={`tab${filter === f ? " active" : ""}`} onClick={() => setFilter(f)}>
            {t.filters[f]}{" "}
            <span className="tab-count">
              {f === "all" ? list.length : f === "earned" ? earned : list.length - earned}
            </span>
          </button>
        ))}
      </div>

      {trophies === null ? (
        <p className="muted">{t.loading}</p>
      ) : list.length === 0 ? (
        <p className="muted small">{t.noTrophies}</p>
      ) : (
        <ul className="trophy-list">
          {visible.map((x) => (
            <li key={x.id} className={`card trophy-row${x.earned_at ? " trophy-earned" : ""}`}>
              {x.icon_url ? <img className="trophy-icon" src={x.icon_url} alt="" loading="lazy" /> : <span className="trophy-icon" />}
              <span className="trophy-main">
                <strong>
                  {x.name} {x.hidden && <EyeOff size={13} className="muted" aria-label={t.hidden} />}
                </strong>
                {x.detail && <span className="muted small">{x.detail}</span>}
              </span>
              <span className="trophy-side">
                <span className={`trophy-badge trophy-${x.type}`}>{t.types[x.type]}</span>
                {x.earned_rate !== null && <span className="muted small">{t.rarity(x.earned_rate)}</span>}
                {x.earned_at && <span className="status-on small">{t.earnedOn(formatDate(x.earned_at.slice(0, 10)))}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
