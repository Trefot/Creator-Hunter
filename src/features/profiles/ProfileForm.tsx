import { FormEvent, useState } from "react";
import { Platform, PLATFORMS, Profile, ProfileInput } from "../../db/profiles";
import { es } from "../../i18n/es";
import { minorToInput, parseMoney } from "../income/money";

const t = es.profiles;

/** Umbrales orientativos (USD) solo como sugerencia: varían por país y cambian; se confirman en cada panel. */
const SUGGESTED_THRESHOLD: Record<Platform, number> = {
  youtube: 100,
  twitch: 50,
  tiktok: 10,
  instagram: 100,
  facebook: 100,
};

interface Props {
  /** Perfil a editar; sin él, el formulario crea uno nuevo. */
  profile?: Profile;
  onSave: (input: ProfileInput) => Promise<void>;
  onCancel: () => void;
}

export function ProfileForm({ profile, onSave, onCancel }: Props) {
  const [input, setInput] = useState<ProfileInput>({
    platform: profile?.platform ?? "youtube",
    handle: profile?.handle ?? "",
    display_name: profile?.display_name ?? "",
    url: profile?.url ?? "",
    is_monetized: profile?.is_monetized ?? false,
    payout_threshold_minor: profile?.payout_threshold_minor ?? null,
  });
  const [threshold, setThreshold] = useState(
    profile?.payout_threshold_minor ? minorToInput(profile.payout_threshold_minor) : "",
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function set<K extends keyof ProfileInput>(key: K, value: ProfileInput[K]) {
    setInput((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.handle.trim()) return setError(t.errors.handleRequired);
    const url = input.url.trim();
    if (url && !/^https?:\/\//i.test(url)) return setError(t.errors.invalidUrl);
    const thresholdMinor = threshold.trim() === "" ? null : parseMoney(threshold);
    if (threshold.trim() !== "" && thresholdMinor === null) return setError(t.errors.threshold);

    setError("");
    setSaving(true);
    try {
      await onSave({ ...input, payout_threshold_minor: thresholdMinor });
    } catch (err) {
      setError(String(err).includes("UNIQUE") ? t.errors.duplicate : `${t.errors.generic} ${err}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card form" onSubmit={onSubmit}>
      <h2>{profile ? t.editTitle : t.newTitle}</h2>

      <div className="form-grid">
        <label>
          {t.platform}
          <select value={input.platform} onChange={(e) => set("platform", e.target.value as Platform)}>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {es.platforms[p]}
              </option>
            ))}
          </select>
        </label>

        <label>
          {t.handle}
          <input
            autoFocus
            value={input.handle}
            onChange={(e) => set("handle", e.target.value)}
            placeholder={t.handlePlaceholder}
          />
        </label>

        <label>
          {t.displayName}
          <input
            value={input.display_name}
            onChange={(e) => set("display_name", e.target.value)}
            placeholder={t.displayNamePlaceholder}
          />
        </label>

        <label>
          {t.url}
          <input value={input.url} onChange={(e) => set("url", e.target.value)} placeholder={t.urlPlaceholder} />
        </label>

        <label>
          {t.payoutThreshold}
          <input
            inputMode="decimal"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            placeholder={t.payoutThresholdPlaceholder(SUGGESTED_THRESHOLD[input.platform])}
          />
          <span className="field-hint">{t.payoutThresholdHint}</span>
        </label>
      </div>

      <label className="checkbox">
        <input
          type="checkbox"
          checked={input.is_monetized}
          onChange={(e) => set("is_monetized", e.target.checked)}
        />
        {t.monetized}
      </label>

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
