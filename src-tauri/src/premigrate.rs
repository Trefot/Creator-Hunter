//! Preparación obligatoria antes de que la interfaz abra SQLite (D-024).
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

#[derive(Default)]
pub struct Preparation(Mutex<bool>);

/// Serializa la preparación. Un fallo no se memoriza: el usuario puede reintentar.
#[tauri::command]
pub async fn prepare_database(app: AppHandle) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<Preparation>();
        let mut ready = state
            .0
            .lock()
            .map_err(|_| "No se pudo preparar la base de datos.")?;
        if *ready {
            return Ok(());
        }
        let file = crate::DB_URL.trim_start_matches("sqlite:");
        let db = app
            .path()
            .app_config_dir()
            .map_err(|e| e.to_string())?
            .join(file);
        if db.exists() {
            let latest = crate::migrations()
                .iter()
                .map(|m| m.version)
                .max()
                .unwrap_or(0);
            let dir = crate::backup::backup_location(&app)?;
            tauri::async_runtime::block_on(crate::data_safety::backup_if_pending(
                &db, &dir, latest,
            ))?;
        }
        *ready = true;
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}
