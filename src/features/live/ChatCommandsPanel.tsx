import { useEffect, useState } from "react";
import { Eye, Plus, Save, Trash2 } from "lucide-react";
import { ChatCommand, ChatCommandsConfig, chatCommandsGet, chatCommandsPreview, chatCommandsSave, twitchScopes } from "../../db/streamTools";
import "./streamTools.css";

const VARIABLES = [
  ["{usuario}", "quien escribe el comando"],
  ["{juego}", "el juego actual"],
  ["{platinos}", "tus platinos"],
  ["{progreso}", "% de trofeos del juego actual"],
  ["{objetivo}", "el objetivo marcado del juego"],
  ["{contador:Nombre}", "el valor de un contador, p. ej. {contador:Cofres abiertos}"],
];

/** En directo → Comandos: respuestas automáticas a !platino, !juego, !redes… */
export function ChatCommandsPanel({ active }: { active: boolean }) {
  const [config, setConfig] = useState<ChatCommandsConfig | null>(null);
  const [status, setStatus] = useState<Record<string, { trigger: string; at: number; error: string | null }> | null>(null);
  const [missingWrite, setMissingWrite] = useState(false);
  const [previews, setPreviews] = useState<Record<number, string>>({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!active) return;
    chatCommandsGet()
      .then((s) => {
        setConfig(s.config);
        setStatus(s.status);
      })
      .catch((e) => setError(String(e)));
    twitchScopes()
      .then((s) => setMissingWrite(s.connected && s.missing.some((m) => m.scope === "user:write:chat")))
      .catch(() => {});
  }, [active]);

  if (!config) return <p className="muted">{error || "Cargando comandos…"}</p>;

  const update = (i: number, patch: Partial<ChatCommand>) => {
    setSaved(false);
    setConfig({ ...config, commands: config.commands.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  };

  async function save(next: ChatCommandsConfig) {
    setError("");
    try {
      setConfig(await chatCommandsSave(next));
      setSaved(true);
    } catch (e) {
      setError(String(e));
    }
  }

  async function preview(i: number) {
    try {
      const text = await chatCommandsPreview(config!.commands[i].response, "twitch");
      setPreviews((p) => ({ ...p, [i]: text }));
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <section className="card tools-panel">
      <header className="tools-head">
        <div>
          <h2>Comandos de chat</h2>
          <p className="muted small">Nexus contesta en tu chat de Twitch y YouTube cuando alguien escribe un comando. Solo con Nexus abierto.</p>
        </div>
        <label className="checkbox">
          <input type="checkbox" checked={config.enabled} onChange={(e) => save({ ...config, enabled: e.target.checked })} />
          <strong>{config.enabled ? "Activados" : "Desactivados"}</strong>
        </label>
      </header>

      {missingWrite && (
        <p className="tools-warn small">
          🟡 Twitch todavía no te dio permiso para escribir en el chat. Ve a <strong>Conexiones → Twitch</strong> y renueva los permisos una vez.
        </p>
      )}
      <p className="muted small">
        Para responder en YouTube hace falta volver a conectar YouTube una vez (Mi estudio → Cuentas), para dar permiso de chat.
      </p>

      <div className="commands-list">
        {config.commands.map((c, i) => (
          <div key={i} className={`command-row${c.enabled ? "" : " off"}`}>
            <div className="command-top">
              <input className="command-trigger" value={c.trigger} onChange={(e) => update(i, { trigger: e.target.value })} aria-label="Comando" />
              <label className="small">
                Espera
                <input type="number" min={0} max={3600} value={c.cooldown} onChange={(e) => update(i, { cooldown: Number(e.target.value) })} /> s
              </label>
              <label className="checkbox small">
                <input type="checkbox" checked={c.enabled} onChange={(e) => update(i, { enabled: e.target.checked })} /> Activo
              </label>
              <button className="ghost small-button icon-button" title="Vista previa" onClick={() => preview(i)}>
                <Eye size={14} />
              </button>
              <button
                className="ghost small-button icon-button"
                title="Quitar"
                onClick={() => {
                  setSaved(false);
                  setConfig({ ...config, commands: config.commands.filter((_, j) => j !== i) });
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
            <textarea rows={2} value={c.response} maxLength={400} onChange={(e) => update(i, { response: e.target.value })} aria-label="Respuesta" />
            {previews[i] && <p className="command-preview small">💬 {previews[i]}</p>}
            {status && Object.entries(status).filter(([, s]) => s?.trigger === c.trigger).map(([p, s]) => (
              <p key={p} className={`small ${s.error ? "error" : "muted"}`}>
                {p === "twitch" ? "Twitch" : "YouTube"}: {s.error ? s.error : `último uso ${new Date(s.at * 1000).toLocaleTimeString("es")}`}
              </p>
            ))}
          </div>
        ))}
      </div>

      <div className="tools-actions">
        <button
          className="ghost small-button"
          disabled={config.commands.length >= 30}
          onClick={() => {
            setSaved(false);
            setConfig({ ...config, commands: [...config.commands, { trigger: "!nuevo", response: "Escribe aquí la respuesta.", cooldown: 30, enabled: true }] });
          }}
        >
          <Plus size={14} /> Añadir comando
        </button>
        <button onClick={() => save(config)}>
          <Save size={14} /> Guardar
        </button>
        {saved && <span className="status-on small">Guardado ✓</span>}
      </div>
      {error && <p role="alert" className="error small">{error}</p>}

      <details className="commands-help">
        <summary className="small">Variables que puedes usar</summary>
        <ul className="small">
          {VARIABLES.map(([v, d]) => (
            <li key={v}>
              <code>{v}</code> — {d}
            </li>
          ))}
        </ul>
        <p className="muted small">Cada comando espera los segundos indicados antes de volver a contestar, para no inundar el chat. Una respuesta no puede empezar por ! ni por /.</p>
      </details>
    </section>
  );
}
