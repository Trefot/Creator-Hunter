//! Read-only official APIs. Credentials stay in the OS vault, never in SQLite or IPC responses.
use serde_json::{Value, json};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};
#[derive(Default)]
pub struct MetricsState {
    pub(crate) operation: tauri::async_runtime::Mutex<()>,
}
fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
fn vault(platform: &str) -> Result<keyring::Entry, String> {
    let service = if cfg!(debug_assertions) {
        "com.trefotg.studio.metrics.dev"
    } else {
        "com.trefotg.studio.metrics"
    };
    keyring::Entry::new(service, platform)
        .map_err(|_| "No se pudo abrir el almacén de credenciales de Windows.".into())
}
fn read_secret(platform: &str) -> Result<Value, String> {
    let s = vault(platform)?.get_password().map_err(|_| {
        "La credencial no está disponible. Vuelve a conectar esta cuenta.".to_string()
    })?;
    serde_json::from_str(&s).map_err(|_| "Vuelve a conectar esta cuenta.".into())
}
async fn cfg(app: &AppHandle, platform: &str) -> Result<Value, String> {
    crate::social_alerts::load(app, &format!("metrics-{platform}")).await
}
async fn save_cfg(app: &AppHandle, platform: &str, v: &Value) -> Result<(), String> {
    crate::social_alerts::save(app, &format!("metrics-{platform}"), v).await
}
fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(25))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| "No se pudo iniciar la consulta.".into())
}
async fn api(request: reqwest::RequestBuilder, platform: &str) -> Result<Value, String> {
    let response = request.send().await.map_err(|_| {
        format!("No se pudo contactar con {platform}. Comprueba Internet y vuelve a intentar.")
    })?;
    let status = response.status();
    let body: Value = response
        .json()
        .await
        .map_err(|_| format!("{platform} no devolvió una respuesta válida."))?;
    if !status.is_success()
        || body
            .get("error")
            .is_some_and(|e| e.is_object() && e["code"].as_str() != Some("ok") && !e.is_null())
    {
        return Err(format!(
            "{platform} rechazó la consulta. Revisa si la autorización caducó y si tiene permisos para leer estadísticas. No se ha sustituido tu registro anterior."
        ));
    }
    Ok(body)
}
fn checked_token(token: &str) -> Result<&str, String> {
    let t = token.trim();
    if crate::metrics_core::token_ok(t) {
        Ok(t)
    } else {
        Err(
            "Introduce un token de acceso válido en el campo privado; no lo compartas por chat."
                .into(),
        )
    }
}
fn text<'a>(v: &'a Value, key: &str) -> Result<&'a str, String> {
    v[key]
        .as_str()
        .filter(|s| crate::metrics_core::safe_id(s))
        .ok_or_else(|| "La plataforma no devolvió una identidad válida.".into())
}
#[tauri::command]
pub async fn metrics_status(app: AppHandle) -> Result<Value, String> {
    let mut out = json!({});
    for p in ["twitch", "meta", "tiktok"] {
        let c = cfg(&app, p).await?;
        let configured = c["configured"] == true && (p == "twitch" || read_secret(p).is_ok());
        out[p] = json!({"configured":configured,"auto":c["auto"]==true,"profile_id":c["profile_id"],"facebook_profile":c["facebook_profile"],"instagram_profile":c["instagram_profile"],"name":c["name"],"last_sync_ms":c["last_sync_ms"],"error":c["error"]});
    }
    Ok(out)
}
#[tauri::command]
pub async fn metrics_connect_meta(
    app: AppHandle,
    token: String,
    facebook_profile: String,
    instagram_profile: Option<String>,
    page_id: Option<String>,
) -> Result<Value, String> {
    let state = app.state::<MetricsState>();
    let _gate = state.operation.lock().await;
    let token = checked_token(&token)?;
    let pool = crate::backup::pool(&app).await?;
    crate::metrics_core::profile(&pool, &facebook_profile, "facebook").await?;
    if let Some(id) = instagram_profile.as_ref().filter(|s| !s.is_empty()) {
        crate::metrics_core::profile(&pool, id, "instagram").await?;
    }
    // A business-owned Page can be readable by ID even when /me/accounts is empty.
    // Explicit selection verifies read access with the supplied token before saving it.
    let requested = page_id
        .as_deref()
        .map(str::trim)
        .filter(|id| !id.is_empty());
    let (id, authorized_token) = if let Some(id) = requested {
        (
            crate::metrics_core::meta_page_id(id)?.to_string(),
            token.to_string(),
        )
    } else {
        let pages = api(
            client()?
                .get("https://graph.facebook.com/v27.0/me/accounts")
                .bearer_auth(token)
                .query(&[("fields", "id,name,access_token"), ("limit", "100")]),
            "Meta",
        )
        .await?;
        let data = pages["data"]
            .as_array()
            .ok_or("Meta no devolvió una lista válida de páginas.")?;
        if data.is_empty() {
            return Ok(json!({"needs_page_id":true}));
        }
        if data.len() > 1 {
            return Ok(
                json!({"needs_page":true,"pages":data.iter().map(|p|json!({"id":p["id"],"name":p["name"]})).collect::<Vec<_>>()}),
            );
        }
        let page = &data[0];
        let id = crate::metrics_core::meta_page_id(text(page, "id")?)?.to_string();
        let page_token = page["access_token"].as_str().ok_or("Meta no devolvió la autorización de la página. Puedes indicar su ID para comprobar el acceso con tu token de usuario.")?;
        (id, checked_token(page_token)?.to_string())
    };
    let page = api(
        client()?
            .get(format!("https://graph.facebook.com/v27.0/{id}"))
            .bearer_auth(&authorized_token)
            .query(&[(
                "fields",
                "id,name,followers_count,instagram_business_account",
            )]),
        "Facebook",
    )
    .await?;
    let needs_instagram = instagram_profile.as_ref().is_some_and(|s| !s.is_empty());
    let ig = crate::metrics_core::meta_page_identity(&page, &id, needs_instagram)?;
    if needs_instagram {
        let ig_id = ig
            .as_deref()
            .ok_or("La página no tiene un Instagram profesional vinculado.")?;
        let instagram = api(
            client()?
                .get(format!("https://graph.facebook.com/v27.0/{ig_id}"))
                .bearer_auth(&authorized_token)
                .query(&[("fields", "id,username,followers_count,media_count")]),
            "Instagram",
        )
        .await?;
        crate::metrics_core::meta_instagram_identity(&instagram, ig_id)?;
    }
    vault("meta")?
        .set_password(&json!({"token":authorized_token,"page_id":id,"instagram_id":ig}).to_string())
        .map_err(|_| "Windows no pudo guardar la autorización.".to_string())?;
    save_cfg(&app,"meta",&json!({"configured":true,"auto":true,"facebook_profile":facebook_profile,"instagram_profile":instagram_profile,"name":page["name"]})).await?;
    Ok(json!({"configured":true,"name":page["name"]}))
}
#[tauri::command]
pub async fn metrics_connect_tiktok(
    app: AppHandle,
    token: String,
    profile_id: String,
) -> Result<(), String> {
    let state = app.state::<MetricsState>();
    let _gate = state.operation.lock().await;
    let token = checked_token(&token)?;
    let pool = crate::backup::pool(&app).await?;
    crate::metrics_core::profile(&pool, &profile_id, "tiktok").await?;
    let v = api(
        client()?
            .get("https://open.tiktokapis.com/v2/user/info/")
            .bearer_auth(token)
            .query(&[("fields", "open_id,display_name,follower_count,video_count")]),
        "TikTok",
    )
    .await?;
    let user = &v["data"]["user"];
    if crate::metrics_core::count(&user["follower_count"]).is_none() {
        return Err("TikTok no autorizó las estadísticas. Habilita user.info.stats para tu usuario de prueba o aplicación.".into());
    }
    vault("tiktok")?
        .set_password(&json!({"token":token,"account_id":text(user,"open_id")?}).to_string())
        .map_err(|_| "Windows no pudo guardar la autorización.".to_string())?;
    save_cfg(
        &app,
        "tiktok",
        &json!({"configured":true,"auto":true,"profile_id":profile_id,"name":user["display_name"]}),
    )
    .await
}
async fn sync(
    app: &AppHandle,
    platform: &str,
    profile_id: Option<&str>,
    date: &str,
) -> Result<Value, String> {
    let pool = crate::backup::pool(app).await?;
    let mut c = cfg(app, platform).await?;
    let mut rows = Vec::new();
    match platform {
        "twitch" => {
            let id = profile_id
                .or_else(|| c["profile_id"].as_str())
                .ok_or("Elige tu perfil de Twitch.")?;
            crate::metrics_core::profile(&pool, id, "twitch").await?;
            let (client_id, token, user) = crate::social_alerts::twitch_token().await?;
            if c["account_id"]
                .as_str()
                .is_some_and(|previous| previous != user)
            {
                return Err("La cuenta de Twitch cambió. Desvincula sus métricas y elige el perfil correcto antes de sincronizar.".into());
            }
            let data = api(
                client()?
                    .get("https://api.twitch.tv/helix/channels/followers")
                    .bearer_auth(&token)
                    .header("Client-Id", &client_id)
                    .query(&[("broadcaster_id", user.as_str()), ("first", "1")]),
                "Twitch",
            )
            .await?;
            let count = crate::metrics_core::count(&data["total"])
                .ok_or("Twitch no devolvió el total de seguidores.")?;
            let identity = api(
                client()?
                    .get("https://api.twitch.tv/helix/users")
                    .bearer_auth(&token)
                    .header("Client-Id", &client_id)
                    .query(&[("id", user.as_str())]),
                "Twitch",
            )
            .await?;
            let handle: String = sqlx::query_scalar("SELECT handle FROM profile WHERE id=$1")
                .bind(id)
                .fetch_one(&pool)
                .await
                .map_err(|e| e.to_string())?;
            if !handle
                .trim()
                .trim_start_matches('@')
                .eq_ignore_ascii_case(identity["data"][0]["login"].as_str().unwrap_or(""))
            {
                return Err("El @usuario del perfil no coincide con la cuenta de Twitch autorizada. Corrige el perfil o cambia la cuenta.".into());
            }
            crate::metrics_core::snapshot(&pool, id, "twitch", date, Some(count), None).await?;
            c = json!({"configured":true,"auto":c["auto"].as_bool().unwrap_or(true),"profile_id":id,"account_id":user,"name":identity["data"][0]["display_name"]});
            rows.push(json!({"platform":"twitch","followers":count}));
        }
        "meta" => {
            let secret = read_secret("meta")?;
            let token = secret["token"].as_str().ok_or("Vuelve a conectar Meta.")?;
            let page = text(&secret, "page_id")?;
            let v = api(
                client()?
                    .get(format!("https://graph.facebook.com/v27.0/{page}"))
                    .bearer_auth(token)
                    .query(&[("fields", "id,name,followers_count")]),
                "Facebook",
            )
            .await?;
            let facebook = c["facebook_profile"]
                .as_str()
                .ok_or("Elige el perfil de Facebook.")?;
            // Fetch both before any write: an Instagram permission failure cannot overwrite its data with zero.
            let mut instagram = None;
            if let Some(id) = c["instagram_profile"].as_str().filter(|s| !s.is_empty()) {
                let ig = text(&secret, "instagram_id")?;
                let v = api(
                    client()?
                        .get(format!("https://graph.facebook.com/v27.0/{ig}"))
                        .bearer_auth(token)
                        .query(&[("fields", "id,username,followers_count,media_count")]),
                    "Instagram",
                )
                .await?;
                instagram = Some((id.to_string(), v));
            }
            let mut batch = vec![crate::metrics_core::Snapshot {
                id: facebook,
                platform: "facebook",
                followers: crate::metrics_core::count(&v["followers_count"]),
                views: None,
            }];
            if let Some((id, v)) = instagram.as_ref() {
                batch.push(crate::metrics_core::Snapshot {
                    id,
                    platform: "instagram",
                    followers: crate::metrics_core::count(&v["followers_count"]),
                    views: None,
                });
            }
            crate::metrics_core::snapshot_batch(&pool, date, &batch).await?;
            rows.push(json!({"platform":"facebook","followers":v["followers_count"]}));
            if let Some((_, v)) = instagram {
                rows.push(json!({"platform":"instagram","followers":v["followers_count"],"posts":v["media_count"]}));
            }
        }
        "tiktok" => {
            let secret = read_secret("tiktok")?;
            let token = secret["token"]
                .as_str()
                .ok_or("Vuelve a conectar TikTok.")?;
            let id = c["profile_id"]
                .as_str()
                .ok_or("Elige el perfil de TikTok.")?;
            let v = api(
                client()?
                    .get("https://open.tiktokapis.com/v2/user/info/")
                    .bearer_auth(token)
                    .query(&[("fields", "open_id,follower_count,video_count,likes_count")]),
                "TikTok",
            )
            .await?;
            let user = &v["data"]["user"];
            if user["open_id"] != secret["account_id"] {
                return Err("La autorización pertenece a otra cuenta de TikTok.".into());
            }
            crate::metrics_core::snapshot(
                &pool,
                id,
                "tiktok",
                date,
                crate::metrics_core::count(&user["follower_count"]),
                None,
            )
            .await?;
            rows.push(json!({"platform":"tiktok","followers":user["follower_count"],"likes":user["likes_count"],"posts":user["video_count"]}));
        }
        _ => return Err("Red no compatible.".into()),
    }
    c["last_sync_ms"] = json!(now());
    c["error"] = Value::Null;
    save_cfg(app, platform, &c).await?;
    let _ = app.emit("metrics-changed", ());
    Ok(json!({"rows":rows,"updated_ms":c["last_sync_ms"]}))
}
#[tauri::command]
pub async fn metrics_sync(
    app: AppHandle,
    platform: String,
    profile_id: Option<String>,
    date: String,
) -> Result<Value, String> {
    let state = app.state::<MetricsState>();
    let _gate = state.operation.lock().await;
    let result = sync(&app, &platform, profile_id.as_deref(), &date).await;
    if let Err(ref e) = result {
        if ["twitch", "meta", "tiktok"].contains(&platform.as_str()) {
            let mut c = cfg(&app, &platform).await?;
            if c.is_object() {
                c["error"] = json!(e);
                save_cfg(&app, &platform, &c).await?;
            }
        }
    }
    result
}
#[tauri::command]
pub async fn metrics_control(
    app: AppHandle,
    platform: String,
    action: String,
) -> Result<(), String> {
    if !["twitch", "meta", "tiktok"].contains(&platform.as_str()) {
        return Err("Red no compatible.".into());
    }
    let state = app.state::<MetricsState>();
    let _gate = state.operation.lock().await;
    let mut c = cfg(&app, &platform).await?;
    if action == "disconnect" {
        if platform != "twitch" {
            let _ = vault(&platform)?.delete_credential();
        }
        c = json!({"configured":false,"auto":false});
    } else if c.is_object() && ["auto_on", "auto_off"].contains(&action.as_str()) {
        c["auto"] = json!(action == "auto_on");
    } else {
        return Err("Acción no compatible.".into());
    }
    save_cfg(&app, &platform, &c).await
}
pub async fn reset_after_restore(app: &AppHandle) -> Result<(), String> {
    for p in ["twitch", "meta", "tiktok"] {
        let mut c = cfg(app, p).await?;
        if c.is_object() {
            c["auto"] = json!(false);
            save_cfg(app, p, &c).await?;
        }
    }
    Ok(())
}
