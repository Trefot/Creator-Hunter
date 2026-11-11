//! Conexión con YouTube (D-015).
//!
//! OAuth de app de escritorio según Google: el navegador redirige a `http://127.0.0.1:<puerto>`
//! (loopback) y el código se canjea con PKCE S256. El refresh token se guarda en el Administrador
//! de credenciales de Windows; el access token solo vive en memoria. Las credenciales del cliente
//! (el JSON descargado de Google Cloud) se guardan en la carpeta de datos de la app, nunca en Git.

use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use base64::engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD};
use base64::Engine;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_opener::OpenerExt;

const AUTH_URL: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
const REVOKE_URL: &str = "https://oauth2.googleapis.com/revoke";
const CHANNELS_URL: &str = "https://www.googleapis.com/youtube/v3/channels";
const ANALYTICS_URL: &str = "https://youtubeanalytics.googleapis.com/v2/reports";
/// Lectura del canal y de Analytics (horas, vistas, suscriptores). Sin permiso monetario (D-015).
const SCOPES: &str =
    "https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly";
const KEYRING_SERVICE: &str = "TrophyHunter";
const KEYRING_USER: &str = if cfg!(debug_assertions) { "youtube-refresh-token-dev" } else { "youtube-refresh-token" };
const CLIENT_FILE: &str = if cfg!(debug_assertions) { "google-client-dev.json" } else { "google-client.json" };
const CONNECTION_FILE: &str = if cfg!(debug_assertions) { "youtube-connection-dev.json" } else { "youtube-connection.json" };
/// Tiempo máximo para completar el inicio de sesión en el navegador.
const LOGIN_TIMEOUT: Duration = Duration::from_secs(300);

/// Access token en memoria con su caducidad.
#[derive(Default)]
pub struct YouTubeState {
    access: Mutex<Option<(String, Instant)>>,
}

#[derive(Deserialize, Serialize)]
struct ClientInfo {
    client_id: String,
    client_secret: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Channel {
    id: String,
    title: String,
    custom_url: Option<String>,
    thumbnail: Option<String>,
    subscribers: Option<u64>,
    views: Option<u64>,
    videos: Option<u64>,
}

/// Qué perfil de la app está conectado a qué canal.
#[derive(Serialize, Deserialize, Clone)]
pub struct Connection {
    profile_id: String,
    channel: Channel,
}

#[derive(Serialize)]
pub struct Status {
    configured: bool,
    connected: bool,
    connection: Option<Connection>,
}

#[derive(Serialize)]
pub struct ConnectResult {
    connection: Connection,
    /// Foto del canal como data URL, para ponerla como foto del perfil.
    avatar: Option<String>,
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    expires_in: u64,
    refresh_token: Option<String>,
}

fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn read_json<T: for<'de> Deserialize<'de>>(path: PathBuf) -> Option<T> {
    serde_json::from_str(&std::fs::read_to_string(path).ok()?).ok()
}

fn load_client(app: &AppHandle) -> Result<ClientInfo, String> {
    read_json(data_dir(app)?.join(CLIENT_FILE))
        .ok_or_else(|| "Primero importa el archivo JSON del cliente de Google.".to_string())
}

fn keyring_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER).map_err(|e| e.to_string())
}

fn random_b64(bytes: usize) -> String {
    let mut buf = vec![0u8; bytes];
    rand::thread_rng().fill_bytes(&mut buf);
    URL_SAFE_NO_PAD.encode(buf)
}

