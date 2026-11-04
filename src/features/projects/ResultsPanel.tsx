import { FormEvent, useEffect, useState } from "react";
import { createResult, deleteResult, listResults, LIVE_FIELDS, RESULT_FIELDS, ResultField, ResultSnapshot } from "../../db/results";
import { es } from "../../i18n/es";
import { formatDate, formatNumber, todayIso } from "../../i18n/format";

const t = es.publishing;

interface Props {
  adaptationId: string;
  isLive: boolean;
}

/** Resultados fechados de una publicación, con la evolución de las vistas. */
export function ResultsPanel({ adaptationId, isLive }: Props) {
  const fields: ResultField[] = isLive ? [...LIVE_FIELDS, "views", "likes", "comments"] : [...RESULT_FIELDS];
  const empty = () => Object.fromEntries(fields.map((f) => [f, ""])) as Record<ResultField, string>;

  const [results, setResults] = useState<ResultSnapshot[]>([]);
  const [date, setDate] = useState(todayIso());
  const [values, setValues] = useState(empty);
  const [error, setError] = useState("");

  async function refresh() {
    setResults(await listResults(adaptationId));
  }

  useEffect(() => {
    refresh().catch((err) => setError(String(err)));
  }, [adaptationId]);

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

  return (
    <div className="inline-panel">
      <h3>{t.resultsTitle}</h3>
      <p className="muted small">{t.resultsHint}</p>

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
                  <td>{formatDate(r.recorded_on)}</td>
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
