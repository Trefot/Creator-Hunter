import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CheckCircle2, Circle, AlertTriangle, Radio, Flag, Clapperboard, ListChecks } from "lucide-react";
import type { Section } from "../../sections";

interface Obs { enabled: boolean; connected: boolean; streaming: boolean; recording: boolean; replay_active: boolean; stream_ms: number | null; error: string | null }
interface Social { settings: Record<string, boolean> | null; platforms: Record<string, { connected: boolean; message: string }> | null }
interface Music { spotify_connected?: boolean; reward?: { id?: string } | null }
interface Alerts { diagnostics?: { platform: string; viewer_seen_ms: number }[] }
interface Recap { id: string; started_at: string; ended_at: string | null; seen: boolean; moments: unknown[] }
type Go = (s: Section, tab?: string) => void;
type Tone = "ok" | "warn" | "todo";

function clock(ms: number) { const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h} h ${m} min` : `${m} min`; }

/** «Hoy»: un solo sitio que lleva de la mano antes, durante y después del directo (fase 2). */
export function TodayAssistant({ onNavigate }: { onNavigate: Go }) {
  const [obs, setObs] = useState<Obs | null>(null), [social, setSocial] = useState<Social | null>(null), [music, setMusic] = useState<Music | null>(null);
  const [alerts, setAlerts] = useState<Alerts | null>(null), [recap, setRecap] = useState<Recap | null>(null), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false);

  useEffect(() => {
    let stop = false, timer: ReturnType<typeof setTimeout>;
    async function load() {
      const [o, s, m, a, r] = await Promise.all([
        invoke<Obs>("obs_status").catch(() => null), invoke<Social>("social_status").catch(() => null), invoke<Music>("music_status").catch(() => null),
        invoke<Alerts>("alerts_status").catch(() => null), invoke<Recap[]>("stream_recaps").catch(() => []),
      ]);
      if (stop) return;
      setObs(o); setSocial(s); setMusic(m); setAlerts(a); setRecap(r[0] ?? null);
      timer = setTimeout(load, 4000);
    }
    void load();
    return () => { stop = true; clearTimeout(timer); };
  }, []);

  async function mark() {
    setBusy(true); setNotice("");
    try { await invoke("obs_mark", { title: null }); setNotice("Momento guardado. Lo verás en Momentos."); } catch (e) { setNotice(String(e)); } finally { setBusy(false); }
  }

  const live = obs?.streaming === true;
  const twitch = social?.platforms?.twitch?.connected === true, youtube = social?.platforms?.youtube?.connected === true;
  const overlay = alerts?.diagnostics?.some((d) => Date.now() - d.viewer_seen_ms < 8000) ?? false;
  const todayIso = new Date().toLocaleDateString("sv");
  const recapToday = recap && recap.ended_at && new Date(recap.ended_at).toLocaleDateString("sv") === todayIso ? recap : null;

  const before: { tone: Tone; text: string; hint: string; go: () => void }[] = [
    { tone: obs?.connected ? "ok" : obs?.enabled ? "todo" : "warn", text: obs?.connected ? "OBS conectado" : "Abre OBS", hint: obs?.connected ? "Nexus ve tu emisión, grabación y momentos." : "Nexus se conecta solo en cuanto lo abras.", go: () => onNavigate("connections") },
    { tone: twitch ? "ok" : "warn", text: twitch ? "Twitch recibiendo chat y eventos" : "Twitch sin conectar", hint: twitch ? "Follows, subs, bits, raids y canjes llegan a Nexus." : "Conéctalo para alertas, chat y canjes.", go: () => onNavigate("connections") },
    { tone: youtube ? "ok" : "todo", text: youtube ? "YouTube conectado" : "YouTube sin directo activo", hint: youtube ? "Chat y suscriptores de YouTube activos." : "Se activa solo cuando emites en YouTube.", go: () => onNavigate("connections") },
    { tone: overlay ? "ok" : obs?.connected ? "warn" : "todo", text: overlay ? "Alertas listas en OBS" : "Fuente de alertas sin abrir", hint: overlay ? "La fuente «Alertas Nexus» está escuchando (alertas y voz TTS)." : "Comprueba que la fuente «Alertas Nexus» esté en la escena.", go: () => onNavigate("live", "alerts") },
    { tone: music?.spotify_connected && music?.reward?.id ? "ok" : "todo", text: music?.reward?.id ? "Pedir canción activo" : "Pedir canción sin configurar", hint: music?.reward?.id ? "Spotify debe estar sonando en tu PC para los canjes." : "Crea la recompensa en Sonido.", go: () => onNavigate("live", "sound") },
  ];
  const ready = before.filter((s) => s.tone === "ok").length;

  return (
    <section className="card today-assistant" style={{ marginBottom: 16 }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div><span className="nexus-eyebrow">HOY</span><h2 style={{ margin: "2px 0" }}>{live ? "Estás en directo" : recapToday ? "Directo terminado" : "Tu directo de hoy"}</h2>
          <p className="muted small" style={{ margin: 0 }}>{live ? `En emisión desde hace ${clock(obs?.stream_ms ?? 0)}. Lo importante, a un clic.` : recapToday ? "Cierra el día: resumen, momentos y vídeo." : `${ready} de ${before.length} listos para emitir.`}</p></div>
        {live && <span className="setup-badge ok"><Radio size={14} /> EN DIRECTO</span>}
      </header>

      {!live && !recapToday && <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0", display: "grid", gap: 6 }}>{before.map((s) => (
        <li key={s.text}><button className="ghost" style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "flex-start", width: "100%", textAlign: "left", padding: "10px 14px" }} onClick={s.go}>
          {s.tone === "ok" ? <CheckCircle2 size={18} color="#3ecf8e" /> : s.tone === "warn" ? <AlertTriangle size={18} color="#f5b14c" /> : <Circle size={18} />}
          <span><strong>{s.text}</strong><br /><span className="muted small">{s.hint}</span></span></button></li>))}</ul>}

      {live && <div className="tools-actions" style={{ marginTop: 10 }}>
        <button disabled={busy} onClick={() => void mark()}><Flag size={16} /> Marcar momento</button>
        <button className="ghost" onClick={() => onNavigate("live", "chat")}>Ver chat</button>
        <button className="ghost" onClick={() => onNavigate("live", "alerts")}>Eventos recibidos</button>
        <button className="ghost" onClick={() => onNavigate("live", "sound")}>Música y voz</button>
        {!obs?.replay_active && !obs?.recording && <p className="tools-warn small">El búfer de repetición no está activo: los momentos no tendrán vídeo. Actívalo en OBS → Ajustes → Salida.</p>}
      </div>}

      {recapToday && !live && <div className="tools-actions" style={{ marginTop: 10 }}>
        <button onClick={() => onNavigate("live", "recaps")}><ListChecks size={16} /> Ver resumen{recapToday.seen ? "" : " (nuevo)"}</button>
        <button className="ghost" onClick={() => onNavigate("projects", "moments")}>Momentos → Shorts ({recapToday.moments.length})</button>
        <button className="ghost" onClick={() => onNavigate("projects", "moments")}><Clapperboard size={16} /> Episodio para YouTube</button>
      </div>}
      {notice && <p role="status" className="small">{notice}</p>}
    </section>
  );
}
