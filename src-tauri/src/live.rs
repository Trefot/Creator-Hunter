//! Live Studio (D-018): servidor HTTP local para OBS y el Stream Deck.
//!
//! Solo escucha en 127.0.0.1 (nunca en la red). Las rutas de lectura (el overlay y la lista de
//! contadores) son abiertas; las que cambian un contador exigen la clave local (`key`), para que
//! una página web cualquiera no pueda tocarlos desde el navegador.
//!
//! - `GET /overlay[?c=id1,id2&layout=row|column]`: página para la "Fuente de navegador" de OBS.
//! - `GET /api/counters`: los contadores en JSON.
//! - `GET /api/counters/live?since=N`: espera (hasta 20 s) a que algo cambie y devuelve
//!   `{ change, counters }`. Así el overlay reacciona en el mismo instante en que se pulsa (D-022).
//! - `GET /api/counters/{id}/image` y `/sound`: el PNG y el sonido propios (se piden solo si cambian).
//! - `GET /api/counters/{id}/{inc|dec|reset}?key=…`: para el Stream Deck ("Sitio web" en segundo plano).

use std::fs;
use std::sync::{Condvar, Mutex};
use std::thread;
use std::time::Duration;

use serde::Serialize;
use serde_json::json;
use sqlx::Row;
use tauri::{AppHandle, Emitter, Manager, State};
use tiny_http::{Header, Request, Response, Server};

/// D-019: la versión de pruebas usa otro puerto para no chocar con la app instalada.
pub const PORT: u16 = if cfg!(debug_assertions) { 7879 } else { 7878 };
const KEY_FILE: &str = if cfg!(debug_assertions) { "live-key-dev.txt" } else { "live-key.txt" };
const OVERLAY_HTML: &str = include_str!("../overlay/counters.html");
/// Lo que espera como mucho una petición `live` antes de responder sin cambios.
const LONG_POLL: Duration = Duration::from_secs(20);

/// Número de cambio: sube con cada modificación de un contador y despierta a los overlays.
static CHANGE: Mutex<u64> = Mutex::new(0);
static CHANGED: Condvar = Condvar::new();

#[derive(Clone, Default, Serialize)]
pub struct LiveInfo {
    pub running: bool,
    pub port: u16,
    pub key: String,
    pub error: Option<String>,
}

#[derive(Default)]
pub struct LiveState(pub Mutex<LiveInfo>);

/// Estado del servidor local (para mostrar las URLs en la app).
#[tauri::command]
pub fn live_status(state: State<'_, LiveState>) -> LiveInfo {
    state.0.lock().map(|i| i.clone()).unwrap_or_default()
}

/// La app avisa de que cambió un contador desde su propia interfaz.
#[tauri::command]
pub fn live_notify() {
    bump_change();
}

fn bump_change() {
    if let Ok(mut n) = CHANGE.lock() {
        *n += 1;
        CHANGED.notify_all();
    }
}

/// Espera a que el número de cambio pase de `since` (o a que se agote el tiempo) y lo devuelve.
fn wait_change(since: u64) -> u64 {
    let Ok(guard) = CHANGE.lock() else { return since };
    match CHANGED.wait_timeout_while(guard, LONG_POLL, |n| *n <= since) {
        Ok((n, _)) => *n,
        Err(_) => since,
    }
}

/// Clave local: se genera una vez y se guarda en la carpeta de datos de la app.
fn load_key(app: &AppHandle) -> Result<String, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(KEY_FILE);
    if let Ok(existing) = fs::read_to_string(&path) {
        let existing = existing.trim().to_string();
        if existing.len() >= 16 && existing.chars().all(|c| c.is_ascii_hexdigit()) {
            return Ok(existing);
        }
    }
    let key: String = (0..12).map(|_| format!("{:02x}", rand::random::<u8>())).collect();
    fs::write(&path, &key).map_err(|e| e.to_string())?;
    Ok(key)
}