/// Guarda las credenciales del cliente OAuth a partir del JSON descargado de Google Cloud.
#[tauri::command]
pub fn youtube_import_client(app: AppHandle, content: String) -> Result<(), String> {
    let doc: Value = serde_json::from_str(&content).map_err(|_| "El archivo no es un JSON válido.".to_string())?;
    let installed = doc
        .get("installed")
        .ok_or("El JSON no es de un cliente «App de escritorio». Crea el cliente con ese tipo en Google Cloud.")?;
    let client: ClientInfo = serde_json::from_value(installed.clone())
        .map_err(|_| "Al JSON le faltan client_id o client_secret.".to_string())?;
    if !client.client_id.ends_with(".apps.googleusercontent.com") {
        return Err("El client_id no parece de Google.".into());
    }
    let text = serde_json::to_string_pretty(&client).map_err(|e| e.to_string())?;
    std::fs::write(data_dir(&app)?.join(CLIENT_FILE), text).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn youtube_status(app: AppHandle) -> Result<Status, String> {
    let dir = data_dir(&app)?;
    let configured = dir.join(CLIENT_FILE).exists();
    let connected = keyring_entry()?.get_password().is_ok();
    let connection = if connected { read_json(dir.join(CONNECTION_FILE)) } else { None };
    Ok(Status { configured, connected, connection })
}

/// Espera a que el navegador vuelva a `127.0.0.1` con el código; responde con una página de cierre.
fn wait_for_code(listener: TcpListener, expected_state: &str) -> Result<String, String> {
    listener.set_nonblocking(true).map_err(|e| e.to_string())?;
    let deadline = Instant::now() + LOGIN_TIMEOUT;
    loop {
        match listener.accept() {
            Ok((mut stream, _)) => {
                stream.set_nonblocking(false).map_err(|e| e.to_string())?;
                let mut line = String::new();
                BufReader::new(&stream).read_line(&mut line).map_err(|e| e.to_string())?;
                // "GET /?code=...&state=... HTTP/1.1"
                let path = line.split_whitespace().nth(1).unwrap_or("/");
                let url = url::Url::parse(&format!("http://127.0.0.1{path}")).map_err(|e| e.to_string())?;
                let param = |name: &str| url.query_pairs().find(|(k, _)| k == name).map(|(_, v)| v.into_owned());

                // El navegador puede pedir también /favicon.ico: se ignora.
                if param("code").is_none() && param("error").is_none() {
                    let _ = stream.write_all(b"HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
                    continue;
                }
                let ok = param("code").is_some() && param("state").as_deref() == Some(expected_state);
                let body = if ok {
                    "<h2>TrophyHunter conectado con YouTube.</h2><p>Ya puedes cerrar esta pestaña y volver a la app.</p>"
                } else {
                    "<h2>No se completó la conexión.</h2><p>Vuelve a la app e inténtalo de nuevo.</p>"
                };
                let page = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\n\r\n\
                     <html><body style=\"font-family:sans-serif;background:#0e0c14;color:#eeebf6;padding:40px\">{body}</body></html>"
                );
                let _ = stream.write_all(page.as_bytes());

                if let Some(error) = param("error") {
                    return Err(if error == "access_denied" {
                        "Cancelaste el permiso en Google.".into()
                    } else {
                        format!("Google devolvió un error: {error}")
                    });
                }
                if param("state").as_deref() != Some(expected_state) {
                    return Err("La respuesta de Google no coincide con esta solicitud (state).".into());
                }
                return param("code").ok_or_else(|| "Google no devolvió un código.".into());
            }
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                if Instant::now() > deadline {
                    return Err("Se agotó el tiempo para iniciar sesión (5 minutos).".into());
                }
                std::thread::sleep(Duration::from_millis(150));
            }
            Err(e) => return Err(e.to_string()),
        }
    }
}

async fn request_token(params: &[(&str, &str)]) -> Result<TokenResponse, String> {
    let response = reqwest::Client::new()
        .post(TOKEN_URL)
        .form(params)
        .send()
        .await
        .map_err(|e| format!("No se pudo contactar con Google: {e}"))?;
    if !response.status().is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(if body.contains("invalid_grant") {
            "El acceso a YouTube caducó o se revocó. Vuelve a conectar.".into()
        } else {
            format!("Google rechazó la solicitud de token: {body}")
        });
    }
    response.json().await.map_err(|e| e.to_string())
}

fn remember(state: &YouTubeState, token: &TokenResponse) {
    // Se renueva un minuto antes de que caduque.
    let expires = Instant::now() + Duration::from_secs(token.expires_in.saturating_sub(60));
    *state.access.lock().unwrap() = Some((token.access_token.clone(), expires));
}

/// Access token válido: el de memoria o uno nuevo a partir del refresh token guardado.
pub(crate) async fn access_token(app: &AppHandle, state: &YouTubeState) -> Result<String, String> {
    if let Some((token, expires)) = state.access.lock().unwrap().clone() {
        if Instant::now() < expires {
            return Ok(token);
        }
    }
    let refresh = keyring_entry()?
        .get_password()
        .map_err(|_| "YouTube no está conectado.".to_string())?;
    let client = load_client(app)?;
    let token = request_token(&[
        ("client_id", client.client_id.as_str()),
        ("client_secret", client.client_secret.as_str()),
        ("refresh_token", refresh.as_str()),
        ("grant_type", "refresh_token"),
    ])
    .await?;
    remember(state, &token);
    Ok(token.access_token)
}

