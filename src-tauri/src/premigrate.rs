//! Copia automática antes de migrar (D-020).
//!
//! Al arrancar, antes de que el frontend abra la base de datos (y se apliquen las migraciones
//! pendientes), se mira la versión del esquema. Si hay migraciones nuevas, se guarda una copia
//! completa con `VACUUM INTO` en Documentos\TrophyHunter\Copias. Así cada actualización de la app
//! instalada deja una copia de los datos reales sin depender de nadie.

use std::time::{SystemTime, UNIX_EPOCH};

use sqlx::sqlite::SqliteConnectOptions;
use sqlx::{ConnectOptions, Row};
use tauri::{AppHandle, Manager};

/// Devuelve la ruta de la copia creada, o None si no hacía falta.
pub fn backup_if_pending(app: &AppHandle, latest: i64) -> Result<Option<String>, String> {
    let file = crate::DB_URL.trim_start_matches("sqlite:");
    let db = app.path().app_config_dir().map_err(|e| e.to_string())?.join(file);
    if !db.exists() {
        return Ok(None); // primera vez: no hay datos que copiar
    }
    tauri::async_runtime::block_on(async {
        let mut conn = SqliteConnectOptions::new()
            .filename(&db)
            .read_only(true)
            .connect()
            .await
            .map_err(|e| e.to_string())?;
        let has_table = sqlx::query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '_sqlx_migrations'")
            .fetch_optional(&mut conn)
            .await
            .map_err(|e| e.to_string())?
            .is_some();
        if !has_table {
            return Ok(None);
        }
        let current: i64 = sqlx::query("SELECT COALESCE(MAX(version), 0) AS v FROM _sqlx_migrations")
            .fetch_one(&mut conn)
            .await
            .map_err(|e| e.to_string())?
            .get("v");
        if current >= latest {
            return Ok(None);
        }
        let secs = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
        let dest = crate::backup::backup_dir(app)?.join(format!("antes-de-migrar-v{current}-a-v{latest}-{secs}.db"));
        let dest_sql = dest.display().to_string().replace('\'', "''");
        sqlx::query(&format!("VACUUM INTO '{dest_sql}'"))
            .execute(&mut conn)
            .await
            .map_err(|e| format!("No se pudo crear la copia antes de migrar: {e}"))?;
        Ok(Some(dest.display().to_string()))
    })
}
