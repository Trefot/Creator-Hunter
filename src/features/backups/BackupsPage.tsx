import { PageTitle } from "../../components/PageTitle";
import { ChangeEvent, useState } from "react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { exportBackup, ExportResult, importBackup, ImportResult, previewBackup } from "../../db/backup";
import { es } from "../../i18n/es";

const t = es.backups;

/** 'AAAAMMDD-HHMMSS' → '03/11/2026 22:40'. */
function stampLabel(stamp: string): string {
  const m = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})/.exec(stamp);
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : stamp;
}

export function BackupsPage() {
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState<ExportResult | null>(null);
  const [file, setFile] = useState<{ content: string; preview: NonNullable<ReturnType<typeof previewBackup>> } | null>(null);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");

  async function onExport() {
    setError("");
    setExporting(true);
    try {
      setExported(await exportBackup());
    } catch (err) {
      setError(String(err));
    } finally {
      setExporting(false);
    }
  }

  async function onChooseFile(e: ChangeEvent<HTMLInputElement>) {
    setError("");
    setImported(null);
    const chosen = e.target.files?.[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo
    if (!chosen) return;
    const content = await chosen.text();
    const preview = previewBackup(content);
    if (!preview) {
      setFile(null);
      return setError(t.invalidFile);
    }
    setFile({ content, preview });
  }

  async function onImport() {
    if (!file) return;
    setError("");
    setImporting(true);
    try {
      setImported(await importBackup(file.content));
      setFile(null);
    } catch (err) {
      setError(`${t.errorPrefix} ${err}`);
    } finally {
      setImporting(false);
    }
  }

  const totalRows = file ? file.preview.counts.reduce((sum, [, n]) => sum + n, 0) : 0;

  return (
    <section className="page">
      <header className="page-header">
        <PageTitle section="backups" subtitle={t.subtitle} />
      </header>

      <div className="card backup-block">
        <h2>{t.exportTitle}</h2>
        <p className="muted">{t.exportBody}</p>
        <div>
          <button onClick={onExport} disabled={exporting}>
            {exporting ? t.exporting : t.exportButton}
          </button>
        </div>
        {exported && (
          <div className="backup-result">
            <span className="status-on">{t.exported(exported.rows)}</span>
            <code>{exported.path}</code>
            <button className="link" onClick={() => revealItemInDir(exported.path)}>
              {t.showInFolder}
            </button>
          </div>
        )}
      </div>

      <div className="card backup-block">
        <h2>{t.importTitle}</h2>
        <p className="muted">{t.importBody}</p>
        {!file && !imported && (
          <label className="file-button">
            {t.chooseFile}
            <input type="file" accept=".json,application/json" onChange={onChooseFile} />
          </label>
        )}

        {file && (
          <div className="backup-result">
            <strong>{t.preview(stampLabel(file.preview.exportedAt), totalRows)}</strong>
            <span className="muted small">{t.previewTables}</span>
            <ul className="backup-counts">
              {file.preview.counts.map(([table, n]) => (
                <li key={table}>
                  {t.tables[table] ?? table}: <strong>{n}</strong>
                </li>
              ))}
            </ul>
            <div className="profile-actions">
              <button className="danger" onClick={onImport} disabled={importing}>
                {importing ? t.importing : t.confirmImport}
              </button>
              <button className="ghost" onClick={() => setFile(null)} disabled={importing}>
                {t.cancel}
              </button>
            </div>
          </div>
        )}

        {imported && (
          <div className="backup-result">
            <span className="status-on">{t.imported(imported.rows)}</span>
            <span className="muted small">{t.safetyCopy}</span>
            <code>{imported.safety_copy}</code>
            <div>
              <button onClick={() => window.location.reload()}>{t.reload}</button>
            </div>
          </div>
        )}
      </div>

      {error && <p className="error">{error}</p>}
    </section>
  );
}
