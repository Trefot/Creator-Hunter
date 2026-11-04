import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  AlertTriangle,
  Check,
  ExternalLink,
  Footprints,
  Gem,
  ListChecks,
  Lock,
  MapPin,
  Plus,
  Shuffle,
  Swords,
  Trash2,
  Trophy as TrophyIcon,
  Undo2,
  X,
} from "lucide-react";
import { ProgressRing } from "../../components/charts/ProgressRing";
import type { Trophy, TrophyPhase } from "../../db/games";
import type { GuideEntry } from "../../db/guide";
import { es } from "../../i18n/es";
import { formatDate } from "../../i18n/format";
import type { ItemSource } from "./collections/types";
import { CheckItem, useGame } from "./GameContext";
import { GUIDE_ICONS } from "./GuideView";
import { ngPlusPhase, sendToNgPlus } from "./missed";
import { TodayButton } from "./TrophyParts";

const t = es.sheet;

const SOURCE_ICONS: Record<ItemSource, typeof Lock> = { fixed: Swords, random: Shuffle, enemy: Gem };

/** Agrupa la lista por `group` o capítulo, en el orden en que aparecen. */
function groupItems(items: CheckItem[]): [string, CheckItem[]][] {
  const out = new Map<string, CheckItem[]>();
  for (const i of items) {
    const label = i.group ?? (i.chapter ? t.chapter(i.chapter) : t.otherGroup);
    out.set(label, [...(out.get(label) ?? []), i]);
  }
  return [...out.entries()];
}

interface Props {
  trophy: Trophy;
  phases: TrophyPhase[];
  guide: GuideEntry[];
  onChanged: () => Promise<void>;
  onClose: () => void;
}

/**
 * Ficha de un trofeo: qué pide, la lista de lo que hay que conseguir (para ir marcando),
 * lo siguiente que toca y cómo conseguirlo.
 */
