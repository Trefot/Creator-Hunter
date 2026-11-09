import Database from "@tauri-apps/plugin-sql";

/**
 * Misma cadena que DB_URL en src-tauri/src/lib.rs, donde se registran las migraciones.
 * D-019: en desarrollo se usa la base de pruebas; la app instalada usa los datos reales.
 */
const DB_URL = import.meta.env.DEV ? "sqlite:studio-dev.db" : "sqlite:studio.db";

/** Espacio de trabajo único de Alpha 0.1, creado por la migración 001. */
export const WORKSPACE_ID = "00000000-0000-4000-8000-000000000001";

let connection: Promise<Database> | null = null;

/** Conexión compartida; la primera llamada aplica las migraciones pendientes. */
export function getDb(): Promise<Database> {
  connection ??= Database.load(DB_URL);
  return connection;
}

export function newId(): string {
  return crypto.randomUUID();
}
