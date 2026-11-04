import { useEffect, useState } from "react";
import {
  addSections,
  deleteSection,
  listSections,
  ScriptSection,
  SECTION_KINDS,
  SectionKind,
  swapSections,
  TEMPLATE,
  updateSection,
} from "../../db/scriptSections";
import { es } from "../../i18n/es";
import { formatDuration, readingSeconds, totalSeconds, wordCount } from "./scriptTime";

const t = es.script;

interface SectionProps {
  section: ScriptSection;
  isFirst: boolean;
  isLast: boolean;
  onSaved: (section: ScriptSection) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
  onError: (message: string) => void;
}

/** Una sección del guion. Se guarda sola al salir de cada campo. */
function SectionEditor({ section, isFirst, isLast, onSaved, onMove, onDelete, onError }: SectionProps) {
  const [kind, setKind] = useState<SectionKind>(section.kind);
  const [content, setContent] = useState(section.content);
  const [seconds, setSeconds] = useState(section.est_seconds === null ? "" : String(section.est_seconds));
  const [saved, setSaved] = useState(false);

  async function save(next: { kind?: SectionKind } = {}) {
    const trimmed = seconds.trim();
    const est = trimmed === "" ? null : Number(trimmed);
    if (est !== null && (!Number.isInteger(est) || est < 0)) return onError(t.errors.seconds);

    const input = { kind: next.kind ?? kind, content, est_seconds: est };
    if (input.kind === section.kind && input.content === section.content && input.est_seconds === section.est_seconds) return;
    try {
      await updateSection(section.id, input);
      onSaved({ ...section, ...input });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      onError(`${t.errors.generic} ${err}`);
    }
  }

  return (
    <li className={`script-section script-${kind}`}>
      <div className="script-section-head">
        <select
          value={kind}
          onChange={(e) => {
            const k = e.target.value as SectionKind;
            setKind(k);
            save({ kind: k });
          }}
        >
          {SECTION_KINDS.map((k) => (
            <option key={k} value={k}>
              {t.kinds[k]}
            </option>
          ))}
        </select>
        <label className="seconds-field" title={t.secondsHint}>
          {t.seconds}
          <input
            inputMode="numeric"
            value={seconds}
            onChange={(e) => setSeconds(e.target.value)}
            onBlur={() => save()}
            placeholder={t.secondsPlaceholder(readingSeconds(content))}
          />
        </label>
        <span className="muted small">{t.words(wordCount(content))}</span>
        {saved && <span className="status-on small">{t.saved}</span>}
        <span className="spacer" />
        <button className="ghost small-button" disabled={isFirst} onClick={() => onMove(-1)} title={t.moveUp}>
          ↑
        </button>
        <button className="ghost small-button" disabled={isLast} onClick={() => onMove(1)} title={t.moveDown}>
          ↓
        </button>
        <button className="ghost small-button" onClick={onDelete}>
          {t.remove}
        </button>
      </div>
      <textarea
        rows={4}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={() => save()}
        placeholder={t.contentPlaceholder}
      />
    </li>
  );
}

export function ScriptEditor({ adaptationId }: { adaptationId: string }) {
  const [sections, setSections] = useState<ScriptSection[] | null>(null);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      setSections(await listSections(adaptationId));
    } catch (err) {
      setError(`${t.errors.generic} ${err}`);
    }
  }

  useEffect(() => {
    refresh();
  }, [adaptationId]);

  async function run(action: () => Promise<void>) {
    setError("");
    try {
      await action();
    } catch (err) {
      setError(`${t.errors.generic} ${err}`);
    }
    await refresh();
  }

  if (sections === null) return null;

  return (
    <div className="script-editor">
      <div className="script-header">
        <h3>{t.title}</h3>
        <span className="script-total">
          {t.total}: <strong>{formatDuration(totalSeconds(sections))}</strong>
        </span>
      </div>

      {sections.length === 0 ? (
        <div className="empty-state compact">
          <p>{t.empty}</p>
          <button onClick={() => run(() => addSections(adaptationId, TEMPLATE))}>{t.useTemplate}</button>
        </div>
      ) : (
        <ol className="script-sections">
          {sections.map((s, i) => (
            <SectionEditor
              key={s.id}
              section={s}
              isFirst={i === 0}
              isLast={i === sections.length - 1}
              onSaved={(updated) => setSections((prev) => prev && prev.map((x) => (x.id === updated.id ? updated : x)))}
              onMove={(dir) => run(() => swapSections(s, sections[i + dir]))}
              onDelete={() => run(() => deleteSection(s.id))}
              onError={setError}
            />
          ))}
        </ol>
      )}

      {error && <p className="error">{error}</p>}

      <div className="chips">
        <span className="muted small">{t.add}</span>
        {SECTION_KINDS.map((k) => (
          <button key={k} className="chip" onClick={() => run(() => addSections(adaptationId, [k]))}>
            + {t.kinds[k]}
          </button>
        ))}
      </div>
    </div>
  );
}
