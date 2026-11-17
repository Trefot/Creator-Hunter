//! Captura local, voluntaria y limitada. No empieza OBS, no publica ni elimina vídeos.
use crate::auto_moments_core::{self as core, Config};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{
    io::{BufRead, BufReader, Write},
    process::{Child, Command, Stdio},
    sync::Mutex,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_opener::OpenerExt;
const PREFIX: &str = "auto-moment:";
const LIMIT_BYTES: u64 = 2 * 1024 * 1024 * 1024;
#[derive(Clone, Serialize, Deserialize)]
pub struct Candidate {
    pub id: String,
    pub marker_id: Option<String>,
    pub output_path: String,
    pub source: String,
    pub reason: String,
    pub state: String,
    pub created_ms: u64,
    pub tail_ms: u64,
    pub before: u32,
    pub after: u32,
}
#[derive(Clone, Serialize)]
struct Pending {
    token: u64,
    source: String,
    triggered_ms: u64,
    save_at_ms: u64,
    phase: String,
}
#[derive(Default)]
struct Inner {
    hydrated: bool,
    config: Config,
    armed: bool,
    listening: bool,
    starting: bool,
    voice_generation: u64,
    child: Option<Child>,
    pending: Option<Pending>,
    last_trigger: Option<Instant>,
    message: String,
}
#[derive(Default)]
pub struct AutoMomentsState {
    gate: Mutex<()>,
    inner: Mutex<Inner>,
}
impl Drop for AutoMomentsState {
    fn drop(&mut self) {
        if let Ok(i) = self.inner.get_mut() {
            if let Some(mut child) = i.child.take() {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    }
}
fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}
fn hydrate(app: &AppHandle) -> Result<(), String> {
    if app
        .state::<AutoMomentsState>()
        .inner
        .lock()
        .map_err(|e| e.to_string())?
        .hydrated
    {
        return Ok(());
    }
    let value =
        tauri::async_runtime::block_on(crate::social_alerts::load(app, "auto-moments-config"))?;
    let config = if value.is_null() {
        Config::default()
    } else {
        serde_json::from_value(value).map_err(|_| "Configuración de momentos no válida.")?
    };
    let state = app.state::<AutoMomentsState>();
    let mut i = state.inner.lock().map_err(|e| e.to_string())?;
    i.config = config;
    i.hydrated = true;
    Ok(())
}
fn activity(app: &AppHandle) -> Value {
    let state = app.state::<AutoMomentsState>();
    let i = state.inner.lock().unwrap();
    json!({"armed":i.armed,"listening":i.listening,"starting":i.starting,"pending":i.pending,"message":i.message})
}
fn emit(app: &AppHandle) {
    let _ = app.emit("auto-moments-changed", activity(app));
}
fn message(app: &AppHandle, text: String) {
    let changed = {
        let state = app.state::<AutoMomentsState>();
        let mut i = state.inner.lock().unwrap();
        if i.message == text {
            false
        } else {
            i.message = text;
            true
        }
    };
    if changed {
        emit(app);
    }
}

pub(crate) fn candidates(app: &AppHandle) -> Result<Vec<Candidate>, String> {
    tauri::async_runtime::block_on(async {
        let pool = crate::backup::pool(app).await?;
        let rows: Vec<String> = sqlx::query_scalar(
            "SELECT content FROM alert_cursor WHERE id LIKE 'auto-moment:%' ORDER BY id LIMIT 501",
        )
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;
        rows.into_iter().map(|s|serde_json::from_str(&s).map_err(|_|"No se pudo leer un candidato guardado. Revisa la copia de seguridad antes de continuar.".into())).collect()
    })
}
fn store(app: &AppHandle, c: &Candidate) -> Result<(), String> {
    tauri::async_runtime::block_on(crate::social_alerts::save(
        app,
        &format!("{PREFIX}{}", c.id),
        &json!(c),
    ))
}
fn usage(items: &[Candidate]) -> Result<u64, String> {
    let mut total = 0u64;
    for c in items {
        match std::fs::metadata(&c.output_path){Ok(m)=>total=total.saturating_add(m.len()),Err(e)if e.kind()==std::io::ErrorKind::NotFound=>{},Err(_)=>return Err("No se pudo medir el espacio de un candidato. Comprueba el acceso a la carpeta de OBS antes de capturar más.".into())}
    }
    Ok(total)
}

fn buffer_ready(app: &AppHandle) -> Result<(), String> {
    crate::obs::operate(app, |c| {
        if c.request("GetReplayBufferStatus")?["outputActive"] != true {
            return Err("Activa el Replay Buffer en OBS antes de capturar momentos. Nexus no lo inicia por ti.".into());
        }
        Ok(())
    })
}
fn configure(app: &AppHandle, config: Config) -> Result<(), String> {
    config.validate()?;
    let state = app.state::<AutoMomentsState>();
    let _gate = state.gate.lock().map_err(|e| e.to_string())?;
    hydrate(app)?;
    {
        let i = state.inner.lock().unwrap();
        if i.armed || i.starting || i.child.is_some() || i.pending.is_some() {
            return Err(
                "Desactiva la captura y espera el guardado pendiente antes de cambiar sus ajustes."
                    .into(),
            );
        }
    }
    tauri::async_runtime::block_on(crate::social_alerts::save(
        app,
        "auto-moments-config",
        &json!(config),
    ))?;
    state.inner.lock().unwrap().config = config;
    emit(app);
    Ok(())
}
fn arm(app: &AppHandle) -> Result<(), String> {
    let state = app.state::<AutoMomentsState>();
    let _gate = state.gate.lock().map_err(|e| e.to_string())?;
    hydrate(app)?;
    let config = state.inner.lock().unwrap().config.clone();
    config.validate()?;
    if !config.buffer_confirmed {
        return Err(
            "Configura el tiempo del Replay Buffer en OBS y confirma sus segundos en Nexus.".into(),
        );
    }
    buffer_ready(app)?;
    {
        let mut i = state.inner.lock().unwrap();
        i.armed = true;
        i.message =
            "Captura activada para esta sesión. El botón Momento también solicitará un clip."
                .into();
    }
    emit(app);
    Ok(())
}
fn stop_voice(app: &AppHandle) {
    let child = {
        let state = app.state::<AutoMomentsState>();
        let mut i = state.inner.lock().unwrap();
        i.voice_generation = i.voice_generation.wrapping_add(1);
        i.listening = false;
        i.starting = false;
        i.child.take()
    };
    if let Some(mut child) = child {
        let _ = child.kill();
        let _ = child.wait();
    }
    emit(app);
}
fn disarm(app: &AppHandle) {
    stop_voice(app);
    {
        let state = app.state::<AutoMomentsState>();
        let mut i = state.inner.lock().unwrap();
        i.armed = false;
        if i.pending.as_ref().is_some_and(|p| p.phase == "waiting") {
            i.pending = None;
        }
        i.message=if i.pending.is_some(){"Captura desactivada. OBS ya está guardando el clip solicitado; se conservará su resultado."}else{"Captura y micrófono desactivados. No se reactivan al reiniciar Nexus."}.into();
    }
    emit(app);
}
/// Orden de bloqueo compartido con la restauración: captura → operación OBS.
pub(crate) fn with_capture_paused<T>(
    app: &AppHandle,
    work: impl FnOnce() -> Result<T, String>,
) -> Result<T, String> {
    let state = app.state::<AutoMomentsState>();
    let _gate = state.gate.lock().map_err(|e| e.to_string())?;
    if state
        .inner
        .lock()
        .unwrap()
        .pending
        .as_ref()
        .is_some_and(|p| p.phase == "saving")
    {
        return Err("Espera a que OBS confirme el candidato antes de restaurar una copia.".into());
    }
    disarm(app);
    let result = work();
    {
        let mut i = state.inner.lock().unwrap();
        i.hydrated = false;
        i.config = Config::default();
        i.last_trigger = None;
        i.message =
            "Captura desactivada para restaurar los datos. Actívala de nuevo cuando estés listo."
                .into();
    }
    emit(app);
    result
}
fn finish(app: &AppHandle, token: u64, result: Result<(), String>) {
    {
        let state = app.state::<AutoMomentsState>();
        let mut i = state.inner.lock().unwrap();
        if i.pending.as_ref().map(|p| p.token) != Some(token) {
            return;
        }
        i.pending = None;
        i.message = match result {
            Ok(()) => "Candidato guardado. Revísalo en Momentos antes de crear el Short.".into(),
            Err(e) => {
                format!("No se confirmó el candidato: {e}. No se reintentará automáticamente.")
            }
        };
    }
    emit(app);
}
fn request(app: &AppHandle, source: &str, voice_generation: Option<u64>) -> Result<(), String> {
    let state = app.state::<AutoMomentsState>();
    let _gate = state.gate.lock().map_err(|e| e.to_string())?;
    hydrate(app)?;
    let started = Instant::now();
    let triggered_ms = now();
    let config = {
        let i = state.inner.lock().unwrap();
        if voice_generation.is_some_and(|g| g != i.voice_generation) {
            return Err("La escucha ya se detuvo.".into());
        }
        if !i.armed {
            return Err("Activa primero la captura de momentos para esta sesión.".into());
        }
        if i.pending.is_some() {
            return Err(
                "Ya hay una captura pendiente. Espera o cancélala antes de solicitar otra.".into(),
            );
        }
        if i.last_trigger
            .is_some_and(|t| t.elapsed() < Duration::from_secs(90))
        {
            return Err("Espera 90 segundos entre capturas para evitar duplicados.".into());
        }
        i.config.clone()
    };
    let items = candidates(app)?;
    if items.len() >= 500 {
        return Err("El historial de capturas alcanzó su límite de 500. Gestiona los archivos y el historial antes de añadir más.".into());
    }
    if items.iter().filter(|c| c.state == "pending").count() >= 20 {
        return Err(
            "Hay 20 candidatos pendientes. Revisa o descarta algunos antes de capturar más.".into(),
        );
    }
    let value =
        tauri::async_runtime::block_on(crate::social_alerts::load(app, "auto-moments-quota"))?;
    let mut quota: Vec<u64> = if value.is_null() {
        vec![]
    } else {
        serde_json::from_value(value)
            .map_err(|_| "No se pudo leer el límite horario de capturas.")?
    };
    quota.retain(|stamp| triggered_ms.saturating_sub(*stamp) < 3_600_000);
    if quota.len().max(
        items
            .iter()
            .filter(|c| triggered_ms.saturating_sub(c.created_ms) < 3_600_000)
            .count(),
    ) >= 6
    {
        return Err("Límite de seis solicitudes por hora alcanzado.".into());
    }
    if quota
        .iter()
        .any(|stamp| triggered_ms.saturating_sub(*stamp) < 90_000)
    {
        return Err("Espera 90 segundos entre capturas para evitar duplicados.".into());
    }
    if usage(&items)? >= LIMIT_BYTES {
        return Err("Los archivos de candidatos ocupan al menos 2 GB. Gestiona los vídeos desde su carpeta antes de capturar más; descartar no borra archivos.".into());
    }
    buffer_ready(app)?;
    quota.push(triggered_ms);
    tauri::async_runtime::block_on(crate::social_alerts::save(
        app,
        "auto-moments-quota",
        &json!(quota),
    ))?;
    let token = rand::random::<u64>();
    {
        let mut i = state.inner.lock().unwrap();
        if !i.armed {
            return Err("Se desactivó la captura.".into());
        }
        i.last_trigger = Some(Instant::now());
        i.pending = Some(Pending {
            token,
            source: source.into(),
            triggered_ms,
            save_at_ms: triggered_ms + config.after as u64 * 1000,
            phase: "waiting".into(),
        });
        i.message = format!(
            "Momento detectado. Se guardará después de {} segundos.",
            config.after
        );
    }
    emit(app);
    let app = app.clone();
    let source = source.to_string();
    std::thread::spawn(move || {
        while started.elapsed() < Duration::from_secs(config.after as u64) {
            if app
                .state::<AutoMomentsState>()
                .inner
                .lock()
                .unwrap()
                .pending
                .as_ref()
                .map(|p| p.token)
                != Some(token)
            {
                return;
            }
            std::thread::sleep(Duration::from_millis(100));
        }
        {
            let state = app.state::<AutoMomentsState>();
            let mut i = state.inner.lock().unwrap();
            let Some(p) = i.pending.as_mut().filter(|p| p.token == token) else {
                return;
            };
            p.phase = "saving".into();
        }
        emit(&app);
        let result = (|| {
            let result = crate::obs::save_replay(
                &app,
                Some(
                    if source == "voice" {
                        "Momento por voz"
                    } else {
                        "Momento capturado"
                    }
                    .into(),
                ),
            )?;
            let candidate = Candidate {
                id: result["id"]
                    .as_str()
                    .ok_or("OBS no devolvió el identificador del clip.")?
                    .into(),
                marker_id: result["marker_id"].as_str().map(String::from),
                output_path: result["output_path"]
                    .as_str()
                    .ok_or("OBS no confirmó el archivo.")?
                    .into(),
                source: source.clone(),
                reason: if source == "voice" {
                    format!("Frase: {}", config.phrase)
                } else {
                    "Botón Momento / captura manual".into()
                },
                state: "pending".into(),
                created_ms: triggered_ms,
                tail_ms: result["requested_at_ms"]
                    .as_u64()
                    .unwrap_or_else(now)
                    .saturating_sub(triggered_ms),
                before: config.before,
                after: config.after,
            };
            store(&app, &candidate).map_err(|e| {
                format!(
                    "El clip original está guardado en {} pero no se pudo crear su ficha: {e}",
                    candidate.output_path
                )
            })?;
            Ok(())
        })();
        finish(&app, token, result);
    });
    Ok(())
}
pub(crate) fn capture_from_deck(app: &AppHandle) -> Result<Value, String> {
    request(app, "button", None)?;
    Ok(
        json!({"queued":true,"message":"Captura pendiente; revisa Momentos para confirmar el archivo."}),
    )
}
/// El marcado tradicional sigue funcionando aunque la captura esté apagada o falle.
pub(crate) fn on_mark(app: &AppHandle) {
    if !app.state::<AutoMomentsState>().inner.lock().unwrap().armed {
        return;
    }
    let app = app.clone();
    std::thread::spawn(move || {
        if let Err(e) = request(&app, "button", None) {
            message(&app, format!("Marca guardada, sin clip adicional: {e}"));
        }
    });
}
#[cfg(windows)]
fn powershell(script: &str) -> Command {
    use base64::{Engine, engine::general_purpose::STANDARD};
    use std::os::windows::process::CommandExt;
    let bytes: Vec<u8> = script.encode_utf16().flat_map(u16::to_le_bytes).collect();
    let mut c = Command::new("powershell.exe");
    c.creation_flags(0x08000000).args([
        "-NoProfile",
        "-NonInteractive",
        "-EncodedCommand",
        &STANDARD.encode(bytes),
    ]);
    c
}
#[cfg(not(windows))]
fn powershell(_script: &str) -> Command {
    Command::new("nexus-local-recognition-requires-windows")
}
fn start_voice(app: &AppHandle) -> Result<(), String> {
    if !cfg!(windows) {
        return Err(
            "La escucha local de esta versión requiere Windows y un reconocedor de voz instalado."
                .into(),
        );
    }
    arm(app)?;
    let state = app.state::<AutoMomentsState>();
    let _gate = state.gate.lock().map_err(|e| e.to_string())?;
    let (config, generation) = {
        let mut i = state.inner.lock().unwrap();
        if !i.armed {
            return Err("La captura se desactivó antes de iniciar el micrófono.".into());
        }
        if i.child.is_some() {
            return Err("La escucha ya está iniciada.".into());
        }
        i.voice_generation = i.voice_generation.wrapping_add(1);
        (i.config.clone(), i.voice_generation)
    };
    let mut child = powershell(include_str!("auto_moments_voice.ps1"))
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("No se pudo abrir el reconocedor local: {e}"))?;
    let data = json!({"parent":std::process::id(),"phrase":config.phrase,"culture":config.culture})
        .to_string();
    let written = child
        .stdin
        .take()
        .ok_or("No se abrió la entrada del reconocedor.")
        .and_then(|mut input| {
            input
                .write_all(data.as_bytes())
                .map_err(|_| "No se pudo configurar el reconocedor.")
        });
    if let Err(e) = written {
        let _ = child.kill();
        let _ = child.wait();
        return Err(e.into());
    }
    let Some(stdout) = child.stdout.take() else {
        let _ = child.kill();
        let _ = child.wait();
        return Err("No se pudo leer el reconocedor.".into());
    };
    {
        let mut i = state.inner.lock().unwrap();
        i.child = Some(child);
        i.starting = true;
        i.message =
            "Iniciando el reconocedor local y el micrófono predeterminado de Windows…".into();
    }
    emit(app);
    let timeout_app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_secs(30));
        let state = timeout_app.state::<AutoMomentsState>();
        let Ok(_gate) = state.gate.lock() else { return };
        let timed_out = {
            let i = state.inner.lock().unwrap();
            i.voice_generation == generation && i.starting
        };
        if timed_out {
            stop_voice(&timeout_app);
            message(&timeout_app,"La escucha no terminó de iniciar en 30 segundos. Revisa el micrófono y los reconocedores locales; el botón de captura sigue disponible.".into());
        }
    });
    let app = app.clone();
    std::thread::spawn(move || {
        let mut failed = false;
        for line in BufReader::new(stdout).lines() {
            let Ok(line) = line else { break };
            let Ok(v) = serde_json::from_str::<Value>(line.trim().trim_start_matches('\u{feff}'))
            else {
                continue;
            };
            if app
                .state::<AutoMomentsState>()
                .inner
                .lock()
                .unwrap()
                .voice_generation
                != generation
            {
                break;
            }
            match v["event"].as_str() {
                Some("ready") => {
                    {
                        let state = app.state::<AutoMomentsState>();
                        let mut i = state.inner.lock().unwrap();
                        i.starting = false;
                        i.listening = true;
                        i.message="Escucha local activa. El reconocedor no guarda audio aparte ni lo envía a Internet; los clips conservan el audio de OBS.".into();
                    }
                    emit(&app)
                }
                Some("recognized") => {
                    if core::accepted(
                        &config,
                        v["text"].as_str().unwrap_or(""),
                        v["confidence"].as_f64().unwrap_or(0.0),
                    ) {
                        if let Err(e) = request(&app, "voice", Some(generation)) {
                            message(&app, e)
                        }
                    }
                }
                Some("error") => {
                    failed = true;
                    message(
                        &app,
                        format!(
                            "Reconocimiento detenido: {}",
                            v["message"]
                                .as_str()
                                .unwrap_or("No se pudo iniciar el micrófono.")
                        ),
                    );
                    break;
                }
                _ => {}
            }
        }
        let child = {
            let state = app.state::<AutoMomentsState>();
            let mut i = state.inner.lock().unwrap();
            if i.voice_generation != generation {
                return;
            }
            if !failed && (i.listening || i.starting) {
                i.message =
                    "El reconocedor local se cerró. La captura por botón sigue activa.".into();
            }
            i.listening = false;
            i.starting = false;
            i.child.take()
        };
        if let Some(mut c) = child {
            let _ = c.kill();
            let _ = c.wait();
        }
        emit(&app);
    });
    Ok(())
}
#[tauri::command]
pub async fn auto_moments_status(app: AppHandle) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move||{let state=app.state::<AutoMomentsState>();let _gate=state.gate.lock().map_err(|e|e.to_string())?;hydrate(&app)?;let items=candidates(&app)?;let bytes=usage(&items)?;let entries:Vec<Value>=items.iter().map(|c|{let mut v=json!(c);v["exists"]=json!(std::path::Path::new(&c.output_path).is_file());v}).collect();let config=state.inner.lock().unwrap().config.clone();Ok(json!({"config":config,"activity":activity(&app),"items":entries,"bytes":bytes,"limit_bytes":LIMIT_BYTES}))}).await.map_err(|e|e.to_string())?
}
#[tauri::command]
pub fn auto_moments_activity(app: AppHandle) -> Value {
    activity(&app)
}
#[tauri::command]
pub async fn auto_moments_configure(app: AppHandle, config: Config) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || configure(&app, config))
        .await
        .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn auto_moments_control(app: AppHandle, action: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move||match action.as_str(){"arm"=>arm(&app),"listen"=>start_voice(&app),"stop_voice"=>{let state=app.state::<AutoMomentsState>();let _gate=state.gate.lock().map_err(|e|e.to_string())?;stop_voice(&app);message(&app,"Escucha detenida. La captura por botón sigue disponible y la espera pendiente continúa.".into());Ok(())},"off"=>{let state=app.state::<AutoMomentsState>();let _gate=state.gate.lock().map_err(|e|e.to_string())?;disarm(&app);Ok(())},"capture"=>request(&app,"button",None),"cancel"=>{{let state=app.state::<AutoMomentsState>();let mut i=state.inner.lock().unwrap();if i.pending.as_ref().is_some_and(|p|p.phase=="saving"){return Err("OBS ya está guardando; no se puede cancelar ni borrar automáticamente el archivo.".into())}i.pending=None;i.message="Espera cancelada. Las marcas manuales existentes se conservan.".into();}emit(&app);Ok(())},_=>Err("Control de captura no válido.".into())}).await.map_err(|e|e.to_string())?
}
#[tauri::command]
pub async fn auto_moments_review(app: AppHandle, id: String, action: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        if !["pending", "kept", "discarded", "open"].contains(&action.as_str()) {
            return Err("Revisión no válida.".into());
        }
        let state = app.state::<AutoMomentsState>();
        let _gate = state.gate.lock().map_err(|e| e.to_string())?;
        let mut c = candidates(&app)?
            .into_iter()
            .find(|c| c.id == id)
            .ok_or("No existe ese candidato.")?;
        if action == "open" {
            if !std::path::Path::new(&c.output_path).is_file() {
                return Err("El archivo se movió o eliminó.".into());
            }
            app.opener()
                .open_path(c.output_path, None::<&str>)
                .map_err(|e| e.to_string())?;
        } else {
            c.state = action;
            store(&app, &c)?;
            emit(&app)
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn auto_moments_languages() -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(||{let out=powershell("$ErrorActionPreference='Stop';[Console]::OutputEncoding=New-Object Text.UTF8Encoding($false);Add-Type -AssemblyName System.Speech;ConvertTo-Json -Compress -InputObject @([System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers()|ForEach-Object {@{culture=$_.Culture.Name;name=$_.Description}})").output().map_err(|_|"El reconocimiento local requiere Windows.".to_string())?;if !out.status.success(){return Err("No se pudieron consultar los reconocedores locales de Windows.".into())}serde_json::from_str(String::from_utf8_lossy(&out.stdout).trim().trim_start_matches('\u{feff}')).map_err(|_|"Windows no devolvió una lista de idiomas válida.".into())}).await.map_err(|e|e.to_string())?
}
#[tauri::command]
pub async fn auto_moments_cleanup(app: AppHandle) -> Result<u64, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AutoMomentsState>();
        let _gate = state.gate.lock().map_err(|e| e.to_string())?;
        let remove: Vec<_> = candidates(&app)?
            .into_iter()
            .filter(|c| {
                c.state == "discarded"
                    && std::fs::metadata(&c.output_path)
                        .is_err_and(|e| e.kind() == std::io::ErrorKind::NotFound)
            })
            .collect();
        tauri::async_runtime::block_on(async {
            let pool = crate::backup::pool(&app).await?;
            let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
            let mut removed = 0;
            for c in remove {
                removed += sqlx::query("DELETE FROM alert_cursor WHERE id=?")
                    .bind(format!("{PREFIX}{}", c.id))
                    .execute(&mut *tx)
                    .await
                    .map_err(|e| e.to_string())?
                    .rows_affected();
            }
            tx.commit().await.map_err(|e| e.to_string())?;
            emit(&app);
            Ok(removed)
        })
    })
    .await
    .map_err(|e| e.to_string())?
}
#[cfg(test)]
mod tests {
    #[test]
    fn powershell_is_valid_syntax() {
        if !cfg!(windows) {
            return;
        }
        let script = include_str!("auto_moments_voice.ps1");
        let validate = "$s=[Console]::In.ReadToEnd();$tokens=$null;$errors=$null;$null=[Management.Automation.Language.Parser]::ParseInput($s,[ref]$tokens,[ref]$errors);if($errors.Count){exit 1}";
        let mut child = super::powershell(validate)
            .stdin(std::process::Stdio::piped())
            .spawn()
            .unwrap();
        use std::io::Write;
        child
            .stdin
            .take()
            .unwrap()
            .write_all(script.as_bytes())
            .unwrap();
        assert!(child.wait().unwrap().success());
    }
}

