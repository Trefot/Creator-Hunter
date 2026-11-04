import { RefreshCw } from "lucide-react";
import { youtubeStatus } from "../../db/youtube";
import { syncPublishedVideos } from "../profiles/youtubeSync";
import { extractVideoId } from "../profiles/youtubeVideo";
import { FormEvent, useEffect, useState } from "react";
import { createResult, deleteResult, listResults, LIVE_FIELDS, RESULT_FIELDS, ResultField, ResultSnapshot } from "../../db/results";
import { es } from "../../i18n/es";
import { LineChart } from "../../components/charts/LineChart";
import { formatCompact, formatDate, formatNumber, formatShortDate, todayIso } from "../../i18n/format";

const t = es.publishing;

interface Props {
  adaptationId: string;
  isLive: boolean;
  /** Enlace publicado: si es de YouTube, los resultados se traen solos. */
  publishedUrl: string | null;
}

/** Resultados fechados de una publicación, con la evolución de las vistas. */
export function ResultsPanel({ adaptationId, isLive, publishedUrl }: Props) {
  const fromYouTube = extractVideoId(publishedUrl) !== null;
  const [fetching, setFetching] = useState(false);
  const [ytMessage, setYtMessage] = useState("");
  const fields: ResultField[] = isLive ? [...LIVE_FIELDS, "views", "likes", "comments"] : [...RESULT_FIELDS];
  const empty = () => Object.fromEntries(fields.map((f) => [f, ""])) as Record<ResultField, string>;

  const [results, setResults] = useState<ResultSnapshot[]>([]);
  const [date, setDate] = useState(todayIso());
  const [values, setValues] = useState(empty);
  const [error, setError] = useState("");

  async function refresh() {
    setResults(await listResults(adaptationId));
  }

  /** Trae de YouTube el resultado de hoy de esta publicación. */
  async function fetchFromYouTube() {
    setFetching(true);
    setYtMessage("");
    try {
      const status = await youtubeStatus();
      if (!status.connected) {
        setYtMessage(es.youtube.notConnectedForResults);
        return;
      }
      const result = await syncPublishedVideos(adaptationId);
      setYtMessage(result.synced === 0 ? es.youtube.videoNotFound : result.warning ? es.youtube.partialResults : "");
      await refresh();
    } catch (err) {
      setYtMessage(`${es.youtube.syncFailed} ${err}`);
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => {
    refresh()
      .then(() => (fromYouTube ? fetchFromYouTube() : undefined))
      .catch((err) => setError(String(err)));
  }, [adaptationId, publishedUrl]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!date) return setError(t.errors.date);

    const parsed = {} as Record<ResultField, number | null>;
    for (const f of [...RESULT_FIELDS, ...LIVE_FIELDS]) {
      const raw = (values[f] ?? "").trim().replace(",", ".");
      const n = raw === "" ? null : Number(raw);
      const integer = f !== "watch_hours";
      if (n !== null && (!Number.isFinite(n) || n < 0 || (integer && !Number.isInteger(n)))) {
        return setError(t.errors.invalid);
      }
      parsed[f] = n;
    }
    if (Object.values(parsed).every((v) => v === null)) return setError(t.errors.nothing);

    setError("");
    try {
      await createResult(adaptationId, { recorded_on: date, ...parsed });
      setValues(empty());
      await refresh();
    } catch (err) {
      setError(`${t.errors.generic} ${err}`);
    }
  }

  async function onDelete(id: string) {
    await deleteResult(id);
    await refresh();
  }

  const viewPoints = results.filter((r) => r.views !== null).map((r) => ({ date: r.recorded_on, value: r.views! }));

  return (
    <div className="inline-panel">
      <div className="results-head">
        <h3>{t.resultsTitle}</h3>
        {fromYouTube && (
          <button className="small-button" onClick={fetchFromYouTube} disabled={fetching}>
            <RefreshCw size={14} className={fetching ? "spin" : ""} />
            {fetching ? es.youtube.fetching : es.youtube.fetchFromYouTube}
          </button>
        )}
      </div>
      <p className="muted small">{fromYouTube ? es.youtube.resultsAutoHint : t.resultsHint}</p>
      {ytMessage && <p className="small yt-warning">{ytMessage}</p>}

      <form className="results-form" onSubmit={onSubmit}>
        <label>
          {t.date}
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        {fields.map((f) => (
          <label key={f}>
            {t.fields[f]}
            <input
              inputMode={f === "watch_hours" ? "decimal" : "numeric"}
              value={values[f]}
              onChange={(e) => setValues((prev) => ({ ...prev, [f]: e.target.value }))}
            />
          </label>
        ))}
        <button type="submit">{t.add}</button>
      </form>

      {error && <p className="error">{error}</p>}

      {viewPoints.length >= 2 && (
        <>
          <p className="chart-title">{t.chartTitle}</p>
          <LineChart
            points={viewPoints}
            height={170}
            formatValue={formatCompact}
            formatDate={formatShortDate}
            label={t.chartTitle}
          />
        </>
      )}

      {results.length === 0 ? (
        <p className="muted small">{t.empty}</p>
      ) : (
        <table className="snapshot-table">
          <thead>
            <tr>
              <th>{t.date}</th>
              {fields.map((f) => (
                <th key={f}>{t.fields[f]}</th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => {
              // Del más reciente al más antiguo: el anterior con vistas está más abajo en la lista.
              const prev = results.slice(i + 1).find((p) => p.views !== null);
              const diff = r.views !== null && prev ? r.views - prev.views! : null;
              return (
                <tr key={r.id}>
                  <td>
                    {formatDate(r.recorded_on)}
                    {r.source === "api" && <span className="source-chip">{es.youtube.sourceApi}</span>}
                  </td>
                  {fields.map((f) => (
                    <td key={f}>
                      {r[f] !== null ? formatNumber(r[f]!) : "—"}
                      {f === "views" && diff !== null && diff !== 0 && (
                        <span className={diff > 0 ? "delta-up" : "delta-down"}>
                          {" "}
                          {diff > 0 ? "+" : ""}
                          {formatNumber(diff)}
                        </span>
                      )}
                    </td>
                  ))}
                  <td>
                    <button className="ghost small-button" onClick={() => onDelete(r.id)}>
                      {t.remove}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
