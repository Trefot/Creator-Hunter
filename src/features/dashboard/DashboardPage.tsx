import { ReactNode, useEffect, useState } from "react";
import { AccountSnapshot, latestSnapshots } from "../../db/accountSnapshots";
import {
  Adaptation,
  listInProduction,
  listRecentlyPublished,
  listScheduledBetween,
  STEPS,
} from "../../db/adaptations";
import { Goal, listGoals } from "../../db/goals";
import { Income, listIncome } from "../../db/income";
import { listProfiles, Profile } from "../../db/profiles";
import { LatestViews, latestViews } from "../../db/results";
import { es } from "../../i18n/es";
import { formatDateTime, formatMoney, formatNumber, todayIso } from "../../i18n/format";
import { addDays } from "../calendar/week";
import { computeProgress, formatGoalValue } from "../goals/progress";
import { totalsByCurrency } from "../income/money";
import { currentStep } from "../projects/status";
import { Section } from "../../sections";

const t = es.dashboard;
const tp = es.projects;

interface Data {
  profiles: Profile[];
  latest: Map<string, AccountSnapshot>;
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

/** Bloque del dashboard; su cabecera lleva a la sección de origen. */
function Block({ title, onOpen, children, wide }: { title: string; onOpen: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <section className={`card dash-block${wide ? " dash-wide" : ""}`}>
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
  const today = todayIso();

  useEffect(() => {
    Promise.all([
      listProfiles(),
      latestSnapshots(),
      listIncome(),
      listGoals(),
      latestViews(),
      listScheduledBetween(today, addDays(today, 7)),
      listInProduction(),
      listRecentlyPublished(5),
    ])
      .then(([profiles, latest, incomes, goals, views, upcoming, production, recent]) =>
        setData({ profiles, latest, incomes, goals, views, upcoming, production, recent }),
      )
      .catch((err) => setError(String(err)));
  }, []);

  if (error) return <p className="error page">{error}</p>;
  if (!data) return <p className="muted page">{t.loading}</p>;

  const profileOf = (id: string) => data.profiles.find((p) => p.id === id);
  const badge = (id: string) => {
    const p = profileOf(id);
    return p && <span className={`platform-badge platform-${p.platform}`}>{es.platforms[p.platform]}</span>;
  };

  const monthTotals = [...totalsByCurrency(data.incomes, today.slice(0, 7)).entries()];
  const activeGoals = data.goals.filter((g) => g.status === "active");
  const upcoming = data.upcoming.filter((a) => a.published_at === null);
  const viewsOf = new Map(data.views.map((v) => [v.adaptation_id, v.views]));

  // Producción agrupada por paso actual; las que tienen todos sus pasos hechos, "listas para publicar".
  const byStep = new Map<string, Adaptation[]>();
  for (const a of data.production) {
    const key = currentStep(a)?.step ?? "ready";
    byStep.set(key, [...(byStep.get(key) ?? []), a]);
  }
  const stepOrder = [...STEPS, "ready"] as const;

  return (
    <section className="page page-wide">
      <header className="page-header">
        <div>
          <h1>{t.greeting}</h1>
          <p className="muted">{t.subtitle}</p>
        </div>
      </header>

      <div className="dash-grid">
        <Block title={t.networks} onOpen={() => onNavigate("profiles")} wide>
          <div className="dash-networks">
            {data.profiles.map((p) => {
              const s = data.latest.get(p.id);
              return (
                <div key={p.id} className="dash-network">
                  <span className={`platform-badge platform-${p.platform}`}>{es.platforms[p.platform]}</span>
                  <strong className="stat-value">{s?.followers != null ? formatNumber(s.followers) : "—"}</strong>
                  <span className="muted small">
                    {s ? (s.watch_hours != null ? `${formatNumber(s.watch_hours)} h` : es.snapshots.followersUnit) : t.noSnapshot}
                  </span>
                  <span className={`small ${p.is_monetized ? "status-on" : "muted"}`}>
                    {p.is_monetized ? es.profiles.monetized : es.profiles.notMonetized}
                  </span>
                </div>
              );
            })}
          </div>
        </Block>

        <Block title={t.incomeMonth} onOpen={() => onNavigate("income")}>
          {monthTotals.length === 0 ? (
            <strong className="stat-value muted">{es.income.noIncome}</strong>
          ) : (
            monthTotals.map(([currency, minor]) => (
              <strong key={currency} className="stat-value dash-money">
                {formatMoney(minor, currency)}
              </strong>
            ))
          )}
        </Block>

        <Block title={t.goals} onOpen={() => onNavigate("goals")}>
          {activeGoals.length === 0 ? (
            <p className="muted small">{t.noGoals}</p>
          ) : (
            activeGoals.map((g) => {
              const progress = computeProgress(g, data.latest, data.incomes, data.views);
              const p = g.profile_id ? profileOf(g.profile_id) : undefined;
              return (
                <div key={g.id} className="dash-goal">
                  <span className="small">
                    {formatGoalValue(g, g.target_value)} · {es.goals.metrics[g.metric]}
                    {p && ` · ${es.platforms[p.platform]}`}
                  </span>
                  {progress.kind === "value" ? (
                    <div className="progress">
                      <div
                        className={`progress-bar${progress.ratio >= 1 ? " progress-done" : ""}`}
                        style={{ width: `${progress.ratio * 100}%` }}
                      />
                    </div>
                  ) : (
                    <span className="muted small">{es.goals.noData}</span>
                  )}
                </div>
              );
            })
          )}
        </Block>

        <Block title={t.upcoming} onOpen={() => onNavigate("calendar")}>
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

        <Block title={t.production} onOpen={() => onNavigate("projects")}>
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

        <Block title={t.recent} onOpen={() => onNavigate("projects")}>
          {data.recent.length === 0 ? (
            <p className="muted small">{t.noRecent}</p>
          ) : (
            <ul className="dash-list">
              {data.recent.map((a) => {
                const v = viewsOf.get(a.id);
                return (
                  <li key={a.id}>
                    <button className="dash-row" onClick={() => onOpenProject(a.project_id)}>
                      {badge(a.profile_id)}
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
