use serde_json::{Value, json};
use sqlx::Row;
use std::{
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager};
#[derive(Default)]
pub struct StudioState {
    sample: Mutex<Option<(Value, Value)>>,
}
#[tauri::command]
pub async fn studio_capture_project(
    app: AppHandle,
    kind: String,
    id: String,
) -> Result<String, String> {
    let pool = crate::backup::pool(&app).await?;
    capture_project(&pool, &kind, &id).await
}
pub async fn capture_project(
    pool: &sqlx::SqlitePool,
    kind: &str,
    id: &str,
) -> Result<String, String> {
    let w = crate::obs_store::WORKSPACE;
    let query = match kind {
        "clip" => {
            "SELECT title,output_path,game_id,record_ms,stream_ms FROM obs_clip WHERE id=? AND workspace_id=?"
        }
        "moment" => {
            "SELECT m.title,s.output_path,m.game_id,m.record_ms,m.stream_ms FROM obs_marker m JOIN obs_session s ON s.id=m.session_id WHERE m.id=? AND m.workspace_id=?"
        }
        _ => return Err("Tipo de captura no válido.".into()),
    };
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
    let row = sqlx::query(query)
        .bind(id)
        .bind(w)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("La captura ya no existe.")?;
    let key = format!("capture-project-{kind}-{id}");
    let title: String = row.get("title");
    let path: Option<String> = row.get("output_path");
    let summary = format!(
        "Origen: {kind} · {id}\nArchivo: {}\nMarca en grabación (ms): {:?}\nMarca en directo (ms): {:?}\n\nGancho:\nQué ocurre:\nEdición pendiente:\nFormato y publicación:\n\nLas marcas del clip corresponden a la sesión completa, no al inicio del recorte.",
        path.as_deref().unwrap_or("No confirmado por OBS"),
        row.get::<Option<i64>, _>("record_ms"),
        row.get::<Option<i64>, _>("stream_ms")
    );
    sqlx::query("INSERT INTO project(id,workspace_id,title,summary,game_id) VALUES(?,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(&key).bind(w).bind(title).bind(summary).bind(row.get::<Option<String>,_>("game_id")).execute(&mut *tx).await.map_err(|e|e.to_string())?;
    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(key)
}
#[tauri::command]
pub async fn studio_resume(
    app: AppHandle,
    game_id: String,
    note: Option<String>,
) -> Result<Value, String> {
    let pool = crate::backup::pool(&app).await?;
    let exists: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM game WHERE id=? AND workspace_id=?)")
            .bind(&game_id)
            .bind(crate::obs_store::WORKSPACE)
            .fetch_one(&pool)
            .await
            .map_err(|e| e.to_string())?;
    if !exists {
        return Err("El juego no existe.".into());
    }
    let key = format!("game-resume/{game_id}");
    if let Some(note) = note {
        if note.chars().count() > 4000 {
            return Err("Máximo 4000 caracteres.".into());
        }
        crate::social_alerts::save(&app,&key,&json!({"note":note.trim(),"updated_ms":SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis()})).await?;
    }
    crate::social_alerts::load(&app, &key).await
}
#[tauri::command]
pub async fn studio_obs_measure(app: AppHandle) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::obs::operate(&app, |c| {
            let stats = c.request("GetStats")?;
            let stream = c.request("GetStreamStatus")?;
            let video = c.request("GetVideoSettings")?;
            let profiles = c.request("GetProfileList")?;
            let scenes = c.request("GetSceneList")?;
            let state = app.state::<StudioState>();
            let mut old = state.sample.lock().unwrap();
            let report =
                crate::studio_core::diagnostics(&stats, &stream, old.as_ref().map(|(s, o)| (s, o)));
            *old = Some((stats, stream));
            Ok(json!({"report":report,"video":video,"profiles":profiles,"scenes":scenes}))
        })
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn studio_obs_apply(
    app: AppHandle,
    profile: Option<String>,
    scene: Option<String>,
    preset: Option<String>,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move||crate::obs::operate(&app,|c|{
 c.require_idle()?;
 let old_profile=c.request("GetProfileList")?;let old_video=c.request("GetVideoSettings")?;let old_scene=c.request("GetSceneList")?;
 if let Some(p)=profile.as_ref(){if !old_profile["profiles"].as_array().is_some_and(|v|v.iter().any(|v|v==p)){return Err("El perfil ya no existe en OBS.".into());}}
 if let Some(s)=scene.as_ref(){if !old_scene["scenes"].as_array().is_some_and(|v|v.iter().any(|v|v["sceneName"]==*s)){return Err("La escena ya no existe en OBS.".into());}}
 let video=match preset.as_deref(){None=>None,Some("balanced")=>Some(json!({"outputWidth":1920,"outputHeight":1080,"fpsNumerator":60,"fpsDenominator":1})),Some("light")=>Some(json!({"outputWidth":1280,"outputHeight":720,"fpsNumerator":30,"fpsDenominator":1})),_=>return Err("Preset no válido.".into())};
 let dir=app.path().app_data_dir().map_err(|e|e.to_string())?.join("obs-copias");std::fs::create_dir_all(&dir).map_err(|e|e.to_string())?;
 let path=dir.join(format!("perfil-video-{}-{}.json",SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis(),rand::random::<u32>()));
 std::fs::write(&path,json!({"profile":old_profile["currentProfileName"],"video":old_video,"scene":old_scene["currentProgramSceneName"]}).to_string()).map_err(|e|e.to_string())?;
 let result=(||{if let Some(p)=profile{c.request_data("SetCurrentProfile",Some(json!({"profileName":p})))?;}if let Some(v)=video{c.request_data("SetVideoSettings",Some(v))?;}if let Some(s)=scene{c.request_data("SetCurrentProgramScene",Some(json!({"sceneName":s})))?;}Ok::<_,String>(())})();
 if let Err(e)=result{return Err(format!("{e} Puede haber cambios parciales. Copia previa: {}",path.display()));}
 Ok(format!("Perfil aplicado. Copia del perfil seleccionado, vídeo y escena anteriores: {}. No es una exportación completa de OBS.",path.display()))
 })).await.map_err(|e|e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn capture_project_is_idempotent_and_preserves_unknown_files() {
        tauri::async_runtime::block_on(async {
            let pool = sqlx::sqlite::SqlitePoolOptions::new()
                .max_connections(1)
                .connect("sqlite::memory:")
                .await
                .unwrap();
            sqlx::raw_sql("CREATE TABLE project(id TEXT PRIMARY KEY,workspace_id TEXT,title TEXT,summary TEXT,game_id TEXT);CREATE TABLE obs_session(id TEXT PRIMARY KEY,output_path TEXT);CREATE TABLE obs_marker(id TEXT PRIMARY KEY,workspace_id TEXT,title TEXT,session_id TEXT,game_id TEXT,record_ms INTEGER,stream_ms INTEGER);CREATE TABLE obs_clip(id TEXT PRIMARY KEY,workspace_id TEXT,title TEXT,output_path TEXT,game_id TEXT,record_ms INTEGER,stream_ms INTEGER);").execute(&pool).await.unwrap();
            sqlx::query("INSERT INTO obs_session VALUES('session',NULL)")
                .execute(&pool)
                .await
                .unwrap();
            sqlx::query(
                "INSERT INTO obs_marker VALUES('m',?,'Victoria','session','game',1234,5678)",
            )
            .bind(crate::obs_store::WORKSPACE)
            .execute(&pool)
            .await
            .unwrap();
            let a = capture_project(&pool, "moment", "m").await.unwrap();
            let b = capture_project(&pool, "moment", "m").await.unwrap();
            assert_eq!(a, b);
            let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM project")
                .fetch_one(&pool)
                .await
                .unwrap();
            assert_eq!(count, 1);
            let summary: String = sqlx::query_scalar("SELECT summary FROM project")
                .fetch_one(&pool)
                .await
                .unwrap();
            assert!(summary.contains("No confirmado por OBS"));
            assert!(summary.contains("1234"));
            assert!(!summary.contains(".mp4"));
            assert!(capture_project(&pool, "clip", "missing").await.is_err());
            assert!(capture_project(&pool, "invalid", "m").await.is_err());
        });
    }
}

