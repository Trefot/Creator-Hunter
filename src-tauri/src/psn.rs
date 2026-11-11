//! Conexión NO oficial con PlayStation Network (D-016). Solo uso personal y solo lectura.
//!
//! Flujo verificado en el código de psn-api (MIT): el NPSSO que pega el usuario se canjea una sola
//! vez por un código y luego por tokens; el refresh token se guarda en el Administrador de
//! credenciales de Windows. El NPSSO no se guarda en ningún sitio.

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::State;

const AUTH_BASE_URL: &str = "https://ca.account.sony.com/api/authz/v3/oauth";
const TROPHY_BASE_URL: &str = "https://m.np.playstation.com/api/trophy";
/// Identificación de la app móvil de PlayStation que usa psn-api.
const CLIENT_ID: &str = "09515159-7237-4370-9b40-3806e67c0891";
const BASIC_AUTH: &str = "Basic MDk1MTUxNTktNzIzNy00MzcwLTliNDAtMzgwNmU2N2MwODkxOnVjUGprYTV0bnRCMktxc1A=";
const REDIRECT_URI: &str = "com.scee.psxandroid.scecompcall://redirect";
const SCOPE: &str = "psn:mobile.v2.core psn:clientapp";
/// Pide nombres y descripciones en español cuando PSN los tiene.
const LANGUAGE: &str = "es-419,es;q=0.9,en;q=0.8";
const KEYRING_SERVICE: &str = "TrophyHunter";
const KEYRING_USER: &str = if cfg!(debug_assertions) { "psn-refresh-token-dev" } else { "psn-refresh-token" };

#[derive(Default)]
pub struct PsnState {
    access: Mutex<Option<(String, Instant)>>,
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    expires_in: u64,
    refresh_token: Option<String>,
}

#[derive(Serialize)]
pub struct PsnTitle {
    np_communication_id: String,
    np_service_name: String,
    name: String,
    icon_url: Option<String>,
    platform: String,
    progress: u64,
    earned: u64,
    defined: u64,
    last_updated: Option<String>,
}

#[derive(Serialize)]
pub struct PsnTrophy {
    psn_trophy_id: i64,
    group_id: Option<String>,
    name: String,
    detail: Option<String>,
    trophy_type: String,
    hidden: bool,
    icon_url: Option<String>,
    earned_at: Option<String>,
    earned_rate: Option<f64>,
}

fn keyring_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER).map_err(|e| e.to_string())
}

/// NPSSO: 64 caracteres alfanuméricos.
fn is_npsso(s: &str) -> bool {
    s.len() == 64 && s.chars().all(|c| c.is_ascii_alphanumeric())
}

/// Permite pegar el NPSSO solo o el JSON completo de la página de Sony ({"npsso":"…"}).
fn extract_npsso(input: &str) -> Option<String> {
    let trimmed = input.trim();
    if is_npsso(trimmed) {
        return Some(trimmed.to_string());
    }
    let doc: Value = serde_json::from_str(trimmed).ok()?;
    let value = doc["npsso"].as_str()?.to_string();
    is_npsso(&value).then_some(value)
}

/// Extrae el código de la cabecera Location (`com.scee…://redirect/?code=…&cid=…`).
fn code_from_location(location: &str) -> Option<String> {
    let query = location.split_once("?")?.1;
    query
        .split('&')
        .find_map(|pair| pair.strip_prefix("code="))
        .map(|code| code.to_string())
        .filter(|code| !code.is_empty())
}

async fn request_token(params: &[(&str, &str)]) -> Result<TokenResponse, String> {
    let response = reqwest::Client::new()
        .post(format!("{AUTH_BASE_URL}/token"))
        .header("Authorization", BASIC_AUTH)
        .form(params)
        .send()
        .await
        .map_err(|e| format!("No se pudo contactar con PlayStation: {e}"))?;
    if !response.status().is_success() {
        return Err("PlayStation rechazó la renovación del acceso. Vuelve a conectar con un NPSSO nuevo.".into());
    }
    response.json().await.map_err(|e| e.to_string())
}

