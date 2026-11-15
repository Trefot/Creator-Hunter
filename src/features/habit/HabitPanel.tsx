import { useEffect, useState } from "react";
import { CalendarCheck, Check, Coffee, Play, ExternalLink, LucideIcon, Plus, Radio, RotateCcw, Scissors, Settings2, Video, X } from "lucide-react";
import { Adaptation, listAllAdaptations, listInProduction, markScheduled, publishAdaptation } from "../../db/adaptations";
import { recentUploads } from "../../db/youtube";
import { matchUploads, Upload } from "./autoMatch";
import { notifyHabitChanged } from "./HabitLayer";
import { listProjects, Project } from "../../db/projects";
import { completeSession, getRoutine, listSessions, planSession, removeSession, reopenSession, setRoutineDay, WorkSession } from "../../db/workPlan";
import { es } from "../../i18n/es";
import { todayIso } from "../../i18n/format";
import { addDays } from "../calendar/week";
import { BUFFER_GOAL, bufferStatus, candidates, isPlanned, weekdayIndex, WORK_KINDS, WorkKind, weekProgress } from "./plan";
import "./habit.css";

const t = es.habit;
const DISMISSED = "nexus-habit-dismissed";

function readDismissed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISSED) ?? "[]"));
  } catch {
    return new Set();
  }
}

// Las subidas se piden como mucho cada 10 minutos (3 unidades de cuota por consulta).
let uploadsCache: { at: number; list: Upload[] } | null = null;
async function cachedUploads(): Promise<Upload[]> {
  if (uploadsCache && Date.now() - uploadsCache.at < 600_000) return uploadsCache.list;
  const list = await recentUploads();
  uploadsCache = { at: Date.now(), list };
  return list;
}
const ICONS: Record<WorkKind, LucideIcon> = { record: Video, edit: Scissors, schedule: CalendarCheck, stream: Radio, rest: Coffee };
const dayName = new Intl.DateTimeFormat(es.locale, { weekday: "short" });
const longDay = new Intl.DateTimeFormat(es.locale, { weekday: "long", day: "numeric", month: "long" });

function asDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

interface Props {
  onOpenProject: (projectId: string) => void;
  onNavigate: (section: "live" | "ideas" | "projects") => void;
}

