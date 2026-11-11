//! Monitor local de OBS. Solo lectura y marcas: nunca inicia ni detiene una salida.
use crate::{obs_protocol::Client, obs_store};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{
    sync::{
        Mutex,
        atomic::{AtomicBool, Ordering},
    },
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager, State};

const CONFIG_FILE: &str = if cfg!(debug_assertions) {
    "obs-dev.json"
} else {
    "obs.json"
};
const SERVICE: &str = if cfg!(debug_assertions) {
    "nexus-obs-dev"
} else {
    "nexus-obs"
};
#[derive(Clone, Serialize, Deserialize)]
struct Config {
    enabled: bool,
    port: u16,
}
impl Default for Config {
    fn default() -> Self {
        Self {
            enabled: false,
            port: 4455,
        }
    }
}
#[derive(Clone, Default, Serialize)]
pub struct ObsView {
    enabled: bool,
    port: u16,
    connected: bool,
    recording: bool,
    paused: bool,
    streaming: bool,
    record_ms: Option<i64>,
    stream_ms: Option<i64>,
    error: Option<String>,
    last_update_ms: u64,
}
#[derive(Default)]
struct Inner {
    config: Config,
    generation: u64,
    view: ObsView,
    game: Option<String>,
    record_id: Option<String>,
    stream_id: Option<String>,
    last_record_id: Option<String>,
}
#[derive(Default)]
pub struct ObsState {
    inner: Mutex<Inner>,
    pub(crate) operation: Mutex<()>,
    started: AtomicBool,
}
pub(crate) fn reset_after_restore(app: &AppHandle) {
    let state = app.state::<ObsState>();
    if let Ok(mut i) = state.inner.lock() {
        i.record_id = None;
        i.stream_id = None;
        i.last_record_id = None;
        i.generation += 1;
        i.view.connected = false;
        i.view.recording = false;
        i.view.streaming = false;
        i.view.record_ms = None;
        i.view.stream_ms = None;
    }
}

fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
fn id() -> String {
    (0..16)
        .map(|_| format!("{:02x}", rand::random::<u8>()))
        .collect()
}
fn entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE, "websocket")
        .map_err(|_| "No se pudo acceder a las credenciales de OBS.".into())
}
fn password() -> Result<String, String> {
    match entry()?.get_password() {
        Ok(p) => Ok(p),
        Err(keyring::Error::NoEntry) => Ok(String::new()),
        Err(_) => Err("No se pudo leer la contraseña de OBS del almacén de Windows.".into()),
    }
}
fn save_config(app: &AppHandle, config: &Config) -> Result<(), String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    std::fs::write(
        dir.join(CONFIG_FILE),
        serde_json::to_vec(config).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())
}
fn pool(app: &AppHandle) -> Result<sqlx::SqlitePool, String> {
    tauri::async_runtime::block_on(crate::backup::pool(app))
}
fn clear_sessions(app: &AppHandle, reason: &str) -> Result<(), String> {
    let state = app.state::<ObsState>();
    let (record, stream) = {
        let inner = state.inner.lock().map_err(|e| e.to_string())?;
        (inner.record_id.clone(), inner.stream_id.clone())
    };
    let pool = pool(app)?;
    for session in [record, stream].into_iter().flatten() {
        tauri::async_runtime::block_on(obs_store::close_session(&pool, &session, reason, None))?;
    }
    let mut inner = state.inner.lock().map_err(|e| e.to_string())?;
    inner.record_id = None;
    inner.stream_id = None;
    inner.view.connected = false;
    inner.view.recording = false;
    inner.view.streaming = false;
    inner.view.paused = false;
    inner.view.record_ms = None;
    inner.view.stream_ms = None;
    Ok(())
}
fn initialize(app: &AppHandle) -> Result<(), String> {
    let state = app.state::<ObsState>();
    let _guard = state.operation.lock().map_err(|e| e.to_string())?;
    if state.started.load(Ordering::SeqCst) {
        return Ok(());
    }
    let path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join(CONFIG_FILE);
    let config = if path.exists() {
        serde_json::from_slice::<Config>(&std::fs::read(path).map_err(|e| e.to_string())?)
            .map_err(|_| "La configuración local de OBS no es válida.")?
    } else {
        Config::default()
    };
    let pool = pool(app)?;
    tauri::async_runtime::block_on(sqlx::query("UPDATE obs_session SET ended_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),end_reason='app_restarted' WHERE ended_at IS NULL AND workspace_id=$1").bind(obs_store::WORKSPACE).execute(&pool)).map_err(|e|e.to_string())?;
    {
        let mut inner = state.inner.lock().map_err(|e| e.to_string())?;
        inner.view.enabled = config.enabled;
        inner.view.port = config.port;
        inner.config = config;
    }
    state.started.store(true, Ordering::SeqCst);
    let handle = app.clone();
    thread::spawn(move || monitor(handle));
    Ok(())
}
#[tauri::command]
pub async fn obs_initialize(app: AppHandle) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || initialize(&app))
        .await
        .map_err(|e| e.to_string())?
}
#[tauri::command]
pub fn obs_status(state: State<'_, ObsState>) -> ObsView {
    state
        .inner
        .lock()
        .map(|i| i.view.clone())
        .unwrap_or_default()
}
#[tauri::command]
pub fn obs_context(state: State<'_, ObsState>, game_id: Option<String>) {
    if let Ok(mut inner) = state.inner.lock() {
        inner.game = game_id;
    }
}
#[tauri::command]
pub async fn obs_configure(
    app: AppHandle,
    port: u16,
    password: Option<String>,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        if port == 0 {
            return Err("Puerto de OBS no válido.".into());
        }
        initialize(&app)?;
        let state = app.state::<ObsState>();
        let _guard = state.operation.lock().map_err(|e| e.to_string())?;
        if let Some(p) = password {
            entry()?
                .set_password(&p)
                .map_err(|_| "No se pudo guardar la contraseña de OBS en Windows.")?;
        }
        let config = Config {
            enabled: true,
            port,
        };
        save_config(&app, &config)?;
        clear_sessions(&app, "reconfigured")?;
        let mut inner = state.inner.lock().map_err(|e| e.to_string())?;
        inner.config = config;
        inner.generation += 1;
        inner.view.enabled = true;
        inner.view.port = port;
        inner.view.error = None;
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn obs_disconnect(app: AppHandle) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        initialize(&app)?;
        let state = app.state::<ObsState>();
        let _guard = state.operation.lock().map_err(|e| e.to_string())?;
        let config = {
            let inner = state.inner.lock().map_err(|e| e.to_string())?;
            Config {
                enabled: false,
                port: inner.config.port,
            }
        };
        save_config(&app, &config)?;
        clear_sessions(&app, "disconnected")?;
        let mut inner = state.inner.lock().map_err(|e| e.to_string())?;
        inner.config = config;
        inner.generation += 1;
        inner.view.enabled = false;
        inner.view.error = None;
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}
fn duration(data: &Value) -> Result<Option<i64>, String> {
    let active = data["outputActive"]
        .as_bool()
        .ok_or("OBS no devolvió un estado válido.")?;
    if !active {
        return Ok(None);
    }
    let n = data["outputDuration"]
        .as_f64()
        .filter(|n| n.is_finite() && *n >= 0.0 && *n < i64::MAX as f64)
        .ok_or("OBS no devolvió una duración válida.")?;
    Ok(Some(n as i64))
}
fn poll(app: &AppHandle, client: &mut Client) -> Result<(), String> {
    let record = client.request("GetRecordStatus")?;
    let stream = client.request("GetStreamStatus")?;
    let record_ms = duration(&record)?;
    let stream_ms = duration(&stream)?;
    let paused = record["outputPaused"].as_bool().unwrap_or(false) && record_ms.is_some();
    let state = app.state::<ObsState>();
    let (mut rid, mut sid, game, old_record, old_stream) = {
        let i = state.inner.lock().map_err(|e| e.to_string())?;
        (
            i.record_id.clone(),
            i.stream_id.clone(),
            i.game.clone(),
            i.view.record_ms,
            i.view.stream_ms,
        )
    };
    let pool = pool(app)?;
    for (kind, current, elapsed, old) in [
        ("recording", &mut rid, record_ms, old_record),
        ("stream", &mut sid, stream_ms, old_stream),
    ] {
        let restarted = elapsed.zip(old).is_some_and(|(a, b)| a < b);
        if (elapsed.is_none() || restarted) && current.is_some() {
            tauri::async_runtime::block_on(obs_store::close_session(
                &pool,
                current.as_ref().unwrap(),
                if restarted { "restarted" } else { "stopped" },
                if kind == "recording" {
                    client.stopped_record_path.as_deref()
                } else {
                    None
                },
            ))?;
            *current = None;
        }
        if elapsed.is_some() && current.is_none() {
            let fresh = id();
            tauri::async_runtime::block_on(obs_store::open_session(
                &pool,
                &fresh,
                kind,
                game.as_deref(),
            ))?;
            *current = Some(fresh);
        }
    }
    let last_record = {
        let i = state.inner.lock().map_err(|e| e.to_string())?;
        i.record_id.clone().or(i.last_record_id.clone())
    };
    if let (Some(path), Some(session)) = (client.stopped_record_path.take(), last_record) {
        tauri::async_runtime::block_on(
            sqlx::query("UPDATE obs_session SET output_path=$1 WHERE id=$2 AND workspace_id=$3")
                .bind(path)
                .bind(session)
                .bind(obs_store::WORKSPACE)
                .execute(&pool),
        )
        .map_err(|e| e.to_string())?;
    }
    let mut i = state.inner.lock().map_err(|e| e.to_string())?;
    if rid.is_some() {
        i.last_record_id = rid.clone();
    }
    i.record_id = rid;
    i.stream_id = sid;
    i.view.connected = true;
    i.view.recording = record_ms.is_some();
    i.view.streaming = stream_ms.is_some();
    i.view.paused = paused;
    i.view.record_ms = record_ms;
    i.view.stream_ms = stream_ms;
    i.view.error = None;
    i.view.last_update_ms = now();
    Ok(())
}
fn monitor(app: AppHandle) {
    let mut socket: Option<(u64, Client)> = None;
    loop {
        {
            let state = app.state::<ObsState>();
            let Ok(_guard) = state.operation.lock() else {
                return;
            };
            let (config, generation) = {
                let Ok(i) = state.inner.lock() else {
                    return;
                };
                (i.config.clone(), i.generation)
            };
            if !config.enabled {
                socket = None;
            } else {
                let result = (|| {
                    if socket.as_ref().is_none_or(|(g, _)| *g != generation) {
                        socket = Some((generation, Client::connect(config.port, &password()?)?));
                    }
                    poll(&app, &mut socket.as_mut().unwrap().1)
                })();
                if let Err(e) = result {
                    socket = None;
                    let _ = clear_sessions(&app, "connection_lost");
                    if let Ok(mut i) = state.inner.lock() {
                        i.view.error = Some(e);
                        i.view.connected = false;
                        i.view.recording = false;
                        i.view.streaming = false;
                        i.view.record_ms = None;
                        i.view.stream_ms = None;
                    }
                }
            }
        }
        thread::sleep(Duration::from_secs(2));
    }
}
/// Usado tanto por Tauri como por el botón HTTP del Stream Deck. Consulta tiempos nuevos de OBS.
pub fn mark(app: &AppHandle, title: Option<String>) -> Result<Value, String> {
    initialize(app)?;
    let state = app.state::<ObsState>();
    let _guard = state.operation.lock().map_err(|e| e.to_string())?;
    let config = {
        let i = state.inner.lock().map_err(|e| e.to_string())?;
        i.config.clone()
    };
    if !config.enabled {
        return Err("Conecta OBS antes de marcar un momento.".into());
    }
    let mut client = Client::connect(config.port, &password()?)?;
    if let Err(e) = poll(app, &mut client) {
        let _ = clear_sessions(app, "connection_lost");
        return Err(e);
    }
    let (session, record, stream, game) = {
        let i = state.inner.lock().map_err(|e| e.to_string())?;
        let record = if i.view.paused {
            None
        } else {
            i.view.record_ms
        };
        let session = if record.is_some() {
            i.record_id.clone()
        } else {
            i.stream_id.clone()
        };
        (session, record, i.view.stream_ms, i.game.clone())
    };
    let session = session.ok_or(
        "No hay grabación ni directo activos. Si la grabación está en pausa, reanúdala en OBS.",
    )?;
    let marker = id();
    let pool = pool(app)?;
    tauri::async_runtime::block_on(obs_store::insert_marker(
        &pool,
        &marker,
        &session,
        title.as_deref().unwrap_or("Momento"),
        record,
        stream,
        game.as_deref(),
    ))?;
    let result = json!({"id":marker,"record_ms":record,"stream_ms":stream});
    let _ = app.emit("obs-markers-changed", &marker);
    Ok(result)
}
#[tauri::command]
pub async fn obs_mark(app: AppHandle, title: Option<String>) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || mark(&app, title))
        .await
        .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn obs_markers(app: AppHandle) -> Result<Value, String> {
    let pool = crate::backup::pool(&app).await?;
    obs_store::list_markers(&pool).await
}