fn remember(state: &PsnState, token: &TokenResponse) {
    let expires = Instant::now() + Duration::from_secs(token.expires_in.saturating_sub(60));
    *state.access.lock().unwrap() = Some((token.access_token.clone(), expires));
}

async fn access_token(state: &PsnState) -> Result<String, String> {
    if let Some((token, expires)) = state.access.lock().unwrap().clone() {
        if Instant::now() < expires {
            return Ok(token);
        }
    }
    let refresh = keyring_entry()?
        .get_password()
        .map_err(|_| "PlayStation no está conectado.".to_string())?;
    let token = request_token(&[
        ("refresh_token", refresh.as_str()),
        ("grant_type", "refresh_token"),
        ("token_format", "jwt"),
        ("scope", SCOPE),
    ])
    .await?;
    // Sony puede rotar el refresh token: se guarda el nuevo si llega.
    if let Some(new_refresh) = &token.refresh_token {
        let _ = keyring_entry()?.set_password(new_refresh);
    }
    remember(state, &token);
    Ok(token.access_token)
}

/// Canjea el NPSSO por tokens y guarda el refresh token en Windows. El NPSSO se descarta.
#[tauri::command]
pub async fn psn_connect(state: State<'_, PsnState>, npsso: String) -> Result<(), String> {
    let npsso = extract_npsso(&npsso)
        .ok_or("Eso no parece un NPSSO: debe tener 64 letras y números (o pega el texto completo de la página de Sony).")?;
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|e| e.to_string())?;
    let response = client
        .get(format!("{AUTH_BASE_URL}/authorize"))
        .query(&[
            ("access_type", "offline"),
            ("client_id", CLIENT_ID),
            ("redirect_uri", REDIRECT_URI),
            ("response_type", "code"),
            ("scope", SCOPE),
        ])
        .header("Cookie", format!("npsso={npsso}"))
        .send()
        .await
        .map_err(|e| format!("No se pudo contactar con PlayStation: {e}"))?;
    let location = response
        .headers()
        .get(reqwest::header::LOCATION)
        .and_then(|v| v.to_str().ok())
        .unwrap_or_default()
        .to_string();
    let code = code_from_location(&location)
        .ok_or("PlayStation no aceptó el NPSSO (puede haber caducado). Inicia sesión de nuevo en playstation.com y copia uno nuevo.")?;

    let token = request_token(&[
        ("code", code.as_str()),
        ("redirect_uri", REDIRECT_URI),
        ("grant_type", "authorization_code"),
        ("token_format", "jwt"),
    ])
    .await?;
    let refresh = token
        .refresh_token
        .clone()
        .ok_or("PlayStation no entregó un token de renovación.")?;
    keyring_entry()?
        .set_password(&refresh)
        .map_err(|e| format!("No se pudo guardar el acceso en Windows: {e}"))?;
    remember(&state, &token);
    Ok(())
}

#[tauri::command]
pub fn psn_status() -> Result<bool, String> {
    Ok(keyring_entry()?.get_password().is_ok())
}

#[tauri::command]
pub fn psn_disconnect(state: State<'_, PsnState>) -> Result<(), String> {
    let _ = keyring_entry()?.delete_credential();
    *state.access.lock().unwrap() = None;
    Ok(())
}

async fn get_json(token: &str, url: &str, query: &[(&str, &str)]) -> Result<Value, String> {
    let response = reqwest::Client::new()
        .get(url)
        .query(query)
        .bearer_auth(token)
        .header("Accept-Language", LANGUAGE)
        .send()
        .await
        .map_err(|e| format!("No se pudo contactar con PlayStation: {e}"))?;
    let status = response.status();
    let doc: Value = response.json().await.map_err(|e| e.to_string())?;
    if !status.is_success() || doc.get("error").is_some() {
        let message = doc["error"]["message"].as_str().unwrap_or("error desconocido");
        return Err(format!("PlayStation rechazó la consulta: {message}"));
    }
    Ok(doc)
}

