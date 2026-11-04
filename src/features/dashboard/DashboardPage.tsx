import { PlatformBadge } from "../../components/PlatformBadge";
import { BadgeCheck, CalendarDays, Clock, Eye, FolderKanban, LucideIcon, PartyPopper, UsersRound, Wallet } from "lucide-react";
import { ProgressRing } from "../../components/charts/ProgressRing";
import { ReactNode, useEffect, useState } from "react";
import { Logo } from "../../components/Logo";
import { BarChart } from "../../components/charts/BarChart";
import { LineChart } from "../../components/charts/LineChart";
import { AccountSnapshot, latestSnapshots, listAllSnapshots } from "../../db/accountSnapshots";
import {
  Adaptation,
  listInProduction,
  listRecentlyPublished,
  listScheduledBetween,
  STEPS,
} from "../../db/adaptations";
import { Goal, GoalMetric, listGoals } from "../../db/goals";
import { Income, listIncome } from "../../db/income";
import { listProfiles, markPaid, Profile } from "../../db/profiles";
import { PAYOUT_CURRENCY, payoutStatuses } from "../income/payout";
import { LatestViews, latestViews } from "../../db/results";
import { es } from "../../i18n/es";
import { formatCompact, formatDateTime, formatMonth, formatMoney, formatNumber, formatShortDate, todayIso } from "../../i18n/format";
import { addDays } from "../calendar/week";
import { computeProgress, daysUntil, formatGoalValue } from "../goals/progress";
import { monthlyTotals, totalsByCurrency } from "../income/money";
import { currentStep } from "../projects/status";
import { Section } from "../../sections";

const t = es.dashboard;
const tp = es.projects;

interface Data {
  profiles: Profile[];
  latest: Map<string, AccountSnapshot>;
  history: AccountSnapshot[];
  incomes: Income[];
  goals: Goal[];
  views: LatestViews[];
  upcoming: Adaptation[];
  production: Adaptation[];
  recent: Adaptation[];
}

interface Props {
  onNavigate: (section: Section) => void;
  onOpenProject: (projectId: string) => void;
}

/** Icono de cada métrica de meta. */
const METRIC_ICONS: Record<GoalMetric, LucideIcon> = {
  followers: UsersRound,
  watch_hours: Clock,
  income: Wallet,
  views: Eye,
};

/** Saludo según la hora local. */
function greetingFor(hour: number): string {
  return hour < 6 ? t.night : hour < 13 ? t.morning : hour < 20 ? t.afternoon : t.night;
}

const longDate = new Intl.DateTimeFormat(es.locale, { weekday: "long", day: "numeric", month: "long" });

function formatLongDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return longDate.format(new Date(y, m - 1, d));
}

/** Cifra clave grande, pulsable para ir a su sección. */
function Kpi({ icon: Icon, label, value, onClick }: { icon: LucideIcon; label: string; value: string; onClick: () => void }) {
  return (
    <button className="kpi" onClick={onClick}>
      <span className="kpi-icon">
        <Icon size={20} />
      </span>
      <span className="kpi-value">{value}</span>
      <span className="kpi-label">{label}</span>
    </button>
  );
}

/** Bloque del dashboard; su cabecera lleva a la sección de origen. */
/** Zona del dashboard en la que va cada bloque (ver .dash-grid en App.css). */
type Area = "networks" | "income" | "goals" | "upcoming" | "production" | "recent";

function Block({ title, onOpen, children, area }: { title: string; onOpen: () => void; children: ReactNode; area: Area }) {
  return (
    <section className={`card dash-block dash-area-${area}`}>
      <header className="dash-block-header">
        <h2>{title}</h2>
        <button className="link" onClick={onOpen}>
          {t.seeAll}
        </button>
      </header>
      {children}
    </section>
  );
}

