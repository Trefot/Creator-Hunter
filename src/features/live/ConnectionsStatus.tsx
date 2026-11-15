import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { RefreshCw } from "lucide-react";
import { chatCommandsGet, shortsStatus, twitchScopes } from "../../db/streamTools";
import { obsStatus } from "../../db/obs";
import { youtubeStatus } from "../../db/youtube";
import { psnStatus } from "../../db/psn";
import "./streamTools.css";

export type CheckState = "ok" | "warn" | "error" | "off";
export interface Check {
  id: string;
  name: string;
  state: CheckState;
  detail: string;
  /** Pestaña de En directo donde se arregla. */
  tab?: string;
}

const safe = async <T,>(p: Promise<T>): Promise<T | null> => {
  try {
    return await p;
  } catch {
    return null;
  }
};

/** Revisa todas las conexiones a la vez. Ninguna comprobación tumba a las demás. */
export async function runChecks(): Promise<Check[]> {
  const [obs, scopes, social, yt, discord, music, psn, live, commands, ffmpeg] = await Promise.all([
    safe(obsStatus()),
    safe(twitchScopes()),
    safe(invoke<{ settings: Record<string, boolean> | null; platforms: Record<string, { connected?: boolean; message?: string }> | null }>("social_status")),
    safe(youtubeStatus()),
    safe(invoke<{ live_configured: boolean; settings: Record<string, unknown> | null }>("discord_status")),
    safe(invoke<{ spotify: unknown; spotify_error?: string }>("music_status")),
    safe(psnStatus()),
    safe(invoke<{ running: boolean; error: string | null }>("live_status")),
    safe(chatCommandsGet()),
    safe(shortsStatus()),
  ]);
  const checks: Check[] = [];

  checks.push(
    !live
      ? { id: "server", name: "Servidor de Nexus (OBS y Stream Deck)", state: "error", detail: "No responde." }
      : live.running
        ? { id: "server", name: "Servidor de Nexus (OBS y Stream Deck)", state: "ok", detail: "Activo." }
        : { id: "server", name: "Servidor de Nexus (OBS y Stream Deck)", state: "error", detail: live.error ?? "No arrancó." },
  );

  checks.push(
    !obs || !obs.enabled
      ? { id: "obs", name: "OBS", state: "off", detail: "Sin configurar.", tab: "obs" }
      : obs.connected
        ? { id: "obs", name: "OBS", state: "ok", detail: obs.streaming ? "Conectado y emitiendo." : "Conectado.", tab: "obs" }
        : { id: "obs", name: "OBS", state: "error", detail: obs.error ?? "No conecta: ¿está OBS abierto con WebSocket activado?", tab: "obs" },
  );

  if (!scopes || !scopes.connected) {
    checks.push({ id: "twitch", name: "Twitch", state: "off", detail: scopes?.error ?? "Sin conectar.", tab: "connections" });
  } else if (scopes.missing.length) {
    checks.push({
      id: "twitch",
      name: "Twitch",
      state: "warn",
      detail: `Renueva los permisos para: ${scopes.missing.map((m) => m.for).join(", ")}.`,
      tab: "connections",
    });
  } else {
    checks.push({ id: "twitch", name: "Twitch", state: "ok", detail: `Conectado${scopes.login ? ` como ${scopes.login}` : ""} con todos los permisos.`, tab: "connections" });
  }
  const tw = social?.platforms?.twitch;
  if (scopes?.connected && social?.settings?.twitch && tw && tw.connected === false) {
    checks.push({ id: "twitch-events", name: "Eventos de Twitch", state: "warn", detail: tw.message || "La recepción de eventos está desconectada.", tab: "connections" });
  }

  checks.push(
    !yt || !yt.configured
      ? { id: "youtube", name: "YouTube", state: "off", detail: "Sin configurar." }
      : yt.connected
        ? { id: "youtube", name: "YouTube", state: "ok", detail: "Conectado." }
        : { id: "youtube", name: "YouTube", state: "warn", detail: "Desconectado o caducado: vuelve a conectarlo en Mi estudio → Cuentas." },
  );

  checks.push(
    discord?.live_configured
      ? { id: "discord", name: "Discord", state: "ok", detail: "Aviso de directos configurado.", tab: "connections" }
      : { id: "discord", name: "Discord", state: "off", detail: "Sin webhook de directos.", tab: "connections" },
  );

  checks.push(
    music?.spotify_error
      ? { id: "spotify", name: "Spotify", state: "warn", detail: music.spotify_error, tab: "sound" }
      : music?.spotify
        ? { id: "spotify", name: "Spotify", state: "ok", detail: "Conectado.", tab: "sound" }
        : { id: "spotify", name: "Spotify", state: "off", detail: "Sin conectar.", tab: "sound" },
  );

  checks.push(psn ? { id: "psn", name: "PlayStation", state: "ok", detail: "Conectado." } : { id: "psn", name: "PlayStation", state: "off", detail: "Sin conectar." });

  const cmdErrors = Object.entries(commands?.status ?? {}).filter(([, s]) => s?.error);
  checks.push(
    !commands?.config.enabled
      ? { id: "commands", name: "Comandos de chat", state: "off", detail: "Desactivados.", tab: "commands" }
      : cmdErrors.length
        ? { id: "commands", name: "Comandos de chat", state: "warn", detail: cmdErrors.map(([, s]) => s.error).join(" "), tab: "commands" }
        : { id: "commands", name: "Comandos de chat", state: "ok", detail: "Activos.", tab: "commands" },
  );

  checks.push(
    ffmpeg?.ffmpeg
      ? { id: "ffmpeg", name: "ffmpeg (Shorts)", state: "ok", detail: "Instalado.", tab: "moments" }
      : { id: "ffmpeg", name: "ffmpeg (Shorts)", state: "off", detail: "Necesario para crear Shorts.", tab: "moments" },
  );
  return checks;
}

const ICON: Record<CheckState, string> = { ok: "🟢", warn: "🟡", error: "🔴", off: "⚪" };

/** Panel de semáforos: En directo → Estado. */
export function ConnectionsStatus({ active, onNavigate }: { active: boolean; onNavigate: (tab: string) => void }) {
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setBusy(true);
    setChecks(await runChecks());
    setBusy(false);
  }
  useEffect(() => {
    if (active) void refresh();
  }, [active]);

  const problems = (checks ?? []).filter((c) => c.state === "error" || c.state === "warn").length;
  return (
    <section className="card tools-panel">
      <header className="tools-head">
        <div>
          <h2>Estado de conexiones</h2>
          <p className="muted small">
            {checks === null ? "Comprobando…" : problems ? `${problems} ${problems === 1 ? "cosa por revisar" : "cosas por revisar"} antes del directo.` : "Todo en orden."}
          </p>
        </div>
        <button className="ghost small-button" disabled={busy} onClick={refresh}>
          <RefreshCw size={14} className={busy ? "spin" : ""} /> Comprobar
        </button>
      </header>
      <ul className="status-list">
        {(checks ?? []).map((c) => (
          <li key={c.id} className={`status-item ${c.state}`}>
            <span className="status-dot" aria-hidden>
              {ICON[c.state]}
            </span>
            <span className="status-text">
              <strong>{c.name}</strong>
              <span className="muted small">{c.detail}</span>
            </span>
            {c.tab && c.state !== "ok" && (
              <button className="ghost small-button" onClick={() => onNavigate(c.tab!)}>
                Arreglar
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="muted small">⚪ = sin usar (no es un error). 🟡 = funciona a medias o le falta un permiso. 🔴 = no funciona.</p>
    </section>
  );
}
