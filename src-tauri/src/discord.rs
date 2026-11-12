//! Avisos salientes. Webhooks solo en el almacén de credenciales del sistema.
use crate::discord_core::{PLATFORMS, content_url, payload, webhook_url};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{
    sync::atomic::{AtomicBool, Ordering},
    time::Duration,
};
use tauri::{AppHandle, Manager};

#[derive(Default)]
pub struct DiscordState {
    busy: AtomicBool,
}
struct Guard<'a>(&'a AtomicBool);
impl Drop for Guard<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::Release);
    }
}
fn acquire(state: &DiscordState) -> Result<Guard<'_>, String> {
    state
        .busy
        .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
        .map_err(|_| "Discord está trabajando. Espera unos segundos.".to_string())?;
    Ok(Guard(&state.busy))
}
#[derive(Default, Deserialize, Serialize, Clone)]
#[serde(default)]
pub struct Settings {
    enabled: bool,
    twitch_live: bool,
    youtube_live: bool,
    twitch_videos: bool,
    youtube_videos: bool,
}
fn entry(kind: &str) -> Result<keyring::Entry, String> {
    if !["live", "videos"].contains(&kind) {
        return Err("Destino no válido.".into());
    }
    let suffix = if cfg!(debug_assertions) { "-dev" } else { "" };
    keyring::Entry::new("NexusStudio", &format!("discord-{kind}{suffix}"))
        .map_err(|_| "No se pudo abrir el almacén de credenciales.".into())
}
async fn load(app: &AppHandle, id: &str) -> Result<Value, String> {
    let pool = crate::backup::pool(app).await?;
    let raw: Option<String> = sqlx::query_scalar("SELECT content FROM alert_cursor WHERE id=?")
        .bind(id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| e.to_string())?;
    raw.map(|s| serde_json::from_str(&s).map_err(|e| e.to_string()))
        .unwrap_or(Ok(Value::Null))
}
async fn save(app: &AppHandle, id: &str, v: &Value) -> Result<(), String> {
    let pool = crate::backup::pool(app).await?;
    sqlx::query("INSERT INTO alert_cursor(id,content) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET content=excluded.content")
        .bind(id).bind(v.to_string()).execute(&pool).await.map_err(|e|e.to_string())?;
    Ok(())
}
async fn settings(app: &AppHandle) -> Result<Settings, String> {
    let v = load(app, "discord-settings").await?;
    if v.is_null() {
        Ok(Settings::default())
    } else {
        serde_json::from_value(v).map_err(|e| e.to_string())
    }
}
#[tauri::command]
pub async fn discord_status(app: AppHandle) -> Result<Value, String> {
    Ok(
        json!({"settings":settings(&app).await?, "live_configured":entry("live")?.get_password().is_ok(),
        "videos_configured":entry("videos")?.get_password().is_ok(),"activity":load(&app,"discord-activity").await?}),
    )
}
#[tauri::command]
pub async fn discord_configure(
    app: AppHandle,
    settings: Settings,
    live_webhook: Option<String>,
    videos_webhook: Option<String>,
) -> Result<(), String> {
    let state = app.state::<DiscordState>();
    let _guard = acquire(&state)?;
    // Validate both first; empty fields keep existing credentials.
    let live = live_webhook
        .filter(|s| !s.trim().is_empty())
        .map(|s| webhook_url(&s))
        .transpose()?;
    let videos = videos_webhook
        .filter(|s| !s.trim().is_empty())
        .map(|s| webhook_url(&s))
        .transpose()?;
    for (kind, url) in [("live", live), ("videos", videos)] {
        if let Some(url) = url {
            entry(kind)?
                .set_password(&url)
                .map_err(|_| "No se pudo guardar el webhook de forma segura.")?;
        }
    }
    save(
        &app,
        "discord-settings",
        &serde_json::to_value(settings).map_err(|e| e.to_string())?,
    )
    .await
}
#[tauri::command]
pub async fn discord_remove(app: AppHandle, kind: String) -> Result<(), String> {
    let state = app.state::<DiscordState>();
    let _guard = acquire(&state)?;
    match entry(&kind)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(_) => Err("No se pudo borrar la credencial.".into()),
    }
}
fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| "No se pudo iniciar la conexión.".into())
}
async fn activity(app: &AppHandle, message: &str) {
    let _ = save(app, "discord-activity", &json!({"message":message})).await;
}
async fn post(app: &AppHandle, kind: &str, body: Value, event_key: &str) -> Result<bool, String> {
    let url = webhook_url(
        &entry(kind)?
            .get_password()
            .map_err(|_| "Configura el webhook de este destino.")?,
    )?;
    // Persistent claim before contacting Discord: a timeout/restart cannot blindly resend.
    let id = format!(
        "discord-delivery-{:x}",
        Sha256::digest(event_key.as_bytes())
    );
    let previous = load(app, &id).await?;
    if !previous.is_null() {
        if previous["state"] == "sent" {
            return Ok(false);
        }
        return Err("Hay una entrega sin confirmar de este contenido. Comprueba el canal de Discord antes de volver a publicarlo.".into());
    }
    save(app, &id, &json!({"state":"pending"})).await?;
    let result = client()?
        .post(format!("{url}?wait=true"))
        .json(&body)
        .send()
        .await;
    let result = match result {
        Ok(r) if r.status().is_success() => {
            save(app, &id, &json!({"state":"sent"})).await?;
            Ok(true)
        }
        Ok(r) if r.status().as_u16() == 429 => {
            // Discord confirms rejection; release claim, and hold all sends until Retry-After.
            let doc: Value = r.json().await.unwrap_or(Value::Null);
            let wait = doc["retry_after"].as_f64().unwrap_or(60.).clamp(1., 3600.);
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();
            save(app, "discord-backoff", &json!(now + wait.ceil() as u64)).await?;
            let pool = crate::backup::pool(app).await?;
            sqlx::query("DELETE FROM alert_cursor WHERE id=?")
                .bind(&id)
                .execute(&pool)
                .await
                .map_err(|e| e.to_string())?;
            Err("Discord limitó los envíos. Se respetará su tiempo de espera.".into())
        }
        Ok(r) => {
            let code = r.status().as_u16();
            if [400, 401, 403, 404].contains(&code) {
                let pool = crate::backup::pool(app).await?;
                sqlx::query("DELETE FROM alert_cursor WHERE id=?")
                    .bind(&id)
                    .execute(&pool)
                    .await
                    .map_err(|e| e.to_string())?;
                Err(format!(
                    "Discord rechazó el aviso ({code}). Revisa el webhook. Se volverá a intentar en la próxima consulta."
                ))
            } else {
                save(app, &id, &json!({"state":"uncertain","http":code})).await?;
                Err(format!(
                    "Discord devolvió {code}. Comprueba el canal: no se reenviará automáticamente para evitar duplicados."
                ))
            }
        }
        Err(_) => {
            save(app, &id, &json!({"state":"uncertain"})).await?;
            Err("No se confirmó la entrega. Comprueba Discord: no se reenvía automáticamente para evitar duplicados.".into())
        }
    };
    result
}
async fn available(app: &AppHandle) -> Result<(), String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    if load(app, "discord-backoff").await?.as_u64().unwrap_or(0) > now {
        return Err("Espera antes de enviar otro aviso: límite de Discord.".into());
    }
    Ok(())
}
#[tauri::command]
pub async fn discord_test(app: AppHandle, kind: String) -> Result<(), String> {
    let state = app.state::<DiscordState>();
    let _guard = acquire(&state)?;
    available(&app).await?;
    let key = format!("test-{}", rand::random::<u64>());
    post(&app,&kind,json!({"username":"Nexus · Trefot","allowed_mentions":{"parse":[]},"content":"🧪 Prueba de Nexus Studio. Este mensaje no anuncia un directo ni una publicación real."}),&key).await?;
    activity(&app, "Mensaje de prueba enviado.").await;
    Ok(())
}
#[tauri::command]
pub async fn discord_publish(
    app: AppHandle,
    platform: String,
    title: String,
    url: String,
) -> Result<bool, String> {
    let state = app.state::<DiscordState>();
    let _guard = acquire(&state)?;
    available(&app).await?;
    let url = content_url(&platform, &url)?;
    if title.trim().is_empty() || title.chars().count() > 200 {
        return Err("Escribe un título de hasta 200 caracteres.".into());
    }
    let key = format!("publication:{platform}:{url}");
    let sent = post(
        &app,
        "videos",
        payload(&platform, false, title.trim(), &url, None),
        &key,
    )
    .await?;
    activity(
        &app,
        if sent {
            "Publicación enviada."
        } else {
            "Este contenido ya se envió o tiene una entrega pendiente de comprobar."
        },
    )
    .await;
    Ok(sent)
}
async fn api(
    url: &str,
    token: &str,
    query: &[(&str, &str)],
    twitch_client: Option<&str>,
) -> Result<Value, String> {
    let mut req = client()?.get(url).bearer_auth(token).query(query);
    if let Some(c) = twitch_client {
        req = req.header("Client-Id", c);
    }
    let r = req
        .send()
        .await
        .map_err(|_| "No se pudo consultar la plataforma.")?;
    if !r.status().is_success() {
        return Err(format!(
            "La plataforma rechazó la consulta ({}). Revisa su conexión y cuota.",
            r.status().as_u16()
        ));
    }
    r.json()
        .await
        .map_err(|_| "Respuesta no válida de la plataforma.".into())
}
async fn publish_event(
    app: &AppHandle,
    platform: &str,
    live: bool,
    id: &str,
    title: &str,
    url: &str,
    thumb: Option<&str>,
) -> Result<(), String> {
    available(app).await?;
    let url = content_url(platform, url)?;
    let key = if live {
        format!("live:{platform}:{id}")
    } else {
        format!("publication:{platform}:{url}")
    };
    if post(
        app,
        if live { "live" } else { "videos" },
        payload(platform, live, title, &url, thumb),
        &key,
    )
    .await?
    {
        activity(app, &format!("Aviso de {platform} enviado: {title}")).await;
    }
    Ok(())
}
async fn videos(
    app: &AppHandle,
    platform: &str,
    account: &str,
    items: &[Value],
) -> Result<(), String> {
    let cursor = format!("discord-seen-{platform}-{account}");
    let old = load(app, &cursor).await?;
    let mut seen: Vec<String> = serde_json::from_value(old.clone()).unwrap_or_default();
    // First observation establishes a baseline, never floods historical publications.
    for item in items.iter().rev() {
        let Some(id) = item["id"].as_str() else {
            continue;
        };
        if !old.is_null() && !seen.iter().any(|s| s == id) {
            publish_event(
                app,
                platform,
                false,
                id,
                item["title"].as_str().unwrap_or("Nuevo contenido"),
                item["url"].as_str().unwrap_or(""),
                item["thumbnail"].as_str(),
            )
            .await?;
        }
        if !seen.iter().any(|s| s == id) {
            seen.push(id.into());
        }
    }
    // Keep all observed IDs: dropping old entries could reannounce an older clip.
    save(app, &cursor, &json!(seen)).await
}
async fn youtube(app: &AppHandle, s: &Settings) -> Result<(), String> {
    let token =
        crate::youtube::access_token(app, &app.state::<crate::youtube::YouTubeState>()).await?;
    if s.youtube_live {
        let data = api(
            "https://www.googleapis.com/youtube/v3/liveBroadcasts",
            &token,
            &[
                ("part", "snippet"),
                ("broadcastStatus", "active"),
                ("broadcastType", "all"),
                ("maxResults", "50"),
            ],
            None,
        )
        .await?;
        for item in data["items"].as_array().into_iter().flatten() {
            if let Some(id) = item["id"].as_str() {
                publish_event(
                    app,
                    "youtube",
                    true,
                    id,
                    item["snippet"]["title"].as_str().unwrap_or("En directo"),
                    &format!("https://www.youtube.com/watch?v={id}"),
                    item["snippet"]["thumbnails"]["medium"]["url"].as_str(),
                )
                .await?;
            }
        }
    }
    if s.youtube_videos {
        let channel = api(
            "https://www.googleapis.com/youtube/v3/channels",
            &token,
            &[("part", "contentDetails"), ("mine", "true")],
            None,
        )
        .await?;
        let id = channel["items"][0]["id"]
            .as_str()
            .ok_or("No se encontró el canal YouTube.")?;
        let playlist = channel["items"][0]["contentDetails"]["relatedPlaylists"]["uploads"]
            .as_str()
            .ok_or("Falta la lista de subidas.")?;
        let data = api(
            "https://www.googleapis.com/youtube/v3/playlistItems",
            &token,
            &[
                ("part", "contentDetails"),
                ("playlistId", playlist),
                ("maxResults", "20"),
            ],
            None,
        )
        .await?;
        let ids = data["items"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|i| i["contentDetails"]["videoId"].as_str())
            .collect::<Vec<_>>()
            .join(",");
        if ids.is_empty() {
            return videos(app, "youtube", id, &[]).await;
        }
        let detail = api(
            "https://www.googleapis.com/youtube/v3/videos",
            &token,
            &[("part", "snippet,status"), ("id", &ids)],
            None,
        )
        .await?;
        let items=detail["items"].as_array().into_iter().flatten().filter(|i|i["status"]["privacyStatus"]=="public" && i["snippet"]["liveBroadcastContent"]=="none").filter_map(|i|{
            let id=i["id"].as_str()?;Some(json!({"id":id,"title":i["snippet"]["title"],"url":format!("https://www.youtube.com/watch?v={id}"),"thumbnail":i["snippet"]["thumbnails"]["medium"]["url"]}))
        }).collect::<Vec<_>>();
        videos(app, "youtube", id, &items).await?;
    }
    Ok(())
}
async fn twitch(app: &AppHandle, s: &Settings) -> Result<(), String> {
    let (client, token, user) = crate::social_alerts::twitch_token().await?;
    if s.twitch_live {
        let data = api(
            "https://api.twitch.tv/helix/streams",
            &token,
            &[("user_id", &user)],
            Some(&client),
        )
        .await?;
        for item in data["data"].as_array().into_iter().flatten() {
            if let (Some(id), Some(login)) = (item["id"].as_str(), item["user_login"].as_str()) {
                let thumb = item["thumbnail_url"]
                    .as_str()
                    .map(|s| s.replace("{width}", "640").replace("{height}", "360"));
                publish_event(
                    app,
                    "twitch",
                    true,
                    id,
                    item["title"].as_str().unwrap_or("En directo"),
                    &format!("https://www.twitch.tv/{login}"),
                    thumb.as_deref(),
                )
                .await?;
            }
        }
    }
    if s.twitch_videos {
        let data = api(
            "https://api.twitch.tv/helix/videos",
            &token,
            &[
                ("user_id", &user),
                ("type", "all"),
                ("sort", "time"),
                ("first", "20"),
            ],
            Some(&client),
        )
        .await?;
        let items=data["data"].as_array().into_iter().flatten().filter(|i|i["type"]!="archive").map(|i|json!({"id":i["id"],"title":i["title"],"url":i["url"],"thumbnail":i["thumbnail_url"]})).collect::<Vec<_>>();
        videos(app, "twitch", &format!("videos-{user}"), &items).await?;
        // Clips sorted by views: bounded to the last day and 100 results, not a complete archive.
        let pool = crate::backup::pool(app).await?;
        let since: String =
            sqlx::query_scalar("SELECT strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 day')")
                .fetch_one(&pool)
                .await
                .map_err(|e| e.to_string())?;
        let clips = api(
            "https://api.twitch.tv/helix/clips",
            &token,
            &[
                ("broadcaster_id", &user),
                ("started_at", &since),
                ("first", "100"),
            ],
            Some(&client),
        )
        .await?;
        let items=clips["data"].as_array().into_iter().flatten().map(|i|json!({"id":i["id"],"title":i["title"],"url":i["url"],"thumbnail":i["thumbnail_url"]})).collect::<Vec<_>>();
        videos(app, "twitch", &format!("clips-{user}"), &items).await?;
    }
    Ok(())
}
pub fn start(app: AppHandle) {
    std::thread::spawn(move || {
        loop {
            // No public listener, no Discord bot token, no inbound commands.
            let state = app.state::<DiscordState>();
            if let Ok(_guard) = acquire(&state) {
                tauri::async_runtime::block_on(async {
                    let Ok(s) = settings(&app).await else { return };
                    if !s.enabled {
                        return;
                    }
                    if let Err(e) = available(&app).await {
                        activity(&app, &e).await;
                        return;
                    }
                    for platform in PLATFORMS {
                        let result = match platform {
                            "youtube" if s.youtube_live || s.youtube_videos => {
                                youtube(&app, &s).await
                            }
                            "twitch" if s.twitch_live || s.twitch_videos => twitch(&app, &s).await,
                            _ => continue,
                        };
                        if let Err(e) = result {
                            activity(&app, &format!("{platform}: {e}")).await;
                        }
                    }
                });
            }
            std::thread::sleep(Duration::from_secs(120));
        }
    });
}
