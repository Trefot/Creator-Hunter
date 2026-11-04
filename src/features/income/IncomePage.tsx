import { PageTitle } from "../../components/PageTitle";
import { EmptyState } from "../../components/EmptyState";
import { CircleDollarSign, PartyPopper, Plus, X } from "lucide-react";
import { PAYOUT_CURRENCY, payoutStatuses } from "./payout";
import { PlatformLogo } from "../../components/PlatformBadge";
import { useEffect, useState } from "react";
import { createIncome, deleteIncome, Income, IncomeInput, listIncome, updateIncome } from "../../db/income";
import { listProfiles, Profile } from "../../db/profiles";
import { es } from "../../i18n/es";
import { BarChart } from "../../components/charts/BarChart";
import { formatDate, formatMonth, formatMoney, todayIso } from "../../i18n/format";
import { IncomeForm } from "./IncomeForm";
import { monthlyTotals, totalsByCurrency } from "./money";

const t = es.income;

/** Moneda por defecto del espacio de trabajo (workspace.default_currency). */
const DEFAULT_CURRENCY = "USD";

/** Filtro por red: un perfil, "sin red concreta" o todas (null). */
type NetworkFilter = string | "none" | null;

/** Primero la moneda por defecto; el resto por orden alfabético. */
function sortedTotals(totals: Map<string, number>): [string, number][] {
  return [...totals.entries()].sort(([a], [b]) =>
    a === DEFAULT_CURRENCY ? -1 : b === DEFAULT_CURRENCY ? 1 : a.localeCompare(b),
  );
}

function moneyLines(totals: Map<string, number>): string {
  const entries = sortedTotals(totals);
  return entries.length ? entries.map(([c, m]) => formatMoney(m, c)).join(" · ") : formatMoney(0, DEFAULT_CURRENCY);
}

interface NetworkCardProps {
  profile: Profile | null;
  incomes: Income[];
  yearTotalUsd: number;
  today: string;
  selected: boolean;
  onSelect: () => void;
}

/** Ingresos de una red: este mes, este año, desde siempre y su parte del total del año. */
function NetworkCard({ profile, incomes, yearTotalUsd, today, selected, onSelect }: NetworkCardProps) {
  const month = totalsByCurrency(incomes, today.slice(0, 7));
  const year = totalsByCurrency(incomes, today.slice(0, 4));
  const all = totalsByCurrency(incomes, "");
  const share = yearTotalUsd > 0 ? (year.get(DEFAULT_CURRENCY) ?? 0) / yearTotalUsd : 0;
  return (
    <button className={`card network-income${selected ? " selected" : ""}`} onClick={onSelect}>
      <span className="network-income-head">
        {profile ? (
          profile.avatar ? (
            <img className="avatar-sm" src={profile.avatar} alt="" />
          ) : (
            <PlatformLogo platform={profile.platform} size={28} />
          )
        ) : (
          <span className="kpi-icon">
            <CircleDollarSign size={18} />
          </span>
        )}
        <span className="network-income-name">
          <strong>{profile ? es.platforms[profile.platform] : t.noProfileShort}</strong>
          {profile && <span className="muted small">{profile.display_name ?? profile.handle}</span>}
        </span>
        {profile?.avatar && <PlatformLogo platform={profile.platform} size={20} />}
      </span>
      <span className="muted small">{t.thisMonth}</span>
      <strong className="network-income-month">{moneyLines(month)}</strong>
      <span className="network-income-row">
        <span className="muted small">{t.thisYear}</span>
        <span className="small">{moneyLines(year)}</span>
      </span>
      <span className="network-income-row">
        <span className="muted small">{t.allTime}</span>
        <span className="small">{moneyLines(all)}</span>
      </span>
      <span className="share">
        <span className="progress">
          <span className="progress-bar" style={{ width: `${share * 100}%` }} />
        </span>
        <span className="muted small">{t.shareOfYear(Math.round(share * 100))}</span>
      </span>
    </button>
  );
}

/** Qué muestra el formulario: nada, un ingreso nuevo o la edición de uno existente. */
type Editing = null | "new" | Income;