#[tauri::command]
pub async fn studio_obs_restore(app: AppHandle) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move||crate::obs::operate(&app,|c|{
 c.require_idle()?;
 let dir=app.path().app_data_dir().map_err(|e|e.to_string())?.join("obs-copias");
 let mut files=std::fs::read_dir(&dir).map_err(|_|"No hay copias de ajustes de OBS.")?.filter_map(Result::ok).filter(|e|e.file_type().is_ok_and(|t|t.is_file())&&e.file_name().to_string_lossy().starts_with("perfil-video-")).collect::<Vec<_>>();
 files.sort_by_key(|e|e.file_name());let path=files.last().ok_or("No hay copia para restaurar.")?.path();
 if std::fs::metadata(&path).map_err(|e|e.to_string())?.len()>65536{return Err("Copia de ajustes demasiado grande.".into());}
 let saved:Value=serde_json::from_slice(&std::fs::read(&path).map_err(|e|e.to_string())?).map_err(|_|"Copia de ajustes no válida.")?;
 let profile=saved["profile"].as_str().ok_or("La copia no identifica el perfil.")?;
 let available=c.request("GetProfileList")?;if !available["profiles"].as_array().is_some_and(|a|a.iter().any(|p|p==profile)){return Err("El perfil de la copia ya no existe en OBS.".into());}
 let mut video=json!({});for field in ["baseWidth","baseHeight","outputWidth","outputHeight","fpsNumerator","fpsDenominator"]{let value=saved["video"][field].as_u64().filter(|n|*n>0&&*n<=100000).ok_or("Copia de vídeo no válida.")?;video[field]=json!(value);}
 let scene=saved["scene"].as_str();if let Some(scene)=scene{if !c.request("GetSceneList")?["scenes"].as_array().is_some_and(|a|a.iter().any(|s|s["sceneName"]==scene)){return Err("La escena de la copia ya no existe en OBS.".into());}}
 c.request_data("SetCurrentProfile",Some(json!({"profileName":profile})))?;
 c.request_data("SetVideoSettings",Some(video))?;
 if let Some(scene)=scene{c.request_data("SetCurrentProgramScene",Some(json!({"sceneName":scene})))?;}
 Ok(format!("Restaurados perfil, vídeo y escena desde {}. No se restauran encoder, bitrate ni fuentes.",path.display()))
 })).await.map_err(|e|e.to_string())?
}
