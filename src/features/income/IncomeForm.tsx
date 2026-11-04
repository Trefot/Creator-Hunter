import { FormEvent, useState } from "react";
import { Income, IncomeInput, IncomeSource, SELECTABLE_INCOME_SOURCES } from "../../db/income";
import { Profile } from "../../db/profiles";
import { es } from "../../i18n/es";
import { todayIso } from "../../i18n/format";
import { minorToInput, parseMoney } from "./money";

const t = es.income;

interface Props {
  /** Ingreso a editar; sin él, el formulario registra uno nuevo. */
  income?: Income;
  profiles: Profile[];
  defaultCurrency: string;
  onSave: (input: IncomeInput) => Promise<void>;
  onCancel: () => void;
}

export function IncomeForm({ income, profiles, defaultCurrency, onSave, onCancel }: Props) {
  const [date, setDate] = useState(income?.received_on ?? todayIso());
  const [amount, setAmount] = useState(income ? minorToInput(income.amount_minor) : "");
  const [currency, setCurrency] = useState(income?.currency ?? defaultCurrency);
  const [source, setSource] = useState<IncomeSource>(income?.source ?? "platform_ads");
  const [profileId, setProfileId] = useState(income?.profile_id ?? "");
  const [note, setNote] = useState(income?.note ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const amountMinor = parseMoney(amount);
    const code = currency.trim().toUpperCase();
    if (!date) return setError(t.errors.date);
    if (amountMinor === null) return setError(t.errors.amount);
    if (!/^[A-Z]{3}$/.test(code)) return setError(t.errors.currency);

    setError("");
    setSaving(true);
    try {
      await onSave({
        received_on: date,
        amount_minor: amountMinor,
        currency: code,
        source,
        profile_id: profileId || null,
        note: note.trim() || null,
      });
    } catch (err) {
      setError(`${t.errors.generic} ${err}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card form" onSubmit={onSubmit}>
      <h2>{income ? t.editTitle : t.newTitle}</h2>

      <div className="form-grid">
        <label>
          {t.amount}
          <div className="money-input">
            <input
              autoFocus
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={t.amountPlaceholder}
            />
            <input
              className="currency-input"
              value={currency}
              maxLength={3}
              onChange={(e) => setCurrency(e.target.value)}
              aria-label={t.currency}
            />
          </div>
        </label>

        <label>
          {t.date}
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>

        <label>
          {t.source}
          <select value={source} onChange={(e) => setSource(e.target.value as IncomeSource)}>
            {/* Un registro antiguo con un tipo ya no ofrecido sigue mostrando el suyo. */}
            {(SELECTABLE_INCOME_SOURCES.includes(source) ? SELECTABLE_INCOME_SOURCES : [source, ...SELECTABLE_INCOME_SOURCES]).map((s) => (
              <option key={s} value={s}>
                {t.sources[s]}
              </option>
            ))}
          </select>
        </label>

        <label>
          {t.profile}
          <select value={profileId} onChange={(e) => setProfileId(e.target.value)}>
            <option value="">{t.noProfile}</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {es.platforms[p.platform]} · {p.display_name ?? p.handle}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="full-width">
        {t.note}
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t.notePlaceholder} />
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
