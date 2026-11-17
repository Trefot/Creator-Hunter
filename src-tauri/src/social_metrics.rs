//! Read-only official APIs. Credentials stay in the OS vault, never in SQLite or IPC responses.
use serde_json::{Value, json};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_opener::OpenerExt;
#[derive(Default)]
pub struct MetricsState {
    pub(crate) operation: tauri::async_runtime::Mutex<()>,
    tiktok_pending: std::sync::Mutex<Option<crate::tiktok_auth_core::Attempt>>,
    tiktok_completing: std::sync::atomic::AtomicBool,
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
    if status.as_u16()==429{return Err(format!("{platform} está limitando las consultas. Espera unos minutos antes de reintentar; tus cifras se conservan."))}
    if status.is_server_error(){return Err(format!("{platform} no está disponible temporalmente. No necesitas volver a registrar la aplicación; reintenta más tarde."))}
    let body: Value = response
        .json()
        .await
        .map_err(|_| format!("{platform} no devolvió una respuesta válida."))?;
    if platform=="Meta"&&body["error"]["code"].as_i64()==Some(190){return Err("La autorización de Meta caducó o fue revocada. Renueva el token en Conexiones; tus registros se conservan.".into())}
    if platform=="Meta"&&matches!(body["error"]["code"].as_i64(),Some(10|200)){return Err("Meta no concedió el permiso necesario para esta consulta. Revisa la página seleccionada y los permisos de contenido/estadísticas de la aplicación.".into())}
    if platform == "TikTok" {
        if let Some(message) = crate::tiktok_auth_core::oauth_error(&body) {
            return Err(message.into());
        }
    }
    if body["error"]
        .as_str()
        .is_some_and(|e| !e.is_empty() && e != "ok")
        || !status.is_success()
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
    let shared = app.state::<MetricsState>();
    let _gate = shared.operation.lock().await;
    let mut out = json!({});
    for p in ["twitch", "meta", "tiktok"] {
        let c = cfg(&app, p).await?;
        let configured = c["configured"] == true && (p == "twitch" || read_secret(p).is_ok());
        out[p] = json!({"configured":configured,"auto":c["auto"]==true,"profile_id":c["profile_id"],"facebook_profile":c["facebook_profile"],"instagram_profile":c["instagram_profile"],"name":c["name"],"last_sync_ms":c["last_sync_ms"],"error":c["error"],"last_auth_ms":c["last_auth_ms"],"can_reconnect":p=="tiktok"&&read_secret(p).is_ok_and(|s|s["client_key"].is_string()&&s["client_secret"].is_string()),"video_access":p=="tiktok"&&read_secret(p).is_ok_and(|s|s["scope"].as_str().unwrap_or_default().split(',').any(|v|v.trim()=="video.list"))});
    }
    let state = app.state::<MetricsState>();
    let mut pending = state
        .tiktok_pending
        .lock()
        .map_err(|_| "No se pudo consultar TikTok.")?;
    if pending
        .as_ref()
        .is_some_and(|p| now().saturating_sub(p.started) >= 600_000)
    {
        *pending = None;
    }
    out["tiktok"]["pending"] = json!(
        state
            .tiktok_completing
            .load(std::sync::atomic::Ordering::SeqCst)
            || pending
                .as_ref()
                .is_some_and(|p| now().saturating_sub(p.started) < 600_000)
    );
    out["tiktok"]["redirect_uri"] = json!(tiktok_redirect());
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
    *state
        .tiktok_pending
        .lock()
        .map_err(|_| "No se pudo cerrar la autorización anterior.")? = None;
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
            c = json!({"configured":true,"auto":if c["configured"]==true {c["auto"].as_bool().unwrap_or(true)} else {true},"profile_id":id,"account_id":user,"name":identity["data"][0]["display_name"]});
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
            let secret = tiktok_secret().await?;
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
        if platform == "tiktok" {
            *state
                .tiktok_pending
                .lock()
                .map_err(|_| "No se pudo cerrar TikTok.")? = None;
        }
        if platform != "twitch" {
            match vault(&platform)?.delete_credential(){Ok(())|Err(keyring::Error::NoEntry)=>{},Err(_)=>return Err("Windows no pudo borrar la credencial local. Vuelve a intentar desconectar.".into())}
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
    *app.state::<MetricsState>()
        .tiktok_pending
        .lock()
        .map_err(|_| "No se pudo cancelar TikTok.")? = None;
    for p in ["twitch", "meta", "tiktok"] {
        let mut c = cfg(app, p).await?;
        if c.is_object() {
            c["auto"] = json!(false);
            save_cfg(app, p, &c).await?;
        }
    }
    Ok(())
}

fn tiktok_redirect() -> String {
    format!("http://127.0.0.1:{}/tiktok/callback", crate::live::PORT)
}
#[tauri::command]
pub async fn metrics_tiktok_begin(
    app: AppHandle,
    client_key: String,
    client_secret: String,
    profile_id: String,
    publications: Option<bool>,
) -> Result<(), String> {
    let state = app.state::<MetricsState>();
    let _gate = state.operation.lock().await;
    let pool = crate::backup::pool(&app).await?;
    crate::metrics_core::profile(&pool, &profile_id, "tiktok").await?;
    let key = client_key.trim().to_string();
    let secret = checked_token(&client_secret)?.to_string();
    if !app
        .state::<crate::live::LiveState>()
        .0
        .lock()
        .map_err(|_| "No se pudo consultar el servidor local.")?
        .running
    {
        return Err(
            "El servidor local de Nexus no está disponible. Revisa En directo antes de autorizar."
                .into(),
        );
    }
    let pending = crate::tiktok_auth_core::Attempt {
        state: crate::tiktok_auth_core::nonce(),
        verifier: crate::tiktok_auth_core::nonce(),
        key,
        secret,
        profile: profile_id,
        started: now(),
    };
    let mut url = crate::tiktok_auth_core::authorize_url(
        &pending.key,
        &pending.state,
        &pending.verifier,
        &tiktok_redirect(),
    )?;
    if publications.unwrap_or(false) {
        let mut parsed=reqwest::Url::parse(&url).map_err(|_|"No se pudo preparar la autorización.")?;
        let pairs:Vec<(String,String)>=parsed.query_pairs().filter(|(k,_)|k!="scope").map(|(k,v)|(k.into_owned(),v.into_owned())).collect();
        parsed.set_query(None);parsed.query_pairs_mut().extend_pairs(pairs).append_pair("scope","user.info.basic,user.info.stats,video.list");url=parsed.into();
    }
    *state
        .tiktok_pending
        .lock()
        .map_err(|_| "No se pudo iniciar TikTok.")? = Some(pending);
    if app.opener().open_url(&url, None::<&str>).is_err() {
        *state
            .tiktok_pending
            .lock()
            .map_err(|_| "No se pudo cerrar TikTok.")? = None;
        return Err("No se pudo abrir TikTok en el navegador.".into());
    }
    Ok(())
}
#[tauri::command]
pub async fn metrics_tiktok_cancel(app: AppHandle) -> Result<(), String> {
    let s = app.state::<MetricsState>();
    if s.tiktok_completing
        .load(std::sync::atomic::Ordering::SeqCst)
    {
        return Err("TikTok ya está comprobando la autorización. Espera el resultado; después puedes desvincular la cuenta.".into());
    }
    let _gate = s.operation.lock().await;
    *s.tiktok_pending
        .lock()
        .map_err(|_| "No se pudo cancelar TikTok.")? = None;
    Ok(())
}
pub async fn tiktok_callback(app: &AppHandle, state_value: &str, code: &str) -> Result<(), String> {
    let state = app.state::<MetricsState>();
    let _gate = state.operation.lock().await;
    let p = {
        let mut pending = state
            .tiktok_pending
            .lock()
            .map_err(|_| "No se pudo comprobar TikTok.")?;
        let attempt = crate::tiktok_auth_core::take_attempt(&mut pending, state_value, now())?;
        state
            .tiktok_completing
            .store(true, std::sync::atomic::Ordering::SeqCst);
        attempt
    };
    struct Reset<'a>(&'a std::sync::atomic::AtomicBool);
    impl Drop for Reset<'_> {
        fn drop(&mut self) {
            self.0.store(false, std::sync::atomic::Ordering::SeqCst);
        }
    }
    let _reset = Reset(&state.tiktok_completing);
    let result=async{
  if code.is_empty()||code.len()>8192{return Err("TikTok no concedió la autorización. Vuelve a conectar desde Nexus.".to_string())}
  let body=api(client()?.post("https://open.tiktokapis.com/v2/oauth/token/").form(&[("client_key",p.key.as_str()),("client_secret",p.secret.as_str()),("code",code),("grant_type","authorization_code"),("redirect_uri",tiktok_redirect().as_str()),("code_verifier",p.verifier.as_str())]),"TikTok").await?;
  let secret=crate::tiktok_auth_core::credentials(&body,&p.key,&p.secret,now(),None)?;
  let v=api(client()?.get("https://open.tiktokapis.com/v2/user/info/").bearer_auth(secret["token"].as_str().ok_or("TikTok no devolvió el token.")?).query(&[("fields","open_id,display_name,follower_count")]),"TikTok").await?;
  let user=&v["data"]["user"];
  if user["open_id"]!=secret["account_id"]||crate::metrics_core::count(&user["follower_count"]).is_none(){return Err("No se pudieron comprobar la cuenta y sus estadísticas. Autoriza user.info.basic y user.info.stats.".into())}
  let pool=crate::backup::pool(app).await?;crate::metrics_core::profile(&pool,&p.profile,"tiktok").await?;
  let old=read_secret("tiktok").ok();vault("tiktok")?.set_password(&secret.to_string()).map_err(|_|"Windows no pudo guardar TikTok.")?;
  if let Err(e)=save_cfg(app,"tiktok",&json!({"configured":true,"auto":true,"profile_id":p.profile,"name":user["display_name"],"last_auth_ms":now()})).await{if let Some(old)=old{let _=vault("tiktok")?.set_password(&old.to_string());}else{let _=vault("tiktok")?.delete_credential();}return Err(e)}
  let _=app.emit("metrics-changed",());Ok(())
 }.await;
    if let Err(ref e) = result {
        let mut c = cfg(app, "tiktok").await?;
        if !c.is_object() {
            c = json!({"configured":false,"auto":false});
        }
        c["error"] = json!(e);
        save_cfg(app, "tiktok", &c).await?;
    }
    result
}
// Caller holds MetricsState.operation, serializing rotation, sync and disconnect.
async fn tiktok_secret() -> Result<Value, String> {
    let old = read_secret("tiktok")?;
    if old["expires_ms"]
        .as_u64()
        .is_none_or(|expiry| expiry > now().saturating_add(120_000))
    {
        return Ok(old);
    }
    if old["refresh_expires_ms"]
        .as_u64()
        .is_none_or(|expiry| expiry <= now())
    {
        return Err(
            "La autorización de TikTok caducó. Vuelve a autorizar desde Conexiones.".into(),
        );
    }
    let key = old["client_key"]
        .as_str()
        .ok_or("Vuelve a autorizar TikTok.")?;
    let secret = old["client_secret"]
        .as_str()
        .ok_or("Vuelve a autorizar TikTok.")?;
    let body = api(
        client()?
            .post("https://open.tiktokapis.com/v2/oauth/token/")
            .form(&[
                ("client_key", key),
                ("client_secret", secret),
                ("grant_type", "refresh_token"),
                (
                    "refresh_token",
                    old["refresh_token"]
                        .as_str()
                        .ok_or("Vuelve a autorizar TikTok.")?,
                ),
            ]),
        "TikTok",
    )
    .await?;
    let fresh = crate::tiktok_auth_core::credentials(
        &body,
        key,
        secret,
        now(),
        old["account_id"].as_str(),
    )?;
    // Save the rotated refresh token before any subsequent API call can fail.
    vault("tiktok")?.set_password(&fresh.to_string()).map_err(
        |_| "Windows no pudo guardar la renovación de TikTok. Vuelve a autorizar la cuenta.",
    )?;
    Ok(fresh)
}

