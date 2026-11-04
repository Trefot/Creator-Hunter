import { PageTitle } from "../../components/PageTitle";
import { EmptyState } from "../../components/EmptyState";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { AccountSnapshot, latestSnapshots } from "../../db/accountSnapshots";
import { createGoal, deleteGoal, Goal, GoalInput, listGoals, setGoalStatus, updateGoal } from "../../db/goals";
import { Income, listIncome } from "../../db/income";
import { listProfiles, Profile } from "../../db/profiles";
import { LatestViews, latestViews } from "../../db/results";
import { es } from "../../i18n/es";
import { formatDate, todayIso } from "../../i18n/format";
import { GoalForm } from "./GoalForm";
import { computeProgress, daysUntil, formatGoalValue, goalStartDate } from "./progress";

const t = es.goals;

/** Qué muestra el formulario: nada, una meta nueva o la edición de una existente. */
type Editing = null | "new" | Goal;

export function GoalsPage() {
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [latest, setLatest] = useState<Map<string, AccountSnapshot>>(new Map());
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [views, setViews] = useState<LatestViews[]>([]);
  const [editing, setEditing] = useState<Editing>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      const [g, p, l, i, v] = await Promise.all([
        listGoals(),
        listProfiles(),
        latestSnapshots(),
        listIncome(),
        latestViews(),
      ]);
      setGoals(g);
      setProfiles(p);
      setLatest(l);
      setIncomes(i);
      setViews(v);
    } catch (err) {
      setError(`${t.errors.generic} ${err}`);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onSave(input: GoalInput) {
    if (editing === "new") await createGoal(input);
    else if (editing) await updateGoal(editing.id, input);
    setEditing(null);
    await refresh();
  }

  /** Ejecuta una acción sobre una meta y refresca la lista. */
  async function run(action: () => Promise<void>) {
    setError("");
    try {
      await action();
    } catch (err) {
      setError(`${t.errors.generic} ${err}`);
    }
    setConfirmingId(null);
    await refresh();
  }

  function profileLabel(goal: Goal): string {
    const p = profiles.find((x) => x.id === goal.profile_id);
    return p ? `${es.platforms[p.platform]} · ${p.display_name ?? p.handle}` : t.allProfiles;
  }

  const today = todayIso();

  return (
    <section className="page">
      <header className="page-header">
        <PageTitle section="goals" subtitle={t.subtitle} />
        {editing === null && <button onClick={() => setEditing("new")}><Plus size={16} />{t.add}</button>}
      </header>

      {editing !== null && (
        <GoalForm
          key={editing === "new" ? "new" : editing.id}
          goal={editing === "new" ? undefined : editing}
          profiles={profiles}
          onSave={onSave}
          onCancel={() => setEditing(null)}
        />
      )}

      {error && <p className="error">{error}</p>}

      {goals === null ? (
        <p className="muted">{t.loading}</p>
      ) : goals.length === 0 ? (
        <EmptyState section="goals" text={t.empty} />
      ) : (
        <ul className="goal-list">
          {goals.map((g) => {
            const progress = computeProgress(g, latest, incomes, views);
            const abandoned = g.status === "abandoned";
            const reached = progress.kind === "value" && progress.ratio >= 1;
            const days = g.deadline ? daysUntil(g.deadline, today) : null;

            return (
              <li key={g.id} className={`card goal-card${abandoned ? " goal-abandoned" : ""}`}>
                <div className="goal-head">
                  <div>
                    <strong>
                      {formatGoalValue(g, g.target_value)} · {t.metrics[g.metric]}
                    </strong>
                    <p className="muted small">
                      {profileLabel(g)}
                      {g.deadline && ` · ${formatDate(g.deadline)}`}
                    </p>
                    {g.metric === "income" && (
                      <p className="muted small">{t.incomeSince(formatDate(goalStartDate(g)))}</p>
                    )}
                    {g.metric === "views" && (
                      <p className="muted small">{t.viewsSince(formatDate(goalStartDate(g)))}</p>
                    )}
                  </div>
                  <div className="profile-actions">
                    {confirmingId === g.id ? (
                      <>
                        <button className="danger" onClick={() => run(() => deleteGoal(g.id))}>
                          {t.confirmRemove}
                        </button>
                        <button className="ghost" onClick={() => setConfirmingId(null)}>
                          {t.cancel}
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="ghost" onClick={() => setEditing(g)}>
                          {t.edit}
                        </button>
                        <button
                          className="ghost"
                          onClick={() => run(() => setGoalStatus(g.id, abandoned ? "active" : "abandoned"))}
                        >
                          {abandoned ? t.reactivate : t.abandon}
                        </button>
                        <button className="ghost" onClick={() => setConfirmingId(g.id)}>
                          {t.remove}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {progress.kind === "value" ? (
                  <>
                    <div className="progress">
                      <div
                        className={`progress-bar${reached ? " progress-done" : ""}`}
                        style={{ width: `${progress.ratio * 100}%` }}
                      />
                    </div>
                    <p className="goal-foot small">
                      <span>
                        {formatGoalValue(g, progress.current)} {t.of} {formatGoalValue(g, g.target_value)} ·{" "}
                        {Math.floor(progress.ratio * 100)} %
                      </span>
                      {abandoned ? (
                        <span className="muted">{t.abandoned}</span>
                      ) : reached ? (
                        <span className="status-on">{t.achieved}</span>
                      ) : (
                        days !== null && (
                          <span className={days < 0 ? "error" : "muted"}>
                            {days < 0 ? t.overdue(-days) : t.daysLeft(days)}
                          </span>
                        )
                      )}
                    </p>
                  </>
                ) : (
                  <p className="muted small">{progress.kind === "pending" ? t.pending : t.noData}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
