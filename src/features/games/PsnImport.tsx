import { useEffect, useState } from "react";
import { Check, Plus, RefreshCw } from "lucide-react";
import { Game } from "../../db/games";
import { PsnTitle, psnTitles } from "../../db/psn";
import { es } from "../../i18n/es";
import { importFromPsn } from "./importGame";

const t = es.games;

interface Props {
  library: Game[];
  onImported: (gameId: string) => Promise<void>;
  onClose: () => void;
}

/** Lista de juegos de la cuenta de PSN para añadirlos a la biblioteca. */
export function PsnImport({ library, onImported, onClose }: Props) {
  const [titles, setTitles] = useState<PsnTitle[] | null>(null);
  const [filter, setFilter] = useState("");
  const [importing, setImporting] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    psnTitles()
      .then(setTitles)
      .catch((err) => setError(String(err)));
  }, []);

  async function onAdd(title: PsnTitle) {
    setError("");
    setImporting(title.np_communication_id);
    try {
      const gameId = await importFromPsn(title);
      await onImported(gameId);
    } catch (err) {
      setError(String(err));
    } finally {
      setImporting(null);
    }
  }

  const inLibrary = new Set(library.map((g) => g.np_communication_id));
  const visible = (titles ?? []).filter((x) => x.name.toLowerCase().includes(filter.trim().toLowerCase()));

  return (
    <div className="card psn-import">
      <div className="results-head">
        <h2>{t.importTitle}</h2>
        <button className="ghost small-button" onClick={onClose}>
          {t.close}
        </button>
      </div>
      <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t.searchPlaceholder} />
      {error && <p className="error small">{error}</p>}
      {titles === null && !error ? (
        <p className="muted small">{t.loadingPsn}</p>
      ) : (
        <ul className="psn-title-list">
          {visible.map((x) => (
            <li key={x.np_communication_id} className="psn-title">
              {x.icon_url ? <img src={x.icon_url} alt="" /> : <span className="psn-title-noimg" />}
              <span className="psn-title-main">
                <strong>{x.name}</strong>
                <span className="muted small">
                  {x.platform} · {t.trophyProgress(x.earned, x.defined)} · {x.progress} %
                </span>
              </span>
              {inLibrary.has(x.np_communication_id) ? (
                <span className="status-on small">
                  <Check size={14} /> {t.inLibrary}
                </span>
              ) : (
                <button className="small-button" disabled={importing !== null} onClick={() => onAdd(x)}>
                  {importing === x.np_communication_id ? <RefreshCw size={14} className="spin" /> : <Plus size={14} />}
                  {importing === x.np_communication_id ? t.importing : t.add}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
