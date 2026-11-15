import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Check, Video, X } from "lucide-react";
import { listInProduction } from "../../db/adaptations";
import { completeSession, listSessions, WorkSession } from "../../db/workPlan";
import { es } from "../../i18n/es";
import { todayIso } from "../../i18n/format";
import "./habit.css";

const t = es.habit;

/** Avisa a «Hoy toca» de que algo cambió (sesión hecha, vídeo publicado…). */
export function notifyHabitChanged() {
  window.dispatchEvent(new Event("habit-changed"));
}

/**
 * Al parar una grabación en OBS (D-033), pregunta cuál de las grabaciones de hoy se hizo.
 * Nunca marca nada sin un clic del usuario.
 */
export function HabitLayer() {
  const [pending, setPending] = useState<WorkSession[]>([]);

  useEffect(() => {
    const unlisten = listen<string>("obs-recording-stopped", async () => {
      try {
        const today = todayIso();
        const sessions = await listSessions(today, today);
        setPending(sessions.filter((s) => s.kind === "record" && !s.done_at));
      } catch {
        /* sin plan de hoy no hay nada que preguntar */
      }
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  if (!pending.length) return null;

  async function confirm(s: WorkSession) {
    const versions = await listInProduction();
    await completeSession(s, versions.find((v) => v.id === s.adaptation_id));
    setPending((list) => list.filter((x) => x.id !== s.id));
    notifyHabitChanged();
  }

  return (
    <div className="habit-toast" role="dialog" aria-label={t.recordedTitle}>
      <button className="ghost icon-button habit-toast-close" title={t.notNow} onClick={() => setPending([])}><X size={16} /></button>
      <span className="studio-eyebrow"><Video size={14} />{t.recordedTitle}</span>
      <p className="small">{t.recordedHint}</p>
      <ul>
        {pending.map((s) => (
          <li key={s.id}>
            <span>{s.adaptation_title && s.adaptation_title !== s.project_title ? `${s.project_title} · ${s.adaptation_title}` : s.project_title}</span>
            <button onClick={() => confirm(s)}><Check size={15} />{t.recordedYes}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