async fn fetch_channel(token: &str) -> Result<Channel, String> {
    let doc: Value = reqwest::Client::new()
        .get(CHANNELS_URL)
        .query(&[("part", "snippet,statistics"), ("mine", "true")])
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| format!("YouTube rechazó la consulta del canal: {e}"))?
        .json()
        .await
        .map_err(|e| e.to_string())?;
    let item = doc["items"]
        .get(0)
        .ok_or("Esta cuenta de Google no tiene canal de YouTube.")?;
    let thumbs = &item["snippet"]["thumbnails"];
    let thumbnail = ["high", "medium", "default"]
        .iter()
        .find_map(|k| thumbs[k]["url"].as_str())
        .map(String::from);
    // La API devuelve los números como texto.
    let num = |v: &Value| v.as_str().and_then(|s| s.parse().ok());
    Ok(Channel {
        id: item["id"].as_str().unwrap_or_default().to_string(),
        title: item["snippet"]["title"].as_str().unwrap_or_default().to_string(),
        custom_url: item["snippet"]["customUrl"].as_str().map(String::from),
        thumbnail,
        subscribers: num(&item["statistics"]["subscriberCount"]),
        views: num(&item["statistics"]["viewCount"]),
        videos: num(&item["statistics"]["videoCount"]),
    })
}

/// Descarga la foto del canal y la devuelve como data URL.
async fn download_image(url: &str) -> Option<String> {
    let response = reqwest::get(url).await.ok()?.error_for_status().ok()?;
    let mime = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("image/jpeg")
        .to_string();
    let bytes = response.bytes().await.ok()?;
    Some(format!("data:{mime};base64,{}", STANDARD.encode(bytes)))
}

/// Inicia sesión con Google en el navegador y conecta el canal al perfil indicado.
#[tauri::command]
pub async fn youtube_connect(
    app: AppHandle,
    state: State<'_, YouTubeState>,
    profile_id: String,
) -> Result<ConnectResult, String> {
    let client = load_client(&app)?;
    let verifier = random_b64(48);
    let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
    let csrf = random_b64(16);

    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let redirect = format!("http://127.0.0.1:{}", listener.local_addr().map_err(|e| e.to_string())?.port());
    let auth = url::Url::parse_with_params(
        AUTH_URL,
        &[
            ("client_id", client.client_id.as_str()),
            ("redirect_uri", redirect.as_str()),
            ("response_type", "code"),
            ("scope", SCOPES),
            ("code_challenge", challenge.as_str()),
            ("code_challenge_method", "S256"),
            ("state", csrf.as_str()),
            ("access_type", "offline"),
            // Fuerza a Google a entregar siempre un refresh token.
            ("prompt", "consent"),
        ],
    )
    .map_err(|e| e.to_string())?;
    app.opener()
        .open_url(auth.as_str(), None::<&str>)
        .map_err(|e| format!("No se pudo abrir el navegador: {e}"))?;

    let code = tauri::async_runtime::spawn_blocking(move || wait_for_code(listener, &csrf))
        .await
        .map_err(|e| e.to_string())??;

    let token = request_token(&[
        ("client_id", client.client_id.as_str()),
        ("client_secret", client.client_secret.as_str()),
        ("code", code.as_str()),
        ("code_verifier", verifier.as_str()),
        ("redirect_uri", redirect.as_str()),
        ("grant_type", "authorization_code"),
    ])
    .await?;
    let refresh = token
        .refresh_token
        .clone()
        .ok_or("Google no entregó un token de renovación. Vuelve a intentarlo.")?;
    keyring_entry()?
        .set_password(&refresh)
        .map_err(|e| format!("No se pudo guardar el acceso en Windows: {e}"))?;
    remember(&state, &token);

    let channel = fetch_channel(&token.access_token).await?;
    let avatar = match &channel.thumbnail {
        Some(url) => download_image(url).await,
        None => None,
    };
    let connection = Connection { profile_id, channel };
    let text = serde_json::to_string_pretty(&connection).map_err(|e| e.to_string())?;
    std::fs::write(data_dir(&app)?.join(CONNECTION_FILE), text).map_err(|e| e.to_string())?;
    Ok(ConnectResult { connection, avatar })
}

