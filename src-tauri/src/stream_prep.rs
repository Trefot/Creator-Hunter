//! Preparación del directo (D-030): permisos de Twitch y título del canal.
use std::time::Duration;

use serde_json::{Value, json};

/// Permisos que necesita Nexus de Twitch y para qué.
const NEEDED: [(&str, &str); 7] = [
    ("moderator:read:followers", "alertas de seguidores"),
    ("channel:read:subscriptions", "alertas de suscripciones"),
    ("bits:read", "alertas de bits"),
    ("user:read:chat", "leer el chat"),
    ("user:write:chat", "responder comandos de chat"),
    ("channel:manage:broadcast", "título y categoría del directo"),
    ("channel:manage:redemptions", "recompensa de TTS"),
];

fn http() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|_| "No se pudo iniciar HTTP.".into())
}

/// Permisos concedidos y los que faltan (para avisar antes del directo).
#[tauri::command]
pub async fn twitch_scopes() -> Result<Value, String> {
    let (_, token, _) = match crate::social_alerts::twitch_token().await {
        Ok(t) => t,
        Err(e) => return Ok(json!({"connected": false, "error": e, "missing": []})),
    };
    let doc: Value = http()?
        .get("https://id.twitch.tv/oauth2/validate")
        .header("Authorization", format!("OAuth {token}"))
        .send()
        .await
        .map_err(|_| "Twitch no respondió.")?
        .json()
        .await
        .map_err(|_| "Respuesta no válida de Twitch.")?;
    let granted: Vec<String> = doc["scopes"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|s| s.as_str().map(String::from))
        .collect();
    let missing: Vec<Value> = NEEDED
        .iter()
        .filter(|(s, _)| !granted.iter().any(|g| g == s))
        .map(|(s, why)| json!({"scope": s, "for": why}))
        .collect();
    Ok(json!({"connected": true, "login": doc["login"], "missing": missing}))
}

/// Título y categoría actuales del canal de Twitch.
#[tauri::command]
pub async fn stream_title_get() -> Result<Value, String> {
    let (client, token, user) = crate::social_alerts::twitch_token().await?;
    let doc: Value = http()?
        .get("https://api.twitch.tv/helix/channels")
        .header("Client-Id", client)
        .bearer_auth(token)
        .query(&[("broadcaster_id", user.as_str())])
        .send()
        .await
        .map_err(|_| "Twitch no respondió.")?
        .json()
        .await
        .map_err(|_| "Respuesta no válida de Twitch.")?;
    let c = &doc["data"][0];
    Ok(json!({"title": c["title"], "game": c["game_name"]}))
}

/// Cambia el título del directo en Twitch (la categoría la gestiona la categoría automática).
#[tauri::command]
pub async fn stream_title_set(title: String) -> Result<(), String> {
    let title = title.trim();
    if title.is_empty() || title.chars().count() > 140 {
        return Err("El título debe tener entre 1 y 140 caracteres.".into());
    }
    let (client, token, user) = crate::social_alerts::twitch_token().await?;
    let r = http()?
        .patch("https://api.twitch.tv/helix/channels")
        .header("Client-Id", client)
        .bearer_auth(token)
        .query(&[("broadcaster_id", user.as_str())])
        .json(&json!({"title": title}))
        .send()
        .await
        .map_err(|_| "Twitch no respondió.")?;
    match r.status().as_u16() {
        204 | 200 => Ok(()),
        401 | 403 => Err("Twitch no permite cambiar el título: renueva los permisos.".into()),
        code => Err(format!("Twitch rechazó el título ({code}).")),
    }
}
