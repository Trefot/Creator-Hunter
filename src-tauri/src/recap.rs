//! Resumen del directo (D-029). Junta lo que ya registra Nexus durante una emisión de OBS:
//! eventos sociales, contadores, momentos, clips y trofeos. Lo derivado se calcula al leer.
use serde_json::{Value, json};
use sqlx::{Row, SqlitePool};
use tauri::AppHandle;

use crate::obs_store::WORKSPACE;
use crate::recap_core::{self, Event};

/// Guarda un evento social recibido (seguidor, sub, bits…). Nunca bloquea la alerta si falla.
pub(crate) async fn log_event(app: &AppHandle, platform: &str, kind: &str, name: &str, amount: &str, note: &str) {
    let Ok(pool) = crate::backup::pool(app).await else { return };
    let _ = sqlx::query(
        "INSERT INTO stream_event(id,workspace_id,platform,kind,name,amount,note) VALUES($1,$2,$3,$4,$5,$6,$7)",
    )
    .bind(format!("{:032x}", rand::random::<u128>()))
    .bind(WORKSPACE)
    .bind(platform)
    .bind(kind)
    .bind(name.chars().take(120).collect::<String>())
    .bind(amount.chars().take(60).collect::<String>())
    .bind(note.chars().take(500).collect::<String>())
    .execute(&pool)
    .await;
}

/// Últimos eventos guardados (los mismos que suma el resumen), para comprobar en directo que llegan.
#[tauri::command]
pub async fn stream_events_recent(app: AppHandle) -> Result<Vec<Value>, String> {
    let pool = crate::backup::pool(&app).await?;
    Ok(sqlx::query("SELECT platform, kind, name, amount, created_at FROM stream_event WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 20")
        .bind(WORKSPACE)
        .fetch_all(&pool)
        .await
        .map_err(err)?
        .iter()
        .map(|r| json!({"platform":r.get::<String,_>("platform"),"kind":r.get::<String,_>("kind"),"name":r.get::<String,_>("name"),
                        "amount":r.get::<Option<String>,_>("amount"),"created_at":r.get::<String,_>("created_at")}))
        .collect())
}

fn err(e: sqlx::Error) -> String {
    e.to_string()
}