/// Arranca el servidor. Cada petición va en su propio hilo: las de `live` se quedan esperando
/// cambios sin bloquear a las demás (el Stream Deck, las imágenes…).
pub fn start(app: AppHandle) {
    let mut info = LiveInfo { port: PORT, ..Default::default() };
    match load_key(&app) {
        Ok(key) => info.key = key,
        Err(e) => info.error = Some(format!("No se pudo crear la clave local: {e}")),
    }
    if info.error.is_none() {
        match Server::http(("127.0.0.1", PORT)) {
            Ok(server) => {
                info.running = true;
                let key = info.key.clone();
                let handle = app.clone();
                thread::spawn(move || {
                    for request in server.incoming_requests() {
                        let handle = handle.clone();
                        let key = key.clone();
                        thread::spawn(move || handle_request(&handle, &key, request));
                    }
                });
            }
            Err(e) => info.error = Some(format!("No se pudo abrir el puerto {PORT}: {e}")),
        }
    }
    if let Ok(mut state) = app.state::<LiveState>().0.lock() {
        *state = info;
    }
}

fn header(name: &str, value: &str) -> Header {
    Header::from_bytes(name.as_bytes(), value.as_bytes()).expect("cabecera válida")
}

fn respond_json(request: Request, status: u16, body: serde_json::Value) {
    let response = Response::from_string(body.to_string())
        .with_status_code(status)
        .with_header(header("Content-Type", "application/json; charset=utf-8"))
        .with_header(header("Cache-Control", "no-store"));
    let _ = request.respond(response);
}

fn respond_blob(request: Request, result: Result<Option<(String, Vec<u8>)>, String>, missing: &str) {
    match result {
        Ok(Some((mime, bytes))) => {
            let response = Response::from_data(bytes)
                .with_header(header("Content-Type", &mime))
                .with_header(header("Cache-Control", "max-age=31536000"));
            let _ = request.respond(response);
        }
        Ok(None) => respond_json(request, 404, json!({ "error": missing })),
        Err(e) => respond_json(request, 400, json!({ "error": e })),
    }
}