export function TrophySheet({ trophy: x, phases, guide, onChanged, onClose }: Props) {
  const ctx = useGame();
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [own, setOwn] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!ctx) return null;
  const collection = ctx.collectionOf(x);
  const items = ctx.checklist(x);
  const progress = ctx.progress(x);
  const linked = guide.filter((g) => g.trophy_ids.includes(x.id));
  const ngPhase = ngPlusPhase(phases);
  const visible = onlyMissing ? items.filter((i) => !i.done) : items;

  async function onAddOwn(e: FormEvent) {
    e.preventDefault();
    await ctx!.addOwnItem(x, own);
    setOwn("");
  }

  // Portal al <body>: la ficha queda por encima de la franja del modo juego y de la skin.
  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <aside className="sheet" role="dialog" aria-label={x.name} onClick={(e) => e.stopPropagation()}>
        <header className={`sheet-hero sheet-${x.type}`}>
          <button className="ghost icon-button sheet-close" onClick={onClose} title={t.close}>
            <X size={18} />
          </button>
          {x.icon_url ? <img className={`sheet-icon${x.earned_at ? "" : " locked"}`} src={x.icon_url} alt="" /> : <span className="sheet-icon" />}
          <div className="sheet-hero-text">
            <span className="chips">
              <span className={`trophy-badge trophy-${x.type}`}>{es.games.types[x.type]}</span>
              {x.earned_rate !== null && <span className="chip-soft">{es.games.rarity(x.earned_rate)}</span>}
              {x.missable && !x.earned_at && (
                <span className="missable-badge">
                  <AlertTriangle size={12} /> {es.games.missable}
                </span>
              )}
            </span>
            <h2>{x.name}</h2>
            {x.detail && <p className="sheet-quote">{x.detail}</p>}
            {x.earned_at ? (
              <span className="status-on small">
                <TrophyIcon size={12} /> {es.games.earnedOn(formatDate(x.earned_at.slice(0, 10)))}
              </span>
            ) : (
              <TodayButton trophy={x} big />
            )}
          </div>
          {progress && (
            <span className="sheet-ring">
              <ProgressRing ratio={progress.done / progress.total} size={84} label={t.progressOf(progress.done, progress.total)} />
            </span>
          )}
        </header>

        <div className="sheet-body">
          {x.missable && !x.earned_at && ngPhase && (
            <section className="sheet-lost">
              <h3>
                <AlertTriangle size={16} /> {t.lostTitle}
              </h3>
              <p className="small">{t.lostText(ngPhase.name)}</p>
              <button
                className="small-button"
                onClick={async () => {
                  await sendToNgPlus(x, ngPhase);
                  await onChanged();
                }}
              >
                <Undo2 size={14} /> {t.lostButton}
              </button>
            </section>
          )}

          {progress?.next && !x.earned_at && (
            <section className="sheet-next">
              <span className="sheet-next-label">
                <Footprints size={14} /> {t.nextStep}
              </span>
              <strong>{progress.next.name}</strong>
              {progress.next.where && (
                <span className="small">
                  <MapPin size={12} /> {progress.next.where}
                </span>
              )}
              {progress.next.how && <span className="small muted">{progress.next.how}</span>}
              <button className="small-button" onClick={() => ctx.toggleItem(x, progress.next!)}>
                <Check size={14} /> {t.markDone}
              </button>
            </section>
          )}

          {x.note && (
            <section className="sheet-section">
              <h3>{t.whatToDo}</h3>
              <p>{x.note}</p>
            </section>
          )}

          {collection && collection.steps.length > 0 && (
            <section className="sheet-section">
              <h3>
                <ListChecks size={16} /> {t.steps}
              </h3>
              <ol className="sheet-steps">
                {collection.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </section>
          )}

          <section className="sheet-section">
            <div className="sheet-items-head">
              <h3>
                <ListChecks size={16} /> {collection?.title ?? t.checklist}
              </h3>
              {items.length > 0 && (
                <label className="checkbox small">
                  <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />
                  {t.onlyMissing}
                </label>
              )}
            </div>
            {items.length === 0 && <p className="muted small">{t.noList}</p>}
            {groupItems(visible).map(([label, group]) => (
              <div key={label} className="sheet-chapter">
                <span className="sheet-chapter-label">
                  {label} <span className="muted">· {t.groupCount(group.filter((i) => i.done).length, group.length)}</span>
                </span>
                <ul className="sheet-items">
                  {group.map((i) => {
                    const Icon = i.source ? SOURCE_ICONS[i.source] : null;
                    return (
                      <li key={i.key} className={`sheet-item${i.done ? " got" : ""}`}>
                        <button
                          className={`today-check${i.done ? " checked" : ""}`}
                          disabled={i.auto}
                          onClick={() => ctx.toggleItem(x, i)}
                          title={i.auto ? t.autoDone : i.done ? t.unmark : t.mark}
                        >
                          {i.done && <Check size={14} />}
                        </button>
                        <span className="sheet-item-main">
                          <strong>
                            {i.name} {i.nameEn && <span className="muted small">({i.nameEn})</span>}
                          </strong>
                          {i.where && (
                            <span className="small sheet-where">
                              <MapPin size={12} /> {i.where}
                            </span>
                          )}
                          {i.how && <span className="muted small">{i.how}</span>}
                          {i.missable && !i.done && (
                            <span className="small sheet-missable">
                              <AlertTriangle size={12} /> {i.missable}
                            </span>
                          )}
                          {i.auto && <span className="small status-on">{t.autoDone}</span>}
                          {i.verified === false && <span className="small guide-flag guide-unverified">{es.guide.unverified}</span>}
                        </span>
                        {i.source && Icon && (
                          <span className={`source-chip source-${i.source}`} title={t.sourceHelp[i.source]}>
                            <Icon size={12} /> {t.sources[i.source]}
                          </span>
                        )}
                        {i.taskId && (
                          <button className="ghost small-button icon-button" title={t.removeOwn} onClick={() => ctx.removeOwnItem(i.taskId!)}>
                            <Trash2 size={13} />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            <form className="add-phase sheet-add-own" onSubmit={onAddOwn}>
              <input value={own} onChange={(e) => setOwn(e.target.value)} placeholder={t.ownPlaceholder} />
              <button type="submit" className="small-button" disabled={!own.trim()}>
                <Plus size={14} /> {t.addOwn}
              </button>
            </form>
          </section>

          {collection?.farmBuild && (
            <section className="sheet-section">
              <h3>
                <Gem size={16} /> {t.farmBuild}
              </h3>
              <p className="small">{collection.farmBuild.summary}</p>
              <div className="sheet-pieces">
                {collection.farmBuild.pieces.map((p) => (
                  <div key={p.nameEn} className="sheet-piece">
                    <span className="sheet-slot">{p.slot}</span>
                    <strong>
                      {p.name} <span className="muted small">({p.nameEn})</span>
                    </strong>
                    <span className="small">{p.effect}</span>
                    <span className="muted small">{p.howToGet}</span>
                  </div>
                ))}
              </div>
              <p className="muted small">{collection.farmBuild.helpsWith}</p>
            </section>
          )}

          {collection && collection.tips.length > 0 && (
            <section className="sheet-section">
              <h3>{t.tips}</h3>
              <ul className="sheet-tips">
                {collection.tips.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </section>
          )}

          {linked.length > 0 && (
            <section className="sheet-section">
              <h3>{t.fromGuide}</h3>
              <ul className="sheet-guide">
                {linked.map((g) => {
                  const Icon = GUIDE_ICONS[g.kind];
                  return (
                    <li key={g.id}>
                      <Icon size={16} />
                      <span>
                        <strong>{g.title}</strong>
                        {g.summary && <span className="muted small">{g.summary}</span>}
                        {!g.verified && <span className="small guide-flag guide-unverified">{es.guide.unverified}</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {collection && collection.sources.length > 0 && (
            <section className="sheet-section sheet-sources">
              <span className="muted small">{t.sourcesTitle}</span>
              {collection.sources.map((s) => (
                <button key={s.url} className="ghost small-button" onClick={() => openUrl(s.url)}>
                  <ExternalLink size={13} /> {s.label}
                </button>
              ))}
            </section>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
