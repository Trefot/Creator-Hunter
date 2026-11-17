use tauri::AppHandle;
/// Claim + actual income are one transaction; repeated clicks never count a payment twice.
#[tauri::command]
pub async fn income_receive_expected(
    app: AppHandle,
    id: String,
    date: String,
) -> Result<(), String> {
    let pool = crate::backup::pool(&app).await?;
    receive(&pool, id, date).await
}
async fn receive(pool: &sqlx::SqlitePool, id: String, date: String) -> Result<(), String> {
    if !id.starts_with("income-due:") || id.len() > 100 {
        return Err("Ingreso previsto no válido.".into());
    }
    let day: Option<String> = sqlx::query_scalar("SELECT date($1,'+0 days')")
        .bind(&date)
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?;
    if day.as_deref() != Some(date.as_str()) {
        return Err("Fecha de cobro no válida.".into());
    }
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
    let row:Option<String>=sqlx::query_scalar("UPDATE alert_cursor SET content=json_set(content,'$.received',json('true')) WHERE id=$1 AND json_extract(content,'$.received')=0 RETURNING content").bind(&id).fetch_optional(&mut *tx).await.map_err(|e|e.to_string())?;
    let Some(raw) = row else {
        return Err("El cobro ya se registró o no existe.".into());
    };
    let v: serde_json::Value =
        serde_json::from_str(&raw).map_err(|_| "Ingreso previsto no válido.")?;
    let amount = v["amount_minor"]
        .as_i64()
        .filter(|n| *n > 0 && *n <= 9_007_199_254_740_991)
        .ok_or("Importe no válido.")?;
    let currency = v["currency"]
        .as_str()
        .filter(|s| s.len() == 3 && s.bytes().all(|b| b.is_ascii_uppercase()))
        .ok_or("Moneda no válida.")?;
    let note = v["description"]
        .as_str()
        .unwrap_or("Cobro registrado")
        .chars()
        .take(1000)
        .collect::<String>();
    sqlx::query("INSERT INTO income(id,workspace_id,source,amount_minor,currency,received_on,note) VALUES(lower(hex(randomblob(16))),$1,'other',$2,$3,$4,$5)").bind(crate::obs_store::WORKSPACE).bind(amount).bind(currency).bind(date).bind(note).execute(&mut *tx).await.map_err(|e|e.to_string())?;
    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn a_receivable_is_collected_once_and_invalid_amount_rolls_back() {
        tauri::async_runtime::block_on(async {
            let pool = sqlx::sqlite::SqlitePoolOptions::new()
                .max_connections(1)
                .connect("sqlite::memory:")
                .await
                .unwrap();
            sqlx::raw_sql(include_str!("../migrations/001_initial.sql"))
                .execute(&pool)
                .await
                .unwrap();
            sqlx::query("INSERT OR IGNORE INTO workspace(id,name) VALUES($1,'Pruebas')")
                .bind(crate::obs_store::WORKSPACE)
                .execute(&pool)
                .await
                .unwrap();
            sqlx::raw_sql("CREATE TABLE alert_cursor(id TEXT PRIMARY KEY,content TEXT NOT NULL)")
                .execute(&pool)
                .await
                .unwrap();
            let body = r#"{"received":false,"amount_minor":120050,"currency":"COP","description":"Patrocinio"}"#;
            sqlx::query("INSERT INTO alert_cursor VALUES('income-due:test',$1)")
                .bind(body)
                .execute(&pool)
                .await
                .unwrap();
            receive(&pool, "income-due:test".into(), "2026-11-16".into())
                .await
                .unwrap();
            assert!(
                receive(&pool, "income-due:test".into(), "2026-11-16".into())
                    .await
                    .is_err()
            );
            let amount: i64 = sqlx::query_scalar("SELECT SUM(amount_minor) FROM income")
                .fetch_one(&pool)
                .await
                .unwrap();
            assert_eq!(amount, 120050);
            sqlx::query("INSERT INTO alert_cursor VALUES('income-due:bad',$1)")
                .bind(body.replace("120050", "-1"))
                .execute(&pool)
                .await
                .unwrap();
            assert!(
                receive(&pool, "income-due:bad".into(), "2026-11-16".into())
                    .await
                    .is_err()
            );
            let received:i64=sqlx::query_scalar("SELECT json_extract(content,'$.received') FROM alert_cursor WHERE id='income-due:bad'").fetch_one(&pool).await.unwrap();
            assert_eq!(received, 0);
        })
    }
}