/** «Hoy toca», la semana y el medidor del colchón en Inicio (D-032). */
export function HabitPanel({ onOpenProject, onNavigate }: Props) {
  const today = todayIso();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const [routine, setRoutine] = useState<WorkKind[] | null>(null);
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [weekSessions, setWeekSessions] = useState<WorkSession[]>([]);
  const [versions, setVersions] = useState<Adaptation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState(today);
  const [choice, setChoice] = useState("");
  const [editingRoutine, setEditingRoutine] = useState(false);
  const [error, setError] = useState("");
  const [allVersions, setAllVersions] = useState<Adaptation[]>([]);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [dismissed, setDismissed] = useState(readDismissed);

  // La semana del progreso es de lunes a domingo.
  const monday = addDays(today, -weekdayIndex(today));
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  async function refresh() {
    try {
      const [r, s, w, v, p] = await Promise.all([
        getRoutine(),
        listSessions(today, days[6]),
        listSessions(monday, weekDays[6]),
        listInProduction(),
        listProjects(),
      ]);
      setRoutine(r);
      setSessions(s);
      setWeekSessions(w);
      setVersions(v);
      setProjects(p);
      setAllVersions(await listAllAdaptations());
    } catch (err) {
      setError(`${t.error} ${err}`);
    }
  }

  useEffect(() => {
    refresh();
    // Sin YouTube conectado simplemente no hay sugerencias.
    cachedUploads().then(setUploads).catch(() => {});
    const onChange = () => refresh();
    window.addEventListener("habit-changed", onChange);
    return () => window.removeEventListener("habit-changed", onChange);
  }, []);

  async function run(action: () => Promise<void>) {
    setError("");
    try {
      await action();
    } catch (err) {
      setError(`${t.error} ${err}`);
    }
    await refresh();
  }

  if (!routine) return null;

  const kind = routine[weekdayIndex(selected)];
  const Icon = ICONS[kind];
  const daySessions = sessions.filter((s) => s.day === selected);
  const options = isPlanned(kind)
    ? candidates(kind, projects, versions).filter((c) => !daySessions.some((s) => s.project_id === c.projectId))
    : [];
  const buffer = bufferStatus(versions);
  const week = weekProgress(routine, weekSessions, weekDays);
  const isToday = selected === today;
  const matches = matchUploads(uploads, allVersions, dismissed);

  function dismiss(key: string) {
    const next = new Set(dismissed).add(key);
    setDismissed(next);
    try {
      localStorage.setItem(DISMISSED, JSON.stringify([...next]));
    } catch {
      /* solo se pierde el descarte al reiniciar */
    }
  }

  function add() {
    const pick = options.find((o) => `${o.projectId}|${o.adaptationId ?? ""}` === choice) ?? options[0];
    if (!pick || !isPlanned(kind)) return;
    setChoice("");
    run(() => planSession(selected, kind, pick.projectId, pick.adaptationId));
  }

  return (
    <section className="habit-panel" aria-label={t.title}>
      <header className="habit-head">
        <div className="habit-today">
          <span className={`habit-icon habit-${kind}`}><Icon size={26} /></span>
          <div>
            <span className="studio-eyebrow">{isToday ? t.today : longDay.format(asDate(selected))}</span>
            <h2>{t.kinds[kind]}</h2>
            <p className="muted small">{t.kindHints[kind]}</p>
          </div>
        </div>
        <div className="habit-week-score">
          <strong>{t.weekScore(week.done, week.planned)}</strong>
          <button className="ghost" onClick={() => setEditingRoutine(!editingRoutine)}><Settings2 size={15} />{t.routine}</button>
        </div>
      </header>

      {editingRoutine && (
        <div className="habit-routine">
          <p className="muted small">{t.routineHint}</p>
          <div className="habit-routine-grid">
            {weekDays.map((d, i) => (
              <label key={d}>
                <span>{dayName.format(asDate(d))}</span>
                <select value={routine[i]} onChange={(e) => run(() => setRoutineDay(i, e.target.value as WorkKind))}>
                  {WORK_KINDS.map((k) => <option key={k} value={k}>{t.kinds[k]}</option>)}
                </select>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="habit-strip" role="tablist">
        {days.map((d) => {
          const k = routine[weekdayIndex(d)];
          const DayIcon = ICONS[k];
          const items = sessions.filter((s) => s.day === d);
          const done = items.length > 0 && items.every((s) => s.done_at);
          return (
            <button key={d} role="tab" aria-selected={d === selected} className={`habit-day${d === selected ? " on" : ""}${done ? " done" : ""}`} onClick={() => setSelected(d)}>
              <span className="habit-day-name">{d === today ? t.todayShort : dayName.format(asDate(d))}</span>
              <DayIcon size={16} />
              <span className="habit-day-count">{done ? <Check size={13} /> : isPlanned(k) ? items.length || "·" : ""}</span>
            </button>
          );
        })}
      </div>

      {error && <p className="error">{error}</p>}

      {isPlanned(kind) ? (
        <div className="habit-work">
          {daySessions.length === 0 && <p className="muted">{isToday ? t.nothingToday : t.nothingDay}</p>}
          <ul className="habit-sessions">
            {daySessions.map((s) => (
              <li key={s.id} className={s.done_at ? "done" : ""}>
                <span className="habit-session-title">{s.adaptation_title && s.adaptation_title !== s.project_title ? `${s.project_title} · ${s.adaptation_title}` : s.project_title}</span>
                <div className="tools-actions">
                  <button className="ghost" onClick={() => onOpenProject(s.project_id)}><ExternalLink size={15} />{t.open}</button>
                  {s.done_at ? (
                    <button className="ghost" onClick={() => run(() => reopenSession(s.id))}><RotateCcw size={15} />{t.reopen}</button>
                  ) : (
                    <button onClick={() => run(() => completeSession(s, versions.find((v) => v.id === s.adaptation_id)))}><Check size={15} />{t.done}</button>
                  )}
                  <button className="ghost icon-button" title={t.remove} onClick={() => run(() => removeSession(s.id))}><X size={15} /></button>
                </div>
              </li>
            ))}
          </ul>
          {options.length > 0 ? (
            <div className="habit-pick">
              <select value={choice} onChange={(e) => setChoice(e.target.value)}>
                {options.map((o) => <option key={`${o.projectId}|${o.adaptationId ?? ""}`} value={`${o.projectId}|${o.adaptationId ?? ""}`}>{o.early ? `${o.label} ${t.early[kind]}` : o.label}</option>)}
              </select>
              <button onClick={add}><Plus size={15} />{t.add}</button>
            </div>
          ) : daySessions.length > 0 ? null : (
            <p className="muted small">
              {t.noCandidates[kind]} <button className="link-button" onClick={() => onNavigate(kind === "record" ? "ideas" : "projects")}>{kind === "record" ? t.goIdeas : t.goProjects}</button>
            </p>
          )}
        </div>
      ) : kind === "stream" ? (
        <div className="habit-work"><button onClick={() => onNavigate("live")}><Radio size={15} />{t.goLive}</button></div>
      ) : null}

      {matches.length > 0 && (
        <div className="habit-detected">
          <span className="studio-eyebrow"><Play size={14} />{t.detected}</span>
          {matches.map((m) => (
            <div key={m.upload.id} className="habit-detected-row">
              <span className="small">{m.action === "publish" ? t.detectedPublish(m.upload.title, m.version.title) : t.detectedSchedule(m.upload.title, m.version.title)}</span>
              <div className="tools-actions">
                <button onClick={() => run(async () => {
                  if (m.action === "publish") await publishAdaptation(m.version.id, m.at, m.url);
                  else await markScheduled(m.version.id, m.at, m.url);
                  notifyHabitChanged();
                })}><Check size={15} />{m.action === "publish" ? t.detectedYesPublish : t.detectedYesSchedule}</button>
                <button className="ghost" onClick={() => dismiss(`${m.upload.id}:${m.version.id}`)}>{t.detectedNo}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={`habit-buffer level-${buffer.level}`}>
        <div className="habit-buffer-head">
          <strong>{t.buffer}</strong>
          <span className="small">{t.bufferLevel[buffer.level]}</span>
        </div>
        <Meter label={t.longs} value={buffer.long} goal={BUFFER_GOAL.long} />
        <Meter label={t.shorts} value={buffer.short} goal={BUFFER_GOAL.short} />
      </div>
    </section>
  );
}

function Meter({ label, value, goal }: { label: string; value: number; goal: number }) {
  return (
    <div className="habit-meter">
      <span>{label}</span>
      <div className="habit-meter-bar"><span style={{ width: `${Math.min(100, (value / goal) * 100)}%` }} /></div>
      <span className="small">{value}/{goal}</span>
    </div>
  );
}
