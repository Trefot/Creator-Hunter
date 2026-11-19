import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import { Clapperboard, Copy, ExternalLink, FolderOpen } from "lucide-react";
import { AudioPicker } from "./MediaTools";

interface Saved { path: string; title: string; start: number; end: number; description: string; warning: string | null }

/** «1:02:03», «62:03» o «75» → segundos. */
export function parseClock(text: string): number | null {
  const parts = text.trim().split(":").map(p => p.trim());
  if (!parts.length || parts.length > 3 || parts.some(p => !/^\d+$/.test(p))) return null;
  return parts.reduce((total, p) => total * 60 + Number(p), 0);
}

export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}

function Frame({ sessionId, at }: { sessionId: string; at: number | null }) {
  const [src, setSrc] = useState(""), [error, setError] = useState("");
  useEffect(() => {
    if (at === null) return;
    let stopped = false;
    const timer = setTimeout(() => {
      invoke<string>("episode_frame", { sessionId, at })
        .then(s => { if (!stopped) { setSrc(s); setError(""); } })
        .catch(e => { if (!stopped) setError(String(e)); });
    }, 400);
    return () => { stopped = true; clearTimeout(timer); };
  }, [sessionId, at]);
  if (error) return <p className="error small">{error}</p>;
  return src ? <img src={src} alt="" style={{ width: "100%", maxWidth: 320, borderRadius: 8, display: "block" }} /> : <p className="muted small">Cargando imagen…</p>;
}

/** Episodio para YouTube desde la grabación de un directo (D-036). Nexus no sube nada por ti. */
export function EpisodeMaker({ sessionId, game, marks, onClose }: { sessionId: string; game: string | null; marks: number; onClose: () => void }) {
  const [duration, setDuration] = useState<number | null>(null);
  const [startText, setStartText] = useState("0:00"), [endText, setEndText] = useState("");
  const [audio, setAudio] = useState<number[] | undefined>(undefined);
  const [title, setTitle] = useState(game ? `${game} · Episodio ` : "");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [saved, setSaved] = useState<Saved | null>(null), [copied, setCopied] = useState(false);

  useEffect(() => {
    invoke<{ duration: string | null }>("media_inspect", { kind: "recording", id: sessionId })
      .then(d => { const n = Number(d.duration); if (n > 0) { setDuration(n); setEndText(clock(n)); } })
      .catch(e => setError(String(e)));
    invoke<Saved | null>("episode_saved", { sessionId }).then(s => s && setSaved(s)).catch(() => undefined);
  }, [sessionId]);

  const start = parseClock(startText), end = parseClock(endText);
  const length = start !== null && end !== null ? end - start : null;
  const rangeError = start === null || end === null ? "Escribe los tiempos como 1:02:03 o 12:30."
    : duration !== null && end > duration + 1 ? `La grabación dura ${clock(duration)}.`
    : length !== null && length < 60 ? "El episodio debe durar al menos 1 minuto." : "";

  async function render() {
    setBusy(true); setError("");
    try { setSaved(await invoke<Saved>("episode_render", { sessionId, title, start, end, audio })); }
    catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="short-maker">
      <h3 style={{ display: "flex", gap: 8, alignItems: "center", margin: 0 }}><Clapperboard size={17} />Episodio para YouTube</h3>
      <p className="muted small">Corta la espera del principio y la despedida, deja fuera la música y Nexus prepara el vídeo y su descripción. Los Shorts salen de tus marcas, en Crear contenido → Capturas{marks ? ` (${marks} en esta grabación)` : ""}.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <label>1. Empieza en
          <input value={startText} onChange={e => setStartText(e.target.value)} aria-label="Inicio del episodio" />
          <Frame sessionId={sessionId} at={start} />
        </label>
        <label>2. Termina en
          <input value={endText} onChange={e => setEndText(e.target.value)} aria-label="Final del episodio" />
          <Frame sessionId={sessionId} at={end !== null ? Math.max(0, end - 1) : null} />
        </label>
      </div>
      {rangeError ? <p className="tools-warn small">{rangeError}</p> : length !== null && <p className="muted small">El episodio durará {clock(length)}.</p>}

      <AudioPicker kind="recording" id={sessionId} value={audio} onChange={setAudio} label="3. Audio del episodio" />
      <p className="tools-warn small">Desmarca la pista donde va la música (Spotify o la radio del juego): es lo que más reclamaciones de copyright da en YouTube. Si todo va en una sola pista, la música se quedará dentro.</p>

      <label>4. Título
        <input value={title} onChange={e => setTitle(e.target.value)} maxLength={100} aria-label="Título del episodio" />
      </label>

      <div className="tools-actions">
        <button disabled={busy || !!rangeError || !title.trim() || audio === undefined} onClick={() => void render()}>
          {busy ? "Creando · consulta Procesamiento local" : "Crear episodio"}
        </button>
        <button className="ghost" onClick={onClose}>Cerrar</button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}

      {saved && (
        <div className="short-maker">
          <strong>Listo: {saved.title} ({clock(saved.end - saved.start)})</strong>
          {saved.warning && <p className="tools-warn small">{saved.warning}</p>}
          <textarea readOnly rows={Math.min(12, saved.description.split("\n").length + 1)} value={saved.description} style={{ width: "100%", boxSizing: "border-box" }} aria-label="Descripción para YouTube" />
          <div className="tools-actions">
            <button className="ghost" onClick={() => void copy(saved.description)}><Copy size={15} />{copied ? "Copiada" : "Copiar descripción"}</button>
            <button className="ghost" onClick={() => void revealItemInDir(saved.path)}><FolderOpen size={15} />Mostrar vídeo</button>
            <button onClick={() => void openUrl("https://www.youtube.com/upload").catch(e => setError(String(e)))}><ExternalLink size={15} />Subir en YouTube Studio</button>
          </div>
          <p className="muted small">Arrastra el vídeo a YouTube Studio, pega la descripción y prográmalo. YouTube revisa el copyright al subir: si aparece una reclamación, se ve antes de publicar.</p>
        </div>
      )}
    </div>
  );
}