/// Publication reads share the metrics gate: refreshing/disconnecting cannot race credentials.
pub(crate) async fn content_feed(app:&AppHandle,platform:&str)->Result<(String,Vec<crate::content_performance::Post>,Option<String>),String>{
 use crate::content_performance::{Post,count};
 let shared=app.state::<MetricsState>();let _gate=shared.operation.lock().await;
 let provider=if matches!(platform,"instagram"|"facebook"){"meta"}else{platform};
 let c=cfg(app,provider).await?;
 if c["configured"]!=true{return Err(format!("Conecta {platform} y comprueba sus métricas en Conexiones."))}
 let profile=c[match platform{"facebook"=>"facebook_profile","instagram"=>"instagram_profile",_=>"profile_id"}].as_str().ok_or("Selecciona el perfil de esta red en Conexiones.")?.to_string();
 let mut out=Vec::new();let mut warning=None;
 match platform{
 "tiktok"=>{
  let secret=tiktok_secret().await?;
  crate::content_core::bind_owner(&crate::backup::pool(app).await?,&profile,platform,text(&secret,"account_id")?).await?;
  if !secret["scope"].as_str().unwrap_or_default().split(',').any(|s|s.trim()=="video.list"){return Err("TikTok necesita el permiso video.list: añádelo en tu Sandbox, activa Publicaciones al autorizar y vuelve a conectar. Tus cifras de seguidores siguen disponibles.".into())}
  let token=secret["token"].as_str().ok_or("Vuelve a conectar TikTok.")?;
  let fields="id,title,video_description,create_time,cover_image_url,share_url,like_count,comment_count,share_count,view_count";
  let v=api(client()?.post("https://open.tiktokapis.com/v2/video/list/").bearer_auth(token).query(&[("fields",fields)]).json(&json!({"max_count":20})),"TikTok").await?;
  let mut videos=v["data"]["videos"].as_array().cloned().ok_or("TikTok no devolvió la lista de vídeos.")?;
  let known=crate::content_performance::known(app,&profile).await?;
  for ids in known.chunks(20){
   let v=api(client()?.post("https://open.tiktokapis.com/v2/video/query/").bearer_auth(token).query(&[("fields",fields)]).json(&json!({"filters":{"video_ids":ids}})),"TikTok").await?;
   if let Some(items)=v["data"]["videos"].as_array(){for v in items{if !videos.iter().any(|x|x["id"]==v["id"]){videos.push(v.clone())}}}
  }
  let pool=crate::backup::pool(app).await?;
  for v in videos{
   let Some(id)=v["id"].as_str().filter(|s|crate::metrics_core::safe_id(s)) else{continue};
   let date:Option<String>=sqlx::query_scalar("SELECT strftime('%Y-%m-%dT%H:%M:%SZ',$1,'unixepoch')").bind(v["create_time"].as_i64()).fetch_one(&pool).await.map_err(|e|e.to_string())?;
   let Some(date)=date else{continue};
   let mut p=Post::new(&v["cover_image_url"],id,v["title"].as_str().or_else(||v["video_description"].as_str()).unwrap_or("Vídeo"),v["share_url"].as_str().unwrap_or_default().into(),date,"short");
   p.views=count(&v["view_count"]);p.likes=count(&v["like_count"]);p.comments=count(&v["comment_count"]);p.shares=count(&v["share_count"]);out.push(p);
  }
  warning=Some("Descubre los 20 vídeos públicos más recientes y actualiza hasta 200 ya registrados. Los contadores pueden llegar con retraso.".into());
 },
 "instagram"|"facebook"=>{
  let secret=read_secret("meta")?;let token=secret["token"].as_str().ok_or("Renueva la autorización de Meta.")?;
  let owner=text(&secret,if platform=="instagram"{"instagram_id"}else{"page_id"})?;
  crate::content_core::bind_owner(&crate::backup::pool(app).await?,&profile,platform,owner).await?;
  let fields=if platform=="instagram"{"id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count"}else{"id,message,created_time,permalink_url,full_picture,likes.limit(0).summary(true),comments.limit(0).summary(true),shares"};
  let path=if platform=="instagram"{"media"}else{"published_posts"};
  let v=api(client()?.get(format!("https://graph.facebook.com/v27.0/{owner}/{path}")).bearer_auth(token).query(&[("fields",fields),("limit","50")]),"Meta").await?;
  let items=v["data"].as_array().ok_or("Meta no devolvió publicaciones. Revisa los permisos de contenido de la cuenta.")?;
  let mut missing_insights=false;
  let pool=crate::backup::pool(app).await?;
  let attempts:Vec<(String,String)>=sqlx::query_as("SELECT id,content FROM alert_cursor WHERE id LIKE $1").bind(format!("content-insight-{platform}:%")).fetch_all(&pool).await.map_err(|e|e.to_string())?;
  let attempts:std::collections::HashMap<String,u64>=attempts.into_iter().map(|(id,raw)|(id,serde_json::from_str::<u64>(&raw).unwrap_or(0))).collect();
  let mut order:Vec<usize>=(0..items.len()).collect();order.sort_by_key(|i|if *i<5{(0,*i as u64)}else{(1,*attempts.get(&format!("content-insight-{platform}:{}",items[*i]["id"].as_str().unwrap_or_default())).unwrap_or(&0))});
  let eligible:std::collections::HashSet<String>=order.into_iter().take(10).filter_map(|i|items[i]["id"].as_str().map(str::to_string)).collect();
  for v in items{
   let Some(id)=v["id"].as_str().filter(|s|crate::metrics_core::safe_id(s)) else{continue};
   let ig=platform=="instagram";
   let format=if ig {if v["media_product_type"]=="REELS"{"reel"}else{"post"}}else{"post"};
   let mut p=Post::new(if ig{if v["thumbnail_url"].is_string(){&v["thumbnail_url"]}else{&v["media_url"]}}else{&v["full_picture"]},id,v[if ig{"caption"}else{"message"}].as_str().unwrap_or("Publicación"),v[if ig{"permalink"}else{"permalink_url"}].as_str().unwrap_or_default().into(),v[if ig{"timestamp"}else{"created_time"}].as_str().unwrap_or_default().into(),format);
   p.likes=count(if ig{&v["like_count"]}else{&v["likes"]["summary"]["total_count"]});p.comments=count(if ig{&v["comments_count"]}else{&v["comments"]["summary"]["total_count"]});p.shares=count(&v["shares"]["count"]);
   if !missing_insights&&eligible.contains(id){
    crate::social_alerts::save(app,&format!("content-insight-{platform}:{id}"),&json!(now())).await?;
    match api(client()?.get(format!("https://graph.facebook.com/v27.0/{id}/insights")).bearer_auth(token).query(&[("metric",if ig{"views"}else{"post_media_view"})]),"Meta").await{
     Ok(insights)=>{p.views=count(&insights["data"][0]["values"][0]["value"]).or_else(||count(&insights["data"][0]["total_value"]["value"]));},Err(_)=>missing_insights=true,
    }
   }
   out.push(p);
  }
  warning=Some(if platform=="facebook"&&missing_insights{"Últimas 50 publicaciones. Las vistas requieren read_insights y pages_read_engagement; renueva la autorización con esos permisos. Los datos no disponibles quedan vacíos."}else if platform=="facebook"{"Últimas 50 publicaciones. Vistas de contenido mostrado o reproducido (post_media_view). Hasta diez consultas de vistas por recorrido; las demás métricas dependen de Meta y cada cifra conserva su fecha."}else if missing_insights{"Últimas 50 publicaciones. Para vistas se necesita instagram_manage_insights; los valores no disponibles quedan vacíos. Comprueba el permiso en Meta y renueva la autorización."}else{"Últimas 50 publicaciones. Se rotan hasta diez consultas de vistas por recorrido para cuidar la cuota; cada cifra conserva su fecha. Meta puede entregar datos con retraso."}.into());
 },
 "twitch"=>{
  let (client_id,token,user)=crate::social_alerts::twitch_token().await?;
  if c["account_id"].as_str()!=Some(user.as_str()){return Err("La cuenta de Twitch cambió. Revisa el perfil antes de consultar contenido.".into())}
  crate::content_core::bind_owner(&crate::backup::pool(app).await?,&profile,platform,&user).await?;
  let v=api(client()?.get("https://api.twitch.tv/helix/videos").bearer_auth(&token).header("Client-Id",client_id).query(&[("user_id",user.as_str()),("first","50")]),"Twitch").await?;
  for v in v["data"].as_array().into_iter().flatten(){
   let Some(id)=v["id"].as_str() else{continue};let mut p=Post::new(&v["thumbnail_url"],id,v["title"].as_str().unwrap_or("Directo"),v["url"].as_str().unwrap_or_default().into(),v["published_at"].as_str().unwrap_or_default().into(),"live");p.views=count(&v["view_count"]);out.push(p);
  }
  warning=Some("Últimos 50 vídeos y repeticiones. Twitch no ofrece aquí likes ni comentarios comparables a otras redes. Los clips se gestionan por separado.".into());
 },_=>return Err("Esta red no admite consultas de publicaciones.".into())
 }
 Ok((profile,out,warning))
}

#[tauri::command]
pub async fn metrics_tiktok_reconnect(app:AppHandle,profile_id:String,publications:Option<bool>)->Result<(),String>{
 let old=read_secret("tiktok")?;
 let key=old["client_key"].as_str().ok_or("Esta conexión manual no tiene cliente guardado. Introduce el Client key y Client secret para usar autorización renovable.")?;
 let secret=old["client_secret"].as_str().ok_or("Introduce de nuevo el Client secret en el campo privado.")?;
 let video=publications.unwrap_or(false)||old["scope"].as_str().unwrap_or_default().split(',').any(|v|v.trim()=="video.list");
 metrics_tiktok_begin(app,key.into(),secret.into(),profile_id,Some(video)).await
}
