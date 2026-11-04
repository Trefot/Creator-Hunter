import { FormEvent, useEffect, useState } from "react";
import { CalendarCheck, CalendarPlus, Check, ChevronRight, Flag, ListTodo, PenLine, Plus, Trash2, Trophy as TrophyIcon } from "lucide-react";
import { ProgressRing } from "../../components/charts/ProgressRing";
import { Game, Trophy, TrophyPhase } from "../../db/games";
import { deleteObjective, listSessions, PlaySession, SessionObjective, setObjectiveDone, updateSessionNote } from "../../db/sessions";
import { es } from "../../i18n/es";
import { formatDate, todayIso } from "../../i18n/format";
import { useGame } from "./GameContext";
import { currentPhase } from "./RouteView";
import { ProgressLine, TodayButton } from "./TrophyParts";

const t = es.today;

interface Props {
  game: Game;
  trophies: Trophy[];
  phases: TrophyPhase[];
  /** Lleva a la lista de trofeos pendientes para elegir qué añadir. */
  onGoPending: () => void;
}

/**
 * Hoy: el plan de la partida, armado por el jugador desde los trofeos pendientes.
 * Cada trofeo del plan muestra cuánto lleva de su lista y lo siguiente que toca.
 */
export function TodayView({ game, trophies, phases, onGoPending }: Props) {
  const ctx = useGame();
  const today = todayIso();
  const [history, setHistory] = useState<PlaySession[]>([]);
  const [free, setFree] = useState("");
  const [note, setNote] = useState("");

  const session = ctx?.today ?? null;

  useEffect(() => {
    listSessions(game.id).then((list) => setHistory(list.filter((s) => s.played_on !== today && s.objectives.length > 0)));
  }, [game.id, today]);

  useEffect(() => setNote(session?.note ?? ""), [session?.id]);

  if (!ctx) return null;

  const current = currentPhase(phases, trophies);
  const phaseIndex = current ? phases.findIndex((p) => p.id === current.id) : -1;
  const phaseLeft = current ? trophies.filter((x) => x.phase_id === current.id && !x.earned_at) : [];
  const recommended = phaseLeft[0];

  const trophyOf = (o: SessionObjective) => (o.trophy_id ? trophies.find((x) => x.id === o.trophy_id) : undefined);
  const isDone = (o: SessionObjective) => {
    const trophy = trophyOf(o);
    if (!trophy) return o.done;
    const p = ctx.progress(trophy);
    return !!trophy.earned_at || o.done || (!!p && p.done === p.total);
  };
  const objectives = session?.objectives ?? [];
  const done = objectives.filter(isDone).length;

  async function onAddFree(e: FormEvent) {
    e.preventDefault();
    await ctx!.addFreeToday(free);
    setFree("");
  }

  return (
    <div className="route">
      {/* Cabecera: dónde estás en la ruta y cómo va el día */}
      <section className="today-hero" style={game.cover ? { ["--today-art" as string]: `url("${game.cover}")` } : undefined}>
        <div className="today-hero-info">
          <span className="today-eyebrow">
            <CalendarCheck size={14} /> {t.todayTitle(formatDate(today))}
          </span>
          {current ? (
            <>
              <span className="small today-phase-of">
                {t.phaseLabel} · {t.phaseOf(phaseIndex + 1, phases.length)}
              </span>
              <h2>{current.name}</h2>
              <span className="small">{t.phaseLeft(phaseLeft.length)}</span>
            </>
          ) : (
            <h2>{t.noPhase}</h2>
          )}
          <div className="today-phases" aria-hidden>
            {phases.map((p, i) => (
              <span key={p.id} className={i < phaseIndex || phaseIndex === -1 ? "done" : i === phaseIndex ? "now" : ""} title={p.name} />
            ))}
          </div>
        </div>
        {objectives.length > 0 && <ProgressRing ratio={done / objectives.length} size={96} label={t.progress(done, objectives.length)} />}
      </section>

      {/* Recomendación: lo que toca según la ruta, para añadirlo con un clic */}
      {recommended && !ctx.inToday(recommended) && (
        <div className="today-main" onClick={() => ctx.openTrophy(recommended)} role="button" tabIndex={0}>
          {recommended.icon_url ? <img src={recommended.icon_url} alt="" /> : <Flag size={40} />}
          <span className="today-main-text">
            <span className="today-eyebrow">
              <Flag size={13} /> {t.recommended}
            </span>
            <strong>{recommended.name}</strong>
            {recommended.note && <span className="small">{recommended.note}</span>}
          </span>
          <TodayButton trophy={recommended} big />
        </div>
      )}

      <section className="card today-plan">
        <div className="today-head">
          <h2>
            <ListTodo size={18} /> {t.planHeading}
          </h2>
          {objectives.length > 0 && <span className="chip-count small">{t.progress(done, objectives.length)}</span>}
        </div>

        {objectives.length === 0 ? (
          <div className="today-empty">
            <CalendarPlus size={36} />
            <strong>{t.emptyTitle}</strong>
            <ol className="today-howto small">
              <li>{t.emptyStep1}</li>
              <li>{t.emptyStep2}</li>
              <li>{t.emptyStep3}</li>
            </ol>
            <button onClick={onGoPending}>
              <TrophyIcon size={16} /> {t.goPending}
            </button>
          </div>
        ) : (
          <div className="today-plan-list">
            {objectives.map((o) => {
              const trophy = trophyOf(o);
              const finished = isDone(o);
              if (!trophy) {
                return (
                  <div key={o.id} className={`today-free${finished ? " today-done" : ""}`}>
                    <button
                      className={`today-check${finished ? " checked" : ""}`}
                      onClick={async () => {
                        await setObjectiveDone(o.id, !o.done);
                        await ctx.reloadToday();
                      }}
                    >
                      {finished && <Check size={14} />}
                    </button>
                    <PenLine size={14} className="muted" />
                    <span className="today-title">{o.title}</span>
                    <button
                      className="ghost small-button icon-button"
                      title={t.remove}
                      onClick={async () => {
                        await deleteObjective(o.id);
                        await ctx.reloadToday();
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              }
              const p = ctx.progress(trophy);
              return (
                <div key={o.id} className={`plan-card${finished ? " today-done" : ""}`} onClick={() => ctx.openTrophy(trophy)} role="button" tabIndex={0}>
                  {trophy.icon_url ? <img className="plan-icon" src={trophy.icon_url} alt="" /> : <span className="plan-icon" />}
                  <span className="plan-main">
                    <span className="plan-title">
                      <strong className="today-title">{trophy.name}</strong>
                      <span className={`trophy-badge trophy-${trophy.type}`}>{es.games.types[trophy.type]}</span>
                      {trophy.earned_at && <span className="status-on small">{t.autoDone}</span>}
                    </span>
                    {p ? (
                      <ProgressLine progress={p} onOpen={() => ctx.openTrophy(trophy)} />
                    ) : (
                      <span className="small muted">{trophy.note ?? trophy.detail}</span>
                    )}
                  </span>
                  <span className="plan-side">
                    <span className="link-button small">
                      {t.openSheet} <ChevronRight size={12} />
                    </span>
                    <button
                      className="ghost small-button icon-button"
                      title={t.remove}
                      onClick={(e) => {
                        e.stopPropagation();
                        ctx.toggleToday(trophy);
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </span>
                </div>
              );
            })}
            <button className="ghost small-button today-more" onClick={onGoPending}>
              <Plus size={14} /> {t.addMore}
            </button>
          </div>
        )}

        <form className="add-phase" onSubmit={onAddFree}>
          <input value={free} onChange={(e) => setFree(e.target.value)} placeholder={t.customPlaceholder} />
          <button type="submit" className="small-button" disabled={!free.trim()}>
            <Plus size={14} /> {t.add}
          </button>
        </form>

        {session && (
          <label className="today-note">
            <span className="small muted">{t.note}</span>
            <textarea
              rows={3}
              value={note}
              placeholder={t.notePlaceholder}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => note !== (session.note ?? "") && updateSessionNote(session.id, note).then(ctx.reloadToday)}
            />
          </label>
        )}
      </section>

      {history.length > 0 && (
        <section className="phase">
          <h3>{t.history}</h3>
          <ul className="today-history">
            {history.map((s) => (
              <li key={s.id}>
                <details>
                  <summary>
                    <strong>{formatDate(s.played_on)}</strong> · <span className="muted small">{t.progress(s.objectives.filter(isDone).length, s.objectives.length)}</span>
                  </summary>
                  <ul className="now-list">
                    {s.objectives.map((o) => (
                      <li key={o.id} className="small">
                        {isDone(o) ? "✓" : "·"} {o.title}
                      </li>
                    ))}
                  </ul>
                  {s.note && <p className="muted small">{s.note}</p>}
                </details>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
