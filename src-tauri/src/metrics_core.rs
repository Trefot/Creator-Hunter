use serde_json::Value;
pub fn count(v: &Value) -> Option<i64> {
    v.as_i64()
        .filter(|n| *n >= 0 && *n <= 9_007_199_254_740_991)
}
pub fn token_ok(token: &str) -> bool {
    !token.trim().is_empty() && token.len() <= 8192 && !token.chars().any(char::is_whitespace)
}
pub fn safe_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 100
        && id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
}
pub async fn profile(pool: &sqlx::SqlitePool, id: &str, platform: &str) -> Result<(), String> {
    let ok: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM profile WHERE id=$1 AND platform=$2 AND workspace_id=$3)",
    )
    .bind(id)
    .bind(platform)
    .bind(crate::obs_store::WORKSPACE)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;
    if ok {
        Ok(())
    } else {
        Err("Elige el perfil correcto para esta red en Nexus.".into())
    }
}
pub struct Snapshot<'a> {
    pub id: &'a str,
    pub platform: &'a str,
    pub followers: Option<i64>,
    pub views: Option<i64>,
}
pub async fn snapshot(
    pool: &sqlx::SqlitePool,
    id: &str,
    platform: &str,
    date: &str,
    followers: Option<i64>,
    views: Option<i64>,
) -> Result<(), String> {
    snapshot_batch(
        pool,
        date,
        &[Snapshot {
            id,
            platform,
            followers,
            views,
        }],
    )
    .await
}
pub async fn snapshot_batch(
    pool: &sqlx::SqlitePool,
    date: &str,
    rows: &[Snapshot<'_>],
) -> Result<(), String> {
    let valid: Option<String> = sqlx::query_scalar("SELECT date($1,'+0 days')")
        .bind(date)
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?;
    if date.len() != 10 || valid.as_deref() != Some(date) {
        return Err("La fecha no es válida. El registro anterior se conserva.".into());
    }
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
    for r in rows {
        if r.followers.is_none()
            || r.followers
                .is_some_and(|v| !(0..=9_007_199_254_740_991).contains(&v))
            || r.views
                .is_some_and(|v| !(0..=9_007_199_254_740_991).contains(&v))
        {
            return Err(
                "La API no devolvió una cifra válida. El registro anterior se conserva.".into(),
            );
        }
        let ok: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM profile WHERE id=$1 AND platform=$2 AND workspace_id=$3)",
        )
        .bind(r.id)
        .bind(r.platform)
        .bind(crate::obs_store::WORKSPACE)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
        if !ok {
            return Err("Elige el perfil correcto para esta red en Nexus.".into());
        }
        sqlx::query("INSERT INTO account_snapshot(id,workspace_id,profile_id,recorded_on,followers,total_views,source) VALUES(lower(hex(randomblob(16))),$1,$2,$3,$4,$5,'api') ON CONFLICT(profile_id,recorded_on) WHERE source='api' DO UPDATE SET followers=excluded.followers,total_views=excluded.total_views,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')")
  .bind(crate::obs_store::WORKSPACE).bind(r.id).bind(date).bind(r.followers).bind(r.views).execute(&mut *tx).await.map_err(|e|e.to_string())?;
    }
    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn missing_private_or_invalid_counts_are_not_zero() {
        for v in [
            Value::Null,
            json!(-1),
            json!("402"),
            json!(9007199254740992i64),
        ] {
            assert_eq!(count(&v), None)
        }
        assert_eq!(count(&json!(0)), Some(0));
        assert_eq!(count(&json!(402)), Some(402));
    }
    #[test]
    fn credentials_are_bounded_and_ids_cannot_be_paths() {
        assert!(token_ok("EAAtest-token"));
        assert!(!token_ok(""));
        assert!(!token_ok("token\nother"));
        assert!(!token_ok(&"x".repeat(8193)));
        assert!(safe_id("123456"));
        assert!(!safe_id("../other?token=x"));
    }

    #[test]
    fn api_updates_are_daily_atomic_and_preserve_manual_records() {
        tauri::async_runtime::block_on(async {
            let pool = sqlx::sqlite::SqlitePoolOptions::new()
                .max_connections(1)
                .connect("sqlite::memory:")
                .await
                .unwrap();
            sqlx::raw_sql("CREATE TABLE profile(id TEXT PRIMARY KEY,platform TEXT,workspace_id TEXT); CREATE TABLE account_snapshot(id TEXT PRIMARY KEY,workspace_id TEXT,profile_id TEXT,recorded_on TEXT,followers INTEGER,total_views INTEGER,source TEXT,watch_hours REAL,updated_at TEXT); CREATE UNIQUE INDEX api_day ON account_snapshot(profile_id,recorded_on) WHERE source='api';").execute(&pool).await.unwrap();
            for (id, platform) in [("fb", "facebook"), ("ig", "instagram")] {
                sqlx::query("INSERT INTO profile VALUES(?,?,?)")
                    .bind(id)
                    .bind(platform)
                    .bind(crate::obs_store::WORKSPACE)
                    .execute(&pool)
                    .await
                    .unwrap();
            }
            sqlx::query("INSERT INTO account_snapshot(id,profile_id,recorded_on,followers,source,watch_hours) VALUES('manual','fb','2026-11-16',12,'manual',247.4)").execute(&pool).await.unwrap();
            snapshot(&pool, "fb", "facebook", "2026-11-16", Some(20), None)
                .await
                .unwrap();
            snapshot(&pool, "fb", "facebook", "2026-11-16", Some(21), None)
                .await
                .unwrap();
            let rows: i64 = sqlx::query_scalar("SELECT count(*) FROM account_snapshot")
                .fetch_one(&pool)
                .await
                .unwrap();
            assert_eq!(rows, 2);
            let hours: f64 =
                sqlx::query_scalar("SELECT watch_hours FROM account_snapshot WHERE id='manual'")
                    .fetch_one(&pool)
                    .await
                    .unwrap();
            assert_eq!(hours, 247.4);
            let result = snapshot_batch(
                &pool,
                "2026-11-16",
                &[
                    Snapshot {
                        id: "fb",
                        platform: "facebook",
                        followers: Some(25),
                        views: None,
                    },
                    Snapshot {
                        id: "ig",
                        platform: "instagram",
                        followers: None,
                        views: None,
                    },
                ],
            )
            .await;
            assert!(result.is_err());
            let value: i64 =
                sqlx::query_scalar("SELECT followers FROM account_snapshot WHERE source='api'")
                    .fetch_one(&pool)
                    .await
                    .unwrap();
            assert_eq!(value, 21);
            assert!(
                snapshot(&pool, "fb", "instagram", "2026-11-16", Some(30), None)
                    .await
                    .is_err()
            );
            assert!(
                snapshot(&pool, "fb", "facebook", "2026-02-31", Some(30), None)
                    .await
                    .is_err()
            );
            snapshot(&pool, "ig", "instagram", "2026-11-16", Some(0), None)
                .await
                .unwrap();
        });
    }
}
