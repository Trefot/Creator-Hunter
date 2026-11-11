use serde_json::{Value, json};
use tauri::{AppHandle, Emitter};
#[tauri::command]
pub async fn game_targets(app: AppHandle, game_id: String) -> Result<Value, String> {
    let pool = crate::backup::pool(&app).await?;
    crate::game_broadcast::targets(&pool, &game_id).await
}
#[tauri::command]
pub async fn game_broadcast_state(app: AppHandle) -> Result<Value, String> {
    let pool = crate::backup::pool(&app).await?;
    crate::game_broadcast::state(&pool).await
}
#[tauri::command]
pub async fn game_target_change(
    app: AppHandle,
    target_id: String,
    done: bool,
    require_current: Option<bool>,
) -> Result<Value, String> {
    let pool = crate::backup::pool(&app).await?;
    let result = crate::game_broadcast::change_target(
        &pool,
        &target_id,
        done,
        require_current.unwrap_or(false),
    )
    .await?;
    let _ = app.emit("game-targets-changed", &result);
    Ok(result)
}
#[tauri::command]
pub async fn game_broadcast_action(app: AppHandle, action: String) -> Result<Value, String> {
    let pool = crate::backup::pool(&app).await?;
    let result = crate::game_broadcast::current_action(&pool, &action).await?;
    let _ = app.emit("game-targets-changed", &result);
    Ok(result)
}
#[tauri::command]
pub async fn obs_sources(app: AppHandle) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || crate::obs::read_obs(&app, "GetInputList", None))
        .await
        .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn obs_capture(app: AppHandle, source: String) -> Result<String, String> {
    if source.trim().is_empty() {
        return Err("Elige la fuente de captura del juego en OBS.".into());
    }
    tauri::async_runtime::spawn_blocking(move||{
  let data=crate::obs::read_obs(&app,"GetSourceScreenshot",Some(json!({"sourceName":source,"imageFormat":"png","imageWidth":1280,"imageHeight":720})))?;
  data["imageData"].as_str().filter(|s|s.starts_with("data:image/png;base64,")).map(String::from).ok_or("OBS no devolvió una captura PNG válida.".into())
 }).await.map_err(|e|e.to_string())?
}
