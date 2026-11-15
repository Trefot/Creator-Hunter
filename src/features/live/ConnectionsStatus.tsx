import { useEffect, useState,useRef } from "react";
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
  const [obs, scopes, social, yt, discord, music, psn, live, commands, ffmpeg, streaming, alerts] = await Promise.all([
    safe(obsStatus()),
    safe(twitchScopes()),
    safe(invoke<{ settings: Record<string, boolean> | null; platforms: Record<string, { connected?: boolean; message?: string }> | null }>("social_status")),
    safe(youtubeStatus()),
    safe(invoke<{ live_configured: boolean; videos_configured?:boolean; activity?:{message?:string}; settings: Record<string, unknown> | null }>("discord_status")),
    safe(invoke<{ spotify: unknown; spotify_connected?:boolean; spotify_error?: string }>("music_status")),
    safe(psnStatus()),
    safe(invoke<{ running: boolean; error: string | null }>("live_status")),
    safe(chatCommandsGet()),
    safe(shortsStatus()),
    safe(invoke<{category_enabled:boolean;category_message:string}>('stream_settings')),
    safe(invoke<{twitch_pending:number;youtube_pending:number;tiktok_pending:number}>('alerts_status')),
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
    !obs ? {id:"obs",name:"OBS",state:"error",detail:"No se pudo consultar OBS.",tab:"obs"} : !obs.enabled
      ? { id: "obs", name: "OBS", state: "off", detail: "Sin configurar.", tab: "obs" }
      : obs.connected
        ? { id: "obs", name: "OBS", state: "ok", detail: obs.streaming ? "Conectado y emitiendo." : "Conectado.", tab: "obs" }
        : { id: "obs", name: "OBS", state: "error", detail: obs.error ?? "No conecta: ¿está OBS abierto con WebSocket activado?", tab: "obs" },
  );

  if(!scopes){checks.push({id:"twitch",name:"Twitch",state:"warn",detail:"No se pudo comprobar la autorización.",tab:"connections"});}
  else if (!scopes.connected) {
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
    !yt ? {id:"youtube",name:"YouTube",state:"warn",detail:"No se pudo comprobar la cuenta."} : !yt.configured
      ? { id: "youtube", name: "YouTube", state: "off", detail: "Sin configurar." }
      : yt.connected
        ? { id: "youtube", name: "YouTube", state: "ok", detail: "Conectado." }
        : { id: "youtube", name: "YouTube", state: "warn", detail: "Desconectado o caducado: vuelve a conectarlo en Mi estudio → Cuentas." },
  );

  checks.push(
    !discord ? {id:"discord",name:"Discord",state:"warn",detail:"No se pudo consultar Discord.",tab:"connections"} : discord.live_configured
      ? { id: "discord", name: "Discord", state: "ok", detail: discord.activity?.message || "Webhook guardado. Usa la prueba en Discord para verificar la entrega.", tab: "connections" }
      : { id: "discord", name: "Discord", state: "off", detail: "Sin webhook de directos.", tab: "connections" },
  );

  checks.push(
    !music ? {id:"spotify",name:"Spotify",state:"warn",detail:"No se pudo consultar Spotify.",tab:"sound"} : music.spotify_error
      ? { id: "spotify", name: "Spotify", state: "warn", detail: music.spotify_error, tab: "sound" }
      : music?.spotify_connected
        ? { id: "spotify", name: "Spotify", state: "ok", detail: music?.spotify ? "Autorizado, con reproducción." : "Autorizado, sin reproducción activa.", tab: "sound" }
        : { id: "spotify", name: "Spotify", state: "off", detail: "Sin conectar.", tab: "sound" },
  );

  checks.push(psn===null?{id:"psn",name:"PlayStation",state:"warn",detail:"No se pudo comprobar la sesión."}:psn ? { id: "psn", name: "PlayStation", state: "ok", detail: "Conectado." } : { id: "psn", name: "PlayStation", state: "off", detail: "Sin conectar." });

  const cmdErrors = Object.entries(commands?.status ?? {}).filter(([, s]) => s?.error);
  checks.push(
    !commands ? {id:"commands",name:"Comandos de chat",state:"warn",detail:"No se pudo consultar los comandos.",tab:"commands"} : !commands.config.enabled
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
  if(discord?.videos_configured)checks.push({id:'discord-videos',name:'Publicaciones a Discord',state:'ok',detail:'Webhook de vídeos guardado. La entrega se consulta en su historial.',tab:'connections'});
  checks.push({id:'category',name:'Categoría de Twitch',state:streaming?streaming.category_enabled?'ok':'off':'warn',detail:streaming?.category_message||'Sin estado disponible. Revisa la asociación del juego.',tab:'category'});
  checks.push({id:'alerts',name:'Cola de alertas',state:alerts?'ok':'warn',detail:alerts?`Pendientes: Twitch ${alerts.twitch_pending}, YouTube ${alerts.youtube_pending}, TikTok ${alerts.tiktok_pending}. La entrega visual se comprueba en OBS.`:'No se pudo consultar.',tab:'alerts'});
  return checks;
}

const ICON: Record<CheckState, string> = { ok: "🟢", warn: "🟡", error: "🔴", off: "⚪" };

/** Panel de semáforos: En directo → Estado. */
export function ConnectionsStatus({ active, onNavigate }: { active: boolean; onNavigate: (tab: string) => void }) {
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [busy, setBusy] = useState(false);
  const running=useRef(false),previous=useRef<Record<string,string>>({});
  const [history,setHistory]=useState<{at:string;name:string;state:string}[]>([]);

  async function refresh() {
    if(running.current)return;running.current=true;setBusy(true);
    try{const next=await runChecks();setChecks(next);const changes=next.filter(c=>previous.current[c.id]!==c.state).map(c=>({at:new Date().toISOString(),name:c.name,state:c.state}));previous.current=Object.fromEntries(next.map(c=>[c.id,c.state]));if(changes.length)setHistory(h=>[...changes,...h].slice(0,60));}finally{running.current=false;setBusy(false)}
  }
  useEffect(() => {
    if(!active)return;void refresh();const timer=setInterval(()=>void refresh(),15000);return()=>clearInterval(timer);
  }, [active]);

  const unconfigured=(checks??[]).filter(c=>c.state==="off").length;
  const problems = (checks ?? []).filter((c) => c.state === "error" || c.state === "warn").length;
  return (
    <section className="card tools-panel">
      <header className="tools-head">
        <div>
          <h2>Estado de conexiones</h2>
          <p className="muted small">
            {checks === null ? "Comprobando…" : problems ? `${problems} ${problems === 1 ? "cosa por revisar" : "cosas por revisar"} antes del directo.` : unconfigured ? `${unconfigured} servicios sin configurar o desactivados. Revisa los que quieras usar.` : "Las comprobaciones de conexión no muestran incidencias."}
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
      <details><summary>Historial de esta sesión</summary><ul>{history.map((h,i)=><li key={i}>{new Date(h.at).toLocaleTimeString('es')} · {h.name}: {h.state==='ok'?'listo':h.state==='off'?'sin usar':'revisar'}</li>)}</ul></details>
      <p className="muted small">⚪ = sin usar (no es un error). 🟡 = funciona a medias o le falta un permiso. 🔴 = no funciona.</p>
    </section>
  );
}
