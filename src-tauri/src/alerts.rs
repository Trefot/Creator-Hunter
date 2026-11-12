use crate::alerts_core::{Config, Engine, Settings};
use serde_json::{Value, json};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};
#[derive(Default)]
pub struct AlertsState(pub tauri::async_runtime::Mutex<Engine>);
const WORKSPACE: &str = "00000000-0000-4000-8000-000000000001";
async fn read(app: &AppHandle) -> Result<Settings, String> {
    let pool = crate::backup::pool(app).await?;
    let raw: Option<String> = sqlx::query_scalar("SELECT alert_settings FROM workspace WHERE id=?")
        .bind(WORKSPACE)
        .fetch_one(&pool)
        .await
        .map_err(|e| e.to_string())?;
    let settings: Settings = match raw {
        Some(s) => serde_json::from_str(&s)
            .map_err(|e| format!("Preferencias de alertas no válidas: {e}"))?,
        None => Settings::default(),
    };
    settings.validate()?;
    Ok(settings)
}
async fn write(app: &AppHandle, settings: &Settings) -> Result<(), String> {
    settings.validate()?;
    let pool = crate::backup::pool(app).await?;
    sqlx::query("UPDATE workspace SET alert_settings=? WHERE id=?")
        .bind(serde_json::to_string(settings).map_err(|e| e.to_string())?)
        .bind(WORKSPACE)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}
#[tauri::command]
pub async fn alerts_status(app: AppHandle) -> Result<Value, String> {
    let state = app.state::<AlertsState>();
    let mut e = state.0.lock().await;
    e.settings = read(&app).await?;
    Ok(e.status())
}
#[tauri::command]
pub async fn alerts_save(
    app: AppHandle,
    platform: String,
    config: Config,
) -> Result<Value, String> {
    config.validate()?;
    let state = app.state::<AlertsState>();
    let mut e = state.0.lock().await;
    let mut settings = read(&app).await?;
    match platform.as_str() {
        "twitch" => settings.twitch = config,
        "youtube" => settings.youtube = config,
        "tiktok" => settings.tiktok = config,
        _ => return Err("Plataforma no válida.".into()),
    }
    write(&app, &settings).await?;
    e.settings = settings;
    Ok(e.status())
}
#[tauri::command]
pub async fn alerts_audio(app: AppHandle, coordinate: bool) -> Result<Value, String> {
    let state = app.state::<AlertsState>();
    let mut e = state.0.lock().await;
    let mut settings = read(&app).await?;
    settings.coordinate_audio = coordinate;
    write(&app, &settings).await?;
    e.settings = settings;
    Ok(e.status())
}
#[tauri::command]
pub async fn alerts_action(
    app: AppHandle,
    platform: String,
    action: String,
) -> Result<Value, String> {
    action_inner(&app, &platform, &action).await
}
pub async fn action_inner(app: &AppHandle, platform: &str, action: &str) -> Result<Value, String> {
    let state = app.state::<AlertsState>();
    let mut e = state.0.lock().await;
    e.settings = read(app).await?;
    if action == "mute" || action == "pause" {
        let cfg = match platform {
            "twitch" => &mut e.settings.twitch,
            "youtube" => &mut e.settings.youtube,
            "tiktok" => &mut e.settings.tiktok,
            _ => return Err("Plataforma no válida.".into()),
        };
        if action == "mute" {
            cfg.muted = !cfg.muted
        } else {
            cfg.paused = !cfg.paused
        }
        write(app, &e.settings).await?;
    } else {
        e.action(platform, action)?
    }
    Ok(e.status())
}
pub async fn poll(app: &AppHandle, platform: &str, viewer: &str) -> Result<Value, String> {
    let state = app.state::<AlertsState>();
    let mut e = state.0.lock().await;
    e.settings = read(app).await?;
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis() as u64;
    let mut data = e.poll(platform, viewer, now)?;
    data["app_version"] = json!(app.package_info().version.to_string());
    Ok(data)
}
#[tauri::command]
pub async fn alerts_announce(
    app: AppHandle,
    platform: String,
    title: String,
    message: String,
) -> Result<Value, String> {
    let state = app.state::<AlertsState>();
    let mut e = state.0.lock().await;
    e.enqueue(&platform, title, message, false)?;
    Ok(json!({"queued":true}))
}
