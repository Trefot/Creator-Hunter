//! Estado compartido de objetivos/colecciones. Sin dependencia de la ventana.
use serde_json::{Value, json};
use sqlx::{Row, SqlitePool};
const W: &str = "00000000-0000-4000-8000-000000000001";
const TARGETS: &str = "SELECT t.*, (t.done=1 OR EXISTS(SELECT 1 FROM collection_item c WHERE c.game_id=t.game_id AND c.item_key=t.collection_key AND c.workspace_id=t.workspace_id) OR EXISTS(SELECT 1 FROM trophy p WHERE p.game_id=t.game_id AND p.psn_trophy_id=t.done_with_trophy AND p.earned_at IS NOT NULL AND p.workspace_id=t.workspace_id)) AS achieved, EXISTS(SELECT 1 FROM trophy p WHERE p.game_id=t.game_id AND p.psn_trophy_id=t.done_with_trophy AND p.earned_at IS NOT NULL AND p.workspace_id=t.workspace_id) AS psn_achieved FROM game_target t WHERE t.workspace_id=$1 AND t.game_id=$2 ORDER BY t.position,t.rowid";
pub async fn targets(pool: &SqlitePool, game: &str) -> Result<Value, String> {
    target_list(pool, game, true).await
}
async fn target_list(pool: &SqlitePool, game: &str, detailed: bool) -> Result<Value, String> {
    let query = if detailed {
        TARGETS.to_string()
    } else {
        TARGETS.replace("t.*,", "t.id,t.title,t.guide,t.position,")
    };
    let rows = sqlx::query(&query)
        .bind(W)
        .bind(game)
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(json!(rows.iter().map(|r| {if !detailed{return json!({"id":r.get::<String,_>("id"),"title":r.get::<String,_>("title"),"guide":r.get::<Option<String>,_>("guide"),"done":r.get::<bool,_>("achieved")});} json!({"id":r.get::<String,_>("id"),"game_id":game,"title":r.get::<String,_>("title"),"guide":r.get::<Option<String>,_>("guide"),"done":r.get::<bool,_>("achieved"),"psn_achieved":r.get::<bool,_>("psn_achieved"),"detector_source":r.get::<Option<String>,_>("detector_source"),"detector_reference":r.get::<Option<String>,_>("detector_reference"),"detector_x":r.get::<Option<i64>,_>("detector_x"),"detector_y":r.get::<Option<i64>,_>("detector_y"),"detector_w":r.get::<Option<i64>,_>("detector_w"),"detector_h":r.get::<Option<i64>,_>("detector_h"),"detector_mode":r.get::<String,_>("detector_mode"),"detector_threshold":r.get::<f64,_>("detector_threshold")})}).collect::<Vec<_>>()))
}
pub async fn change_target(
    pool: &SqlitePool,
    id: &str,
    done: bool,
    require_current: bool,
) -> Result<Value, String> {
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
    let row=sqlx::query("SELECT t.game_id,t.collection_key,t.done_with_trophy FROM game_target t WHERE t.id=$1 AND t.workspace_id=$2").bind(id).bind(W).fetch_optional(&mut *tx).await.map_err(|e|e.to_string())?.ok_or("El objetivo ya no existe.")?;
    let game: String = row.get("game_id");
    let key: Option<String> = row.get("collection_key");
    let trophy: Option<i64> = row.get("done_with_trophy");
    if require_current {
        let selected:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM game_overlay WHERE workspace_id=$1 AND game_id=$2 AND target_id=$3)").bind(W).bind(&game).bind(id).fetch_one(&mut *tx).await.map_err(|e|e.to_string())?;
        if !selected {
            return Err("El objetivo seleccionado cambió; no se marcó otro objeto.".into());
        }
    }
    if !done {
        let psn:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM trophy WHERE workspace_id=$1 AND game_id=$2 AND psn_trophy_id=$3 AND earned_at IS NOT NULL)").bind(W).bind(&game).bind(trophy).fetch_one(&mut *tx).await.map_err(|e|e.to_string())?;
        if psn {
            return Err(
                "Este paso está confirmado por un trofeo de PSN y no se puede desmarcar aquí."
                    .into(),
            );
        }
    }
    sqlx::query("UPDATE game_target SET done=$1 WHERE id=$2 AND workspace_id=$3")
        .bind(if key.is_some() { false } else { done })
        .bind(id)
        .bind(W)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    if let Some(key) = key {
        if done {
            sqlx::query("INSERT INTO collection_item(id,workspace_id,game_id,item_key) VALUES($1,$2,$3,$4) ON CONFLICT(game_id,item_key) DO NOTHING").bind(format!("target-{id}")).bind(W).bind(&game).bind(key).execute(&mut *tx).await.map_err(|e|e.to_string())?;
        } else {
            sqlx::query(
                "DELETE FROM collection_item WHERE workspace_id=$1 AND game_id=$2 AND item_key=$3",
            )
            .bind(W)
            .bind(&game)
            .bind(key)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
        }
    }
    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(json!({"id":id,"game_id":game,"done":done}))
}
pub async fn state(pool: &SqlitePool) -> Result<Value, String> {
    let counts=sqlx::query("SELECT SUM(CASE WHEN EXISTS(SELECT 1 FROM trophy t WHERE t.game_id=g.id AND t.type='platinum' AND t.earned_at IS NOT NULL) THEN 1 ELSE 0 END) AS verified, SUM(CASE WHEN g.status='platinum' AND NOT EXISTS(SELECT 1 FROM trophy t WHERE t.game_id=g.id AND t.type='platinum' AND t.earned_at IS NOT NULL) THEN 1 ELSE 0 END) AS manual FROM game g WHERE g.workspace_id=$1").bind(W).fetch_one(pool).await.map_err(|e|e.to_string())?;
    let verified = counts.get::<Option<i64>, _>("verified").unwrap_or(0);
    let manual = counts.get::<Option<i64>, _>("manual").unwrap_or(0);
    let row=sqlx::query("SELECT o.game_id,o.target_id,g.title,(SELECT COUNT(*) FROM trophy t WHERE t.game_id=g.id) AS total,(SELECT COUNT(*) FROM trophy t WHERE t.game_id=g.id AND t.earned_at IS NOT NULL) AS earned FROM game_overlay o LEFT JOIN game g ON g.id=o.game_id WHERE o.workspace_id=$1").bind(W).fetch_optional(pool).await.map_err(|e|e.to_string())?;
    let mut result = json!({"platinos":verified+manual,"verified":verified,"manual":manual,"game":null,"target":null,"done":0,"total":0});
    if let Some(row) = row {
        if let Some(game) = row.get::<Option<String>, _>("game_id") {
            let all = target_list(pool, &game, false).await?;
            let list = all.as_array().ok_or("Objetivos no válidos.")?;
            let selected = row.get::<Option<String>, _>("target_id");
            result["game"] = json!({"id":game,"title":row.get::<Option<String>,_>("title"),"trophy_total":row.get::<i64,_>("total"),"trophy_earned":row.get::<i64,_>("earned")});
            result["total"] = json!(list.len());
            result["done"] = json!(list.iter().filter(|t| t["done"] == true).count());
            if let Some(id) = selected {
                if let Some(target) = list.iter().find(|t| t["id"] == id) {
                    result["target"] = json!({"id":target["id"],"title":target["title"],"guide":target["guide"],"done":target["done"]});
                }
            }
        }
    }
    Ok(result)
}
pub async fn current_action(pool: &SqlitePool, action: &str) -> Result<Value, String> {
    let row = sqlx::query("SELECT game_id,target_id FROM game_overlay WHERE workspace_id=$1")
        .bind(W)
        .fetch_optional(pool)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Elige un juego y objetivo en Juegos → Overlay y objetos.")?;
    let game = row
        .get::<Option<String>, _>("game_id")
        .ok_or("Elige un juego para el overlay.")?;
    let id = row.get::<Option<String>, _>("target_id");
    if action == "next" {
        let all = target_list(pool, &game, false).await?;
        let list = all.as_array().ok_or("Objetivos no válidos.")?;
        let start = id
            .as_ref()
            .and_then(|id| list.iter().position(|t| t["id"] == *id))
            .map(|i| i + 1)
            .unwrap_or(0);
        let next = list
            .iter()
            .skip(start)
            .chain(list.iter().take(start))
            .find(|t| t["done"] != true)
            .ok_or("Todos los objetivos de esta lista están conseguidos.")?;
        sqlx::query("UPDATE game_overlay SET target_id=$1 WHERE workspace_id=$2 AND game_id=$3")
            .bind(next["id"].as_str())
            .bind(W)
            .bind(&game)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
        return Ok(json!({"game_id":game,"id":next["id"]}));
    }
    if !matches!(action, "complete" | "undo") {
        return Err("Acción no válida.".into());
    }
    change_target(
        pool,
        &id.ok_or("Selecciona un objetivo para el overlay.")?,
        action == "complete",
        true,
    )
    .await
}
