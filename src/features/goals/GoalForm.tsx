import {useDraftState,clearDraft} from "../../hooks/useDraftState";
import { FormEvent, useState } from "react";
import { Goal, GOAL_METRICS, GoalInput, GoalMetric } from "../../db/goals";
import { Profile } from "../../db/profiles";
import { es } from "../../i18n/es";

const t = es.goals;

interface Props {
  /** Meta a editar; sin ella, el formulario crea una nueva. */
  goal?: Goal;
  initialProfileId?: string;
  profiles: Profile[];
  onSave: (input: GoalInput) => Promise<void>;
  onCancel: () => void;
}

export function GoalForm({ goal, profiles, onSave, onCancel, initialProfileId }: Props) {
  const draftKey="GoalForm:"+(goal?.id??initialProfileId??'new');
  const [metric, setMetric] = useDraftState<GoalMetric>(draftKey+":metric",goal?.metric ?? "followers");
  const [profileId, setProfileId] = useDraftState(draftKey+":profileId",goal?.profile_id ?? initialProfileId ?? "");
  const [target, setTarget] = useDraftState(draftKey+":target",goal ? String(goal.target_value) : "");
  const [deadline, setDeadline] = useDraftState(draftKey+":deadline",goal?.deadline ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const value = Number(target.trim().replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) return setError(t.errors.target);

    setError("");
    setSaving(true);
    try {
      await onSave({ metric, profile_id: profileId || null, target_value: value, deadline: deadline || null });
      clearDraft(draftKey);
    } catch (err) {
      setError(`${t.errors.generic} ${err}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card form" onSubmit={onSubmit}><p className="small muted">El borrador se conserva en este equipo al cambiar de apartado. Guarda para confirmar los cambios.</p>
      <h2>{goal ? t.editTitle : t.newTitle}</h2>

      <div className="form-grid">
        <label>
          {t.metric}
          <select value={metric} onChange={(e) => setMetric(e.target.value as GoalMetric)}>
            {GOAL_METRICS.map((m) => (
              <option key={m} value={m}>
                {t.metrics[m]}
              </option>
            ))}
          </select>
        </label>

        <label>
          {t.profile}
          <select aria-label={t.profile} value={profileId} onChange={(e) => setProfileId(e.target.value)}>
            <option value="">{t.allProfiles}</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {es.platforms[p.platform]} · {p.display_name ?? p.handle}
              </option>
            ))}
          </select>
        </label>

        <label>
          {t.target}
          <input autoFocus inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
        </label>

        <label>
          {t.deadline}
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </label>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="form-actions">
        <button type="button" className="ghost" onClick={onCancel}>
          {t.cancel}
        </button>
        <button type="submit" disabled={saving}>
          {t.save}
        </button>
      </div>
    </form>
  );
}
