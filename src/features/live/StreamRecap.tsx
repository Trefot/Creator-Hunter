import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { ChevronDown, Clapperboard, Clock, Flag, Gamepad2, Heart, Send, Sparkles, Trophy, Users, X } from "lucide-react";
import {
  markRecapSeen,
  publishRecapToDiscord,
  recapDiscordPreview,
  recapHasContent,
  StreamRecap,
  streamRecap,
  streamRecaps,
} from "../../db/recap";
import { es } from "../../i18n/es";
import "./recap.css";

const t = es.recap;

function durationText(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")} min` : m > 0 ? `${m} min` : `${s} s`;
}

/** Cifras grandes del resumen: lo que más le importa a un streamer de un vistazo. */
function tiles(r: StreamRecap) {
  const sum = (kinds: string[], field: "count" | "sum") =>
    r.summary.totals.filter((x) => kinds.includes(x.kind)).reduce((a, x) => a + x[field], 0);
  return [
    { icon: <Users size={18} />, value: r.summary.new_people, label: t.tiles.newPeople },
    { icon: <Heart size={18} />, value: sum(["subscribe", "resub", "member"], "count") + sum(["gift_subs", "gift_members"], "sum"), label: t.tiles.subs },
    { icon: <Sparkles size={18} />, value: sum(["bits"], "sum"), label: t.tiles.bits },
    { icon: <Flag size={18} />, value: sum(["raid"], "count"), label: t.tiles.raids, extra: sum(["raid"], "sum") },
    { icon: <Send size={18} />, value: sum(["super_chat", "super_sticker"], "count"), label: t.tiles.superChats },
  ].filter((x, i) => i < 2 || x.value > 0);
}

