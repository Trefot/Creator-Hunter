import { FormEvent, useState } from "react";
import { Adaptation, AdaptationInput, DEFAULT_DISABLED_STEPS, Format, FORMATS, Step, STEPS } from "../../db/adaptations";
import { Profile } from "../../db/profiles";
import { es } from "../../i18n/es";

const t = es.projects;

/** Red sugerida para cada formato al crear una adaptación. */
const SUGGESTED_PLATFORM: Record<Format, string> = {
  long_video: "youtube",
  short: "youtube",
  tiktok: "tiktok",
  reel: "instagram",
  post: "facebook",
  live: "twitch",
};

interface Props {
  /** Adaptación a editar; sin ella, el formulario crea una nueva. */
  adaptation?: Adaptation;
  profiles: Profile[];
  defaultTitle: string;
  /** Al crear, recibe también los pasos desactivados. */
  onSave: (input: AdaptationInput, disabled: Step[]) => Promise<void>;
  onCancel: () => void;
}

export function AdaptationForm({ adaptation, profiles, defaultTitle, onSave, onCancel }: Props) {
  const suggestProfile = (f: Format) => profiles.find((p) => p.platform === SUGGESTED_PLATFORM[f])?.id ?? profiles[0]?.id ?? "";

  const [format, setFormat] = useState<Format>(adaptation?.format ?? "long_video");
  const [profileId, setProfileId] = useState(adaptation?.profile_id ?? suggestProfile("long_video"));
  const [title, setTitle] = useState(adaptation?.title ?? defaultTitle);
  const [scheduledAt, setScheduledAt] = useState(adaptation?.scheduled_at ?? "");
  const [disabled, setDisabled] = useState<Step[]>(DEFAULT_DISABLED_STEPS.long_video);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function onFormatChange(f: Format) {
    setFormat(f);
    if (!adaptation) {
      setProfileId(suggestProfile(f));
      setDisabled(DEFAULT_DISABLED_STEPS[f]);
    }
  }

  function toggleStep(step: Step) {
    setDisabled((prev) => (prev.includes(step) ? prev.filter((s) => s !== step) : [...prev, step]));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError(t.errors.title);

    setError("");
    setSaving(true);
    try {
      await onSave({ format, profile_id: profileId, title, scheduled_at: scheduledAt || null }, disabled);
    } catch (err) {
      setError(`${t.errors.generic} ${err}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card form" onSubmit={onSubmit}>
      <h2>{adaptation ? t.editAdaptation : t.newAdaptation}</h2>

      <div className="form-grid">
        <label>
          {t.format}
          <select value={format} onChange={(e) => onFormatChange(e.target.value as Format)}>
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                {t.formats[f]}
              </option>
            ))}
          </select>
        </label>

        <label>
          {t.profile}
          <select value={profileId} onChange={(e) => setProfileId(e.target.value)}>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {es.platforms[p.platform]} · {p.display_name ?? p.handle}
              </option>
            ))}
          </select>
        </label>

        <label>
          {t.adaptationTitle}
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>

        <label>
          {t.scheduledAt}
          <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
        </label>
      </div>

      {!adaptation && (
        <fieldset className="step-picker">
          <legend>{t.steps}</legend>
          <p className="muted small">{t.stepsHint}</p>
          <div className="chips">
            {STEPS.map((step) => (
              <label key={step} className="checkbox chip-check">
                <input type="checkbox" checked={!disabled.includes(step)} onChange={() => toggleStep(step)} />
                {t.stepNames[step]}
              </label>
            ))}
          </div>
        </fieldset>
      )}

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
