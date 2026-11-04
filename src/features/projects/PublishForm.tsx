import { FormEvent, useState } from "react";
import { publishAdaptation } from "../../db/adaptations";
import { es } from "../../i18n/es";
import { nowLocal } from "../../i18n/format";

const t = es.publishing;

interface Props {
  adaptationId: string;
  onDone: () => Promise<void>;
  onCancel: () => void;
}

export function PublishForm({ adaptationId, onDone, onCancel }: Props) {
  const [publishedAt, setPublishedAt] = useState(nowLocal());
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const link = url.trim();
    if (!publishedAt) return setError(t.errors.date);
    if (link && !/^https?:\/\//i.test(link)) return setError(t.errors.url);
    try {
      await publishAdaptation(adaptationId, publishedAt, link || null);
      await onDone();
    } catch (err) {
      setError(`${t.errors.generic} ${err}`);
    }
  }

  return (
    <form className="inline-panel" onSubmit={onSubmit}>
      <h3>{t.title}</h3>
      <div className="snapshot-form publish-form">
        <label>
          {t.publishedAt}
          <input type="datetime-local" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} />
        </label>
        <label>
          {t.url}
          <input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t.urlPlaceholder} />
        </label>
        <button type="button" className="ghost" onClick={onCancel}>
          {t.cancel}
        </button>
        <button type="submit">{t.confirm}</button>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
