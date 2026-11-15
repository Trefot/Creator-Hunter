//! Comandos de chat (D-030): `!platino`, `!juego`, `!redes`… responden en Twitch y YouTube.
//! Solo con la app abierta y el directo en marcha. Necesita permisos de escritura del chat:
//! Twitch `user:write:chat` y YouTube `youtube.force-ssl` (hay que renovar la autorización).
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde_json::{Value, json};
use sqlx::Row;
use tauri::{AppHandle, Manager};

use crate::chat_commands_core::{self as core, Vars};

const CONFIG: &str = "chat-commands";
const STATUS: &str = "chat-commands-status";

/// Último uso de cada comando, para respetar su espera.
static LAST_USE: Mutex<Option<HashMap<String, Instant>>> = Mutex::new(None);

async fn config(app: &AppHandle) -> Value {
    match crate::social_alerts::load(app, CONFIG).await {
        Ok(v) if v.is_object() => core::validate(&v).unwrap_or_else(|_| core::defaults()),
        _ => core::defaults(),
    }
}

async fn record(app: &AppHandle, platform: &str, trigger: &str, error: Option<String>) {
    let mut status = crate::social_alerts::load(app, STATUS).await.unwrap_or(Value::Null);
    if !status.is_object() {
        status = json!({});
    }
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    status[platform] = json!({"trigger":trigger,"at":now,"error":error});
    let _ = crate::social_alerts::save(app, STATUS, &status).await;
}

/// Datos actuales para rellenar las respuestas.
async fn vars(app: &AppHandle, user: &str) -> Vars {
    let mut v = Vars { user: user.to_string(), ..Default::default() };
    let Ok(pool) = crate::backup::pool(app).await else { return v };
    if let Ok(state) = crate::game_broadcast::state(&pool).await {
        v.platinos = state["platinos"].as_i64().unwrap_or(0);
        v.game = state["game"]["title"].as_str().map(String::from);
        v.earned = state["game"]["trophy_earned"].as_i64().unwrap_or(0);
        v.total = state["game"]["trophy_total"].as_i64().unwrap_or(0);
        v.target = state["target"]["title"].as_str().map(String::from);
    }
    if let Ok(rows) = sqlx::query("SELECT name, value FROM counter WHERE workspace_id = $1")
        .bind(crate::obs_store::WORKSPACE)
        .fetch_all(&pool)
        .await
    {
        v.counters = rows.iter().map(|r| (r.get("name"), r.get("value"))).collect();
    }
    v
}

fn http() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|_| "No se pudo iniciar HTTP.".into())
}

async fn send_twitch(text: &str) -> Result<(), String> {
    let (client, token, user) = crate::social_alerts::twitch_token().await?;
    let r = http()?
        .post("https://api.twitch.tv/helix/chat/messages")
        .header("Client-Id", client)
        .bearer_auth(token)
        .json(&json!({"broadcaster_id":user,"sender_id":user,"message":text}))
        .send()
        .await
        .map_err(|_| "Twitch no respondió.")?;
    match r.status().as_u16() {
        200 => Ok(()),
        401 | 403 => Err("Twitch no permite responder: renueva los permisos en En directo → Conexiones.".into()),
        code => Err(format!("Twitch rechazó la respuesta ({code}).")),
    }
}

async fn send_youtube(app: &AppHandle, text: &str) -> Result<(), String> {
    let chat = crate::social_alerts::youtube_chat_id();
    if chat.is_empty() {
        return Err("No hay un directo de YouTube activo.".into());
    }
    let token = crate::youtube::access_token(app, &app.state::<crate::youtube::YouTubeState>()).await?;
    let r = http()?
        .post("https://www.googleapis.com/youtube/v3/liveChat/messages?part=snippet")
        .bearer_auth(token)
        .json(&json!({"snippet":{"liveChatId":chat,"type":"textMessageEvent","textMessageDetails":{"messageText":text}}}))
        .send()
        .await
        .map_err(|_| "YouTube no respondió.")?;
    match r.status().as_u16() {
        200 => Ok(()),
        401 | 403 => Err("YouTube no permite responder: vuelve a conectar YouTube para dar permiso de chat.".into()),
        code => Err(format!("YouTube rechazó la respuesta ({code}).")),
    }
}

/// Llamado con cada mensaje del chat. Ignora en silencio lo que no es un comando.
pub async fn receive(app: &AppHandle, platform: &str, name: &str, text: &str) {
    if !text.trim_start().starts_with('!') {
        return;
    }
    let cfg = config(app).await;
    if cfg["enabled"] != true {
        return;
    }
    let Some(cmd) = core::find(&cfg, text.trim()) else { return };
    let trigger = cmd["trigger"].as_str().unwrap_or("").to_string();
    let wait = Duration::from_secs(cmd["cooldown"].as_u64().unwrap_or(30));
    {
        let key = format!("{platform}:{trigger}");
        let mut guard = LAST_USE.lock().unwrap();
        let map = guard.get_or_insert_with(HashMap::new);
        if map.get(&key).is_some_and(|t| t.elapsed() < wait) {
            return;
        }
        map.insert(key, Instant::now());
    }
    let reply = core::fit(&core::render(cmd["response"].as_str().unwrap_or(""), &vars(app, name).await), platform);
    let result = match platform {
        "twitch" => send_twitch(&reply).await,
        "youtube" => send_youtube(app, &reply).await,
        _ => return,
    };
    record(app, platform, &trigger, result.err()).await;
}

#[tauri::command]
pub async fn chat_commands_get(app: AppHandle) -> Result<Value, String> {
    let status = crate::social_alerts::load(&app, STATUS).await.unwrap_or(Value::Null);
    Ok(json!({"config": config(&app).await, "status": status}))
}

#[tauri::command]
pub async fn chat_commands_save(app: AppHandle, config: Value) -> Result<Value, String> {
    let clean = core::validate(&config)?;
    crate::social_alerts::save(&app, CONFIG, &clean).await?;
    Ok(clean)
}

/// Vista previa de una respuesta con los datos actuales, sin enviarla.
#[tauri::command]
pub async fn chat_commands_preview(app: AppHandle, response: String, platform: String) -> Result<String, String> {
    Ok(core::fit(&core::render(&response, &vars(&app, "Espectador").await), &platform))
}