function TotalCard({ label, totals }: { label: string; totals: Map<string, number> }) {
  const entries = sortedTotals(totals);
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
  const [network, setNetwork] = useState<NetworkFilter>(null);
  /** Avisos de umbral superado tras guardar un ingreso. */
  const [alerts, setAlerts] = useState<string[]>([]);
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
    const before = payoutStatuses(profiles, incomes ?? []);
    if (editing === "new") await createIncome(input);
    else if (editing) await updateIncome(editing.id, input);
    setEditing(null);
    const [after, p] = await Promise.all([listIncome(), listProfiles()]);
    setIncomes(after);
    setProfiles(p);
    // Avisar solo de las redes que acaban de cruzar su umbral con este ingreso.
    const crossed = payoutStatuses(p, after).filter(
      (s) => s.ready && !before.find((b) => b.profile.id === s.profile.id)?.ready,
    );
    if (crossed.length) {
      setAlerts(
        crossed.map((s) =>
          es.profiles.thresholdCrossed(
            es.platforms[s.profile.platform],
            formatMoney(s.pending, PAYOUT_CURRENCY),
            formatMoney(s.threshold, PAYOUT_CURRENCY),
          ),
        ),
      );
    }
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

  const matches = (i: Income, f: NetworkFilter) =>
    f === null ? true : f === "none" ? i.profile_id === null : i.profile_id === f;
  const shown = incomes?.filter((i) => matches(i, network)) ?? [];
  const yearTotalUsd = totalsByCurrency(incomes ?? [], today.slice(0, 4)).get(DEFAULT_CURRENCY) ?? 0;
  const hasUnassigned = incomes?.some((i) => i.profile_id === null) ?? false;
  const selectedProfile = profiles.find((p) => p.id === network);
  const filterName =
    network === null ? null : network === "none" ? t.noProfileShort : selectedProfile ? es.platforms[selectedProfile.platform] : null;

  return (
    <section className="page">
      <header className="page-header">
        <PageTitle section="income" subtitle={t.subtitle} />
        {editing === null && <button onClick={() => setEditing("new")}><Plus size={16} />{t.add}</button>}
      </header>

      {alerts.length > 0 && (
        <div className="payout-alert">
          <span className="payout-alert-icon">
            <PartyPopper size={22} />
          </span>
          <div className="payout-alert-text">
            {alerts.map((a) => (
              <strong key={a}>{a}</strong>
            ))}
            <p>{t.payoutHint}</p>
          </div>
          <button className="ghost icon-button" onClick={() => setAlerts([])} title={t.cancel}>
            <X size={16} />
          </button>
        </div>
      )}

      {incomes !== null && (
        <>
          <h2 className="section-heading">{t.totalHeading}</h2>
          <div className="stat-grid">
            <TotalCard label={t.thisMonth} totals={totalsByCurrency(incomes, today.slice(0, 7))} />
            <TotalCard label={t.thisYear} totals={totalsByCurrency(incomes, today.slice(0, 4))} />
            <TotalCard label={t.allTime} totals={totalsByCurrency(incomes, "")} />
          </div>
        </>
      )}

      {incomes !== null && incomes.length > 0 && profiles.length > 0 && (
        <>
          <div className="section-heading-row">
            <h2 className="section-heading">{t.byNetworkHeading}</h2>
            {network !== null && (
              <button className="chip chip-active" onClick={() => setNetwork(null)}>
                {t.showAll} ×
              </button>
            )}
          </div>
          <p className="muted small">{t.byNetworkHint}</p>
          <div className="network-income-grid">
            {profiles.map((p) => (
              <NetworkCard
                key={p.id}
                profile={p}
                incomes={incomes.filter((i) => i.profile_id === p.id)}
                yearTotalUsd={yearTotalUsd}
                today={today}
                selected={network === p.id}
                onSelect={() => setNetwork(network === p.id ? null : p.id)}
              />
            ))}
            {hasUnassigned && (
              <NetworkCard
                profile={null}
                incomes={incomes.filter((i) => i.profile_id === null)}
                yearTotalUsd={yearTotalUsd}
                today={today}
                selected={network === "none"}
                onSelect={() => setNetwork(network === "none" ? null : "none")}
              />
            )}
          </div>
        </>
      )}

      {incomes !== null && incomes.length > 0 && (
        <div className="card chart-card">
          <p className="chart-title">{filterName ? t.chartTitleFor(filterName) : t.chartTitle}</p>
          <BarChart
            bars={monthlyTotals(shown, DEFAULT_CURRENCY, 12, today).map((m) => ({
              key: m.month,
              label: formatMonth(m.month),
              value: m.minor,
            }))}
            formatValue={(minor) => formatMoney(Math.round(minor), DEFAULT_CURRENCY)}
            label={t.chartTitle}
          />
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
        <EmptyState section="income" text={t.empty} />
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
            {shown.map((i) => (
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
