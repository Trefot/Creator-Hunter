//! Copias de seguridad: exportar todos los datos a JSON e importarlos (ver D-011).
//!
//! La importación valida el archivo completo antes de tocar nada, guarda una copia de la base
//! de datos actual con `VACUUM INTO` y reemplaza los datos dentro de una transacción: si algo
//! falla, la transacción se deshace al soltarse y los datos quedan como estaban.

use std::path::PathBuf;

use serde::Serialize;
use sqlx::{Pool, Sqlite};
use tauri::{AppHandle, Manager};
use tauri_plugin_sql::{DbInstances, DbPool};

use crate::DB_URL;

use crate::data_safety;

#[derive(Serialize)]
pub struct ExportResult {
    path: String,
    rows: usize,
}

#[derive(Serialize)]
pub struct ImportResult {
    rows: usize,
    safety_copy: String,
}

pub(crate) async fn pool(app: &AppHandle) -> Result<Pool<Sqlite>, String> {
    let instances = app.state::<DbInstances>();
    let map = instances.0.read().await;
    match map.get(DB_URL) {
        Some(DbPool::Sqlite(pool)) => Ok(pool.clone()),
        _ => Err("La base de datos no está abierta.".into()),
    }
}

/// Carpeta de copias: Documentos\TrophyHunter\Copias.
pub(crate) fn backup_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = backup_location(app)?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

pub(crate) fn backup_location(app: &AppHandle) -> Result<PathBuf, String> {
    let mut dir = app
        .path()
        .document_dir()
        .map_err(|e| e.to_string())?
        .join("TrophyHunter")
        .join("Copias");
    if cfg!(debug_assertions) {
        dir = dir.join("Pruebas");
    }
    Ok(dir)
}

/// La marca de tiempo llega del frontend (hora local); solo se aceptan dígitos y guiones.
fn check_stamp(stamp: &str) -> Result<(), String> {
    if stamp.is_empty() || !stamp.chars().all(|c| c.is_ascii_digit() || c == '-') {
        return Err("Marca de tiempo no válida.".into());
    }
    Ok(())
}

#[tauri::command]
pub async fn export_backup(app: AppHandle, stamp: String) -> Result<ExportResult, String> {
    use std::io::Write;
    check_stamp(&stamp)?;
    let pool = pool(&app).await?;
    let (document, total) = data_safety::snapshot(&pool, &data_safety::TABLES, &stamp).await?;
    let path = backup_dir(&app)?.join(format!("trophyhunter-copia-{stamp}.json"));
    let text = serde_json::to_vec_pretty(&document).map_err(|e| e.to_string())?;
    // No sobrescribir una copia anterior si dos exportaciones reciben la misma marca.
    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&path)
        .map_err(|e| format!("No se pudo crear la copia: {e}"))?;
    let result = file.write_all(&text).and_then(|_| file.sync_all());
    drop(file);
    if let Err(error) = result {
        let _ = std::fs::remove_file(&path);
        return Err(format!("No se pudo guardar la copia: {error}"));
    }
    Ok(ExportResult {
        path: path.display().to_string(),
        rows: total,
    })
}

#[tauri::command]
pub async fn import_backup(
    app: AppHandle,
    content: String,
    stamp: String,
) -> Result<ImportResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        // Las marcas y el monitor no deben escribir durante la restauración.
        let state = app.state::<crate::obs::ObsState>();
        let _guard = state.operation.lock().map_err(|e| e.to_string())?;
        tauri::async_runtime::block_on(async {
            check_stamp(&stamp)?;
            let pool = pool(&app).await?;
            data_safety::validate(&pool, &content).await?;
            let safety = backup_dir(&app)?.join(format!("antes-de-importar-{stamp}.db"));
            sqlx::query("VACUUM INTO ?")
                .bind(safety.to_string_lossy().as_ref())
                .execute(&pool)
                .await
                .map_err(|e| format!("No se pudo crear la copia previa: {e}"))?;
            let total = data_safety::restore(&pool, &content).await?;
            crate::obs::reset_after_restore(&app);
            Ok(ImportResult {
                rows: total,
                safety_copy: safety.display().to_string(),
            })
        })
    })
    .await
    .map_err(|e| e.to_string())?
}