#[tauri::command]
pub async fn auto_moments_delete_file(app:AppHandle,id:String,confirmed:bool)->Result<(),String>{
 if !confirmed{return Err("Confirma el envío del vídeo a la papelera.".into())}
 let jobs=crate::media_jobs::media_jobs_status(app.clone());
 if jobs["jobs"].as_array().is_some_and(|rows|rows.iter().any(|j|matches!(j["state"].as_str(),Some("queued"|"running"|"finishing")))){return Err("Termina el procesamiento antes de liberar espacio.".into())}
 let pool=crate::backup::pool(&app).await?;
 let used:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM project WHERE id=$1 UNION ALL SELECT 1 FROM clip_export WHERE source_kind='clip' AND source_id=$2)").bind(format!("capture-project-clip-{id}")).bind(&id).fetch_one(&pool).await.map_err(|e|e.to_string())?;
 if used{return Err("Este clip está vinculado a un proyecto o una exportación. Conserva el original o gestiona el archivo desde el explorador.".into())}
 tauri::async_runtime::spawn_blocking(move||{
  let state=app.state::<AutoMomentsState>();let _gate=state.gate.lock().map_err(|e|e.to_string())?;
  let candidate=candidates(&app)?.into_iter().find(|c|c.id==id&&c.state=="discarded").ok_or("Solo se pueden retirar vídeos descartados.")?;
  if !std::path::Path::new(&candidate.output_path).is_file(){return Err("El archivo ya no está en esa carpeta.".into())}
  #[cfg(windows)]{let out=powershell("$ErrorActionPreference='Stop';Add-Type -AssemblyName Microsoft.VisualBasic;[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($env:NEXUS_REMOVE_PATH,'OnlyErrorDialogs','SendToRecycleBin')").env("NEXUS_REMOVE_PATH",&candidate.output_path).output().map_err(|_|"No se pudo abrir la papelera de Windows.")?;if !out.status.success(){return Err("Windows no pudo enviar el archivo a la papelera. Puede estar en uso.".into())}emit(&app);Ok(())}
  #[cfg(not(windows))]{Err("El envío a la papelera está disponible en Windows.".into())}
 }).await.map_err(|e|e.to_string())?
}