fn handle_request(app: &AppHandle, key: &str, request: Request) {
    let url = match url::Url::parse(&format!("http://127.0.0.1{}", request.url())) {
        Ok(u) => u,
        Err(_) => return respond_json(request, 400, json!({ "error": "URL no válida" })),
    };
    let segments: Vec<String> = url.path_segments().map(|s| s.map(String::from).collect()).unwrap_or_default();
    let query = |name: &str| url.query_pairs().find(|(k, _)| k == name).map(|(_, v)| v.to_string());

    match segments.iter().map(String::as_str).collect::<Vec<_>>().as_slice() {
        ["game-overlay"] => {
            let response=Response::from_string(include_str!("../overlay/game.html")).with_header(header("Content-Type","text/html; charset=utf-8")).with_header(header("Cache-Control","no-store"));let _=request.respond(response);
        }
        ["api","game","state"] => {
            let result=tauri::async_runtime::block_on(async {let pool=crate::backup::pool(app).await?;crate::game_broadcast::state(&pool).await});
            match result {Ok(data)=>respond_json(request,200,data),Err(error)=>respond_json(request,503,json!({"error":error}))}
        }
        ["api","game","current",action] => {
            if query("key").as_deref()!=Some(key){return respond_json(request,403,json!({"error":"Falta la clave local o no es correcta."}));}
            let result=tauri::async_runtime::block_on(async {let pool=crate::backup::pool(app).await?;crate::game_broadcast::current_action(&pool,action).await});
            match result {Ok(data)=>{let _=app.emit("game-targets-changed",&data);respond_json(request,200,data)},Err(error)=>respond_json(request,409,json!({"error":error}))}
        }
        ["api", "clips", "save"] => {
            if query("key").as_deref() != Some(key) {
                return respond_json(request, 403, json!({ "error": "Falta la clave local o no es correcta." }));
            }
            match crate::obs::save_replay(app, query("title")) {
                Ok(clip) => respond_json(request, 200, clip),
                Err(error) => respond_json(request, 409, json!({"error":error})),
            }
        }
        ["api", "moments", "mark"] => {
            if query("key").as_deref() != Some(key) {
                return respond_json(request, 403, json!({ "error": "Falta la clave local o no es correcta." }));
            }
            match crate::obs::mark(app, query("title")) {
                Ok(marker) => respond_json(request, 200, marker),
                Err(error) => respond_json(request, 409, json!({"error":error})),
            }
        }
        ["overlay"] | ["overlay", ""] => {
            let response = Response::from_string(OVERLAY_HTML)
                .with_header(header("Content-Type", "text/html; charset=utf-8"))
                .with_header(header("Cache-Control", "no-store"));
            let _ = request.respond(response);
        }
        ["api", "counters"] => match tauri::async_runtime::block_on(list_counters(app)) {
            Ok(list) => respond_json(request, 200, list),
            Err(e) => respond_json(request, 503, json!({ "error": e })),
        },
        ["api", "counters", "live"] => {
            // Solo espera si el overlay está al día (`since` == actual). Sin `since`, o con uno de otra
            // sesión de la app (tras reiniciarla el contador vuelve a 0), responde al momento.
            let current = CHANGE.lock().map(|n| *n).unwrap_or(0);
            let change = match query("since").and_then(|s| s.parse::<u64>().ok()) {
                Some(since) if since == current => wait_change(since),
                _ => current,
            };
            match tauri::async_runtime::block_on(list_counters(app)) {
                Ok(list) => respond_json(
                    request,
                    200,
                    json!({ "change": change, "counters": list, "app_version": app.package_info().version.to_string() }),
                ),
                Err(e) => respond_json(request, 503, json!({ "error": e })),
            }
        }
        ["api", "counters", id, "image"] => {
            let result = tauri::async_runtime::block_on(counter_blob(app, id, "image", "image/"));
            respond_blob(request, result, "Ese contador no tiene imagen.")
        }
        ["api", "counters", id, "sound"] => {
            let result = tauri::async_runtime::block_on(counter_blob(app, id, "sound", "audio/"));
            respond_blob(request, result, "Ese contador no tiene sonido propio.")
        }
        ["api", "counters", id, action] => {
            if query("key").as_deref() != Some(key) {
                return respond_json(request, 403, json!({ "error": "Falta la clave local o no es correcta." }));
            }
            let id = id.to_string();
            let action = action.to_string();
            match tauri::async_runtime::block_on(change_counter(app, &id, &action)) {
                Ok(value) => {
                    bump_change();
                    let _ = app.emit("counters-changed", &id);
                    respond_json(request, 200, json!({ "id": id, "value": value }))
                }
                Err(e) => respond_json(request, 400, json!({ "error": e })),
            }
        }
        _ => respond_json(request, 404, json!({ "error": "No existe esa ruta." })),
    }
}

