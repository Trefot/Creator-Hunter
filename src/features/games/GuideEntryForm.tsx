import { FormEvent, useState } from "react";
import { THUMBNAIL_SIZE } from "../../components/images";
import { ImagePicker } from "../../components/ImagePicker";
import { Trophy, TrophyPhase } from "../../db/games";
import { GUIDE_KINDS, GuideEntry, GuideEntryInput, GuideKind } from "../../db/guide";
import { es } from "../../i18n/es";

const t = es.guide;

interface Props {
  entry?: GuideEntry;
  phases: TrophyPhase[];
  trophies: Trophy[];
  onSave: (input: GuideEntryInput) => Promise<void>;
  onCancel: () => void;
}

const isUrl = (v: string) => !v.trim() || /^https?:\/\//i.test(v.trim());

/** Crear o editar una entrada de la guía. */
export function GuideEntryForm({ entry, phases, trophies, onSave, onCancel }: Props) {
  const [input, setInput] = useState<GuideEntryInput>({
    kind: entry?.kind ?? "boss",
    title: entry?.title ?? "",
    phase_id: entry?.phase_id ?? null,
    summary: entry?.summary ?? "",
    body: entry?.body ?? "",
    image: entry?.image ?? null,
    video_url: entry?.video_url ?? "",
    source_url: entry?.source_url ?? "",
    // Lo que escribe el usuario cuenta como comprobado; los borradores vienen marcados como no.
    verified: entry?.verified ?? true,
    trophy_ids: entry?.trophy_ids ?? [],
  });
  const [error, setError] = useState("");

  function set<K extends keyof GuideEntryInput>(key: K, value: GuideEntryInput[K]) {
    setInput((prev) => ({ ...prev, [key]: value }));
  }

  function toggleTrophy(id: string) {
    set("trophy_ids", input.trophy_ids.includes(id) ? input.trophy_ids.filter((x) => x !== id) : [...input.trophy_ids, id]);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.title.trim()) return setError(t.errors.title);
    if (!isUrl(input.video_url ?? "") || !isUrl(input.source_url ?? "")) return setError(t.errors.url);
    try {
      await onSave(input);
    } catch (err) {
      setError(String(err));
    }
  }

  return (
    <form className="card form guide-form" onSubmit={onSubmit}>
      <h2>{entry ? t.editTitle : t.newTitle}</h2>
      <div className="form-grid">
        <label>
          {t.kind}
          <select value={input.kind} onChange={(e) => set("kind", e.target.value as GuideKind)}>
            {GUIDE_KINDS.map((k) => (
              <option key={k} value={k}>
                {t.kinds[k]}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t.title}
          <input autoFocus value={input.title} onChange={(e) => set("title", e.target.value)} placeholder={t.titlePlaceholder} />
        </label>
        <label>
          {t.phase}
          <select value={input.phase_id ?? ""} onChange={(e) => set("phase_id", e.target.value || null)}>
            <option value="">{t.noPhase}</option>
            {phases.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t.summary}
          <input value={input.summary ?? ""} onChange={(e) => set("summary", e.target.value)} placeholder={t.summaryPlaceholder} />
        </label>
      </div>

      <label className="full-width">
        {t.body}
        <textarea rows={7} value={input.body ?? ""} onChange={(e) => set("body", e.target.value)} placeholder={t.bodyPlaceholder[input.kind]} />
      </label>

      <div className="guide-form-media">
        <ImagePicker
          image={input.image}
          size={THUMBNAIL_SIZE}
          className="thumb-md"
          placeholder={<span className="thumb-placeholder small">{t.addImage}</span>}
          onChange={async (img) => set("image", img)}
        />
        <div className="guide-form-links">
          <label>
            {t.videoUrl}
            <input value={input.video_url ?? ""} onChange={(e) => set("video_url", e.target.value)} placeholder="https://…" />
          </label>
          <label>
            {t.sourceUrl}
            <input value={input.source_url ?? ""} onChange={(e) => set("source_url", e.target.value)} placeholder="https://…" />
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={input.verified} onChange={(e) => set("verified", e.target.checked)} />
            {t.verifiedByMe}
          </label>
        </div>
      </div>

      <fieldset className="step-picker">
        <legend>{t.linkedTrophies}</legend>
        <div className="chips">
          {trophies.map((x) => (
            <label key={x.id} className="checkbox chip-check">
              <input type="checkbox" checked={input.trophy_ids.includes(x.id)} onChange={() => toggleTrophy(x.id)} />
              {x.name}
            </label>
          ))}
        </div>
      </fieldset>

      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        <button type="button" className="ghost" onClick={onCancel}>
          {t.cancel}
        </button>
        <button type="submit">{t.save}</button>
      </div>
    </form>
  );
}
