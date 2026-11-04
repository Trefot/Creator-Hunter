import { useEffect, useState } from "react";
import { createIncome, deleteIncome, Income, IncomeInput, listIncome, updateIncome } from "../../db/income";
import { listProfiles, Profile } from "../../db/profiles";
import { es } from "../../i18n/es";
import { formatDate, formatMoney, todayIso } from "../../i18n/format";
import { IncomeForm } from "./IncomeForm";
import { totalsByCurrency } from "./money";

const t = es.income;

/** Moneda por defecto del espacio de trabajo (workspace.default_currency). */
const DEFAULT_CURRENCY = "USD";

/** Qué muestra el formulario: nada, un ingreso nuevo o la edición de uno existente. */
type Editing = null | "new" | Income;

function TotalCard({ label, totals }: { label: string; totals: Map<string, number> }) {
  const entries = [...totals.entries()].sort(([a], [b]) =>
    a === DEFAULT_CURRENCY ? -1 : b === DEFAULT_CURRENCY ? 1 : a.localeCompare(b),
  );
  return (
    <div className="card stat-card">
      <span className="muted small">{label}</span>
      {entries.length === 0 ? (
        <strong className="stat-value muted">{t.noIncome}</strong>
      ) : (
        entries.map(([currency, minor]) => (
          <strong key={currency} className="stat-value">
            {formatMoney(minor, currency)}
          </strong>
        ))
      )}
    </div>
  );
}

export function IncomePage() {
  const [incomes, setIncomes] = useState<Income[] | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [editing, setEditing] = useState<Editing>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      const [i, p] = await Promise.all([listIncome(), listProfiles()]);
      setIncomes(i);
      setProfiles(p);
    } catch (err) {
      setError(`${t.errors.generic} ${err}`);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onSave(input: IncomeInput) {
    if (editing === "new") await createIncome(input);
    else if (editing) await updateIncome(editing.id, input);
    setEditing(null);
    await refresh();
  }

  async function onDelete(id: string) {
    setError("");
    try {
      await deleteIncome(id);
    } catch (err) {
      setError(`${t.errors.generic} ${err}`);
    }
    setConfirmingId(null);
    await refresh();
  }

  function profileLabel(id: string | null): string {
    const p = profiles.find((x) => x.id === id);
    return p ? es.platforms[p.platform] : "—";
  }

  const today = todayIso();

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>{es.sections.income}</h1>
          <p className="muted">{t.subtitle}</p>
        </div>
        {editing === null && <button onClick={() => setEditing("new")}>{t.add}</button>}
      </header>

      {incomes !== null && (
        <div className="stat-grid">
          <TotalCard label={t.thisMonth} totals={totalsByCurrency(incomes, today.slice(0, 7))} />
          <TotalCard label={t.thisYear} totals={totalsByCurrency(incomes, today.slice(0, 4))} />
        </div>
      )}

      {editing !== null && (
        <IncomeForm
          key={editing === "new" ? "new" : editing.id}
          income={editing === "new" ? undefined : editing}
          profiles={profiles}
          defaultCurrency={DEFAULT_CURRENCY}
          onSave={onSave}
          onCancel={() => setEditing(null)}
        />
      )}

      {error && <p className="error">{error}</p>}

      {incomes === null ? (
        <p className="muted">{t.loading}</p>
      ) : incomes.length === 0 ? (
        <div className="empty-state">
          <p>{t.empty}</p>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>{t.date}</th>
              <th>{t.source}</th>
              <th>{t.profile}</th>
              <th>{t.note}</th>
              <th className="num">{t.amount}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {incomes.map((i) => (
              <tr key={i.id}>
                <td>{formatDate(i.received_on)}</td>
                <td>{t.sources[i.source]}</td>
                <td>{profileLabel(i.profile_id)}</td>
                <td className="muted">{i.note ?? ""}</td>
                <td className="num">{formatMoney(i.amount_minor, i.currency)}</td>
                <td className="row-actions">
                  {confirmingId === i.id ? (
                    <>
                      <button className="danger small-button" onClick={() => onDelete(i.id)}>
                        {t.confirmRemove}
                      </button>
                      <button className="ghost small-button" onClick={() => setConfirmingId(null)}>
                        {t.cancel}
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="ghost small-button" onClick={() => setEditing(i)}>
                        {t.edit}
                      </button>
                      <button className="ghost small-button" onClick={() => setConfirmingId(i.id)}>
                        {t.remove}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
