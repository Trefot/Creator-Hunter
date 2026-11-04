import { useEffect, useState } from "react";
import { Gamepad2 } from "lucide-react";
import { EmptyState } from "../../components/EmptyState";
import { PageTitle } from "../../components/PageTitle";
import { Game, listGames } from "../../db/games";
import { psnStatus } from "../../db/psn";
import { es } from "../../i18n/es";
import { GameDetail } from "./GameDetail";
import { PsnConnect } from "./PsnConnect";
import { PsnImport } from "./PsnImport";

const t = es.games;

/** Biblioteca de juegos; al abrir uno se muestra su ficha con los trofeos. */
export function GamesPage() {
  const [games, setGames] = useState<Game[] | null>(null);
  const [connected, setConnected] = useState(false);
  const [importing, setImporting] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      const [g, c] = await Promise.all([listGames(), psnStatus()]);
      setGames(g);
      setConnected(c);
    } catch (err) {
      setError(String(err));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const open = games?.find((g) => g.id === openId);
  if (open) {
    return (
      <GameDetail key={open.id} game={open} psnConnected={connected} onBack={() => setOpenId(null)} onChanged={refresh} />
    );
  }

  return (
    <section className="page">
      <header className="page-header">
        <PageTitle section="games" subtitle={t.subtitle} />
      </header>

      <PsnConnect connected={connected} onChange={refresh} onImport={() => setImporting(true)} />

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

      {games === null ? (
        <p className="muted">{t.loading}</p>
      ) : games.length === 0 ? (
        <EmptyState section="games" text={t.empty} />
      ) : (
        <ul className="gallery">
          {games.map((g) => {
            const ratio = g.trophy_count ? g.earned_count / g.trophy_count : 0;
            return (
              <li key={g.id}>
                <button className="card gallery-card gallery-button" onClick={() => setOpenId(g.id)}>
                  <div className="gallery-cover game-gallery-cover">
                    {g.cover ? <img src={g.cover} alt="" /> : <Gamepad2 size={30} />}
                    <span className={`gallery-status game-status-${g.status}`}>{t.statuses[g.status]}</span>
                  </div>
                  <div className="gallery-body">
                    <strong className="gallery-title">{g.title}</strong>
                    <span className="muted small">
                      {t.platforms[g.platform]} · {t.trophyProgress(g.earned_count, g.trophy_count)}
                    </span>
                    <span className="progress">
                      <span
                        className={`progress-bar${ratio >= 1 ? " progress-done" : ""}`}
                        style={{ width: `${ratio * 100}%` }}
                      />
                    </span>
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
