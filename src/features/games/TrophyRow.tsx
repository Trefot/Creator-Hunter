import { useState } from "react";
import { AlertTriangle, EyeOff, NotebookPen } from "lucide-react";
import { Trophy, TrophyPhase, updateTrophyPlan } from "../../db/games";
import { es } from "../../i18n/es";
import { formatDate } from "../../i18n/format";
import { useGame } from "./GameContext";
import { ProgressLine, TodayButton } from "./TrophyParts";

const t = es.games;

interface Props {
  trophy: Trophy;
  phases: TrophyPhase[];
  onChanged: () => Promise<void>;
}

/** Un trofeo: icono, datos de PSN y, al pulsar el lápiz, su plan (fase, perdible y nota). */
export function TrophyRow({ trophy: x, phases, onChanged }: Props) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(x.note ?? "");
  const ctx = useGame();
  const openTrophy = ctx?.openTrophy;
  const progress = ctx?.progress(x) ?? null;

  async function save(plan: Partial<{ phase_id: string | null; missable: boolean; note: string | null }>) {
    await updateTrophyPlan(x.id, { phase_id: x.phase_id, missable: x.missable, note: x.note, ...plan });
    await onChanged();
  }

  return (
    <li className={`card trophy-row-wrap${x.earned_at ? " trophy-earned" : ""}${x.missable && !x.earned_at ? " trophy-missable" : ""}`}>
      <div className="trophy-row">
        {x.icon_url ? <img className="trophy-icon" src={x.icon_url} alt="" loading="lazy" /> : <span className="trophy-icon" />}
        <span
          className={`trophy-main${openTrophy ? " clickable" : ""}`}
          onClick={openTrophy ? () => openTrophy(x) : undefined}
          title={openTrophy ? es.today.openSheet : undefined}
        >
          <strong>
            {x.name} {x.hidden && <EyeOff size={13} className="muted" aria-label={t.hidden} />}
          </strong>
          {x.detail && <span className="muted small">{x.detail}</span>}
          {x.note && !editing && <span className="trophy-note small">{x.note}</span>}
          {progress && !x.earned_at && <ProgressLine progress={progress} onOpen={() => openTrophy?.(x)} />}
        </span>
        <span className="trophy-side">
          <span className="chips">
            {x.missable && !x.earned_at && (
              <span className="missable-badge">
                <AlertTriangle size={12} /> {t.missable}
              </span>
            )}
            <span className={`trophy-badge trophy-${x.type}`}>{t.types[x.type]}</span>
          </span>
          {x.earned_rate !== null && <span className="muted small">{t.rarity(x.earned_rate)}</span>}
          {x.earned_at && <span className="status-on small">{t.earnedOn(formatDate(x.earned_at.slice(0, 10)))}</span>}
          <TodayButton trophy={x} />
          <button className="ghost small-button icon-button" onClick={() => setEditing(!editing)} title={t.editPlan}>
            <NotebookPen size={14} />
          </button>
        </span>
      </div>

      {editing && (
        <div className="trophy-plan">
          <label>
            {t.phase}
            <select value={x.phase_id ?? ""} onChange={(e) => save({ phase_id: e.target.value || null })}>
              <option value="">{t.noPhase}</option>
              {phases.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={x.missable} onChange={(e) => save({ missable: e.target.checked })} />
            {t.markMissable}
          </label>
          <label className="full-width">
            {t.note}
            <textarea
              rows={2}
              value={note}
              placeholder={t.notePlaceholder}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => note !== (x.note ?? "") && save({ note })}
            />
          </label>
        </div>
      )}
    </li>
  );
}
