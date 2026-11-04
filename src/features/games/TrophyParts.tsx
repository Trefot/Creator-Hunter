import { CalendarCheck, CalendarPlus, ChevronRight, Footprints } from "lucide-react";
import type { Trophy } from "../../db/games";
import { es } from "../../i18n/es";
import { Progress, useGame } from "./GameContext";

const t = es.sheet;

/** Botón "+ Plan de hoy" / "✓ En el plan de hoy" de un trofeo. */
export function TodayButton({ trophy, big = false }: { trophy: Trophy; big?: boolean }) {
  const ctx = useGame();
  if (!ctx || trophy.earned_at) return null;
  const on = ctx.inToday(trophy);
  return (
    <button
      className={`today-toggle${on ? " on" : ""}${big ? " big" : " small-button"}`}
      title={on ? t.removeFromToday : t.addToToday}
      onClick={(e) => {
        e.stopPropagation();
        ctx.toggleToday(trophy);
      }}
    >
      {on ? <CalendarCheck size={big ? 16 : 14} /> : <CalendarPlus size={big ? 16 : 14} />} {on ? t.inToday : t.addToToday}
    </button>
  );
}

/** Barra de progreso de la lista de un trofeo y lo siguiente que toca. */
export function ProgressLine({ progress, onOpen }: { progress: Progress; onOpen?: () => void }) {
  const ratio = progress.total ? progress.done / progress.total : 0;
  const complete = progress.done === progress.total;
  return (
    <span className="progress-line">
      <span className="progress-line-head small">
        <strong>{t.progressOf(progress.done, progress.total)}</strong>
        {!complete && <span className="muted">{t.left(progress.total - progress.done)}</span>}
      </span>
      <span className="progress">
        <span className={`progress-bar${complete ? " progress-done" : ""}`} style={{ width: `${ratio * 100}%` }} />
      </span>
      {progress.next && (
        <button
          className="next-step small"
          onClick={(e) => {
            e.stopPropagation();
            onOpen?.();
          }}
        >
          <Footprints size={13} />
          <span>
            <span className="muted">{t.next}</span> {progress.next.name}
          </span>
          {onOpen && <ChevronRight size={13} />}
        </button>
      )}
    </span>
  );
}
