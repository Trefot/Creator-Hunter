import { PageTitle } from "../../components/PageTitle";
import { PlatformBadge } from "../../components/PlatformBadge";
import { useEffect, useState } from "react";
import { Adaptation, listScheduledBetween, listUnscheduled, listAllAdaptations, markScheduled } from "../../db/adaptations";
import { listProfiles, Profile } from "../../db/profiles";
import { es } from "../../i18n/es";
import { formatDate, todayIso } from "../../i18n/format";
import { currentStep } from "../projects/status";
import { addDays, mondayOf, weekDays } from "./week";
import { CalendarPost, postsBetween } from "../../db/contentPerformance";
import { openUrl } from "@tauri-apps/plugin-opener";

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
  const [overdue,setOverdue]=useState<Adaptation[]>([]),[revision,setRevision]=useState(0);
  const [error, setError] = useState("");
  const [posts, setPosts] = useState<CalendarPost[]>([]);

  useEffect(() => {
    setItems(null);
    Promise.all([listScheduledBetween(monday, addDays(monday, 7)), listUnscheduled(), listProfiles(),listAllAdaptations()])
      .then(([week, pending, p,all]) => {
        setOverdue(all.filter(a=>!a.published_at&&a.scheduled_at&&a.scheduled_at.slice(0,10)<today));
        setItems(week);
        setUnscheduled(pending);
        setProfiles(p);
      })
      .catch((err) => setError(String(err)));
    // Lo que ya salió en tus redes (directos, vídeos, Shorts) aparece solo en su día, en hora local.
    const from = new Date(addDays(monday, -1) + "T00:00:00").toISOString(), to = new Date(addDays(monday, 8) + "T00:00:00").toISOString();
    postsBetween(from, to).then(setPosts).catch((err) => setError(String(err)));
  }, [monday,revision]);

  const days = weekDays(monday);
  const localDay = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const localTime = (iso: string) => new Date(iso).toLocaleTimeString(es.locale, { hour: "2-digit", minute: "2-digit" });
  const formatNames: Record<string, string> = { live: "Directo", video: "Vídeo", short: "Short", reel: "Reel", post: "Publicación", clip: "Clip" };
  const plannedUrls = new Set((items ?? []).map((a) => a.published_url).filter(Boolean));

  function Item({ a, showTime }: { a: Adaptation; showTime: boolean }) {
    const profile = profiles.find((p) => p.id === a.profile_id);
    const step = currentStep(a);
    const published = a.published_at !== null;
    return (
      <button draggable onDragStart={e=>e.dataTransfer.setData("text/plain",a.id)} className={`cal-item${published ? " cal-item-done" : ""}`} onClick={() => onOpenProject(a.project_id)}>
        {a.thumbnail && <img className="cal-thumb" src={a.thumbnail} alt="" />}
        <span className="cal-item-top">
          {showTime && a.scheduled_at && <strong>{a.scheduled_at.slice(11, 16)}</strong>}
          {profile && (
            <PlatformBadge platform={profile.platform} />
          )}
        </span>
        <span className="cal-item-title">{a.title}</span>
        <span className="muted small">
          {tp.formats[a.format]} · {published ? t.published : (step ? tp.stepNames[step.step] : "Listo para publicar")}
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

      <p className="small muted">Fechas en la hora local de este equipo. Planificar aquí no sube ni publica contenido en las redes. Arrastra una pieza a otro día o abre su proyecto para cambiar la hora.</p>
      {!!overdue.length&&<details className="card" open><summary>{overdue.length} publicaciones pendientes de reprogramar</summary>{overdue.map(a=><div key={a.id} className="tools-actions"><button className="ghost" onClick={()=>onOpenProject(a.project_id)}>{a.title}</button><button className="ghost small-button" onClick={()=>void markScheduled(a.id,today+'T18:00',a.published_url).then(()=>setRevision(v=>v+1)).catch(e=>setError(String(e)))}>Mover a hoy, 18:00</button></div>)}</details>}
      {error && <p className="error">{error}</p>}

      {items === null ? (
        <p className="muted">{t.loading}</p>
      ) : (
        <div className="week-grid">
          {days.map((day) => {
            const dayItems = items.filter((a) => a.scheduled_at?.startsWith(day));
            return (
              <div key={day} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData("text/plain"),a=items.find(a=>a.id===id);if(a&&!a.published_at)void markScheduled(a.id,day+"T"+(a.scheduled_at?.slice(11,16)??"18:00"),a.published_url).then(()=>setRevision(v=>v+1)).catch(e=>setError(String(e)))}} className={`day-column${day === today ? " day-today" : ""}`}>
                <div className="day-header">{dayLabel(day)}</div>
                {posts.filter((p) => localDay(p.published_at) === day && !plannedUrls.has(p.url)).map((p) => (
                  <button key={p.id} className="cal-item cal-item-done" title="Publicado en tus redes" onClick={() => void openUrl(p.url).catch((e) => setError(String(e)))}>
                    {p.thumbnail && <img className="cal-thumb" src={p.thumbnail} alt="" />}
                    <span className="cal-item-top"><strong>{localTime(p.published_at)}</strong><PlatformBadge platform={p.platform as Profile["platform"]} /></span>
                    <span className="cal-item-title">{p.title}</span>
                    <span className="muted small">{formatNames[p.format] ?? "Publicado"} · publicado</span>
                  </button>
                ))}
                {dayItems.length === 0 && !posts.some((p) => localDay(p.published_at) === day && !plannedUrls.has(p.url)) ? (
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
