use serde::{Deserialize, Serialize};
use serde_json::Value;
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Post {
    pub remote_id: String,
    pub title: String,
    pub url: String,
    pub thumbnail: Option<String>,
    pub published_at: String,
    pub format: String,
    pub views: Option<i64>,
    pub likes: Option<i64>,
    pub comments: Option<i64>,
    pub shares: Option<i64>,
}
impl Post {
    pub fn new(
        v: &Value,
        id: &str,
        title: &str,
        url: String,
        published_at: String,
        format: &str,
    ) -> Self {
        Self {
            remote_id: id.into(),
            title: title.chars().take(500).collect(),
            url,
            thumbnail: v
                .as_str()
                .filter(|s| s.starts_with("https://") && s.len() < 4096)
                .map(str::to_string),
            published_at,
            format: format.into(),
            views: None,
            likes: None,
            comments: None,
            shares: None,
        }
    }
}
pub fn count(v: &Value) -> Option<i64> {
    let n = v.as_i64().or_else(|| v.as_str()?.parse().ok())?;
    (0..=9_007_199_254_740_991).contains(&n).then_some(n)
}
pub(crate) async fn store(
    pool: &sqlx::SqlitePool,
    profile: &str,
    platform: &str,
    posts: Vec<Post>,
) -> Result<usize, String> {
    crate::metrics_core::profile(pool, profile, platform).await?;
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
    let stamp: String = sqlx::query_scalar("SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now')")
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    let n = posts.len();
    for mut p in posts {
        if [p.views, p.likes, p.comments, p.shares]
            .into_iter()
            .flatten()
            .any(|n| !(0..=9_007_199_254_740_991).contains(&n))
        {
            return Err("La red devolvió contadores no válidos.".into());
        }
        let date: Option<String> = sqlx::query_scalar("SELECT strftime('%Y-%m-%dT%H:%M:%fZ',$1)")
            .bind(&p.published_at)
            .fetch_one(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
        p.published_at = date.ok_or("La fecha de publicación no es válida.")?;
        if p.remote_id.is_empty()
            || p.remote_id.len() > 200
            || p.published_at.len() < 10
            || p.published_at.len() > 40
            || !p.url.starts_with("https://")
            || p.url.len() > 4096
        {
            return Err(
                "La red devolvió una publicación incompleta. Se conserva el historial anterior."
                    .into(),
            );
        }
        sqlx::query("INSERT INTO content_post(id,workspace_id,profile_id,remote_id,platform,title,url,thumbnail,published_at,format,last_seen_at) VALUES(lower(hex(randomblob(16))),$1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(profile_id,remote_id) DO UPDATE SET title=excluded.title,url=excluded.url,thumbnail=COALESCE(excluded.thumbnail,content_post.thumbnail),last_seen_at=excluded.last_seen_at")
         .bind(crate::obs_store::WORKSPACE).bind(profile).bind(&p.remote_id).bind(platform).bind(p.title).bind(p.url).bind(p.thumbnail).bind(p.published_at).bind(p.format).bind(&stamp).execute(&mut *tx).await.map_err(|e|e.to_string())?;
        sqlx::query("INSERT INTO content_observation(id,post_id,observed_at,views,likes,comments,shares) SELECT lower(hex(randomblob(16))),id,$1,$2,$3,$4,$5 FROM content_post WHERE profile_id=$6 AND remote_id=$7 ON CONFLICT(post_id,observed_at) DO UPDATE SET views=excluded.views,likes=excluded.likes,comments=excluded.comments,shares=excluded.shares")
         .bind(&stamp).bind(p.views).bind(p.likes).bind(p.comments).bind(p.shares).bind(profile).bind(p.remote_id).execute(&mut *tx).await.map_err(|e|e.to_string())?;
    }
    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(n)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn discovery_is_idempotent_preserves_classification_and_rolls_back_invalid_batches() {
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
            sqlx::raw_sql(include_str!("../migrations/025_content_performance.sql"))
                .execute(&pool)
                .await
                .unwrap();
            sqlx::query("INSERT OR IGNORE INTO workspace(id,name) VALUES($1,'Pruebas')")
                .bind(crate::obs_store::WORKSPACE)
                .execute(&pool)
                .await
                .unwrap();
            sqlx::query("INSERT INTO profile(id,workspace_id,platform,handle) VALUES('p',$1,'youtube','test')").bind(crate::obs_store::WORKSPACE).execute(&pool).await.unwrap();
            sqlx::raw_sql("CREATE TABLE alert_cursor(id TEXT PRIMARY KEY,content TEXT NOT NULL)")
                .execute(&pool)
                .await
                .unwrap();
            bind_owner(&pool, "p", "youtube", "channel-a")
                .await
                .unwrap();
            assert!(
                bind_owner(&pool, "p", "youtube", "channel-b")
                    .await
                    .is_err()
            );
            bind_owner(&pool, "p", "youtube", "channel-a")
                .await
                .unwrap();
            let mut p = Post::new(
                &Value::Null,
                "remote",
                "Título",
                "https://www.youtube.com/watch?v=abcdefghijk".into(),
                "2026-11-16T00:00:00Z".into(),
                "unknown",
            );
            p.views = Some(12);
            store(&pool, "p", "youtube", vec![p.clone()]).await.unwrap();
            sqlx::query("UPDATE content_post SET format='short'")
                .execute(&pool)
                .await
                .unwrap();
            p.views = Some(20);
            store(&pool, "p", "youtube", vec![p.clone()]).await.unwrap();
            let rows: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM content_post")
                .fetch_one(&pool)
                .await
                .unwrap();
            assert_eq!(rows, 1);
            let format: String = sqlx::query_scalar("SELECT format FROM content_post")
                .fetch_one(&pool)
                .await
                .unwrap();
            assert_eq!(format, "short");
            let mut bad = p.clone();
            bad.remote_id = "bad".into();
            bad.views = Some(-1);
            p.title = "Must roll back".into();
            assert!(store(&pool, "p", "youtube", vec![p, bad]).await.is_err());
            let title: String = sqlx::query_scalar("SELECT title FROM content_post")
                .fetch_one(&pool)
                .await
                .unwrap();
            assert_eq!(title, "Título");
        });
    }
}

/// A local profile cannot silently combine publications from different provider accounts.
pub async fn bind_owner(
    pool: &sqlx::SqlitePool,
    profile: &str,
    platform: &str,
    owner: &str,
) -> Result<(), String> {
    crate::metrics_core::profile(pool, profile, platform).await?;
    if owner.is_empty() || owner.len() > 200 {
        return Err("La red no confirmó la identidad de la cuenta.".into());
    }
    let key = format!("content-owner:{profile}");
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
    sqlx::query("INSERT INTO alert_cursor(id,content) VALUES($1,$2) ON CONFLICT(id) DO NOTHING")
        .bind(&key)
        .bind(serde_json::json!({"platform":platform,"owner":owner}).to_string())
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    let previous: String = sqlx::query_scalar("SELECT content FROM alert_cursor WHERE id=$1")
        .bind(key)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    let value: Value = serde_json::from_str(&previous)
        .map_err(|_| "No se pudo comprobar la cuenta original del perfil.")?;
    if value["owner"] != owner || value["platform"] != platform {
        return Err("Este perfil ya tiene historial de otra cuenta. Crea o selecciona un perfil separado para conservar las comparaciones correctas.".into());
    }
    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(())
}