pub(crate) async fn detail(pool: &SqlitePool, id: &str) -> Result<Value, String> {
    let s = sqlx::query(
        "SELECT s.id, s.observed_at, s.ended_at, s.end_reason, s.recap_seen, s.game_id, g.title AS game,
                CAST(ROUND((julianday(COALESCE(s.ended_at, strftime('%Y-%m-%dT%H:%M:%fZ','now')))
                            - julianday(s.observed_at)) * 86400000) AS INTEGER) AS duration_ms
           FROM obs_session s LEFT JOIN game g ON g.id = s.game_id
          WHERE s.id = $1 AND s.workspace_id = $2 AND s.kind = 'stream'",
    )
    .bind(id)
    .bind(WORKSPACE)
    .fetch_optional(pool)
    .await
    .map_err(err)?
    .ok_or("No existe ese directo.")?;
    let start: String = s.get("observed_at");
    let ended: Option<String> = s.get("ended_at");
    // Las fechas tienen el mismo formato ISO, así que se comparan como texto.
    let end = ended.clone().unwrap_or_else(|| "9999".into());

    let events: Vec<Event> = sqlx::query(
        "SELECT platform, kind, name, amount FROM stream_event
          WHERE workspace_id = $1 AND created_at >= $2 AND created_at <= $3 ORDER BY created_at LIMIT 5000",
    )
    .bind(WORKSPACE)
    .bind(&start)
    .bind(&end)
    .fetch_all(pool)
    .await
    .map_err(err)?
    .iter()
    .map(|r| Event { platform: r.get("platform"), kind: r.get("kind"), name: r.get("name"), amount: r.get("amount") })
    .collect();

    let counters: Vec<Value> = sqlx::query(
        "SELECT c.id, c.name, c.icon, c.color, sc.start_value, COALESCE(sc.end_value, c.value) AS end_value
           FROM obs_session_counter sc JOIN counter c ON c.id = sc.counter_id
          WHERE sc.session_id = $1 ORDER BY c.position, c.created_at",
    )
    .bind(id)
    .fetch_all(pool)
    .await
    .map_err(err)?
    .iter()
    .map(|r| {
        let (a, b): (i64, i64) = (r.get("start_value"), r.get("end_value"));
        json!({"id":r.get::<String,_>("id"),"name":r.get::<String,_>("name"),"icon":r.get::<String,_>("icon"),
               "color":r.get::<String,_>("color"),"start":a,"end":b,"delta":b - a})
    })
    .collect();

    let moments: Vec<Value> = sqlx::query("SELECT title, stream_ms FROM obs_marker WHERE session_id = $1 ORDER BY created_at")
        .bind(id)
        .fetch_all(pool)
        .await
        .map_err(err)?
        .iter()
        .map(|r| json!({"title":r.get::<String,_>("title"),"stream_ms":r.get::<Option<i64>,_>("stream_ms")}))
        .collect();

    let clips: Vec<Value> = sqlx::query(
        "SELECT title, output_path FROM obs_clip WHERE workspace_id = $1 AND created_at >= $2 AND created_at <= $3 ORDER BY created_at",
    )
    .bind(WORKSPACE)
    .bind(&start)
    .bind(&end)
    .fetch_all(pool)
    .await
    .map_err(err)?
    .iter()
    .map(|r| json!({"title":r.get::<String,_>("title"),"output_path":r.get::<String,_>("output_path")}))
    .collect();

    let trophies: Vec<Value> = sqlx::query(
        "SELECT t.name, t.type, t.icon_url, g.title AS game FROM trophy t JOIN game g ON g.id = t.game_id
          WHERE t.workspace_id = $1 AND t.earned_at >= $2 AND t.earned_at <= $3 ORDER BY t.earned_at",
    )
    .bind(WORKSPACE)
    .bind(&start)
    .bind(&end)
    .fetch_all(pool)
    .await
    .map_err(err)?
    .iter()
    .map(|r| json!({"name":r.get::<String,_>("name"),"type":r.get::<String,_>("type"),
                    "icon_url":r.get::<Option<String>,_>("icon_url"),"game":r.get::<String,_>("game")}))
    .collect();

    Ok(json!({
        "id": s.get::<String,_>("id"),
        "started_at": start,
        "ended_at": ended,
        "end_reason": s.get::<Option<String>,_>("end_reason"),
        "seen": s.get::<bool,_>("recap_seen"),
        "game_id": s.get::<Option<String>,_>("game_id"),
        "game": s.get::<Option<String>,_>("game"),
        "duration_ms": s.get::<i64,_>("duration_ms"),
        "summary": recap_core::summarize(&events),
        "counters": counters,
        "moments": moments,
        "clips": clips,
        "trophies": trophies,
    }))
}

/// Últimos 30 directos registrados por OBS, del más reciente al más antiguo.
#[tauri::command]
pub async fn stream_recaps(app: AppHandle) -> Result<Vec<Value>, String> {
    let pool = crate::backup::pool(&app).await?;
    let ids: Vec<String> = sqlx::query_scalar(
        "SELECT id FROM obs_session WHERE workspace_id = $1 AND kind = 'stream' ORDER BY observed_at DESC LIMIT 30",
    )
    .bind(WORKSPACE)
    .fetch_all(&pool)
    .await
    .map_err(err)?;
    let mut out = Vec::with_capacity(ids.len());
    for id in ids {
        out.push(detail(&pool, &id).await?);
    }
    Ok(out)
}

#[tauri::command]
pub async fn stream_recap(app: AppHandle, id: String) -> Result<Value, String> {
    detail(&crate::backup::pool(&app).await?, &id).await
}

/// Se marca visto al cerrar la tarjeta, para no volver a enseñarla sola.
#[tauri::command]
pub async fn stream_recap_seen(app: AppHandle, id: String) -> Result<(), String> {
    let pool = crate::backup::pool(&app).await?;
    sqlx::query("UPDATE obs_session SET recap_seen = 1 WHERE id = $1 AND workspace_id = $2")
        .bind(id)
        .bind(WORKSPACE)
        .execute(&pool)
        .await
        .map_err(err)?;
    Ok(())
}

/// Lo que se publicaría en Discord, para enseñarlo antes de enviarlo.
#[tauri::command]
pub async fn stream_recap_discord_preview(app: AppHandle, id: String) -> Result<Value, String> {
    let recap = detail(&crate::backup::pool(&app).await?, &id).await?;
    Ok(recap_core::discord_body(&recap))
}

/// Publica el agradecimiento en el canal de directos. Una sola vez por directo.
#[tauri::command]
pub async fn stream_recap_discord(app: AppHandle, id: String) -> Result<bool, String> {
    let recap = detail(&crate::backup::pool(&app).await?, &id).await?;
    crate::discord::post(&app, "live", recap_core::discord_body(&recap), &format!("stream-recap:{id}")).await
}
