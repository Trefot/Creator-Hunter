import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { Download, PartyPopper, RefreshCw, Sparkles, X } from "lucide-react";
import { Logo } from "../../components/Logo";
import { es } from "../../i18n/es";

const t = es.update;
/** Cada cuánto se mira si hay una versión nueva con la app abierta. */
const CHECK_EVERY_MS = 10 * 60 * 1000;
/** Tiempo para leer las novedades antes de instalar al abrir la app. */
const READ_TIME_MS = 3500;
/** Novedades de la versión que se está instalando, para enseñarlas al volver a abrir. */
const PENDING_KEY = "th.update.pending";

interface UpdateInfo {
  version: string;
  notes: string[];
  source: "github" | "carpeta";
}

function Notes({ notes }: { notes: string[] }) {
  if (notes.length === 0) return null;
  return (
    <ul className="update-notes">
      {notes.map((n) => (
        <li key={n}>
          <Sparkles size={14} /> {n}
        </li>
      ))}
    </ul>
  );
}

/**
 * Actualización como Lumen (D-021, D-023). Al abrir la app, si GitHub tiene una versión nueva,
 * enseña sus novedades y se instala sola. Con la app abierta solo avisa (nunca reinicia a mitad
 * de un stream). Tras actualizar, muestra una vez «¡Actualizado!» con las novedades.
 */
export function UpdateLayer() {
  const [installing, setInstalling] = useState<UpdateInfo | null>(null);
  const [available, setAvailable] = useState<UpdateInfo | null>(null);
  const [updated, setUpdated] = useState<{ version: string; notes: string[] } | null>(null);
  const [error, setError] = useState("");

  async function apply(info: UpdateInfo) {
    setInstalling(info);
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify({ version: info.version, notes: info.notes }));
    } catch {
      /* sin almacenamiento: solo se pierde el aviso de después */
    }
    await new Promise((r) => setTimeout(r, READ_TIME_MS));
    try {
      await invoke("update_apply");
    } catch (err) {
      setInstalling(null);
      setError(String(err));
    }
  }

  useEffect(() => {
    if (import.meta.env.DEV) return; // la versión de pruebas no se actualiza

    // ¿Venimos de actualizar? Enseña las novedades una vez.
    getVersion().then((current) => {
      try {
        const pending = JSON.parse(localStorage.getItem(PENDING_KEY) ?? "null");
        if (pending?.version === current) setUpdated(pending);
        if (pending) localStorage.removeItem(PENDING_KEY);
      } catch {
        /* nada que enseñar */
      }
    });

    invoke<UpdateInfo | null>("update_check").then((info) => info && apply(info));
    const timer = setInterval(() => {
      invoke<UpdateInfo | null>("update_check").then((info) => setAvailable(info));
    }, CHECK_EVERY_MS);
    return () => clearInterval(timer);
  }, []);

  if (installing) {
    return (
      <div className="update-screen" role="status">
        <Logo size={72} />
        <h2>{t.newVersion(installing.version)}</h2>
        <Notes notes={installing.notes} />
        <p className="muted">
          <RefreshCw size={16} className="spin" /> {t.installingHint}
        </p>
      </div>
    );
  }

  if (updated) {
    return (
      <div className="update-backdrop" onClick={() => setUpdated(null)}>
        <div className="card update-done" onClick={(e) => e.stopPropagation()} role="dialog">
          <button className="ghost icon-button update-close" onClick={() => setUpdated(null)} title={t.close}>
            <X size={16} />
          </button>
          <PartyPopper size={36} />
          <h2>{t.updated(updated.version)}</h2>
          {updated.notes.length > 0 ? <Notes notes={updated.notes} /> : <p className="muted">{t.noNotes}</p>}
          <button onClick={() => setUpdated(null)}>{t.great}</button>
        </div>
      </div>
    );
  }

  if (!available && !error) return null;
  return (
    <div className={`update-banner${error ? " error" : ""}`} role="status">
      <Download size={16} />
      <span>
        {error ? t.failed(error) : t.available(available!.version)}
        {available?.notes[0] && <span className="muted small"> · {available.notes[0]}</span>}
      </span>
      {!error && (
        <button className="small-button" onClick={() => apply(available!)}>
          {t.now}
        </button>
      )}
    </div>
  );
}