export function DashboardPage({ onNavigate, onOpenProject }: Props) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [confirmingPaid, setConfirmingPaid] = useState<string | null>(null);
  const today = todayIso();

  function load() {
    Promise.all([
      listProfiles(),
      latestSnapshots(),
      listIncome(),
      listGoals(),
      latestViews(),
      listScheduledBetween(today, addDays(today, 7)),
      listInProduction(),
      listRecentlyPublished(5),
      listAllSnapshots(),
    ])
      .then(([profiles, latest, incomes, goals, views, upcoming, production, recent, history]) =>
        setData({ profiles, latest, history, incomes, goals, views, upcoming, production, recent }),
      )
      .catch((err) => setError(String(err)));
  }

  useEffect(load, []);

  async function onMarkPaid(profileId: string) {
    try {
      await markPaid(profileId, today);
      setConfirmingPaid(null);
      load();
    } catch (err) {
      setError(String(err));
    }
  }

  if (error) return <p className="error page">{error}</p>;
  if (!data) return <p className="muted page">{t.loading}</p>;

  const profileOf = (id: string) => data.profiles.find((p) => p.id === id);
  const badge = (id: string) => {
    const p = profileOf(id);
    return p && <PlatformBadge platform={p.platform} size={18} />;
  };

  const monthTotals = [...totalsByCurrency(data.incomes, today.slice(0, 7)).entries()];
  const payouts = payoutStatuses(data.profiles, data.incomes);
  const readyPayouts = payouts.filter((p) => p.ready);
  // Una fila por red con ingresos este mes o con umbral de pago; primero las listas para cobrar.
  const monthIncomes = data.incomes.filter(
    (i) => i.currency === PAYOUT_CURRENCY && i.received_on.startsWith(today.slice(0, 7)),
  );
  const networkIds = new Set<string | null>([
    ...monthIncomes.map((i) => i.profile_id),
    ...payouts.map((p) => p.profile.id),
  ]);
  const networkRows = [...networkIds]
    .map((id) => ({
      key: id ?? "none",
      profile: id ? profileOf(id) : undefined,
      monthMinor: monthIncomes.filter((i) => i.profile_id === id).reduce((sum, i) => sum + i.amount_minor, 0),
      payout: payouts.find((p) => p.profile.id === id),
    }))
    .sort((x, y) => Number(!!y.payout?.ready) - Number(!!x.payout?.ready) || y.monthMinor - x.monthMinor);
  const activeGoals = data.goals.filter((g) => g.status === "active");
  const upcoming = data.upcoming.filter((a) => a.published_at === null);
  const viewsOf = new Map(data.views.map((v) => [v.adaptation_id, v.views]));
  const totalFollowers = [...data.latest.values()].reduce((sum, s) => sum + (s.followers ?? 0), 0);

  // Producción agrupada por paso actual; las que tienen todos sus pasos hechos, "listas para publicar".
  const byStep = new Map<string, Adaptation[]>();
  for (const a of data.production) {
    const key = currentStep(a)?.step ?? "ready";
    byStep.set(key, [...(byStep.get(key) ?? []), a]);
  }
  const stepOrder = [...STEPS, "ready"] as const;

  return (
    <section className="page page-wide">
      <header className="dash-hero">
        <div className="dash-hero-text">
          <span className="dash-hero-date">{formatLongDate(today)}</span>
          <h1>{t.hello(greetingFor(new Date().getHours()))}</h1>
          <p>{t.subtitle}</p>
        </div>
        <div className="dash-hero-logo">
          <Logo size={96} />
        </div>
      </header>

      {readyPayouts.length > 0 && (
        <div className="payout-alert">
          <span className="payout-alert-icon">
            <PartyPopper size={22} />
          </span>
          <div>
            <strong>{t.alertTitle}</strong>
            <p>{t.alertBody(readyPayouts.map((p) => es.platforms[p.profile.platform]).join(", "))}</p>
          </div>
        </div>
      )}

      <div className="kpi-grid">
        <Kpi icon={UsersRound} label={t.kpiFollowers} value={formatNumber(totalFollowers)} onClick={() => onNavigate("profiles")} />
        <Kpi
          icon={Wallet}
          label={t.kpiIncome}
          value={formatMoney(totalsByCurrency(data.incomes, today.slice(0, 7)).get("USD") ?? 0, "USD")}
          onClick={() => onNavigate("income")}
        />
        <Kpi icon={CalendarDays} label={t.kpiUpcoming} value={String(upcoming.length)} onClick={() => onNavigate("calendar")} />
        <Kpi icon={FolderKanban} label={t.kpiProduction} value={String(data.production.length)} onClick={() => onNavigate("projects")} />
      </div>

      <div className="dash-grid">
        <Block title={t.networks} onOpen={() => onNavigate("profiles")} area="networks">
          <div className="dash-networks">
            {data.profiles.map((p) => {
              const s = data.latest.get(p.id);
              const points = data.history
                .filter((h) => h.profile_id === p.id && h.followers !== null)
                .map((h) => ({ date: h.recorded_on, value: h.followers! }));
              return (
                <div key={p.id} className="dash-network">
                  <span className="dash-network-head">
                    {p.avatar && <img className="avatar-sm" src={p.avatar} alt="" />}
                    <PlatformBadge platform={p.platform} withName />
                  </span>
                  <strong className="stat-value">{s?.followers != null ? formatNumber(s.followers) : "—"}</strong>
                  <span className="muted small">
                    {s ? (s.watch_hours != null ? `${formatNumber(s.watch_hours)} h` : es.snapshots.followersUnit) : t.noSnapshot}
                  </span>
                  <span className={`small ${p.is_monetized ? "status-on" : "muted"}`}>
                    {p.is_monetized ? es.profiles.monetized : es.profiles.notMonetized}
                  </span>
                  {points.length >= 2 && (
                    <LineChart
                      points={points}
                      height={44}
                      compact
                      formatValue={formatCompact}
                      formatDate={formatShortDate}
                      label={t.followersChart(es.platforms[p.platform])}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </Block>

        <Block title={t.incomeTitle} onOpen={() => onNavigate("income")} area="income">
          <span className="muted small">{t.incomeMonth}</span>
          {monthTotals.length === 0 ? (
            <strong className="stat-value muted">{es.income.noIncome}</strong>
          ) : (
            monthTotals.map(([currency, minor]) => (
              <strong key={currency} className="stat-value dash-money">
                {formatMoney(minor, currency)}
              </strong>
            ))
          )}

          {networkRows.length > 0 && (
            <div className="dash-income-networks">
              {networkRows.map(({ key, profile, monthMinor, payout }) => (
                <div key={key} className={`payout${payout?.ready ? " payout-ready" : ""}`}>
                  <span className="payout-head">
                    {profile ? (
                      <PlatformBadge platform={profile.platform} size={20} withName />
                    ) : (
                      <span className="small">{es.income.noProfileShort}</span>
                    )}
                    <span className="small">
                      <span className="muted">{t.thisMonthShort} </span>
                      <strong>{formatMoney(monthMinor, PAYOUT_CURRENCY)}</strong>
                    </span>
                  </span>

                  {payout ? (
                    <>
                      <span className="progress">
                        <span
                          className={`progress-bar${payout.ready ? " progress-done" : ""}`}
                          style={{ width: `${Math.min(payout.pending / payout.threshold, 1) * 100}%` }}
                        />
                      </span>
                      <span className="payout-foot">
                        <span className="small">
                          {payout.ready ? (
                            <span className="status-on">{t.readyToCollect} </span>
                          ) : (
                            <span>{t.missing(formatMoney(payout.threshold - payout.pending, PAYOUT_CURRENCY))} · </span>
                          )}
                          <span className="muted">
                            {t.toPayout(formatMoney(payout.pending, PAYOUT_CURRENCY), formatMoney(payout.threshold, PAYOUT_CURRENCY))}
                            {profile?.last_payout_on && ` · ${t.since(formatShortDate(profile.last_payout_on))}`}
                          </span>
                        </span>
                        {payout.pending > 0 &&
                          profile &&
                          (confirmingPaid === profile.id ? (
                            <span className="profile-actions">
                              <span className="small">{t.confirmPaid}</span>
                              <button className="small-button" onClick={() => onMarkPaid(profile.id)}>
                                {t.confirm}
                              </button>
                              <button className="ghost small-button" onClick={() => setConfirmingPaid(null)}>
                                {t.cancel}
                              </button>
                            </span>
                          ) : (
                            <button
                              className={`${payout.ready ? "" : "ghost "}small-button`}
                              onClick={() => setConfirmingPaid(profile.id)}
                            >
                              <BadgeCheck size={14} />
                              {t.markPaid}
                            </button>
                          ))}
                      </span>
                    </>
                  ) : (
                    profile?.is_monetized && <span className="muted small">{t.noThreshold}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {data.incomes.length > 0 && (
            <>
              <p className="chart-title muted">{t.incomeChart}</p>
              <BarChart
                bars={monthlyTotals(data.incomes, "USD", 6, today).map((m) => ({
                  key: m.month,
                  label: formatMonth(m.month),
                  value: m.minor,
                }))}
                height={150}
                formatValue={(minor) => formatMoney(Math.round(minor), "USD")}
                label={t.incomeChart}
              />
            </>
          )}
        </Block>

        <Block title={t.goals} onOpen={() => onNavigate("goals")} area="goals">
          {activeGoals.length === 0 ? (
            <p className="muted small">{t.noGoals}</p>
          ) : (
            <div className="goal-tiles">
              {activeGoals.map((g) => {
                const progress = computeProgress(g, data.latest, data.incomes, data.views);
                const p = g.profile_id ? profileOf(g.profile_id) : undefined;
                const MetricIcon = METRIC_ICONS[g.metric];
                const days = g.deadline ? daysUntil(g.deadline, today) : null;
                const ratio = progress.kind === "value" ? progress.ratio : 0;
                const done = ratio >= 1;
                return (
                  <button key={g.id} className={`goal-tile${done ? " goal-tile-done" : ""}`} onClick={() => onNavigate("goals")}>
                    <ProgressRing ratio={ratio} label={`${es.goals.metrics[g.metric]}: ${Math.floor(ratio * 100)} %`} />
                    <span className="goal-tile-body">
                      <span className="goal-tile-head">
                        <span className="goal-tile-icon">
                          <MetricIcon size={14} />
                        </span>
                        <span className="small muted">{es.goals.metrics[g.metric]}</span>
                        {p ? <PlatformBadge platform={p.platform} size={16} /> : <span className="chip">{t.allNetworks}</span>}
                      </span>
                      <strong className="goal-tile-target">{formatGoalValue(g, g.target_value)}</strong>
                      <span className="small muted">
                        {progress.kind === "value"
                          ? t.goalCurrent(formatGoalValue(g, progress.current))
                          : es.goals.noData}
                      </span>
                      {done ? (
                        <span className="small status-on">{es.goals.achieved}</span>
                      ) : (
                        days !== null && (
                          <span className={`small ${days < 0 ? "error" : "muted"}`}>
                            {days < 0 ? es.goals.overdue(-days) : es.goals.daysLeft(days)}
                          </span>
                        )
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </Block>

        <Block title={t.upcoming} onOpen={() => onNavigate("calendar")} area="upcoming">
          {upcoming.length === 0 ? (
            <p className="muted small">{t.noUpcoming}</p>
          ) : (
            <ul className="dash-list">
              {upcoming.map((a) => (
                <li key={a.id}>
                  <button className="dash-row" onClick={() => onOpenProject(a.project_id)}>
                    <strong className="small">{formatDateTime(a.scheduled_at!)}</strong>
                    {badge(a.profile_id)}
                    <span className="dash-row-title">{a.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Block>

        <Block title={t.production} onOpen={() => onNavigate("projects")} area="production">
          {data.production.length === 0 ? (
            <p className="muted small">{t.noProduction}</p>
          ) : (
            stepOrder
              .filter((s) => byStep.has(s))
              .map((s) => (
                <div key={s} className="dash-step-group">
                  <span className="pill">
                    {s === "ready" ? t.readyToPublish : tp.stepNames[s]} · {byStep.get(s)!.length}
                  </span>
                  <ul className="dash-list">
                    {byStep.get(s)!.map((a) => (
                      <li key={a.id}>
                        <button className="dash-row" onClick={() => onOpenProject(a.project_id)}>
                          {badge(a.profile_id)}
                          <span className="dash-row-title">
                            {tp.formats[a.format]} · {a.title}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
          )}
        </Block>

        <Block title={t.recent} onOpen={() => onNavigate("projects")} area="recent">
          {data.recent.length === 0 ? (
            <p className="muted small">{t.noRecent}</p>
          ) : (
            <ul className="dash-list">
              {data.recent.map((a) => {
                const v = viewsOf.get(a.id);
                return (
                  <li key={a.id}>
                    <button className="dash-row" onClick={() => onOpenProject(a.project_id)}>
                      {a.thumbnail ? <img className="thumb-xs" src={a.thumbnail} alt="" /> : badge(a.profile_id)}
                      <span className="dash-row-title">{a.title}</span>
                      <span className="muted small">{v != null ? t.views(formatNumber(v)) : t.noViews}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Block>
      </div>
    </section>
  );
}