/// Datos actuales del canal (renueva el token si hace falta) y actualiza la conexión guardada.
#[tauri::command]
pub async fn youtube_channel(app: AppHandle, state: State<'_, YouTubeState>) -> Result<Channel, String> {
    let token = access_token(&app, &state).await?;
    let channel = fetch_channel(&token).await?;
    let path = data_dir(&app)?.join(CONNECTION_FILE);
    if let Some(mut connection) = read_json::<Connection>(path.clone()) {
        connection.channel = channel.clone();
        if let Ok(text) = serde_json::to_string_pretty(&connection) {
            let _ = std::fs::write(path, text);
        }
    }
    Ok(channel)
}

#[derive(Serialize)]
pub struct SyncData {
    profile_id: String,
    channel: Channel,
    /// Horas de visualización en el intervalo pedido (YouTube Analytics); None si no se pudo obtener.
    watch_hours: Option<f64>,
    /// Aviso si Analytics falló pero los datos del canal sí llegaron.
    warning: Option<String>,
}

fn is_iso_date(s: &str) -> bool {
    s.len() == 10 && s.chars().enumerate().all(|(i, c)| if i == 4 || i == 7 { c == '-' } else { c.is_ascii_digit() })
}

/// Consulta de Analytics sobre todo el canal en [start, end]; `dimensions` vacío = total.
async fn analytics_rows(token: &str, start: &str, end: &str, dimensions: &str) -> Result<Vec<Value>, String> {
    let mut query = vec![
        ("ids", "channel==MINE"),
        ("startDate", start),
        ("endDate", end),
        ("metrics", "estimatedMinutesWatched"),
    ];
    if !dimensions.is_empty() {
        query.push(("dimensions", dimensions));
    }
    let response = reqwest::Client::new()
        .get(ANALYTICS_URL)
        .query(&query)
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format!("YouTube Analytics rechazó la consulta: {body}"));
    }
    let doc: Value = response.json().await.map_err(|e| e.to_string())?;
    // Sin visualizaciones en el periodo, Analytics no devuelve filas.
    Ok(doc["rows"].as_array().cloned().unwrap_or_default())
}

/// Minutos vistos en [start, end] **sin Shorts ni historias**, lo más parecido al contador de horas
/// de monetización (que tampoco cuenta los Shorts). Si la consulta por tipo de contenido falla,
/// se usa el total del canal como respaldo.
async fn fetch_watch_minutes(token: &str, start: &str, end: &str) -> Result<f64, String> {
    match analytics_rows(token, start, end, "creatorContentType").await {
        Ok(rows) => Ok(long_form_minutes(&rows)),
        Err(_) => {
            let rows = analytics_rows(token, start, end, "").await?;
            Ok(rows.first().and_then(|r| r[0].as_f64()).unwrap_or(0.0))
        }
    }
}

/// Suma los minutos de las filas [tipo, minutos] excepto Shorts e historias.
fn long_form_minutes(rows: &[Value]) -> f64 {
    rows.iter()
        .filter(|r| !matches!(r[0].as_str(), Some("SHORTS") | Some("STORY")))
        .filter_map(|r| r[1].as_f64())
        .sum()
}

/// Sincroniza el canal: datos públicos (Data API) y horas de los últimos 365 días (Analytics).
/// La interfaz guarda el resultado como registro del día con origen 'api'.
#[tauri::command]
pub async fn youtube_sync(
    app: AppHandle,
    state: State<'_, YouTubeState>,
    start: String,
    end: String,
) -> Result<SyncData, String> {
    if !is_iso_date(&start) || !is_iso_date(&end) {
        return Err("Fechas no válidas.".into());
    }
    let connection: Connection = read_json(data_dir(&app)?.join(CONNECTION_FILE))
        .ok_or_else(|| "YouTube no está conectado a ningún perfil.".to_string())?;
    let token = access_token(&app, &state).await?;
    let channel = fetch_channel(&token).await?;
    let (watch_hours, warning) = match fetch_watch_minutes(&token, &start, &end).await {
        Ok(minutes) => (Some((minutes / 60.0 * 10.0).round() / 10.0), None),
        Err(e) => (None, Some(e)),
    };

    let updated = Connection { profile_id: connection.profile_id.clone(), channel: channel.clone() };
    if let Ok(text) = serde_json::to_string_pretty(&updated) {
        let _ = std::fs::write(data_dir(&app)?.join(CONNECTION_FILE), text);
    }
    Ok(SyncData { profile_id: connection.profile_id, channel, watch_hours, warning })
}

