//! Live Studio (D-018): servidor HTTP local para OBS y el Stream Deck.
//!
//! Solo escucha en 127.0.0.1 (nunca en la red). Las rutas de lectura (el overlay y la lista de
//! contadores) son abiertas; las que cambian un contador exigen la clave local (`key`), para que
//! una página web cualquiera no pueda tocarlos desde el navegador.
//!
//! - `GET /overlay[?c=id1,id2&layout=row|column]`: página para la "Fuente de navegador" de OBS.
//! - `GET /api/counters`: los contadores en JSON.
//! - `GET /api/counters/{id}/{inc|dec|reset}?key=…`: para el Stream Deck ("Sitio web" en segundo plano).

use std::fs;
use std::sync::Mutex;
use std::thread;

use serde::Serialize;
use serde_json::json;
use sqlx::Row;
use tauri::{AppHandle, Emitter, Manager, State};
use tiny_http::{Header, Request, Response, Server};

/// D-019: la versión de pruebas usa otro puerto para no chocar con la app instalada.
pub const PORT: u16 = if cfg!(debug_assertions) { 7879 } else { 7878 };
const KEY_FILE: &str = if cfg!(debug_assertions) { "live-key-dev.txt" } else { "live-key.txt" };
const OVERLAY_HTML: &str = include_str!("../overlay/counters.html");

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

/// Arranca el servidor en un hilo propio. Si el puerto está ocupado, lo deja anotado en el estado.
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
                        handle_request(&handle, &key, request);
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

fn handle_request(app: &AppHandle, key: &str, request: Request) {
    let url = match url::Url::parse(&format!("http://127.0.0.1{}", request.url())) {
        Ok(u) => u,
        Err(_) => return respond_json(request, 400, json!({ "error": "URL no válida" })),
    };
    let segments: Vec<String> = url.path_segments().map(|s| s.map(String::from).collect()).unwrap_or_default();
    let query_key = url.query_pairs().find(|(k, _)| k == "key").map(|(_, v)| v.to_string());

    match segments.iter().map(String::as_str).collect::<Vec<_>>().as_slice() {
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
        ["api", "counters", id, action] => {
            if query_key.as_deref() != Some(key) {
                return respond_json(request, 403, json!({ "error": "Falta la clave local o no es correcta." }));
            }
            let id = id.to_string();
            let action = action.to_string();
            match tauri::async_runtime::block_on(change_counter(app, &id, &action)) {
                Ok(value) => {
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
    let rows = sqlx::query("SELECT id, name, icon, color, value FROM counter ORDER BY position, created_at")
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
