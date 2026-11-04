import { FormEvent, useState } from "react";
import { Idea, IdeaInput } from "../../db/ideas";
import { es } from "../../i18n/es";

const t = es.ideas;

interface Props {
  /** Idea a editar; sin ella, el formulario crea una nueva. */
  idea?: Idea;
  onSave: (input: IdeaInput) => Promise<void>;
  onCancel: () => void;
}

export function IdeaForm({ idea, onSave, onCancel }: Props) {
  const [input, setInput] = useState<IdeaInput>({
    title: idea?.title ?? "",
    description: idea?.description ?? "",
    tags: idea?.tags ?? "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function set<K extends keyof IdeaInput>(key: K, value: IdeaInput[K]) {
    setInput((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.title.trim()) return setError(t.errors.title);

    setError("");
    setSaving(true);
    try {
      await onSave(input);
    } catch (err) {
      setError(`${t.errors.generic} ${err}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card form" onSubmit={onSubmit}>
      <h2>{idea ? t.editTitle : t.newTitle}</h2>

      <label>
        {t.title}
        <input autoFocus value={input.title} onChange={(e) => set("title", e.target.value)} placeholder={t.titlePlaceholder} />
      </label>

      <label className="full-width">
        {t.description}
        <textarea
          rows={3}
          value={input.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder={t.descriptionPlaceholder}
        />
      </label>

      <label className="full-width">
        {t.tags}
        <input value={input.tags} onChange={(e) => set("tags", e.target.value)} placeholder={t.tagsPlaceholder} />
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