const VIDEOS_URL: &str = "https://www.googleapis.com/youtube/v3/videos";

/// Estadísticas de un vídeo: contadores públicos al día (Data API) y compartidos/horas (Analytics,
/// con 1–2 días de retraso; None si Analytics aún no tiene datos o el vídeo no es del canal).
#[derive(Serialize, Default, Clone)]
pub struct VideoStats {
    id: String,
    views: Option<u64>,
    likes: Option<u64>,
    comments: Option<u64>,
    shares: Option<u64>,
    watch_hours: Option<f64>,
}

/// ID de vídeo de YouTube: 11 caracteres [A-Za-z0-9_-]. Se valida porque va dentro de filtros de la API.
fn is_video_id(id: &str) -> bool {
    id.len() == 11 && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

async fn fetch_public_counts(token: &str, ids: &[String], out: &mut std::collections::HashMap<String, VideoStats>) -> Result<(), String> {
    for chunk in ids.chunks(50) {
        let doc: Value = reqwest::Client::new()
            .get(VIDEOS_URL)
            .query(&[("part", "statistics"), ("id", &chunk.join(",")), ("maxResults", "50")])
            .bearer_auth(token)
            .send()
            .await
            .map_err(|e| e.to_string())?
            .error_for_status()
            .map_err(|e| format!("YouTube rechazó la consulta de vídeos: {e}"))?
            .json()
            .await
            .map_err(|e| e.to_string())?;
        let num = |v: &Value| v.as_str().and_then(|s| s.parse().ok());
        for item in doc["items"].as_array().cloned().unwrap_or_default() {
            let id = item["id"].as_str().unwrap_or_default().to_string();
            let stats = out.entry(id.clone()).or_insert_with(|| VideoStats { id, ..Default::default() });
            stats.views = num(&item["statistics"]["viewCount"]);
            stats.likes = num(&item["statistics"]["likeCount"]);
            stats.comments = num(&item["statistics"]["commentCount"]);
        }
    }
    Ok(())
}

async fn fetch_analytics_counts(
    token: &str,
    ids: &[String],
    start: &str,
    end: &str,
    out: &mut std::collections::HashMap<String, VideoStats>,
) -> Result<(), String> {
    for chunk in ids.chunks(200) {
        let filter = format!("video=={}", chunk.join(","));
        let response = reqwest::Client::new()
            .get(ANALYTICS_URL)
            .query(&[
                ("ids", "channel==MINE"),
                ("startDate", start),
                ("endDate", end),
                ("metrics", "estimatedMinutesWatched,shares"),
                ("dimensions", "video"),
                ("filters", filter.as_str()),
                ("sort", "-estimatedMinutesWatched"),
                ("maxResults", "200"),
            ])
            .bearer_auth(token)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if !response.status().is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(format!("YouTube Analytics rechazó la consulta por vídeo: {body}"));
        }
        let doc: Value = response.json().await.map_err(|e| e.to_string())?;
        // Filas: [videoId, minutos, compartidos]
        for row in doc["rows"].as_array().cloned().unwrap_or_default() {
            let Some(id) = row[0].as_str() else { continue };
            let stats = out.entry(id.to_string()).or_insert_with(|| VideoStats { id: id.to_string(), ..Default::default() });
            stats.watch_hours = row[1].as_f64().map(|m| (m / 60.0 * 10.0).round() / 10.0);
            stats.shares = row[2].as_f64().map(|s| s as u64);
        }
    }
    Ok(())
}

#[derive(Serialize)]
pub struct VideoSyncData {
    videos: Vec<VideoStats>,
    warning: Option<String>,
}

/// Estadísticas de varios vídeos. `start`/`end` acotan los datos de Analytics (desde la publicación más antigua).
#[tauri::command]
pub async fn youtube_video_stats(
    app: AppHandle,
    state: State<'_, YouTubeState>,
    ids: Vec<String>,
    start: String,
    end: String,
) -> Result<VideoSyncData, String> {
    if !is_iso_date(&start) || !is_iso_date(&end) {
        return Err("Fechas no válidas.".into());
    }
    let mut ids: Vec<String> = ids.into_iter().filter(|id| is_video_id(id)).collect();
    ids.sort();
    ids.dedup();
    if ids.is_empty() {
        return Ok(VideoSyncData { videos: vec![], warning: None });
    }
    let token = access_token(&app, &state).await?;
    let mut out = std::collections::HashMap::new();
    fetch_public_counts(&token, &ids, &mut out).await?;
    let warning = fetch_analytics_counts(&token, &ids, &start, &end, &mut out).await.err();
    Ok(VideoSyncData { videos: out.into_values().collect(), warning })
}

