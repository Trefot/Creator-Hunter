import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Download, RefreshCw } from "lucide-react";
import { Logo } from "../../components/Logo";
import { es } from "../../i18n/es";

const t = es.update;
/** Cada cuánto se mira si hay una versión nueva con la app abierta. */
const CHECK_EVERY_MS = 10 * 60 * 1000;

interface UpdateInfo {
  version: string;
}

/**
 * Actualización automática (D-021). Al abrir la app, si hay una versión nueva en
 * Documentos\TrophyHunter\Instaladores, se instala sola y la app se vuelve a abrir.
 * Con la app abierta, solo avisa: nunca se reinicia a mitad de un stream.
 */
export function UpdateLayer() {
  const [installing, setInstalling] = useState<string | null>(null);
  const [available, setAvailable] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function apply(version: string) {
    setInstalling(version);
    try {
      await invoke("update_apply");
    } catch (err) {
      setInstalling(null);
      setError(String(err));
    }
  }

  useEffect(() => {
    if (import.meta.env.DEV) return; // la versión de pruebas no se actualiza
    invoke<UpdateInfo | null>("update_check").then((info) => {
      if (info) setTimeout(() => apply(info.version), 1200); // al abrir: directa
    });
    const timer = setInterval(() => {
      invoke<UpdateInfo | null>("update_check").then((info) => setAvailable(info?.version ?? null));
    }, CHECK_EVERY_MS);
    return () => clearInterval(timer);
  }, []);

  if (installing) {
    return (
      <div className="update-screen" role="status">
        <Logo size={72} />
        <h2>{t.installing(installing)}</h2>
        <p className="muted">{t.installingHint}</p>
        <RefreshCw size={22} className="spin" />
      </div>
    );
  }

  if (!available && !error) return null;
  return (
    <div className={`update-banner${error ? " error" : ""}`} role="status">
      <Download size={16} />
      <span>{error ? t.failed(error) : t.available(available!)}</span>
      {!error && (
        <button className="small-button" onClick={() => apply(available!)}>
          {t.now}
        </button>
      )}
    </div>
  );
}
