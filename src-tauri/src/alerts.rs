use crate::alerts_core::{Config, Engine, Settings, definition, first_kind};
use base64::Engine as _;
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
pub async fn alerts_save_event(
    app: AppHandle,
    platform: String,
    event_kind: String,
    mut config: Config,
) -> Result<Value, String> {
    definition(&platform, &event_kind)?;
    config.validate()?;
    config.muted = false;
    config.paused = false;
    let state = app.state::<AlertsState>();
    let mut e = state.0.lock().await;
    let mut settings = read(&app).await?;
    settings
        .event_templates
        .insert(format!("{platform}/{event_kind}"), config);
    write(&app, &settings).await?;
    e.settings = settings;
    Ok(e.status())
}
#[tauri::command]
pub fn alerts_asset(name: String) -> Result<String, String> {
    let (mime, bytes) = crate::alerts_assets::get(&name).ok_or("Ilustración no disponible.")?;
    if mime != "image/png" {
        return Err("Este recurso no es una ilustración.".into());
    }
    Ok(format!(
        "data:image/png;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(bytes)
    ))
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
    event_kind: Option<String>,
) -> Result<Value, String> {
    action_inner(&app, &platform, &action, event_kind.as_deref()).await
}
pub async fn action_inner(
    app: &AppHandle,
    platform: &str,
    action: &str,
    event_kind: Option<&str>,
) -> Result<Value, String> {
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
    } else if action == "test" {
        e.test_event(platform, event_kind.unwrap_or(first_kind(platform)?))?;
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

/// Medios separados de las plantillas: el estado y los sondeos no llevan megabytes de audio.
#[tauri::command]
pub async fn alerts_import_audio(app:AppHandle, mime:String, content:String)->Result<String,String>{
    use sha2::{Digest,Sha256};
    if !["audio/mpeg","audio/wav","audio/ogg"].contains(&mime.as_str()) || content.len()>2_800_000{return Err("Usa MP3, WAV u OGG de hasta 2 MB.".into());}
    let bytes=base64::engine::general_purpose::STANDARD.decode(&content).map_err(|_|"Audio no válido.")?;
    let valid=match mime.as_str(){"audio/wav"=>bytes.starts_with(b"RIFF")&&bytes.get(8..12)==Some(b"WAVE"),"audio/ogg"=>bytes.starts_with(b"OggS"),_=>bytes.starts_with(b"ID3")||(bytes.len()>1&&bytes[0]==255&&bytes[1]&224==224)};
    if !valid || bytes.len()>2_097_152{return Err("El contenido no coincide con un audio MP3, WAV u OGG válido de hasta 2 MB.".into());}
    let id=format!("{:x}",Sha256::digest(&bytes));let pool=crate::backup::pool(&app).await?;
    let count:i64=sqlx::query_scalar("SELECT COUNT(*) FROM alert_audio").fetch_one(&pool).await.map_err(|e|e.to_string())?;
    // Reutiliza el mismo fichero sin duplicarlo. Límite de biblioteca para mantener las copias manejables.
    let exists:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM alert_audio WHERE id=?)").bind(&id).fetch_one(&pool).await.map_err(|e|e.to_string())?;
    if count>=64&&!exists{return Err("La biblioteca llegó a 64 audios.".into());}
    sqlx::query("INSERT OR IGNORE INTO alert_audio(id,mime,content) VALUES(?,?,?)").bind(&id).bind(mime).bind(content).execute(&pool).await.map_err(|e|e.to_string())?;Ok(id)
}
#[tauri::command]
pub async fn alerts_audio_data(app:AppHandle,id:String)->Result<String,String>{
    let (mime,bytes)=audio_blob(&app,&id).await?;Ok(format!("data:{mime};base64,{}",base64::engine::general_purpose::STANDARD.encode(bytes)))
}
pub async fn audio_blob(app:&AppHandle,id:&str)->Result<(String,Vec<u8>),String>{
    if id.len()!=64||!id.bytes().all(|b|b.is_ascii_hexdigit()){return Err("Audio no válido.".into());}
    let pool=crate::backup::pool(app).await?;
    let (mime,content):(String,String)=sqlx::query_as("SELECT mime,content FROM alert_audio WHERE id=?").bind(id).fetch_one(&pool).await.map_err(|_|"Audio no disponible.".to_string())?;
    let bytes=base64::engine::general_purpose::STANDARD.decode(content).map_err(|_|"Audio dañado.")?;Ok((mime,bytes))
}
pub async fn receive(app:&AppHandle,platform:&str,kind:&str,name:&str,amount:&str,note:&str)->Result<(),String>{
    let state=app.state::<AlertsState>();let mut engine=state.0.lock().await;engine.settings=read(app).await?;engine.receive(platform,kind,name,amount,note)
}
