import { PageTitle } from "../../components/PageTitle";
import { PlatformBadge } from "../../components/PlatformBadge";
import { useEffect, useState } from "react";
import { Adaptation, listScheduledBetween, listUnscheduled } from "../../db/adaptations";
import { listProfiles, Profile } from "../../db/profiles";
import { es } from "../../i18n/es";
import { formatDate, todayIso } from "../../i18n/format";
import { currentStep } from "../projects/status";
import { addDays, mondayOf, weekDays } from "./week";

const t = es.calendar;
const tp = es.projects;

const dayHeader = new Intl.DateTimeFormat(es.locale, { weekday: "short", day: "numeric" });

function dayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return dayHeader.format(new Date(y, m - 1, d));
}

interface Props {
  onOpenProject: (projectId: string) => void;
}

export function CalendarPage({ onOpenProject }: Props) {
  const today = todayIso();
  const [monday, setMonday] = useState(mondayOf(today));
  const [items, setItems] = useState<Adaptation[] | null>(null);
  const [unscheduled, setUnscheduled] = useState<Adaptation[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    setItems(null);
    Promise.all([listScheduledBetween(monday, addDays(monday, 7)), listUnscheduled(), listProfiles()])
      .then(([week, pending, p]) => {
        setItems(week);
        setUnscheduled(pending);
        setProfiles(p);
      })
      .catch((err) => setError(String(err)));
  }, [monday]);

  const days = weekDays(monday);

  function Item({ a, showTime }: { a: Adaptation; showTime: boolean }) {
    const profile = profiles.find((p) => p.id === a.profile_id);
    const step = currentStep(a);
    const published = a.published_at !== null || step === null;
    return (
      <button className={`cal-item${published ? " cal-item-done" : ""}`} onClick={() => onOpenProject(a.project_id)}>
        {a.thumbnail && <img className="cal-thumb" src={a.thumbnail} alt="" />}
        <span className="cal-item-top">
          {showTime && a.scheduled_at && <strong>{a.scheduled_at.slice(11, 16)}</strong>}
          {profile && (
            <PlatformBadge platform={profile.platform} />
          )}
        </span>
        <span className="cal-item-title">{a.title}</span>
        <span className="muted small">
          {tp.formats[a.format]} · {published ? t.published : tp.stepNames[step!.step]}
        </span>
      </button>
    );
  }

  return (
    <section className="page page-wide">
      <header className="page-header">
        <PageTitle section="calendar" subtitle={t.subtitle} />
        <div className="profile-actions">
          <button className="ghost" onClick={() => setMonday(addDays(monday, -7))}>
            {t.previous}
          </button>
          <button className="ghost" onClick={() => setMonday(mondayOf(today))}>
            {t.today}
          </button>
          <button className="ghost" onClick={() => setMonday(addDays(monday, 7))}>
            {t.next}
          </button>
        </div>
      </header>

      <p className="muted small">
        {t.week(formatDate(days[0]), formatDate(days[6]))}
        {items && ` · ${t.scheduledCount(items.length)}`}
      </p>

      {error && <p className="error">{error}</p>}

      {items === null ? (
        <p className="muted">{t.loading}</p>
      ) : (
        <div className="week-grid">
          {days.map((day) => {
            const dayItems = items.filter((a) => a.scheduled_at?.startsWith(day));
            return (
              <div key={day} className={`day-column${day === today ? " day-today" : ""}`}>
                <div className="day-header">{dayLabel(day)}</div>
                {dayItems.length === 0 ? (
                  <span className="muted small day-empty">{t.nothing}</span>
                ) : (
                  dayItems.map((a) => <Item key={a.id} a={a} showTime />)
                )}
              </div>
            );
          })}
        </div>
      )}

      {unscheduled.length > 0 && (
        <div className="unscheduled">
          <h2>{t.unscheduled}</h2>
          <p className="muted small">{t.unscheduledHint}</p>
          <div className="unscheduled-list">
            {unscheduled.map((a) => (
              <Item key={a.id} a={a} showTime={false} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