/** La tarjeta del resumen, igual en el aviso al terminar y en el historial. */
export function RecapCard({ recap: r,onContinue }: { recap: StreamRecap;onContinue?:()=>void }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "sent" | "already">("idle");
  const [error, setError] = useState("");
  const date = new Date(r.started_at);

  async function showPreview() {
    setError("");
    try {
      const body = await recapDiscordPreview(r.id);
      setPreview(body.embeds[0]?.description ?? "");
    } catch (e) {
      setError(String(e));
    }
  }

  async function publish() {
    setState("busy");
    setError("");
    try {
      setState((await publishRecapToDiscord(r.id)) ? "sent" : "already");
    } catch (e) {
      setState("idle");
      setError(String(e));
    }
  }

  return (
    <article className="recap-card">
      <header className="recap-head">
        <div>
          <span className="nexus-eyebrow">{t.eyebrow}</span>
          <h2>{r.game ?? t.noGame}</h2>
          <p className="muted small">
            <Clock size={13} /> {date.toLocaleDateString(es.locale, { weekday: "long", day: "numeric", month: "long" })} ·{" "}
            {date.toLocaleTimeString(es.locale, { hour: "2-digit", minute: "2-digit" })} · <strong>{durationText(r.duration_ms)}</strong>
            {!r.ended_at && <span className="recap-live"> · {t.live}</span>}
          </p>
        </div>
        <Gamepad2 size={34} className="recap-head-icon" />
      </header>

      <button className="ghost small-button" onClick={()=>{onContinue?.();window.dispatchEvent(new CustomEvent("nexus-open-content",{detail:"moments"}))}}>Revisar capturas y preparar el siguiente contenido</button>
      <div className="recap-tiles">
        {tiles(r).map((x) => (
          <div key={x.label} className="recap-tile">
            <span className="recap-tile-icon">{x.icon}</span>
            <strong>{x.value.toLocaleString(es.locale)}</strong>
            <span className="small">{x.label}</span>
            {x.extra ? <span className="muted small">{t.raidViewers(x.extra)}</span> : null}
          </div>
        ))}
      </div>

      {r.summary.events === 0 && <p className="muted small">{t.noEvents}</p>}

      {r.counters.some((c) => c.delta !== 0) && (
        <section className="recap-section">
          <h3>{t.counters}</h3>
          <div className="recap-chips">
            {r.counters
              .filter((c) => c.delta !== 0)
              .map((c) => (
                <span key={c.id} className="recap-chip" style={{ ["--c" as string]: c.color }}>
                  {c.icon} {c.name} <strong>{c.delta > 0 ? `+${c.delta}` : c.delta}</strong>
                  <span className="muted small">→ {c.end.toLocaleString(es.locale)}</span>
                </span>
              ))}
          </div>
        </section>
      )}

      {r.summary.supporters.length > 0 && (
        <section className="recap-section">
          <h3>
            <Heart size={15} /> {t.thanks}
          </h3>
          <ul className="recap-supporters">
            {r.summary.supporters.map((s) => (
              <li key={`${s.platform}:${s.kind}:${s.name}`}>
                <span className={`recap-platform ${s.platform}`}>{s.platform === "twitch" ? "Twitch" : s.platform === "youtube" ? "YouTube" : "TikTok"}</span>
                <strong>{s.name}</strong>
                <span className="muted small">{t.supportLine(s.kind, s.amount, s.detail)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(r.moments.length > 0 || r.clips.length > 0) && (
        <section className="recap-section">
          <h3>
            <Clapperboard size={15} /> {t.captures(r.moments.length, r.clips.length)}
          </h3>
          <ul className="recap-list small">
            {r.clips.slice(0, 5).map((c) => (
              <li key={c.output_path}>🎬 {c.title}</li>
            ))}
            {r.moments.slice(0, 5).map((m, i) => (
              <li key={`${m.title}-${i}`}>🚩 {m.title}</li>
            ))}
          </ul>
          <p className="muted small">{t.capturesHint}</p>
        </section>
      )}

      {r.trophies.length > 0 && (
        <section className="recap-section">
          <h3>
            <Trophy size={15} /> {t.trophies(r.trophies.length)}
          </h3>
          <div className="recap-trophies">
            {r.trophies.map((x) => (
              <span key={`${x.game}-${x.name}`} className="recap-trophy" title={x.game}>
                {x.icon_url ? <img src={x.icon_url} alt="" /> : <Trophy size={16} />} {x.name}
              </span>
            ))}
          </div>
        </section>
      )}

      {r.ended_at && (
        <footer className="recap-actions">
          {state === "sent" || state === "already" ? (
            <span className="status-on small">{state === "sent" ? t.discordSent : t.discordAlready}</span>
          ) : preview === null ? (
            <button className="ghost small-button" onClick={showPreview}>
              <Send size={14} /> {t.discordPreview}
            </button>
          ) : (
            <div className="recap-discord">
              <span className="small muted">{t.discordWillSend}</span>
              <blockquote>
                <strong>{t.discordTitle}</strong>
                <br />
                {preview.split("\n").map((line, i) => (
                  <span key={i}>
                    {line.replace(/\*\*/g, "")}
                    <br />
                  </span>
                ))}
              </blockquote>
              <div className="recap-discord-buttons">
                <button className="small-button" disabled={state === "busy"} onClick={publish}>
                  <Send size={14} /> {t.discordPublish}
                </button>
                <button className="ghost small-button" onClick={() => setPreview(null)}>
                  {t.cancel}
                </button>
              </div>
            </div>
          )}
          {error && <p role="alert" className="error small">{error}</p>}
        </footer>
      )}
    </article>
  );
}

/**
 * Aviso al terminar el directo: cuando OBS deja de emitir, aparece el resumen.
 * Va en App para salir esté donde esté el usuario.
 */
export function StreamRecapLayer() {
  const [recap, setRecap] = useState<StreamRecap | null>(null);

  useEffect(() => {
    const unlisten = listen<string>("stream-recap-ready", async (e) => {
      try {
        const r = await streamRecap(e.payload);
        if (recapHasContent(r)) setRecap(r);
      } catch {
        /* el historial lo tendrá igualmente */
      }
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  if (!recap) return null;
  const close = () => {
    markRecapSeen(recap.id).catch(() => {});
    setRecap(null);
  };
  return (
    <div className="recap-backdrop" onClick={close}>
      <div className="recap-modal" role="dialog" aria-label={t.eyebrow} onClick={(e) => e.stopPropagation()}>
        <button className="ghost icon-button recap-close" onClick={close} title={t.close}>
          <X size={18} />
        </button>
        <RecapCard recap={recap} onContinue={close}/>
        <button className="recap-done" onClick={close}>
          {t.done}
        </button>
      </div>
    </div>
  );
}

/** Historial de directos en En directo → Resúmenes. */
export function RecapHistory({ active }: { active: boolean }) {
  const [list, setList] = useState<StreamRecap[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!active) return;
    streamRecaps()
      .then((items) => {
        setList(items);
        setOpen((current) => current ?? items[0]?.id ?? null);
      })
      .catch((e) => setError(String(e)));
  }, [active]);

  if (error) return <p role="alert" className="error">{error}</p>;
  if (list === null) return <p className="muted">{t.loading}</p>;
  if (list.length === 0)
    return (
      <section className="card recap-empty">
        <Clapperboard size={32} />
        <strong>{t.emptyTitle}</strong>
        <p className="muted small">{t.emptyHint}</p>
      </section>
    );
  return (
    <div className="recap-history">
      <p className="muted small">{t.historyHint}</p>
      {list.map((r) => (
        <div key={r.id} className={`card recap-row${open === r.id ? " open" : ""}`}>
          <button className="recap-row-head" onClick={() => setOpen(open === r.id ? null : r.id)}>
            <span>
              <strong>{r.game ?? t.noGame}</strong>
              <span className="muted small">
                {" "}
                · {new Date(r.started_at).toLocaleDateString(es.locale, { day: "numeric", month: "short" })} · {durationText(r.duration_ms)}
              </span>
            </span>
            <span className="small muted">{t.rowSummary(r.summary.new_people, r.summary.events, r.moments.length + r.clips.length)}</span>
            <ChevronDown size={16} className={open === r.id ? "flip" : ""} />
          </button>
          {open === r.id && <RecapCard recap={r} />}
        </div>
      ))}
    </div>
  );
}
