import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { BadgeCheck, CircleHelp, CirclePlay, Coins, ExternalLink, LucideIcon, Map, Pencil, Plus, Shield, Sparkles, Swords, Trash2 } from "lucide-react";
import { Game, Trophy, TrophyPhase } from "../../db/games";
import { createGuideEntry, deleteGuideEntry, GUIDE_KINDS, GuideEntry, GuideEntryInput, GuideKind, updateGuideEntry } from "../../db/guide";
import { es } from "../../i18n/es";
import { applyGuideDrafts } from "./guides/applyGuideDrafts";
import { guideDraftsFor } from "./guides";
import { GuideEntryForm } from "./GuideEntryForm";

const t = es.guide;

export const GUIDE_ICONS: Record<GuideKind, LucideIcon> = {
  boss: Swords,
  build: Shield,
  route: Map,
  farm: Coins,
  tip: Sparkles,
};

interface CardProps {
  entry: GuideEntry;
  phases: TrophyPhase[];
  trophies: Trophy[];
  onEdit?: () => void;
  onDelete?: () => Promise<void>;
  compact?: boolean;
}

/** Tarjeta de una entrada de la guía. */
export function GuideCard({ entry: e, phases, trophies, onEdit, onDelete, compact }: CardProps) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const Icon = GUIDE_ICONS[e.kind];
  const phase = phases.find((p) => p.id === e.phase_id);
  const linked = trophies.filter((x) => e.trophy_ids.includes(x.id));

  return (
    <li className={`card guide-card guide-${e.kind}`}>
      {e.image && !compact && <img className="guide-image" src={e.image} alt="" />}
      <div className="guide-card-body">
        <div className="guide-card-head">
          <span className="guide-kind">
            <Icon size={14} /> {t.kinds[e.kind]}
          </span>
          {phase && <span className="chip">{phase.name}</span>}
          {e.verified ? (
            <span className="status-on small guide-flag">
              <BadgeCheck size={13} /> {t.verified}
            </span>
          ) : (
            <span className="small guide-flag guide-unverified">
              <CircleHelp size={13} /> {t.unverified}
            </span>
          )}
        </div>
        <strong className="guide-title">{e.title}</strong>
        {e.summary && <p className="muted small guide-summary">{e.summary}</p>}
        {e.body && (open || compact === false) && <p className="guide-text small">{e.body}</p>}
        {linked.length > 0 && !compact && (
          <span className="chips">
            {linked.map((x) => (
              <span key={x.id} className={`trophy-badge trophy-${x.type}`}>
                {x.earned_at ? "✓ " : ""}
                {x.name}
              </span>
            ))}
          </span>
        )}
        <span className="profile-actions wrap guide-actions">
          {e.body && (
            <button className="ghost small-button" onClick={() => setOpen(!open)}>
              {open ? t.hide : t.read}
            </button>
          )}
          {e.video_url && (
            <button className="ghost small-button" onClick={() => openUrl(e.video_url!)}>
              <CirclePlay size={14} /> {t.video}
            </button>
          )}
          {e.source_url && (
            <button className="ghost small-button" onClick={() => openUrl(e.source_url!)}>
              <ExternalLink size={14} /> {t.source}
            </button>
          )}
          {onEdit && (
            <button className="ghost small-button icon-button" onClick={onEdit} title={t.edit}>
              <Pencil size={14} />
            </button>
          )}
          {onDelete &&
            (confirming ? (
              <>
                <button className="danger small-button" onClick={onDelete}>
                  {t.confirmDelete}
                </button>
                <button className="ghost small-button" onClick={() => setConfirming(false)}>
                  {t.cancel}
                </button>
              </>
            ) : (
              <button className="ghost small-button icon-button" onClick={() => setConfirming(true)} title={t.delete}>
                <Trash2 size={14} />
              </button>
            ))}
        </span>
      </div>
    </li>
  );
}

interface Props {
  game: Game;
  guide: GuideEntry[];
  phases: TrophyPhase[];
  trophies: Trophy[];
  onChanged: () => Promise<void>;
}

/** Pestaña Guía: entradas por tipo (jefes, builds, rutas, farmeo y consejos). */
export function GuideView({ game, guide, phases, trophies, onChanged }: Props) {
  const [kind, setKind] = useState<GuideKind | "all">("all");
  const [editing, setEditing] = useState<null | "new" | GuideEntry>(null);
  const [applying, setApplying] = useState(false);
  const drafts = guideDraftsFor(game.np_communication_id);

  async function onSave(input: GuideEntryInput) {
    if (editing === "new") await createGuideEntry(game.id, input);
    else if (editing) await updateGuideEntry(editing.id, input);
    setEditing(null);
    await onChanged();
  }

  async function onApplyDrafts() {
    if (!drafts) return;
    setApplying(true);
    try {
      await applyGuideDrafts(game.id, drafts, phases, trophies);
      await onChanged();
    } finally {
      setApplying(false);
    }
  }

  const visible = guide.filter((e) => kind === "all" || e.kind === kind);

  return (
    <div className="route">
      <div className="guide-toolbar">
        <div className="tabs">
          <button className={`tab${kind === "all" ? " active" : ""}`} onClick={() => setKind("all")}>
            {t.all} <span className="tab-count">{guide.length}</span>
          </button>
          {GUIDE_KINDS.map((k) => {
            const Icon = GUIDE_ICONS[k];
            return (
              <button key={k} className={`tab${kind === k ? " active" : ""}`} onClick={() => setKind(k)}>
                <Icon size={14} /> {t.kindsPlural[k]} <span className="tab-count">{guide.filter((e) => e.kind === k).length}</span>
              </button>
            );
          })}
        </div>
        {editing === null && (
          <button onClick={() => setEditing("new")}>
            <Plus size={16} />
            {t.add}
          </button>
        )}
      </div>

      {editing !== null && (
        <GuideEntryForm
          key={editing === "new" ? "new" : editing.id}
          entry={editing === "new" ? undefined : editing}
          phases={phases}
          trophies={trophies}
          onSave={onSave}
          onCancel={() => setEditing(null)}
        />
      )}

      {guide.length === 0 && drafts && (
        <div className="card route-empty">
          <Swords size={28} />
          <strong>{t.noGuide}</strong>
          <p className="muted small">{t.draftsHint(drafts.entries.length)}</p>
          <button onClick={onApplyDrafts} disabled={applying}>
            <Sparkles size={16} />
            {applying ? t.applying : t.applyDrafts}
          </button>
        </div>
      )}

      {visible.length > 0 && (
        <ul className="guide-grid">
          {visible.map((e) => (
            <GuideCard
              key={e.id}
              entry={e}
              phases={phases}
              trophies={trophies}
              onEdit={() => setEditing(e)}
              onDelete={async () => {
                await deleteGuideEntry(e.id);
                await onChanged();
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