/// Todos los juegos con trofeos de la cuenta, con su progreso.
#[tauri::command]
pub async fn psn_titles(state: State<'_, PsnState>) -> Result<Vec<PsnTitle>, String> {
    let token = access_token(&state).await?;
    let mut titles = Vec::new();
    let mut offset = 0u64;
    loop {
        let doc = get_json(
            &token,
            &format!("{TROPHY_BASE_URL}/v1/users/me/trophyTitles"),
            &[("limit", "200"), ("offset", &offset.to_string())],
        )
        .await?;
        let count = |v: &Value| ["bronze", "silver", "gold", "platinum"].iter().filter_map(|k| v[k].as_u64()).sum();
        for t in doc["trophyTitles"].as_array().cloned().unwrap_or_default() {
            titles.push(PsnTitle {
                np_communication_id: t["npCommunicationId"].as_str().unwrap_or_default().to_string(),
                np_service_name: t["npServiceName"].as_str().unwrap_or("trophy2").to_string(),
                name: t["trophyTitleName"].as_str().unwrap_or_default().to_string(),
                icon_url: t["trophyTitleIconUrl"].as_str().map(String::from),
                platform: t["trophyTitlePlatform"].as_str().unwrap_or_default().to_string(),
                progress: t["progress"].as_u64().unwrap_or(0),
                earned: count(&t["earnedTrophies"]),
                defined: count(&t["definedTrophies"]),
                last_updated: t["lastUpdatedDateTime"].as_str().map(String::from),
            });
        }
        match doc["nextOffset"].as_u64() {
            Some(next) if next > offset => offset = next,
            _ => break,
        }
    }
    Ok(titles)
}

/// Trofeos de un juego: definición (nombre, tipo, icono) + estado del usuario (ganado, fecha, rareza).
#[tauri::command]
pub async fn psn_title_trophies(
    state: State<'_, PsnState>,
    np_communication_id: String,
    np_service_name: String,
) -> Result<Vec<PsnTrophy>, String> {
    // Van dentro de la ruta de la URL: solo se aceptan identificadores con forma válida.
    if !np_communication_id.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') {
        return Err("Identificador de juego no válido.".into());
    }
    if np_service_name != "trophy" && np_service_name != "trophy2" {
        return Err("Servicio de trofeos no válido.".into());
    }
    let token = access_token(&state).await?;
    let query = [("npServiceName", np_service_name.as_str())];
    let definitions = get_json(
        &token,
        &format!("{TROPHY_BASE_URL}/v1/npCommunicationIds/{np_communication_id}/trophyGroups/all/trophies"),
        &query,
    )
    .await?;
    let earned = get_json(
        &token,
        &format!("{TROPHY_BASE_URL}/v1/users/me/npCommunicationIds/{np_communication_id}/trophyGroups/all/trophies"),
        &query,
    )
    .await?;

    let mut user: HashMap<i64, Value> = HashMap::new();
    for t in earned["trophies"].as_array().cloned().unwrap_or_default() {
        if let Some(id) = t["trophyId"].as_i64() {
            user.insert(id, t);
        }
    }
    let trophies = definitions["trophies"]
        .as_array()
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .filter_map(|t| {
            let id = t["trophyId"].as_i64()?;
            let u = user.get(&id);
            let earned = u.and_then(|u| u["earned"].as_bool()).unwrap_or(false);
            Some(PsnTrophy {
                psn_trophy_id: id,
                group_id: t["trophyGroupId"].as_str().map(String::from),
                name: t["trophyName"].as_str().unwrap_or("(trofeo oculto)").to_string(),
                detail: t["trophyDetail"].as_str().map(String::from),
                trophy_type: t["trophyType"].as_str().unwrap_or("bronze").to_string(),
                hidden: t["trophyHidden"].as_bool().unwrap_or(false),
                icon_url: t["trophyIconUrl"].as_str().map(String::from),
                earned_at: if earned { u.and_then(|u| u["earnedDateTime"].as_str()).map(String::from) } else { None },
                earned_rate: u.and_then(|u| u["trophyEarnedRate"].as_str()).and_then(|r| r.parse().ok()),
            })
        })
        .collect();
    Ok(trophies)
}

