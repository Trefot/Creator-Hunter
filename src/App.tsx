import { FormEvent, useEffect, useState } from "react";
import { getDb } from "./db/database";
import { createProfile, deleteProfile, listProfiles, Platform, PLATFORMS, Profile } from "./db/profiles";
import { es } from "./i18n/es";
import "./App.css";

const t = es.dbTest;

/** Pantalla temporal de la S3: comprueba que los datos sobreviven al cierre de la app. */
function App() {
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [foreignKeys, setForeignKeys] = useState<boolean | null>(null);
  const [platform, setPlatform] = useState<Platform>("youtube");
  const [handle, setHandle] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    try {
      setProfiles(await listProfiles());
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    refresh();
    getDb()
      .then((db) => db.select<{ foreign_keys: number }[]>("PRAGMA foreign_keys"))
      .then((rows) => setForeignKeys(rows[0]?.foreign_keys === 1))
      .catch((e) => setError(String(e)));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!handle.trim()) return;
    setError("");
    try {
      await createProfile(platform, handle);
      setHandle("");
      await refresh();
    } catch (err) {
      setError(String(err).includes("UNIQUE") ? t.duplicate : `${t.error} ${err}`);
    }
  }

  async function onDelete(id: string) {
    await deleteProfile(id);
    await refresh();
  }

  return (
    <main className="container">
      <h1>{es.appName}</h1>
      <h2>{t.title}</h2>
      <p className="muted">{t.intro}</p>

      <form className="row" onSubmit={onSubmit}>
        <select value={platform} onChange={(e) => setPlatform(e.target.value as Platform)} aria-label={t.platform}>
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>
              {es.platforms[p]}
            </option>
          ))}
        </select>
        <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder={t.handle} />
        <button type="submit">{t.add}</button>
      </form>

      {error && <p className="error">{error}</p>}

      {profiles === null ? (
        <p className="muted">{t.loading}</p>
      ) : profiles.length === 0 ? (
        <p className="muted">{t.empty}</p>
      ) : (
        <ul className="list">
          {profiles.map((p) => (
            <li key={p.id}>
              <span>
                <strong>{es.platforms[p.platform]}</strong> {p.handle}
              </span>
              <button className="ghost" onClick={() => onDelete(p.id)}>
                {t.remove}
              </button>
            </li>
          ))}
        </ul>
      )}

      {foreignKeys !== null && (
        <p className="muted small">
          {t.foreignKeys}: {foreignKeys ? t.on : t.off}
        </p>
      )}
    </main>
  );
}

export default App;