/// Pruebas desconecta solo en local: revocar en Google afecta a todos los clientes del proyecto.
#[tauri::command]
pub async fn youtube_disconnect(app: AppHandle, state: State<'_, YouTubeState>) -> Result<(), String> {
    let entry = keyring_entry()?;
    if let Ok(refresh) = entry.get_password() {
        // Si Google no responde, se desconecta igualmente en local.
        if !cfg!(debug_assertions) {
            let _ = reqwest::Client::new().post(REVOKE_URL).form(&[("token", refresh.as_str())]).send().await;
        }
        let _ = entry.delete_credential();
    }
    *state.access.lock().unwrap() = None;
    let _ = std::fs::remove_file(data_dir(&app)?.join(CONNECTION_FILE));
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;
    use std::net::TcpStream;

    /// Simula al navegador: abre el listener, envía una petición y devuelve el resultado.
    fn simulate(requests: &[&str], expected_state: &str) -> Result<String, String> {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let requests: Vec<String> = requests.iter().map(|r| r.to_string()).collect();
        let browser = std::thread::spawn(move || {
            for request in requests {
                let mut stream = TcpStream::connect(("127.0.0.1", port)).unwrap();
                stream.write_all(format!("GET {request} HTTP/1.1\r\nHost: x\r\n\r\n").as_bytes()).unwrap();
                let mut reply = String::new();
                let _ = stream.read_to_string(&mut reply);
            }
        });
        let result = wait_for_code(listener, expected_state);
        browser.join().unwrap();
        result
    }

    #[test]
    fn devuelve_el_codigo_si_el_state_coincide() {
        assert_eq!(simulate(&["/?state=abc&code=4%2FXYZ"], "abc"), Ok("4/XYZ".to_string()));
    }

    #[test]
    fn ignora_favicon_y_espera_la_respuesta_real() {
        assert_eq!(simulate(&["/favicon.ico", "/?code=ok&state=s1"], "s1"), Ok("ok".to_string()));
    }

    #[test]
    fn rechaza_un_state_distinto() {
        assert!(simulate(&["/?code=robado&state=otro"], "bueno").is_err());
    }

    #[test]
    fn informa_si_el_usuario_cancela() {
        assert_eq!(
            simulate(&["/?error=access_denied&state=s"], "s"),
            Err("Cancelaste el permiso en Google.".to_string())
        );
    }

    #[test]
    fn pkce_s256_cumple_el_ejemplo_del_rfc_7636() {
        // RFC 7636, apéndice B.
        let verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
        let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
        assert_eq!(challenge, "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
    }
}

#[cfg(test)]
mod date_tests {
    use super::is_iso_date;

    #[test]
    fn valida_fechas_iso() {
        assert!(is_iso_date("2026-11-04"));
        assert!(!is_iso_date("2026-1-04"));
        assert!(!is_iso_date("2026/11/04"));
        assert!(!is_iso_date("2026-11-04&x=1"));
    }
}

#[cfg(test)]
mod analytics_tests {
    use super::long_form_minutes;
    use serde_json::json;

    #[test]
    fn excluye_shorts_e_historias() {
        let rows = vec![
            json!(["VIDEO_ON_DEMAND", 9000.0]),
            json!(["SHORTS", 3000.0]),
            json!(["LIVE_STREAM", 1200.0]),
            json!(["STORY", 50.0]),
            json!(["UNSPECIFIED", 30.0]),
        ];
        assert_eq!(long_form_minutes(&rows), 10230.0);
    }
}

#[cfg(test)]
mod video_tests {
    use super::is_video_id;

    #[test]
    fn valida_ids_de_video() {
        assert!(is_video_id("dQw4w9WgXcQ"));
        assert!(is_video_id("a-b_c1234XY"));
        assert!(!is_video_id("corto"));
        assert!(!is_video_id("dQw4w9WgXcQ,"));
        assert!(!is_video_id("abc def ghi"));
    }
}
