import { ChangeEvent, useEffect, useState } from "react";
import { FileKey, Link2, Link2Off, LoaderCircle, RefreshCw } from "lucide-react";
import { AVATAR_SIZE, resizeImage } from "../../components/images";
import { setProfileAvatar } from "../../db/profiles";
import {
  connectYouTube,
  disconnectYouTube,
  fetchYouTubeChannel,
  importGoogleClient,
  YouTubeChannel,
  YouTubeStatus,
  youtubeStatus,
} from "../../db/youtube";
import { es } from "../../i18n/es";
import { formatNumber } from "../../i18n/format";

const t = es.youtube;

interface Props {
  profileId: string;
  /** Avisa a la página para recargar (por ejemplo, tras poner la foto del canal). */
  onChange: () => Promise<void>;
}

/** Conexión del perfil de YouTube con la API: importar cliente, conectar, ver canal y desconectar. */
export function YouTubeConnect({ profileId, onChange }: Props) {
  const [status, setStatus] = useState<YouTubeStatus | null>(null);
  const [channel, setChannel] = useState<YouTubeChannel | null>(null);
  const [busy, setBusy] = useState<null | "connecting" | "refreshing">(null);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      const s = await youtubeStatus();
      setStatus(s);
      setChannel(s.connection?.channel ?? null);
      // Comprueba la conexión en vivo (renueva el token si hace falta).
      if (s.connected && s.connection?.profile_id === profileId) {
        setBusy("refreshing");
        setChannel(await fetchYouTubeChannel());
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    load();
  }, [profileId]);

  async function onImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    try {
      await importGoogleClient(await file.text());
      await load();
    } catch (err) {
      setError(String(err));
    }
  }

  async function onConnect() {
    setError("");
    setBusy("connecting");
    try {
      const result = await connectYouTube(profileId);
      if (result.avatar) {
        // La foto del canal llega a tamaño completo: se reduce como cualquier otra (D-013).
        const blob = await (await fetch(result.avatar)).blob();
        await setProfileAvatar(profileId, await resizeImage(new File([blob], "canal"), AVATAR_SIZE));
      }
      await onChange();
      await load();
    } catch (err) {
      setError(String(err));
      setBusy(null);
    }
  }

  async function onDisconnect() {
    setError("");
    try {
      await disconnectYouTube();
      setConfirmingDisconnect(false);
      await load();
    } catch (err) {
      setError(String(err));
    }
  }

  if (!status) return null;
  const linkedHere = status.connected && status.connection?.profile_id === profileId;
  const linkedElsewhere = status.connected && !linkedHere;

  return (
    <div className="yt-connect">
      {!status.configured ? (
        <>
          <span className="small">
            <strong>{t.setupTitle}</strong> · <span className="muted">{t.setupHint}</span>
          </span>
          <label className="file-button small-file">
            <FileKey size={14} /> {t.importClient}
            <input type="file" accept=".json,application/json" onChange={onImport} />
          </label>
        </>
      ) : linkedElsewhere ? (
        <span className="muted small">{t.linkedElsewhere(status.connection?.channel.title ?? "")}</span>
      ) : !linkedHere ? (
        <>
          <span className="small muted">{busy === "connecting" ? t.waitingBrowser : t.connectHint}</span>
          <button className="small-button" onClick={onConnect} disabled={busy !== null}>
            {busy === "connecting" ? <LoaderCircle size={14} className="spin" /> : <Link2 size={14} />}
            {t.connect}
          </button>
        </>
      ) : (
        <>
          <span className="yt-channel">
            <span className="status-on small">● {t.connected}</span>
            <strong className="small">{channel?.title}</strong>
            {channel && (
              <span className="muted small">
                {t.stats(
                  channel.subscribers != null ? formatNumber(channel.subscribers) : "—",
                  channel.views != null ? formatNumber(channel.views) : "—",
                  channel.videos != null ? formatNumber(channel.videos) : "—",
                )}
              </span>
            )}
          </span>
          <span className="profile-actions">
            <button className="ghost small-button" onClick={load} disabled={busy !== null} title={t.refresh}>
              <RefreshCw size={14} className={busy === "refreshing" ? "spin" : ""} />
            </button>
            {confirmingDisconnect ? (
              <>
                <button className="danger small-button" onClick={onDisconnect}>
                  {t.confirmDisconnect}
                </button>
                <button className="ghost small-button" onClick={() => setConfirmingDisconnect(false)}>
                  {t.cancel}
                </button>
              </>
            ) : (
              <button className="ghost small-button" onClick={() => setConfirmingDisconnect(true)}>
                <Link2Off size={14} />
                {t.disconnect}
              </button>
            )}
          </span>
        </>
      )}
      {error && <span className="error small yt-error">{error}</span>}
    </div>
  );
}
