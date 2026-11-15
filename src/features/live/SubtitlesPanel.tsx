import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { Captions, Copy, Download, ListOrdered, RefreshCw } from "lucide-react";
import { Recording, SubtitleStatus, subtitlesChapters, subtitlesGenerate, subtitlesInstall, subtitlesRecordings, subtitlesStatus } from "../../db/subtitles";
import { es } from "../../i18n/es";
import { formatDateTime } from "../../i18n/format";
import { toLocalMinute } from "../habit/autoMatch";
import "./streamTools.css";

const t = es.subtitles;

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

/** En directo → Momentos: subtítulos locales con Whisper y capítulos desde las marcas (D-034). */
export function SubtitlesPanel({ active }: { active: boolean }) {
  const [status, setStatus] = useState<SubtitleStatus | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [install, setInstall] = useState<{ stage: string; done: number; total: number } | null>(null);
  const [installing, setInstalling] = useState(false);
  const [chapters, setChapters] = useState<Record<string, { text: string; warning: string | null }>>({});
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  async function refresh() {
    try {
      const [s, r] = await Promise.all([subtitlesStatus(), subtitlesRecordings()]);
      setStatus(s);
      setRecordings(r);
    } catch (err) {
      setError(String(err));
    }
  }

  useEffect(() => {
    if (active) refresh();
  }, [active]);

  useEffect(() => {
    const a = listen<{ stage: string; done: number; total: number }>("subtitles-install", (e) => setInstall(e.payload));
    const b = listen<{ session_id: string; percent: number }>("subtitles-progress", (e) =>
      setProgress((p) => ({ ...p, [e.payload.session_id]: e.payload.percent })),
    );
    return () => {
      a.then((f) => f());
      b.then((f) => f());
    };
  }, []);

  async function doInstall() {
    setError("");
    setInstalling(true);
    try {
      await subtitlesInstall();
    } catch (err) {
      setError(String(err));
    }
    setInstalling(false);
    setInstall(null);
    await refresh();
  }

  async function showChapters(r: Recording) {
    setError("");
    try {
      const c = await subtitlesChapters(r.id);
      setChapters((all) => ({ ...all, [r.id]: c }));
    } catch (err) {
      setError(String(err));
    }
  }

  async function generate(r: Recording) {
    setError("");
    setBusy(r.id);
    setProgress((p) => ({ ...p, [r.id]: 0 }));
    try {
      await subtitlesGenerate(r.id);
    } catch (err) {
      setError(String(err));
    }
    setBusy(null);
    await refresh();
  }

  async function copy(id: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  }

  const ready = status?.whisper && status.model;
  const mb = (n: number) => Math.round(n / 1_000_000);

  return (
    <section className="card tools-panel" style={{ marginTop: 12 }}>
      <div className="tools-head">
        <div>
          <h2><Captions size={18} />{t.title}</h2>
          <p className="muted small">{t.hint}</p>
        </div>
        <button className="ghost" onClick={refresh}><RefreshCw size={15} />{t.refresh}</button>
      </div>

      {status && !status.ffmpeg && <p className="tools-warn small">{t.needFfmpeg}</p>}
      {status && !ready && (
        <div className="tools-warn">
          <span className="small">{t.installHint}</span>
          <button disabled={installing} onClick={doInstall}><Download size={15} />{installing ? t.installing : t.install}</button>
          {install && (
            <span className="small">
              {install.stage === "modelo" ? t.stageModel : t.stageProgram} · {mb(install.done)}/{mb(install.total)} MB
            </span>
          )}
        </div>
      )}
      {error && <p className="error">{error}</p>}

      {recordings.length === 0 ? (
        <p className="muted small">{t.empty}</p>
      ) : (
        <ul className="status-list">
          {recordings.map((r) => (
            <li key={r.id} className="status-item" style={{ flexDirection: "column", alignItems: "stretch" }}>
              <div className="tools-head">
                <div className="status-text">
                  <strong>{fileName(r.path)}</strong>
                  <span className="muted small">
                    {formatDateTime(toLocalMinute(r.observed_at))}{r.game ? ` · ${r.game}` : ""} · {t.marks(r.marks)}
                    {!r.exists && ` · ${t.missing}`}
                  </span>
                </div>
                <div className="tools-actions">
                  <button className="ghost" onClick={() => showChapters(r)}><ListOrdered size={15} />{t.chapters}</button>
                  {r.srt ? (
                    <button className="ghost" onClick={() => revealItemInDir(r.srt!)}>{t.showSrt}</button>
                  ) : (
                    <button disabled={!ready || !r.exists || !status?.ffmpeg || busy !== null} onClick={() => generate(r)}>
                      <Captions size={15} />{busy === r.id ? t.working(progress[r.id] ?? 0) : t.generate}
                    </button>
                  )}
                </div>
              </div>
              {chapters[r.id] && (
                <div className="short-maker">
                  {chapters[r.id].warning && <p className="tools-warn small">{chapters[r.id].warning}</p>}
                  <textarea readOnly rows={Math.min(10, chapters[r.id].text.split("\n").length + 1)} value={chapters[r.id].text} style={{ width: "100%", boxSizing: "border-box" }} />
                  <div className="tools-actions">
                    <button className="ghost" onClick={() => copy(r.id, chapters[r.id].text)}><Copy size={15} />{copied === r.id ? t.copied : t.copy}</button>
                    <span className="muted small">{t.chaptersHint}</span>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