async fn list_counters(app: &AppHandle) -> Result<serde_json::Value, String> {
    let pool = crate::backup::pool(app).await?;
    let rows = sqlx::query(
        "SELECT id, name, icon, color, value, bg_color, bg_opacity, style, sound_on, sound_volume,
                icon_scale, title_color, number_color,
                image IS NOT NULL AS has_image,
                COALESCE(length(image) || '-' || substr(image, -24), '') AS image_version,
                sound IS NOT NULL AS has_sound,
                COALESCE(length(sound) || '-' || substr(sound, -24), '') AS sound_version
           FROM counter ORDER BY position, created_at",
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;
    let list: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            json!({
                "id": r.get::<String, _>("id"),
                "name": r.get::<String, _>("name"),
                "icon": r.get::<String, _>("icon"),
                "color": r.get::<String, _>("color"),
                "value": r.get::<i64, _>("value"),
                "bg_color": r.get::<String, _>("bg_color"),
                "bg_opacity": r.get::<i64, _>("bg_opacity"),
                "style": r.get::<String, _>("style"),
                "sound_on": r.get::<bool, _>("sound_on"),
                "sound_volume": r.get::<i64, _>("sound_volume"),
                "icon_scale": r.get::<i64, _>("icon_scale"),
                "title_color": r.get::<String, _>("title_color"),
                "number_color": r.get::<String, _>("number_color"),
                "has_image": r.get::<bool, _>("has_image"),
                // Solo cambian si cambia el archivo: el overlay lo vuelve a pedir únicamente entonces.
                "image_version": r.get::<String, _>("image_version"),
                "has_sound": r.get::<bool, _>("has_sound"),
                "sound_version": r.get::<String, _>("sound_version"),
            })
        })
        .collect();
    Ok(json!(list))
}

async fn change_counter(app: &AppHandle, id: &str, action: &str) -> Result<i64, String> {
    let sql = match action {
        "inc" => "UPDATE counter SET value = value + step, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = $1",
        "dec" => "UPDATE counter SET value = MAX(value - step, 0), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = $1",
        "reset" => "UPDATE counter SET value = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = $1",
        _ => return Err("Acción no válida: usa inc, dec o reset.".into()),
    };
    let pool = crate::backup::pool(app).await?;
    let done = sqlx::query(sql).bind(id).execute(&pool).await.map_err(|e| e.to_string())?;
    if done.rows_affected() == 0 {
        return Err("No existe ese contador.".into());
    }
    let row = sqlx::query("SELECT value FROM counter WHERE id = $1")
        .bind(id)
        .fetch_one(&pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(row.get::<i64, _>("value"))
}

/// Un archivo propio de un contador (imagen o sonido), decodificado de su data URL.
async fn counter_blob(app: &AppHandle, id: &str, column: &str, mime_prefix: &str) -> Result<Option<(String, Vec<u8>)>, String> {
    use base64::Engine;
    // `column` solo puede ser uno de estos dos: nunca llega del usuario.
    let sql = match column {
        "image" => "SELECT image AS data FROM counter WHERE id = $1",
        "sound" => "SELECT sound AS data FROM counter WHERE id = $1",
        _ => return Err("Columna no válida.".into()),
    };
    let pool = crate::backup::pool(app).await?;
    let row = sqlx::query(sql).bind(id).fetch_optional(&pool).await.map_err(|e| e.to_string())?;
    let Some(data_url) = row.and_then(|r| r.get::<Option<String>, _>("data")) else {
        return Ok(None);
    };
    let (meta, b64) = data_url.split_once(',').ok_or("Archivo no válido.")?;
    let mime = meta.trim_start_matches("data:").trim_end_matches(";base64").to_string();
    if !mime.starts_with(mime_prefix) {
        return Err("Archivo no válido.".into());
    }
    let bytes = base64::engine::general_purpose::STANDARD.decode(b64).map_err(|e| e.to_string())?;
    Ok(Some((mime, bytes)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wait_change_returns_at_once_if_already_newer_and_wakes_on_bump() {
        let start = CHANGE.lock().map(|n| *n).unwrap();
        // Ya hay un cambio más nuevo que `since`: no espera.
        bump_change();
        assert!(wait_change(start) > start);
        // Sin cambios nuevos: otro hilo lo despierta enseguida.
        let now = CHANGE.lock().map(|n| *n).unwrap();
        let waker = thread::spawn(|| {
            thread::sleep(Duration::from_millis(50));
            bump_change();
        });
        let t0 = std::time::Instant::now();
        assert_eq!(wait_change(now), now + 1);
        assert!(t0.elapsed() < Duration::from_secs(2));
        waker.join().unwrap();
    }
}
