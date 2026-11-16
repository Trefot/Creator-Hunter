//! Read-only publication discovery. Missing provider metrics remain null, never zero.
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager};
#[derive(Default)]
pub struct ContentState(pub tauri::async_runtime::Mutex<()>);
pub use crate::content_core::{Post,count};
pub(crate) async fn known(app:&AppHandle,profile:&str)->Result<Vec<String>,String>{
    sqlx::query_scalar("SELECT remote_id FROM content_post WHERE profile_id=$1 ORDER BY (published_at > strftime('%Y-%m-%dT%H:%M:%fZ','now','-14 days')) DESC,last_seen_at LIMIT 200")
      .bind(profile).fetch_all(&crate::backup::pool(app).await?).await.map_err(|e|e.to_string())
}
#[tauri::command]
pub async fn content_sync(app:AppHandle,platform:String)->Result<Value,String>{
    if !["youtube","twitch","tiktok","instagram","facebook"].contains(&platform.as_str()){return Err("Red no disponible.".into())}
    let state=app.state::<ContentState>();
    let _gate=state.0.lock().await;
    let result=if platform=="youtube"{crate::youtube::content_feed(&app).await}else{crate::social_metrics::content_feed(&app,&platform).await};
    let result=match result {Ok((profile,posts,warning))=>crate::content_core::store(&crate::backup::pool(&app).await?,&profile,&platform,posts).await.map(|n|json!({"count":n,"warning":warning})),Err(e)=>Err(e)};
    let stamp=std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis() as u64;
    let previous=crate::social_alerts::load(&app,&format!("content-sync-{platform}")).await.unwrap_or(json!({}));
    let status=match &result{Ok(v)=>json!({"last_success_ms":stamp,"count":v["count"],"warning":v["warning"]}),Err(e)=>json!({"last_success_ms":previous["last_success_ms"],"last_attempt_ms":stamp,"error":e})};
    crate::social_alerts::save(&app,&format!("content-sync-{platform}"),&status).await?;
    let _=app.emit("content-changed",());result
}
