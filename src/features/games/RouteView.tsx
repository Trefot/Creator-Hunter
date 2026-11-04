import { FormEvent, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { AlertTriangle, ArrowDown, ArrowUp, Compass, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { createPhase, deletePhase, Game, swapPhases, Trophy, TrophyPhase, updatePhase } from "../../db/games";
import type { GuideEntry } from "../../db/guide";
import { GuideCard } from "./GuideView";
import { es } from "../../i18n/es";
import { applyRoadmap } from "./applyRoadmap";
import { roadmapFor } from "./roadmaps";
import { TrophyRow } from "./TrophyRow";

const t = es.games;

interface Props {
  game: Game;
  trophies: Trophy[];
  phases: TrophyPhase[];
  guide: GuideEntry[];
  onChanged: () => Promise<void>;
}

/** Fase actual = la primera, en orden, que aún tiene trofeos pendientes (calculada, no guardada). */
export function currentPhase(phases: TrophyPhase[], trophies: Trophy[]): TrophyPhase | null {
  return phases.find((p) => trophies.some((x) => x.phase_id === p.id && !x.earned_at)) ?? null;
}

function PhaseHeader({
  phase,
  isFirst,
  isLast,
  onMove,
  onChanged,
}: {
  phase: TrophyPhase;
  isFirst: boolean;
  isLast: boolean;
  onMove: (dir: -1 | 1) => void;
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [name, setName] = useState(phase.name);
  const [note, setNote] = useState(phase.note ?? "");

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await updatePhase(phase.id, name, note);
    setEditing(false);
    await onChanged();
  }

  if (editing) {
    return (
      <form className="phase-edit" onSubmit={onSave}>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t.phaseNotePlaceholder} />
        <span className="profile-actions">
          <button type="button" className="ghost small-button" onClick={() => setEditing(false)}>
            {t.cancel}
          </button>
          <button type="submit" className="small-button">
            {t.save}
          </button>
        </span>
      </form>
    );
  }

  return (
    <span className="profile-actions">
      <button className="ghost small-button icon-button" disabled={isFirst} onClick={() => onMove(-1)} title={t.moveUp}>
        <ArrowUp size={14} />
      </button>
      <button className="ghost small-button icon-button" disabled={isLast} onClick={() => onMove(1)} title={t.moveDown}>
        <ArrowDown size={14} />
      </button>
      <button className="ghost small-button icon-button" onClick={() => setEditing(true)} title={t.editPhase}>
        <Pencil size={14} />
      </button>
      {confirming ? (
        <>
          <button
            className="danger small-button"
            onClick={async () => {
              await deletePhase(phase.id);
              await onChanged();
            }}
          >
            {t.confirmDeletePhase}
          </button>
          <button className="ghost small-button" onClick={() => setConfirming(false)}>
            {t.cancel}
          </button>
        </>
      ) : (
        <button className="ghost small-button icon-button" onClick={() => setConfirming(true)} title={t.deletePhase}>
          <Trash2 size={14} />
        </button>
      )}
    </span>
  );
}

export function RouteView({ game, trophies, phases, guide, onChanged }: Props) {
  const [newPhase, setNewPhase] = useState("");
  const [applying, setApplying] = useState(false);
  const roadmap = roadmapFor(game.np_communication_id);
  const current = currentPhase(phases, trophies);

  async function onApply() {
    if (!roadmap) return;
    setApplying(true);
    try {
      await applyRoadmap(game.id, roadmap);
      await onChanged();
    } finally {
      setApplying(false);
    }
  }

  async function onAddPhase(e: FormEvent) {
    e.preventDefault();
    if (!newPhase.trim()) return;
    await createPhase(game.id, newPhase);
    setNewPhase("");
    await onChanged();
  }

  const pendingIn = (phaseId: string | null) => trophies.filter((x) => x.phase_id === phaseId && !x.earned_at);
  // Perdibles pendientes fuera de la fase actual: avisan antes de que sea tarde.
  const missables = trophies.filter((x) => x.missable && !x.earned_at && x.phase_id !== current?.id);
  const unassigned = trophies.filter((x) => x.phase_id === null);

  return (
    <div className="route">
      {phases.length === 0 && (
        <div className="card route-empty">
          <Compass size={28} />
          <strong>{t.noRoute}</strong>
          {roadmap ? (
            <>
              <p className="muted small">{t.suggestedRouteHint}</p>
              <button onClick={onApply} disabled={applying}>
                <Sparkles size={16} />
                {applying ? t.applying : t.applySuggested}
              </button>
              <span className="muted small">
                {t.sources}{" "}
                {roadmap.sources.map((s) => (
                  <button key={s.url} className="link" onClick={() => openUrl(s.url)}>
                    {s.label}
                  </button>
                ))}
              </span>
            </>
          ) : (
            <p className="muted small">{t.noSuggestedRoute}</p>
          )}
        </div>
      )}

      {phases.length > 0 && (
        <section className="card now-card">
          <h2>
            <Compass size={18} /> {t.whatNow}
          </h2>
          {current ? (
            <>
              <p className="small">
                {t.currentPhase} <strong>{current.name}</strong>
              </p>
              {current.note && <p className="muted small">{current.note}</p>}
              <ul className="now-list">
                {pendingIn(current.id).map((x) => (
                  <li key={x.id} className="small">
                    <span className={`trophy-badge trophy-${x.type}`}>{t.types[x.type]}</span> {x.name}
                    {x.note && <span className="muted"> · {x.note}</span>}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="status-on">{t.routeComplete}</p>
          )}
          {current && guide.some((g) => g.phase_id === current.id) && (
            <div className="now-guide">
              <strong className="small">{t.guideForPhase}</strong>
              <ul className="guide-grid compact">
                {guide
                  .filter((g) => g.phase_id === current.id)
                  .map((g) => (
                    <GuideCard key={g.id} entry={g} phases={phases} trophies={trophies} compact />
                  ))}
              </ul>
            </div>
          )}
          {missables.length > 0 && (
            <div className="now-missables">
              <strong className="small">
                <AlertTriangle size={14} /> {t.pendingMissables(missables.length)}
              </strong>
              <ul className="now-list">
                {missables.map((x) => (
                  <li key={x.id} className="small">
                    {x.name}
                    {x.note && <span className="muted"> · {x.note}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {phases.map((p, i) => {
        const items = trophies.filter((x) => x.phase_id === p.id);
        const done = items.filter((x) => x.earned_at).length;
        return (
          <section key={p.id} className={`phase${p.id === current?.id ? " phase-current" : ""}`}>
            <header className="phase-head">
              <div className="phase-title">
                <span className="phase-number">{i + 1}</span>
                <div>
                  <h3>{p.name}</h3>
                  <span className="muted small">{t.phaseProgress(done, items.length)}</span>
                </div>
              </div>
              <PhaseHeader
                phase={p}
                isFirst={i === 0}
                isLast={i === phases.length - 1}
                onMove={async (dir) => {
                  await swapPhases(p, phases[i + dir]);
                  await onChanged();
                }}
                onChanged={onChanged}
              />
            </header>
            <span className="progress">
              <span
                className={`progress-bar${items.length && done === items.length ? " progress-done" : ""}`}
                style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }}
              />
            </span>
            {p.note && <p className="muted small phase-note">{p.note}</p>}
            <ul className="trophy-list">
              {items.map((x) => (
                <TrophyRow key={x.id} trophy={x} phases={phases} onChanged={onChanged} />
              ))}
            </ul>
          </section>
        );
      })}

      {phases.length > 0 && unassigned.length > 0 && (
        <section className="phase">
          <header className="phase-head">
            <h3>{t.unassigned}</h3>
          </header>
          <ul className="trophy-list">
            {unassigned.map((x) => (
              <TrophyRow key={x.id} trophy={x} phases={phases} onChanged={onChanged} />
            ))}
          </ul>
        </section>
      )}

      <form className="add-phase" onSubmit={onAddPhase}>
        <input value={newPhase} onChange={(e) => setNewPhase(e.target.value)} placeholder={t.newPhasePlaceholder} />
        <button type="submit" className="small-button" disabled={!newPhase.trim()}>
          <Plus size={14} />
          {t.addPhase}
        </button>
      </form>
    </div>
  );
}
