//! Spotify personal por PKCE y reproductor local para material autorizado por el usuario.
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{
    sync::Mutex,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager};
use tauri_plugin_opener::OpenerExt;
struct Pending {
    state: String,
    verifier: String,
    client: String,
    started: Instant,
}
#[derive(Default)]
struct Player {
    track: Option<String>,
    playing: bool,
    generation: u64,
    viewer: String,
    lease: Option<Instant>,
    requests: Vec<Value>,
    recent: Vec<(String, Instant)>,
    queue: Vec<String>,
    message: String,
}
#[derive(Default)]
pub struct MusicState {
    spotify_error: Mutex<String>,
    epoch: std::sync::atomic::AtomicU64,
    retry_after: Mutex<Option<Instant>>,
    pending: Mutex<Option<Pending>>,
    player: Mutex<Player>,
    oauth: tauri::async_runtime::Mutex<()>,
    spotify: Mutex<Value>,
}
fn entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(
        "com.trefotg.studio",
        if cfg!(debug_assertions) {
            "spotify-dev"
        } else {
            "spotify"
        },
    )
    .map_err(|_| "No se pudo abrir el almacén de Spotify.".into())
}
fn redirect() -> String {
    format!("http://127.0.0.1:{}/spotify/callback", crate::live::PORT)
}
fn nonce() -> String {
    (0..32)
        .map(|_| format!("{:02x}", rand::random::<u8>()))
        .collect()
}
fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
#[tauri::command]
pub fn spotify_begin(app: AppHandle, client_id: String) -> Result<String, String> {
    if client_id.len() != 32 || !client_id.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(
            "Introduce el Client ID de tu aplicación de Spotify, no el Client Secret.".into(),
        );
    }
    let state = nonce();
    let verifier = nonce();
    let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
    let mut url = url::Url::parse("https://accounts.spotify.com/authorize").unwrap();
    url.query_pairs_mut().extend_pairs([
        ("client_id", client_id.as_str()),
        ("response_type", "code"),
        ("redirect_uri", redirect().as_str()),
        (
            "scope",
            "user-read-playback-state user-modify-playback-state",
        ),
        ("state", state.as_str()),
        ("code_challenge_method", "S256"),
        ("code_challenge", challenge.as_str()),
    ]);
    *app.state::<MusicState>().pending.lock().unwrap() = Some(Pending {
        state,
        verifier,
        client: client_id,
        started: Instant::now(),
    });
    app.opener()
        .open_url(url.as_str(), None::<&str>)
        .map_err(|_| "No se pudo abrir Spotify en el navegador.")?;
    Ok(redirect())
}
pub async fn callback(app: &AppHandle, state: &str, code: &str) -> Result<(), String> {
    let shared = app.state::<MusicState>();
    let _auth = shared.oauth.lock().await;
    let p = {
        let s = app.state::<MusicState>();
        let mut pending = s.pending.lock().unwrap();
        if !pending
            .as_ref()
            .is_some_and(|p| p.state == state && p.started.elapsed() < Duration::from_secs(600))
        {
            return Err(
                "La autorización no corresponde a Nexus o caducó. Vuelve a conectar.".into(),
            );
        }
        pending.take().unwrap()
    };
    if code.is_empty() || code.len() > 4000 {
        return Err("Spotify no autorizó el acceso.".into());
    }
    let r = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|_| "No se pudo iniciar HTTP.")?
        .post("https://accounts.spotify.com/api/token")
        .form(&[
            ("client_id", p.client.as_str()),
            ("grant_type", "authorization_code"),
            ("code", code),
            ("redirect_uri", redirect().as_str()),
            ("code_verifier", p.verifier.as_str()),
        ])
        .send()
        .await
        .map_err(|_| "No se pudo completar Spotify. Vuelve a conectar.")?;
    if !r.status().is_success() {
        return Err(
            "Spotify rechazó la conexión. Revisa cuenta permitida, Premium y URL de retorno."
                .into(),
        );
    }
    let mut v: Value = r
        .json()
        .await
        .map_err(|_| "Respuesta no válida de Spotify.")?;
    v["client_id"] = json!(p.client);
    v["expires_at"] = json!(now() + v["expires_in"].as_u64().unwrap_or(3600));
    entry()?
        .set_password(&v.to_string())
        .map_err(|_| "No se pudo guardar Spotify en las credenciales de Windows.".into())
}
async fn token() -> Result<String, String> {
    let raw = entry()?
        .get_password()
        .map_err(|_| "Conecta tu Spotify Premium.")?;
    let mut v: Value = serde_json::from_str(&raw).map_err(|_| "Vuelve a conectar Spotify.")?;
    if v["expires_at"].as_u64().unwrap_or(0) > now() + 60 {
        return v["access_token"]
            .as_str()
            .map(String::from)
            .ok_or("Vuelve a conectar Spotify.".into());
    }
    let r = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|_| "No se pudo iniciar HTTP.")?
        .post("https://accounts.spotify.com/api/token")
        .form(&[
            ("grant_type", "refresh_token"),
            ("refresh_token", v["refresh_token"].as_str().unwrap_or("")),
            ("client_id", v["client_id"].as_str().unwrap_or("")),
        ])
        .send()
        .await
        .map_err(|_| "No se pudo renovar Spotify.")?;
    if !r.status().is_success() {
        return Err("Vuelve a autorizar Spotify.".into());
    }
    let fresh: Value = r.json().await.map_err(|_| "Respuesta no válida.")?;
    v["access_token"] = fresh["access_token"].clone();
    v["expires_at"] = json!(now() + fresh["expires_in"].as_u64().unwrap_or(3600));
    if fresh["refresh_token"].is_string() {
        v["refresh_token"] = fresh["refresh_token"].clone();
    }
    entry()?
        .set_password(&v.to_string())
        .map_err(|_| "No se pudo guardar Spotify.")?;
    v["access_token"]
        .as_str()
        .map(String::from)
        .ok_or("Vuelve a conectar Spotify.".into())
}
async fn api(
    app: &AppHandle,
    method: reqwest::Method,
    path: &str,
    query: &[(&str, &str)],
) -> Result<Value, String> {
    let shared = app.state::<MusicState>();
    let _auth = shared.oauth.lock().await;
    if shared
        .retry_after
        .lock()
        .unwrap()
        .is_some_and(|t| t > Instant::now())
    {
        return Err("Spotify solicitó esperar antes de otra consulta.".into());
    }
    let t = token().await?;
    let mut request = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|_| "No se pudo iniciar HTTP.")?
        .request(method.clone(), format!("https://api.spotify.com/v1/{path}"))
        .bearer_auth(t)
        .query(query);
    // Spotify exige Content-Length en POST/PUT aunque el cuerpo esté vacío (si no, responde 411).
    if method != reqwest::Method::GET {
        request = request.header(reqwest::header::CONTENT_LENGTH, "0").body(Vec::<u8>::new());
    }
    let r = request
        .send()
        .await
        .map_err(|_| "Spotify no confirmó la operación. Comprueba la cola antes de repetir.")?;
    if r.status() == 429 {
        let seconds = r
            .headers()
            .get("Retry-After")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.parse::<u64>().ok())
            .unwrap_or(60)
            .clamp(1, 3600);
        *shared.retry_after.lock().unwrap() = Some(Instant::now() + Duration::from_secs(seconds));
        return Err(format!("Spotify pidió esperar {seconds} segundos."));
    }
    if r.status() == 204 {
        return Ok(Value::Null);
    }
    if !r.status().is_success() {
        let code = r.status();
        let body: Value = r.json().await.unwrap_or(Value::Null);
        let reason = body["error"]["reason"].as_str().unwrap_or("");
        return Err(match reason {
            "PREMIUM_REQUIRED" => "Spotify exige una cuenta Premium para añadir canciones a la cola.".into(),
            "NO_ACTIVE_DEVICE" => "Spotify no tiene un dispositivo activo: abre Spotify en el PC y dale a reproducir.".into(),
            _ => format!(
                "Spotify respondió {code}{}. Comprueba Premium, dispositivo activo y permisos.",
                body["error"]["message"].as_str().map(|m| format!(" ({m})")).unwrap_or_default()
            ),
        });
    }
    // Algunas operaciones (añadir a la cola) responden 200 sin cuerpo JSON: eso también es éxito.
    let bytes = r.bytes().await.map_err(|_| "Respuesta incompleta de Spotify.")?;
    Ok(serde_json::from_slice(&bytes).unwrap_or(Value::Null))
}
#[tauri::command]
pub async fn spotify_refresh(app: AppHandle) -> Result<Value, String> {
    let epoch = app
        .state::<MusicState>()
        .epoch
        .load(std::sync::atomic::Ordering::SeqCst);
    let v = api(&app, reqwest::Method::GET, "me/player", &[]).await?;
    // Solo datos de presentación; nunca devolver tokens ni datos del dispositivo.
    let result = if v.is_null() {
        Value::Null
    } else {
        json!({"title":v["item"]["name"],"artists":v["item"]["artists"].as_array().map(|a|a.iter().filter_map(|v|v["name"].as_str()).collect::<Vec<_>>().join(", ")),"cover":v["item"]["album"]["images"][0]["url"],"url":v["item"]["external_urls"]["spotify"],"playing":v["is_playing"],"progress_ms":v["progress_ms"],"duration_ms":v["item"]["duration_ms"]})
    };
    if app
        .state::<MusicState>()
        .epoch
        .load(std::sync::atomic::Ordering::SeqCst)
        == epoch
    {
        *app.state::<MusicState>().spotify.lock().unwrap() = result.clone();
    }
    app.state::<MusicState>()
        .spotify_error
        .lock()
        .unwrap()
        .clear();
    Ok(result)
}
#[tauri::command]
pub async fn spotify_control(app: AppHandle, action: String) -> Result<(), String> {
    let (method, path) = match action.as_str() {
        "play" => (reqwest::Method::PUT, "me/player/play"),
        "pause" => (reqwest::Method::PUT, "me/player/pause"),
        "next" => (reqwest::Method::POST, "me/player/next"),
        _ => return Err("Acción no válida.".into()),
    };
    api(&app, method, path, &[]).await?;
    Ok(())
}
#[tauri::command]
pub async fn spotify_disconnect(app: AppHandle) -> Result<(), String> {
    app.state::<MusicState>()
        .epoch
        .fetch_add(1, std::sync::atomic::Ordering::SeqCst);
    let shared = app.state::<MusicState>();
    let _auth = shared.oauth.lock().await;
    *app.state::<MusicState>().pending.lock().unwrap() = None;
    *app.state::<MusicState>().spotify.lock().unwrap() = Value::Null;
    match entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(_) => Err("No se pudo retirar Spotify.".into()),
    }
}
async fn library(app: &AppHandle) -> Result<Value, String> {
    let v = crate::social_alerts::load(app, "music-library").await?;
    Ok(if v.is_array() { v } else { json!([]) })
}
#[tauri::command]
pub async fn music_import(app: AppHandle, title: String, content: String) -> Result<(), String> {
    use base64::engine::general_purpose::STANDARD;
    let (header, raw) = content.split_once(',').ok_or("Audio no válido.")?;
    let mime = match header {
        "data:audio/mpeg;base64" => "audio/mpeg",
        "data:audio/wav;base64" | "data:audio/x-wav;base64" | "data:audio/wave;base64" => {
            "audio/wav"
        }
        "data:audio/ogg;base64" => "audio/ogg",
        _ => return Err("Usa MP3, WAV u OGG.".into()),
    };
    if raw.len() > 28000000 || title.trim().is_empty() || title.chars().count() > 120 {
        return Err("Título requerido, máximo 120 caracteres; audio de hasta 20 MB.".into());
    }
    let bytes = STANDARD.decode(raw).map_err(|_| "Audio no válido.")?;
    if bytes.len() > 20000000 || bytes.len() < 12 {
        return Err("Audio vacío o mayor de 20 MB.".into());
    }
    let valid = match mime {
        "audio/wav" => bytes.starts_with(b"RIFF") && bytes.get(8..12) == Some(b"WAVE"),
        "audio/ogg" => bytes.starts_with(b"OggS"),
        _ => bytes.starts_with(b"ID3") || (bytes[0] == 0xff && bytes[1] & 0xe0 == 0xe0),
    };
    if !valid {
        return Err("La cabecera del archivo no coincide con el formato.".into());
    }
    let mut list = library(&app).await?;
    if list.as_array().unwrap().len() >= 100 {
        return Err("Máximo 100 pistas locales.".into());
    }
    let id = format!("music-{}", nonce());
    let pool = crate::backup::pool(&app).await?;
    let total: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(LENGTH(content)),0) FROM alert_audio WHERE id LIKE 'music-%'",
    )
    .fetch_one(&pool)
    .await
    .map_err(|e| e.to_string())?;
    if total + raw.len() as i64 > 140000000 {
        return Err(
            "La biblioteca local llegó a 100 MB. Retira pistas antes de añadir más.".into(),
        );
    }
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
    sqlx::query("INSERT INTO alert_audio(id,mime,content) VALUES(?,?,?)")
        .bind(&id)
        .bind(mime)
        .bind(raw)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    list.as_array_mut()
        .unwrap()
        .push(json!({"id":id,"title":title.trim()}));
    sqlx::query("INSERT INTO alert_cursor(id,content) VALUES('music-library',?) ON CONFLICT(id) DO UPDATE SET content=excluded.content").bind(list.to_string()).execute(&mut *tx).await.map_err(|e|e.to_string())?;
    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(())
}
#[tauri::command]
pub async fn music_remove(app: AppHandle, id: String) -> Result<(), String> {
    let mut list = library(&app).await?;
    list.as_array_mut().unwrap().retain(|t| t["id"] != id);
    let pool = crate::backup::pool(&app).await?;
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
    sqlx::query("DELETE FROM alert_audio WHERE id=? AND id LIKE 'music-%'")
        .bind(&id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    sqlx::query("UPDATE alert_cursor SET content=? WHERE id='music-library'")
        .bind(list.to_string())
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    tx.commit().await.map_err(|e| e.to_string())?;
    let state = app.state::<MusicState>();
    let mut p = state.player.lock().unwrap();
    p.queue.retain(|t| t != &id);
    if p.track.as_ref() == Some(&id) {
        p.track = None;
        p.playing = false;
        p.generation += 1;
    }
    Ok(())
}
#[tauri::command]
pub async fn music_requests_enable(app: AppHandle, enabled: bool) -> Result<(), String> {
    crate::social_alerts::save(&app, "music-requests", &json!(enabled)).await
}
/// Por defecto las peticiones de Spotify entran solas a la cola; con esto el creador las revisa una a una.
#[tauri::command]
pub async fn music_manual(app: AppHandle, enabled: bool) -> Result<(), String> {
    crate::social_alerts::save(&app, "music-manual", &json!(enabled)).await
}
/// `privileged`: creador o moderador; no tienen la espera de un minuto entre peticiones.
pub async fn receive(app: &AppHandle, platform: &str, user: &str, name: &str, text: &str, privileged: bool) {
    let Some(input) = text.strip_prefix("!sr ").map(str::trim) else {
        return;
    };
    if input.is_empty() || input.len() > 400 {
        return;
    }
    if crate::social_alerts::load(app, "music-requests").await.ok() != Some(json!(true)) {
        return;
    }
    request_song(app, platform, user, name, input, privileged).await;
}

const REWARD_TITLE: &str = "Pedir canción";

/// Crea (o recupera) la recompensa de puntos «Pedir canción» con texto obligatorio.
#[tauri::command]
pub async fn music_reward_create(app: AppHandle, cost: u32) -> Result<Value, String> {
    if !(1..=100000).contains(&cost) {
        return Err("Coste entre 1 y 100000 puntos.".into());
    }
    let (client, _, user) = crate::social_alerts::twitch_token().await?;
    let existing = crate::engagement::twitch_request(
        reqwest::Method::GET,
        "channel_points/custom_rewards",
        &[("broadcaster_id", user.as_str()), ("only_manageable_rewards", "true")],
        None,
    )
    .await?;
    let found = existing["data"].as_array().and_then(|a| a.iter().find(|v| v["title"] == REWARD_TITLE)).cloned();
    let reward = match found {
        Some(r) => r,
        None => crate::engagement::twitch_request(
            reqwest::Method::POST,
            "channel_points/custom_rewards",
            &[("broadcaster_id", &user)],
            Some(json!({"title":REWARD_TITLE,"cost":cost,"is_user_input_required":true,
                "prompt":"Escribe el nombre de la canción y el artista. Si no se puede añadir, te devolvemos los puntos.",
                "background_color":"#9146FF","should_redemptions_skip_request_queue":false})),
        )
        .await?["data"][0]
            .clone(),
    };
    let id = reward["id"].as_str().ok_or("Twitch no confirmó la recompensa; revisa tus recompensas antes de repetir.")?;
    let saved = json!({"id":id,"channel":user,"client":client,"cost":reward["cost"]});
    crate::social_alerts::save(&app, "music-reward", &saved).await?;
    Ok(saved)
}

/// Canje de «Pedir canción»: se añade a la cola y se completa; si no se puede, se devuelven los puntos.
pub async fn reward(app: &AppHandle, event: &Value) {
    let Ok(cfg) = crate::social_alerts::load(app, "music-reward").await else { return };
    let (Some(reward), Some(id)) = (cfg["id"].as_str(), event["id"].as_str()) else { return };
    if event["reward"]["id"] != reward || event["broadcaster_user_id"] != cfg["channel"] {
        return;
    }
    // Un canje se procesa una sola vez aunque Twitch lo reenvíe.
    let Ok(pool) = crate::backup::pool(app).await else { return };
    let claimed = sqlx::query("INSERT OR IGNORE INTO alert_cursor(id,content) VALUES(?,?)")
        .bind(format!("music-redeem/{id}"))
        .bind(json!({"status":"pending"}).to_string())
        .execute(&pool)
        .await;
    if !claimed.is_ok_and(|r| r.rows_affected() == 1) {
        return;
    }
    let input: String = event["user_input"].as_str().unwrap_or("").trim().chars().take(200).collect();
    let user = event["user_id"].as_str().unwrap_or("");
    let name = event["user_name"].as_str().unwrap_or("Alguien");
    let outcome = if input.is_empty() {
        let _ = crate::chat_commands::say(app, "twitch", &format!("🎵 @{name} escribe el nombre de la canción al canjear. Te devolví los puntos.")).await;
        Outcome::Refused
    } else {
        request_song(app, "twitch", user, name, &input, true).await
    };
    let status = match outcome {
        Outcome::Queued => "FULFILLED",
        Outcome::Refused => "CANCELED",
        Outcome::Pending => return, // Revisión manual: queda en la cola de canjes de Twitch.
    };
    let channel = cfg["channel"].as_str().unwrap_or("");
    let _ = crate::engagement::twitch_request(
        reqwest::Method::PATCH,
        "channel_points/custom_rewards/redemptions",
        &[("broadcaster_id", channel), ("reward_id", reward), ("id", id)],
        Some(json!({"status":status})),
    )
    .await;
}

/// Resultado de una petición, para resolver el canje de puntos que la originó.
#[derive(PartialEq)]
enum Outcome { Queued, Pending, Refused }

/// Busca la canción (enlace, biblioteca local o Spotify), la añade a la cola y responde en el chat.
async fn request_song(app: &AppHandle, platform: &str, user: &str, name: &str, input: &str, privileged: bool) -> Outcome {
    let local = library(app).await.ok().and_then(|list| {
        list.as_array()?.iter().find(|t| {
            t["id"] == input || t["title"].as_str().is_some_and(|s| s.eq_ignore_ascii_case(input))
        }).cloned()
    });
    let item = if let Some(uri) = crate::studio_core::spotify_track(input) {
        json!({"source":"spotify","track":uri,"title":input})
    } else if let Some(t) = local {
        json!({"source":"local","track":t["id"],"title":t["title"]})
    } else {
        // Lo normal en el chat: «!sr nombre de la canción». Se busca en Spotify y se toma el primer resultado.
        match api(app, reqwest::Method::GET, "search", &[("q", input), ("type", "track"), ("limit", "1")]).await {
            Ok(found) if found["tracks"]["items"][0]["uri"].is_string() => {
                let t = &found["tracks"]["items"][0];
                let artist = t["artists"][0]["name"].as_str().unwrap_or("");
                json!({"source":"spotify","track":t["uri"],"title":format!("{} – {artist}", t["name"].as_str().unwrap_or(input))})
            }
            Ok(_) => {
                let _ = crate::chat_commands::say(app, platform, &format!("🎵 @{name} no encontré «{input}» en Spotify.")).await;
                return Outcome::Refused;
            }
            Err(e) => {
                let _ = crate::chat_commands::say(app, platform, &format!("🎵 @{name} no pude buscar en Spotify. {e}")).await;
                return Outcome::Refused;
            }
        }
    };
    // El candado se suelta antes de cualquier espera (respuestas en el chat).
    let accepted: Result<(String, String), String> = {
        let state = app.state::<MusicState>();
        let mut p = state.player.lock().unwrap();
        p.recent.retain(|(_, t)| t.elapsed() < Duration::from_secs(60));
        let identity = format!("{platform}:{user}");
        if p.requests.len() >= 20 {
            Err("hay demasiadas peticiones pendientes, prueba en un rato.".to_string())
        } else if let Some((_, t)) = p.recent.iter().find(|(u, _)| u == &identity && !privileged) {
            Err(format!("espera {} s para pedir otra canción.", 60u64.saturating_sub(t.elapsed().as_secs()).max(1)))
        } else if p.requests.iter().any(|r| r["track"] == item["track"]) {
            Err("esa canción ya está pedida.".to_string())
        } else {
            p.recent.push((identity, Instant::now()));
            let mut r = item;
            r["id"] = json!(nonce());
            r["user"] = json!(name.chars().take(100).collect::<String>());
            r["platform"] = json!(platform);
            let pair = (r["id"].as_str().unwrap_or("").to_string(), r["title"].as_str().unwrap_or("").to_string());
            p.requests.push(r);
            Ok(pair)
        }
    };
    let (id, title) = match accepted {
        Ok(pair) => pair,
        Err(reason) => {
            let _ = crate::chat_commands::say(app, platform, &format!("🎵 @{name} {reason}")).await;
            return Outcome::Refused;
        }
    };
    // Aprobación automática salvo que el creador elija revisar cada petición.
    if crate::social_alerts::load(app, "music-manual").await.ok() == Some(json!(true)) {
        let _ = crate::chat_commands::say(app, platform, &format!("🎵 @{name} pedido «{title}». Lo reviso enseguida.")).await;
        return Outcome::Pending;
    }
    let (reply, outcome) = match music_request_resolve(app.clone(), id, true).await {
        Ok(()) => (format!("🎵 @{name} añadida a la cola: {title}"), Outcome::Queued),
        Err(e) => {
            app.state::<MusicState>().player.lock().unwrap().message = e.clone();
            (format!("🎵 @{name} no pude añadir «{title}». {e}"), Outcome::Refused)
        }
    };
    let _ = crate::chat_commands::say(app, platform, &reply).await;
    outcome
}

#[tauri::command]
pub async fn music_request_resolve(app: AppHandle, id: String, accept: bool) -> Result<(), String> {
    let request = {
        let state = app.state::<MusicState>();
        let mut p = state.player.lock().unwrap();
        let index = p
            .requests
            .iter()
            .position(|r| r["id"] == id)
            .ok_or("La petición ya se resolvió.")?;
        p.requests.remove(index)
    };
    if !accept {
        return Ok(());
    }
    let track = request["track"].as_str().ok_or("Pista no válida.")?;
    if request["source"] == "spotify" {
        if request["status"] == "uncertain" {
            app.state::<MusicState>()
                .player
                .lock()
                .unwrap()
                .requests
                .push(request.clone());
            return Err(
                "Comprueba la cola de Spotify antes de retirar esta petición sin confirmar.".into(),
            );
        }
        let result = api(
            &app,
            reqwest::Method::POST,
            "me/player/queue",
            &[("uri", track)],
        )
        .await;
        if let Err(error) = result {
            let mut uncertain = request.clone();
            uncertain["status"] = json!("uncertain");
            let state = app.state::<MusicState>();
            let mut p = state.player.lock().unwrap();
            if p.requests.len() < 20 {
                p.requests.push(uncertain);
            }
            return Err(error);
        }
    } else {
        let list = library(&app).await?;
        if !list.as_array().unwrap().iter().any(|v| v["id"] == track) {
            return Err("La pista ya no existe.".into());
        }
        let state = app.state::<MusicState>();
        let mut p = state.player.lock().unwrap();
        if p.queue.len() >= 50 {
            return Err("Cola local llena.".into());
        }
        p.queue.push(track.into());
        p.message = "Petición aprobada en la cola local.".into();
    }
    Ok(())
}
#[tauri::command]
pub async fn music_play(app: AppHandle, id: Option<String>, action: String) -> Result<(), String> {
    if let Some(id) = id {
        let list = library(&app).await?;
        if !list.as_array().unwrap().iter().any(|v| v["id"] == id) {
            return Err("La pista no existe.".into());
        }
        let state = app.state::<MusicState>();
        let mut p = state.player.lock().unwrap();
        p.track = Some(id);
        p.playing = true;
        p.generation += 1;
        return Ok(());
    }
    player_action(&app, &action, None)
}
pub fn player_action(app: &AppHandle, action: &str, generation: Option<u64>) -> Result<(), String> {
    let state = app.state::<MusicState>();
    let mut p = state.player.lock().unwrap();
    if generation.is_some_and(|g| g != p.generation) {
        return Ok(());
    }
    match action {
        "pause" => p.playing = false,
        "resume" => p.playing = p.track.is_some(),
        "stop" => {
            p.playing = false;
            p.track = None;
            p.generation += 1;
        }
        "next" | "ended" => {
            p.track = if p.queue.is_empty() {
                None
            } else {
                Some(p.queue.remove(0))
            };
            p.playing = p.track.is_some();
            p.generation += 1;
        }
        "failed" => {
            p.playing = false;
            p.message =
                "No se pudo reproducir la pista local. Comprueba formato y fuente de OBS.".into();
        }
        _ => return Err("Acción no válida.".into()),
    }
    Ok(())
}
pub async fn state(app: &AppHandle, viewer: Option<&str>) -> Result<Value, String> {
    let list = library(app).await?;
    let enabled = crate::social_alerts::load(app, "music-requests").await? == true;
    let manual = crate::social_alerts::load(app, "music-manual").await? == true;
    let reward = crate::social_alerts::load(app, "music-reward").await?;
    let volume = crate::social_alerts::load(app, "music-volume")
        .await?
        .as_u64()
        .unwrap_or(70)
        .min(100);
    let spotify_error = app
        .state::<MusicState>()
        .spotify_error
        .lock()
        .unwrap()
        .clone();
    let spotify = app.state::<MusicState>().spotify.lock().unwrap().clone();
    let duck=crate::social_alerts::load(app,"music-duck").await?!=false;
    let alerts=app.state::<crate::alerts::AlertsState>().0.lock().await.status();
    let now=SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as u64;
    let alert_active=alerts["diagnostics"].as_array().is_some_and(|rows|rows.iter().any(|v|v["ends_ms"].as_u64().is_some_and(|end|end>now)));
    let ducking=duck&&(crate::engagement::speaking(app)||alert_active);
    let effective_volume=if ducking {volume/4}else{volume};
    let state = app.state::<MusicState>();
    let mut p = state.player.lock().unwrap();
    let owner = if let Some(v) = viewer {
        if !v.is_empty()
            && v.len() < 100
            && (p.viewer == v || p.lease.is_none_or(|t| t.elapsed() > Duration::from_secs(5)))
        {
            p.viewer = v.into();
            p.lease = Some(Instant::now());
            true
        } else {
            false
        }
    } else {
        false
    };
    Ok(
        json!({"volume":volume,"duck":duck,"ducking":ducking,"effective_volume":effective_volume,"library":list,"requests_enabled":enabled,"requests_manual":manual,"reward":reward,"requests":if viewer.is_none(){p.requests.clone()}else{vec![]},"queue":p.queue,"track":p.track,"playing":p.playing,"generation":p.generation,"audio_owner":owner,"audio_connected":p.lease.is_some_and(|t|t.elapsed()<Duration::from_secs(5)),"message":p.message,"spotify":spotify,"spotify_connected":entry().and_then(|e|e.get_password().map_err(|e|e.to_string())).is_ok(),"spotify_error":spotify_error,"app_version":app.package_info().version.to_string()}),
    )
}
#[tauri::command]
pub async fn music_status(app: AppHandle) -> Result<Value, String> {
    state(&app, None).await
}

pub async fn blob(app: &AppHandle, id: &str) -> Result<(String, Vec<u8>), String> {
    use base64::engine::general_purpose::STANDARD;
    if !id.starts_with("music-")
        || id.len() != 70
        || !id[6..].bytes().all(|b| b.is_ascii_hexdigit())
    {
        return Err("Pista no válida.".into());
    }
    let pool = crate::backup::pool(app).await?;
    let (mime, raw): (String, String) =
        sqlx::query_as("SELECT mime,content FROM alert_audio WHERE id=?")
            .bind(id)
            .fetch_one(&pool)
            .await
            .map_err(|_| "Pista no disponible.")?;
    if raw.len() > 28000000 || !["audio/mpeg", "audio/wav", "audio/ogg"].contains(&mime.as_str()) {
        return Err("Pista no válida.".into());
    }
    Ok((mime, STANDARD.decode(raw).map_err(|_| "Pista dañada.")?))
}

pub fn start(app: AppHandle) {
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(Duration::from_secs(10));
            if entry()
                .and_then(|e| e.get_password().map_err(|_| String::new()))
                .is_ok()
            {
                if let Err(e) = tauri::async_runtime::block_on(spotify_refresh(app.clone())) {
                    let state = app.state::<MusicState>();
                    *state.spotify_error.lock().unwrap() = e;
                    *state.spotify.lock().unwrap() = Value::Null;
                }
            }
        }
    });
}

pub fn reset_after_restore(app: &AppHandle) {
    *app.state::<MusicState>().player.lock().unwrap() = Player::default();
}

#[tauri::command]
pub async fn music_volume(app: AppHandle, volume: u32) -> Result<(), String> {
    if volume > 100 {
        return Err("Volumen entre 0 y 100.".into());
    }
    crate::social_alerts::save(&app, "music-volume", &json!(volume)).await
}

#[tauri::command]
pub async fn music_duck(app:AppHandle,enabled:bool)->Result<(),String>{crate::social_alerts::save(&app,"music-duck",&json!(enabled)).await}
