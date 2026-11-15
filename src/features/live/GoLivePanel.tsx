import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CheckCircle2, Circle, Rocket } from "lucide-react";
import { chatCommandsGet, streamTitleGet, streamTitleSet } from "../../db/streamTools";
import { obsStatus } from "../../db/obs";
import { Check, runChecks } from "./ConnectionsStatus";
import "./streamTools.css";

interface Broadcast {
  platinos: number;
  game: { title: string | null } | null;
  target: { title: string } | null;
}

/** Comprobaciones manuales que Nexus no puede saber solo. Se recuerdan solo durante la sesión. */
const MANUAL = ["Probé el micrófono y el audio del juego", "Tengo agua y el móvil en silencio"];

/**
 * «Empezar directo»: una lista de unos dos minutos antes de emitir. Nexus nunca empieza
 * la emisión: cuando todo está en verde, se emite desde OBS como siempre.
 */
export function GoLivePanel({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [open, setOpen] = useState(false);
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [obsReady, setObsReady] = useState<boolean | null>(null);
  const [broadcast, setBroadcast] = useState<Broadcast | null>(null);
  const [commandsOn, setCommandsOn] = useState(false);
  const [title, setTitle] = useState("");
  const [titleState, setTitleState] = useState<"idle" | "saving" | "saved" | "unavailable">("idle");
  const [manual, setManual] = useState<boolean[]>(MANUAL.map(() => false));
  const [error, setError] = useState("");

  async function load() {
    setError("");
    const [c, obs, b, cmd, current] = await Promise.all([
      runChecks(),
      obsStatus().catch(() => null),
      invoke<Broadcast>("game_broadcast_state").catch(() => null),
      chatCommandsGet().catch(() => null),
      streamTitleGet().catch(() => null),
    ]);
    setChecks(c);
    setObsReady(!!obs?.connected);
    setBroadcast(b);
    setCommandsOn(!!cmd?.config.enabled);
    if (current) setTitle((t) => t || current.title || "");
    else setTitleState("unavailable");
  }

  useEffect(() => {
    if (open) void load();
  }, [open]);

  async function applyTitle() {
    setTitleState("saving");
    setError("");
    try {
      await streamTitleSet(title);
      setTitleState("saved");
    } catch (e) {
      setTitleState("idle");
      setError(String(e));
    }
  }

  const problems = (checks ?? []).filter((c) => c.state === "error" || c.state === "warn");
  const steps = [
    { done: checks !== null && problems.length === 0, label: "Conexiones", detail: checks === null ? "Comprobando…" : problems.length ? `${problems.length} por revisar` : "Todo en orden", fix: "estado" },
    { done: !!obsReady, label: "OBS conectado", detail: obsReady ? "Listo para emitir" : "Abre OBS con WebSocket activado", fix: "obs" },
    { done: !!broadcast?.game?.title, label: "Juego y objetivo", detail: broadcast?.game?.title ? `${broadcast.game.title}${broadcast.target ? ` · objetivo: ${broadcast.target.title}` : ""}` : "Elige el juego en Juegos (o deja que se detecte)" },
    { done: titleState === "saved", label: "Título del directo", detail: titleState === "unavailable" ? "Conecta Twitch para cambiarlo desde aquí" : titleState === "saved" ? "Aplicado en Twitch" : "Escríbelo y pulsa Aplicar" },
    { done: commandsOn, label: "Comandos de chat", detail: commandsOn ? "Activos (!platino, !juego…)" : "Desactivados", fix: "commands" },
    ...MANUAL.map((label, i) => ({ done: manual[i], label, detail: "Márcalo tú", manual: i })),
  ];
  const ready = steps.filter((s) => s.done).length;

  if (!open) {
    return (
      <button className="golive-start" onClick={() => setOpen(true)}>
        <Rocket size={18} /> Empezar directo <span className="muted small">· lista de preparación de 2 minutos</span>
      </button>
    );
  }

  return (
    <section className="card tools-panel golive">
      <header className="tools-head">
        <div>
          <h2>
            <Rocket size={18} /> Empezar directo
          </h2>
          <p className="muted small">
            {ready} de {steps.length} listos. Nexus no empieza la emisión: cuando esté todo, dale a «Iniciar transmisión» en OBS.
          </p>
        </div>
        <button className="ghost small-button" onClick={() => setOpen(false)}>
          Cerrar
        </button>
      </header>
      <ol className="golive-steps">
        {steps.map((s) => (
          <li key={s.label} className={s.done ? "done" : ""}>
            {"manual" in s && s.manual !== undefined ? (
              <button className="golive-check" onClick={() => setManual((m) => m.map((v, i) => (i === s.manual ? !v : v)))} aria-label={s.label}>
                {s.done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
              </button>
            ) : (
              <span className="golive-check">{s.done ? <CheckCircle2 size={18} /> : <Circle size={18} />}</span>
            )}
            <span className="golive-text">
              <strong>{s.label}</strong>
              <span className="muted small">{s.detail}</span>
              {s.label === "Título del directo" && titleState !== "unavailable" && (
                <span className="golive-title">
                  <input value={title} maxLength={140} onChange={(e) => { setTitle(e.target.value); setTitleState("idle"); }} placeholder="Título del directo en Twitch" />
                  <button className="small-button" disabled={!title.trim() || titleState === "saving"} onClick={applyTitle}>
                    Aplicar
                  </button>
                </span>
              )}
            </span>
            {"fix" in s && s.fix && !s.done && (
              <button className="ghost small-button" onClick={() => onNavigate(s.fix!)}>
                Revisar
              </button>
            )}
          </li>
        ))}
      </ol>
      {error && <p role="alert" className="error small">{error}</p>}
      {ready === steps.length && <p className="golive-ready">✅ ¡Todo listo! Empieza a emitir en OBS. Al terminar verás el resumen del directo.</p>}
    </section>
  );
}