const PRESENCE_URL: &str = "https://m.np.playstation.com/api/userProfile/v1/internal/users/me/basicPresences";

#[derive(Serialize)]
pub struct NowPlaying {
    online: bool,
    platform: Option<String>,
    /// Juegos abiertos ahora mismo (normalmente uno).
    games: Vec<PlayingGame>,
}

#[derive(Serialize)]
pub struct PlayingGame {
    title_id: String,
    name: String,
    icon_url: Option<String>,
}

/// Qué está jugando ahora la cuenta (presencia de PSN). Requiere estado en línea visible.
#[tauri::command]
pub async fn psn_now_playing(state: State<'_, PsnState>) -> Result<NowPlaying, String> {
    let token = access_token(&state).await?;
    let doc = get_json(&token, PRESENCE_URL, &[("type", "primary")])
        .await
        .map_err(|e| format!("{e} (¿tienes tu estado en línea oculto en PSN?)"))?;
    let p = &doc["basicPresence"];
    let status = p["primaryPlatformInfo"]["onlineStatus"].as_str().or(p["onlineStatus"].as_str());
    let games = p["gameTitleInfoList"]
        .as_array()
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .map(|g| PlayingGame {
            title_id: g["npTitleId"].as_str().unwrap_or_default().to_string(),
            name: g["titleName"].as_str().unwrap_or_default().to_string(),
            icon_url: g["conceptIconUrl"].as_str().or(g["npTitleIconUrl"].as_str()).map(String::from),
        })
        .collect();
    Ok(NowPlaying {
        online: status == Some("online"),
        platform: p["primaryPlatformInfo"]["platform"].as_str().map(String::from),
        games,
    })
}

/// Descarga la portada del juego y la devuelve como data URL (para verla sin conexión).
#[tauri::command]
pub async fn psn_download_image(url: String) -> Result<String, String> {
    // Solo imágenes del CDN de PlayStation.
    let parsed = url::Url::parse(&url).map_err(|e| e.to_string())?;
    let host = parsed.host_str().unwrap_or_default();
    if parsed.scheme() != "https" || !(host.ends_with(".playstation.com") || host.ends_with(".playstation.net")) {
        return Err("Solo se descargan imágenes de PlayStation.".into());
    }
    let response = reqwest::get(url).await.map_err(|e| e.to_string())?.error_for_status().map_err(|e| e.to_string())?;
    let mime = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("image/png")
        .to_string();
    let bytes = response.bytes().await.map_err(|e| e.to_string())?;
    Ok(format!("data:{mime};base64,{}", STANDARD.encode(bytes)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn acepta_npsso_solo_o_dentro_del_json() {
        let token = "a".repeat(64);
        assert_eq!(extract_npsso(&token), Some(token.clone()));
        assert_eq!(extract_npsso(&format!("  {token}\n")), Some(token.clone()));
        assert_eq!(extract_npsso(&format!("{{\"npsso\":\"{token}\"}}")), Some(token.clone()));
        assert_eq!(extract_npsso("corto"), None);
        assert_eq!(extract_npsso(&format!("{}!", "a".repeat(63))), None);
    }

    #[test]
    fn saca_el_codigo_de_la_redireccion() {
        assert_eq!(
            code_from_location("com.scee.psxandroid.scecompcall://redirect/?code=v3.AbCd&cid=123"),
            Some("v3.AbCd".to_string())
        );
        assert_eq!(code_from_location("com.scee.psxandroid.scecompcall://redirect/?error=login_required"), None);
        assert_eq!(code_from_location(""), None);
    }
}
