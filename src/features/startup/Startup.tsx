import { useEffect, useState } from "react";
import App from "../../App";
import { getDb } from "../../db/database";
import { es } from "../../i18n/es";
import "../../App.css";

/** No monta sincronizaciones ni pantallas de datos hasta proteger y abrir SQLite. */
export function Startup() {
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    getDb().then(
      () => { if (!cancelled) setReady(true); },
      (err: unknown) => { if (!cancelled) setError(String(err)); },
    );
    return () => { cancelled = true; };
  }, [attempt]);

  if (ready) return <App />;
  return (
    <main className="page startup">
      <div className="card" role={error ? "alert" : "status"}>
        <h1>{error ? es.startup.failed : es.startup.loading}</h1>
        {error && <>
          <p>{es.startup.recovery}</p>
          <p className="error">{error}</p>
          <button onClick={() => setAttempt((n) => n + 1)}>{es.startup.retry}</button>
        </>}
      </div>
    </main>
  );
}
