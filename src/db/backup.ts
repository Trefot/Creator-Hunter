import { invoke } from "@tauri-apps/api/core";
import { getDb } from "./database";

/** Exportación e importación; el trabajo lo hacen los comandos de Rust (src-tauri/src/backup.rs). */

export interface ExportResult {
  path: string;
  rows: number;
}

export interface ImportResult {
  rows: number;
  safety_copy: string;
}

/** Marca de tiempo local para los nombres de archivo: 'AAAAMMDD-HHMMSS'. */
function stamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export async function exportBackup(): Promise<ExportResult> {
  await getDb(); // los comandos usan la conexión que abre la app
  return invoke<ExportResult>("export_backup", { stamp: stamp() });
}

export async function importBackup(content: string): Promise<ImportResult> {
  await getDb();
  return invoke<ImportResult>("import_backup", { content, stamp: stamp() });
}

/** Resumen de un archivo de copia para mostrarlo antes de importar; null si no lo parece. */
export function previewBackup(content: string): { exportedAt: string; counts: [string, number][] } | null {
  try {
    const doc = JSON.parse(content);
    if (doc?.format !== "trophyhunter-studio-backup" || typeof doc.tables !== "object") return null;
    const counts = Object.entries(doc.tables as Record<string, unknown[]>).map(
      ([table, rows]) => [table, Array.isArray(rows) ? rows.length : 0] as [string, number],
    );
    return { exportedAt: String(doc.exported_at ?? ""), counts };
  } catch {
    return null;
  }
}
