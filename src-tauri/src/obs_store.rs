//! Persistencia de sesiones y marcas; usa la misma transacción/copia de seguridad que el resto.
use serde_json::{Value, json};
use sqlx::{Row, SqlitePool};
pub const WORKSPACE: &str = "00000000-0000-4000-8000-000000000001";

pub async fn open_session(
    pool: &SqlitePool,
    id: &str,
    kind: &str,
    game: Option<&str>,
) -> Result<(), String> {
    sqlx::query("INSERT INTO obs_session(id,workspace_id,kind,game_id) VALUES($1,$2,$3,(SELECT id FROM game WHERE id=$4 AND workspace_id=$2))")
        .bind(id).bind(WORKSPACE).bind(kind).bind(game).execute(pool).await.map_err(|e|e.to_string())?;
    Ok(())
}
pub async fn close_session(
    pool: &SqlitePool,
    id: &str,
    reason: &str,
    path: Option<&str>,
) -> Result<(), String> {
    sqlx::query("UPDATE obs_session SET ended_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),end_reason=$1,output_path=COALESCE($2,output_path) WHERE id=$3 AND workspace_id=$4 AND ended_at IS NULL")
        .bind(reason).bind(path).bind(id).bind(WORKSPACE).execute(pool).await.map_err(|e|e.to_string())?;
    Ok(())
}
pub async fn insert_marker(
    pool: &SqlitePool,
    id: &str,
    session: &str,
    title: &str,
    record_ms: Option<i64>,
    stream_ms: Option<i64>,
    game: Option<&str>,
) -> Result<(), String> {
    if title.trim().is_empty() || title.chars().count() > 200 {
        return Err("El título debe tener entre 1 y 200 caracteres.".into());
    }
    if record_ms.is_none() && stream_ms.is_none() {
        return Err("No hay grabación ni directo activos para marcar.".into());
    }
    let done=sqlx::query("INSERT INTO obs_marker(id,workspace_id,session_id,title,record_ms,stream_ms,game_id,game_title) SELECT $1,$2,id,$4,$5,$6,(SELECT id FROM game WHERE id=$7 AND workspace_id=$2),(SELECT title FROM game WHERE id=$7 AND workspace_id=$2) FROM obs_session WHERE id=$3 AND workspace_id=$2 AND ended_at IS NULL")
        .bind(id).bind(WORKSPACE).bind(session).bind(title.trim()).bind(record_ms).bind(stream_ms).bind(game)
        .execute(pool).await.map_err(|e|e.to_string())?;
    if done.rows_affected() != 1 {
        return Err("La sesión ya terminó; no se guardó la marca.".into());
    }
    Ok(())
}
pub async fn list_markers(pool: &SqlitePool) -> Result<Value, String> {
    let rows=sqlx::query("SELECT m.id,m.title,m.created_at,m.record_ms,m.stream_ms,m.game_title,s.output_path,s.kind,s.observed_at,s.end_reason FROM obs_marker m JOIN obs_session s ON s.id=m.session_id WHERE m.workspace_id=$1 ORDER BY m.created_at DESC,m.rowid DESC LIMIT 200")
        .bind(WORKSPACE).fetch_all(pool).await.map_err(|e|e.to_string())?;
    Ok(json!(rows.iter().map(|r|json!({
        "id":r.get::<String,_>("id"),"title":r.get::<String,_>("title"),"created_at":r.get::<String,_>("created_at"),
        "record_ms":r.get::<Option<i64>,_>("record_ms"),"stream_ms":r.get::<Option<i64>,_>("stream_ms"),
        "game_title":r.get::<Option<String>,_>("game_title"),"output_path":r.get::<Option<String>,_>("output_path"),
        "kind":r.get::<String,_>("kind"),"observed_at":r.get::<String,_>("observed_at"),"end_reason":r.get::<Option<String>,_>("end_reason")
    })).collect::<Vec<_>>()))
}

/// Clip y marca asociada se guardan en una sola transacción. El vídeo permanece donde OBS lo creó.
pub async fn insert_clip(
    pool: &SqlitePool,
    id: &str,
    marker_id: Option<&str>,
    session: Option<&str>,
    title: &str,
    path: &str,
    record_ms: Option<i64>,
    stream_ms: Option<i64>,
    game: Option<&str>,
) -> Result<(), String> {
    if path.trim().is_empty() {
        return Err("OBS no confirmó una ruta de archivo.".into());
    }
    if title.trim().is_empty() || title.chars().count() > 200 {
        return Err("El título debe tener entre 1 y 200 caracteres.".into());
    }
    if marker_id.is_some() != session.is_some() {
        return Err("La asociación del clip no es válida.".into());
    }
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
    if let (Some(marker), Some(session)) = (marker_id, session) {
        let done=sqlx::query("INSERT INTO obs_marker(id,workspace_id,session_id,title,record_ms,stream_ms,game_id,game_title) SELECT $1,$2,id,$4,$5,$6,(SELECT id FROM game WHERE id=$7 AND workspace_id=$2),(SELECT title FROM game WHERE id=$7 AND workspace_id=$2) FROM obs_session WHERE id=$3 AND workspace_id=$2 AND ended_at IS NULL")
            .bind(marker).bind(WORKSPACE).bind(session).bind(title.trim()).bind(record_ms).bind(stream_ms).bind(game).execute(&mut *tx).await.map_err(|e|e.to_string())?;
        if done.rows_affected() != 1 {
            return Err(
                "La sesión terminó; el archivo sigue en OBS, pero no se pudo asociar la marca."
                    .into(),
            );
        }
    }
    sqlx::query("INSERT INTO obs_clip(id,workspace_id,marker_id,title,output_path,game_id,game_title,record_ms,stream_ms) VALUES($1,$2,$3,$4,$5,(SELECT id FROM game WHERE id=$6 AND workspace_id=$2),(SELECT title FROM game WHERE id=$6 AND workspace_id=$2),$7,$8)")
        .bind(id).bind(WORKSPACE).bind(marker_id).bind(title.trim()).bind(path).bind(game).bind(record_ms).bind(stream_ms)
        .execute(&mut *tx).await.map_err(|e|e.to_string())?;
    tx.commit().await.map_err(|e| e.to_string())
}
pub async fn list_clips(pool: &SqlitePool) -> Result<Value, String> {
    let rows=sqlx::query("SELECT id,title,created_at,output_path,game_title,marker_id,record_ms,stream_ms FROM obs_clip WHERE workspace_id=$1 ORDER BY created_at DESC,rowid DESC LIMIT 100")
        .bind(WORKSPACE).fetch_all(pool).await.map_err(|e|e.to_string())?;
    Ok(json!(rows.iter().map(|r|json!({
        "id":r.get::<String,_>("id"),"title":r.get::<String,_>("title"),"created_at":r.get::<String,_>("created_at"),
        "output_path":r.get::<String,_>("output_path"),"game_title":r.get::<Option<String>,_>("game_title"),
        "marker_id":r.get::<Option<String>,_>("marker_id"),"record_ms":r.get::<Option<i64>,_>("record_ms"),"stream_ms":r.get::<Option<i64>,_>("stream_ms")
    })).collect::<Vec<_>>()))
}
