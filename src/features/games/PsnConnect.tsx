import { FormEvent, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Download, KeyRound, Link2Off, ShieldAlert } from "lucide-react";
import { psnConnect, psnDisconnect } from "../../db/psn";
import { es } from "../../i18n/es";

const t = es.games;

interface Props {
  connected: boolean;
  onChange: () => Promise<void>;
  onImport: () => void;
}

/** Conexión NO oficial con PSN: pegar el NPSSO, ver el estado y desconectar (D-016). */
export function PsnConnect({ connected, onChange, onImport }: Props) {
  const [npsso, setNpsso] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await psnConnect(npsso);
      setNpsso(""); // el NPSSO no se conserva en la interfaz
      await onChange();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onDisconnect() {
    await psnDisconnect();
    setConfirmingDisconnect(false);
    await onChange();
  }

  if (connected) {
    return (
      <div className="psn-connect psn-connected">
        <span className="status-on small">● {t.psnConnected}</span>
        <span className="profile-actions">
          <button className="small-button" onClick={onImport}>
            <Download size={14} />
            {t.importGames}
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
      </div>
    );
  }

  return (
    <form className="psn-connect" onSubmit={onSubmit}>
      <strong>{t.connectTitle}</strong>
      <ol className="psn-steps small">
        <li>
          {t.step1}{" "}
          <button type="button" className="link" onClick={() => openUrl("https://www.playstation.com/")}>
            playstation.com
          </button>
        </li>
        <li>
          {t.step2}{" "}
          <button type="button" className="link" onClick={() => openUrl("https://ca.account.sony.com/api/v1/ssocookie")}>
            {t.step2Link}
          </button>
        </li>
        <li>{t.step3}</li>
      </ol>
      <p className="small psn-warning">
        <ShieldAlert size={14} /> {t.npssoWarning}
      </p>
      <div className="psn-input-row">
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={npsso}
          onChange={(e) => setNpsso(e.target.value)}
          placeholder={t.npssoPlaceholder}
        />
        <button type="submit" disabled={busy || npsso.trim() === ""}>
          <KeyRound size={14} />
          {busy ? t.connecting : t.connect}
        </button>
      </div>
      {error && <p className="error small">{error}</p>}
    </form>
  );
}
