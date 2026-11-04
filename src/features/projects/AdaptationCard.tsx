import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Adaptation, AdaptationStep, setStepDone, setStepEnabled, unpublishAdaptation } from "../../db/adaptations";
import { Profile } from "../../db/profiles";
import { es } from "../../i18n/es";
import { formatDateTime } from "../../i18n/format";
import { PublishForm } from "./PublishForm";
import { ResultsPanel } from "./ResultsPanel";
import { ScriptEditor } from "./ScriptEditor";
import { currentStep, stepProgress } from "./status";

const t = es.projects;
const tpub = es.publishing;

/** Panel desplegado bajo la tarjeta; solo uno a la vez. */
type Panel = null | "script" | "publish" | "results";

interface Props {
  adaptation: Adaptation;
  profile: Profile | undefined;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  /** Avisa para recargar tras cambiar un paso o la publicación. */
  onChange: () => Promise<void>;
  onError: (message: string) => void;
}

export function AdaptationCard({ adaptation, profile, onEdit, onDelete, onChange, onError }: Props) {
  const [configuring, setConfiguring] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmingUnpublish, setConfirmingUnpublish] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);

  /** El guion solo se ofrece si la adaptación usa el paso de guion. */
  const usesScript = adaptation.steps.some((s) => s.step === "script" && s.enabled);
  const published = adaptation.published_at !== null;
  const current = currentStep(adaptation);
  const { done, total } = stepProgress(adaptation);

  const toggle = (p: Exclude<Panel, null>) => setPanel(panel === p ? null : p);

  async function onStepClick(step: AdaptationStep) {
    try {
      if (configuring) await setStepEnabled(step.id, !step.enabled);
      else if (step.enabled) await setStepDone(step.id, step.completed_at === null);
      await onChange();
    } catch (err) {
      onError(`${t.errors.generic} ${err}`);
    }
  }

  async function onUnpublish() {
    try {
      await unpublishAdaptation(adaptation.id);
      setConfirmingUnpublish(false);
      setPanel(null);
      await onChange();
    } catch (err) {
      onError(`${t.errors.generic} ${err}`);
    }
  }

  function stepClass(step: AdaptationStep): string {
    if (!step.enabled) return "step step-off";
    if (step.completed_at) return "step step-done";
    return step.id === current?.id ? "step step-current" : "step";
  }

  return (
    <li className="card adaptation-card">
      <div className="goal-head">
        <div className="idea-main">
          <div className="chips">
            {profile && (
              <span className={`platform-badge platform-${profile.platform}`}>{es.platforms[profile.platform]}</span>
            )}
            <strong>{t.formats[adaptation.format]}</strong>
            <span className={current ? "pill" : "pill pill-done"}>
              {current ? t.current(t.stepNames[current.step]) : t.completed}
            </span>
          </div>
          <span>{adaptation.title}</span>
          <span className="muted small">
            {adaptation.scheduled_at ? formatDateTime(adaptation.scheduled_at) : t.unscheduled} · {done}/{total}
          </span>
          {published && (
            <span className="chips">
              <span className="status-on small">{tpub.publishedOn(formatDateTime(adaptation.published_at!))}</span>
              {adaptation.published_url && (
                <button className="link" onClick={() => openUrl(adaptation.published_url!)}>
                  {tpub.openLink}
                </button>
              )}
              {confirmingUnpublish ? (
                <>
                  <button className="danger small-button" onClick={onUnpublish}>
                    {tpub.confirmUnpublish}
                  </button>
                  <button className="ghost small-button" onClick={() => setConfirmingUnpublish(false)}>
                    {tpub.cancel}
                  </button>
                </>
              ) : (
                <button className="link muted-link" onClick={() => setConfirmingUnpublish(true)}>
                  {tpub.unpublish}
                </button>
              )}
            </span>
          )}
        </div>

        <div className="profile-actions wrap">
          {confirming ? (
            <>
              <button className="danger" onClick={onDelete}>
                {t.confirmRemove}
              </button>
              <button className="ghost" onClick={() => setConfirming(false)}>
                {t.cancel}
              </button>
            </>
          ) : (
            <>
              {published ? (
                <button className={panel === "results" ? "" : "ghost"} onClick={() => toggle("results")}>
                  {panel === "results" ? tpub.hideResults : tpub.results}
                </button>
              ) : (
                <button className={panel === "publish" ? "" : "ghost"} onClick={() => toggle("publish")}>
                  {tpub.publish}
                </button>
              )}
              {usesScript && (
                <button className={panel === "script" ? "" : "ghost"} onClick={() => toggle("script")}>
                  {panel === "script" ? es.script.close : es.script.open}
                </button>
              )}
              <button className="ghost" onClick={() => setConfiguring(!configuring)}>
                {configuring ? t.doneConfiguring : t.configureSteps}
              </button>
              <button className="ghost" onClick={onEdit}>
                {t.edit}
              </button>
              <button className="ghost" onClick={() => setConfirming(true)}>
                {t.remove}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="steps">
        {adaptation.steps
          .filter((s) => configuring || s.enabled)
          .map((s) => (
            <button key={s.id} className={stepClass(s)} onClick={() => onStepClick(s)}>
              {configuring ? (s.enabled ? "☑ " : "☐ ") : s.completed_at ? "✓ " : ""}
              {t.stepNames[s.step]}
            </button>
          ))}
      </div>
      <p className="muted small">{configuring ? t.stepsHint : t.stepsInfo}</p>

      {panel === "script" && usesScript && <ScriptEditor adaptationId={adaptation.id} />}
      {panel === "publish" && !published && (
        <PublishForm
          adaptationId={adaptation.id}
          onDone={async () => {
            setPanel("results");
            await onChange();
          }}
          onCancel={() => setPanel(null)}
        />
      )}
      {panel === "results" && published && <ResultsPanel adaptationId={adaptation.id} isLive={adaptation.format === "live"} />}
    </li>
  );
}
