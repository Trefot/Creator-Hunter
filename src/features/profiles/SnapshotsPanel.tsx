import { FormEvent, useEffect, useState } from "react";
import { AccountSnapshot, createSnapshot, deleteSnapshot, listSnapshots } from "../../db/accountSnapshots";
import { es } from "../../i18n/es";
import { formatDate, formatNumber, todayIso } from "../../i18n/format";

const t = es.snapshots;

interface Props {
  profileId: string;
  /** Avisa a la página para refrescar el último valor de la tarjeta. */
  onChange: () => void;
}

/** Convierte el texto de un campo en número; vacío = null, inválido = NaN. */
function parseField(value: string): number | null {
  const trimmed = value.trim().replace(",", ".");
  return trimmed === "" ? null : Number(trimmed);
}

export function SnapshotsPanel({ profileId, onChange }: Props) {
  const [snapshots, setSnapshots] = useState<AccountSnapshot[]>([]);
  const [date, setDate] = useState(todayIso());
  const [followers, setFollowers] = useState("");
  const [hours, setHours] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    setSnapshots(await listSnapshots(profileId));
  }

  useEffect(() => {
    refresh().catch((err) => setError(String(err)));
  }, [profileId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const f = parseField(followers);
    const h = parseField(hours);
    if (!date) return setError(t.errors.date);
    if (f === null && h === null) return setError(t.errors.nothing);
    const invalid = (v: number | null) => v !== null && (!Number.isFinite(v) || v < 0);
    if (invalid(f) || invalid(h) || (f !== null && !Number.isInteger(f))) return setError(t.errors.invalid);

    setError("");
    try {
      await createSnapshot(profileId, { recorded_on: date, followers: f, watch_hours: h });
      setFollowers("");
      setHours("");
      await refresh();
      onChange();
    } catch (err) {
      setError(String(err));
    }
  }

  async function onDelete(id: string) {
    await deleteSnapshot(id);
    await refresh();
    onChange();
  }

  return (
    <div className="snapshots">
      <h3>{t.title}</h3>
      <p className="muted small">{t.hint}</p>

      <form className="snapshot-form" onSubmit={onSubmit}>
        <label>
          {t.date}
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          {t.followers}
          <input inputMode="numeric" value={followers} onChange={(e) => setFollowers(e.target.value)} />
        </label>
        <label>
          {t.watchHours}
          <input
            inputMode="decimal"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder={t.optional}
          />
        </label>
        <button type="submit">{t.add}</button>
      </form>

      {error && <p className="error">{error}</p>}

      {snapshots.length === 0 ? (
        <p className="muted small">{t.empty}</p>
      ) : (
        <table className="snapshot-table">
          <thead>
            <tr>
              <th>{t.date}</th>
              <th>{t.followers}</th>
              <th>{t.watchHours}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {snapshots.map((s, i) => {
              // El historial va del más reciente al más antiguo: el anterior es el siguiente de la lista.
              const prev = snapshots.slice(i + 1).find((p) => p.followers !== null);
              const diff = s.followers !== null && prev ? s.followers - prev.followers! : null;
              return (
                <tr key={s.id}>
                  <td>{formatDate(s.recorded_on)}</td>
                  <td>
                    {s.followers !== null ? formatNumber(s.followers) : "—"}
                    {diff !== null && diff !== 0 && (
                      <span className={diff > 0 ? "delta-up" : "delta-down"}>
                        {" "}
                        {diff > 0 ? "+" : ""}
                        {formatNumber(diff)}
                      </span>
                    )}
                  </td>
                  <td>{s.watch_hours !== null ? `${formatNumber(s.watch_hours)} ${t.hoursUnit}` : "—"}</td>
                  <td>
                    <button className="ghost small-button" onClick={() => onDelete(s.id)}>
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
