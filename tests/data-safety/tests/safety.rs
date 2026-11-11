use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use std::path::{Path, PathBuf};
use studio_data_safety::{TABLES, backup_if_pending, restore, snapshot, validate};

const MIGRATIONS: [&str; 19] = [
    include_str!("../../../src-tauri/migrations/001_initial.sql"),
    include_str!("../../../src-tauri/migrations/002_twitch_payout.sql"),
    include_str!("../../../src-tauri/migrations/003_images.sql"),
    include_str!("../../../src-tauri/migrations/004_payout_thresholds.sql"),
    include_str!("../../../src-tauri/migrations/005_last_payout.sql"),
    include_str!("../../../src-tauri/migrations/006_api_source.sql"),
    include_str!("../../../src-tauri/migrations/007_games.sql"),
    include_str!("../../../src-tauri/migrations/008_game_guide.sql"),
    include_str!("../../../src-tauri/migrations/009_play_sessions.sql"),
    include_str!("../../../src-tauri/migrations/010_collection_items.sql"),
    include_str!("../../../src-tauri/migrations/011_trophy_tasks.sql"),
    include_str!("../../../src-tauri/migrations/012_counters.sql"),
    include_str!("../../../src-tauri/migrations/013_counter_style.sql"),
    include_str!("../../../src-tauri/migrations/014_counter_fx.sql"),
    include_str!("../../../src-tauri/migrations/015_counter_text.sql"),
    include_str!("../../../src-tauri/migrations/016_obs_moments.sql"),
    include_str!("../../../src-tauri/migrations/017_obs_clips.sql"),
    include_str!("../../../src-tauri/migrations/018_game_ideas.sql"),
    include_str!("../../../src-tauri/migrations/019_game_broadcast.sql"),
];

struct Temp(PathBuf);
static TEMP_SEQUENCE: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
impl Temp {
    fn new() -> Self {
        let n = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let sequence = TEMP_SEQUENCE.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        let dir = std::env::temp_dir().join(format!("studio-safety-{}-{n}-{sequence}", std::process::id()));
        std::fs::create_dir(&dir).unwrap();
        Self(dir)
    }
}
impl Drop for Temp {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

async fn database(path: &Path, version: usize) -> sqlx::SqlitePool {
    let options = SqliteConnectOptions::new()
        .filename(path)
        .create_if_missing(true)
        .foreign_keys(true);
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await
        .unwrap();
    sqlx::raw_sql(
        "CREATE TABLE _sqlx_migrations(version INTEGER PRIMARY KEY, success INTEGER NOT NULL)",
    )
    .execute(&pool)
    .await
    .unwrap();
    for (i, migration) in MIGRATIONS.iter().take(version).enumerate() {
        sqlx::raw_sql(migration).execute(&pool).await.unwrap();
        sqlx::query("INSERT INTO _sqlx_migrations VALUES (?,1)")
            .bind(i as i64 + 1)
            .execute(&pool)
            .await
            .unwrap();
    }
    pool
}

async fn populate(pool: &sqlx::SqlitePool) {
    let sql = "
      INSERT INTO profile(id,workspace_id,platform,handle) VALUES('profile','W','youtube','trefot');
      INSERT INTO account_snapshot(id,workspace_id,profile_id,recorded_on,watch_hours) VALUES('snapshot','W','profile','2026-11-11',12.5);
      INSERT INTO goal(id,workspace_id,profile_id,metric,target_value) VALUES('goal','W','profile','followers',100);
      INSERT INTO income(id,workspace_id,source,amount_minor,received_on) VALUES('income','W','other',12345,'2026-11-11');
      INSERT INTO idea(id,workspace_id,title) VALUES('idea','W','Vídeo con ñ y 🎮');
      INSERT INTO game(id,workspace_id,title) VALUES('game','W','Wukong');
      INSERT INTO trophy_phase(id,workspace_id,game_id,name,position) VALUES('phase','W','game','Inicio',0);
      INSERT INTO trophy(id,workspace_id,game_id,name,type,phase_id) VALUES('trophy','W','game','Primero','bronze','phase');
      INSERT INTO guide_entry(id,workspace_id,game_id,kind,title,phase_id) VALUES('guide','W','game','tip','Consejo','phase');
      INSERT INTO guide_entry_trophy(entry_id,trophy_id,workspace_id) VALUES('guide','trophy','W');
      INSERT INTO play_session(id,workspace_id,game_id,played_on) VALUES('session','W','game','2026-11-11');
      INSERT INTO session_objective(id,workspace_id,session_id,title,trophy_id,guide_entry_id) VALUES('objective','W','session','Objetivo','trophy','guide');
      INSERT INTO collection_item(id,workspace_id,game_id,item_key) VALUES('item','W','game','seed');
      INSERT INTO trophy_task(id,workspace_id,game_id,trophy_id,title) VALUES('task','W','game','trophy','Paso');
      INSERT INTO counter(id,workspace_id,name,game_id,value,image,sound) VALUES('counter','W','Muertes','game',42,'data:image/png;base64,YQ==','data:audio/wav;base64,Yg==');
      INSERT INTO game_goal(id,workspace_id,game_id,title,target_value) VALUES('game-goal','W','game','Nivel',50);
      INSERT INTO project(id,workspace_id,idea_id,title,game_id) VALUES('project','W','idea','Vídeo','game');
      INSERT INTO adaptation(id,workspace_id,project_id,profile_id,format,title) VALUES('adaptation','W','project','profile','long_video','Mi vídeo');
      INSERT INTO adaptation_step(id,workspace_id,adaptation_id,step) VALUES('step','W','adaptation','editing');
      INSERT INTO script_section(id,workspace_id,adaptation_id,kind,position,content) VALUES('section','W','adaptation','hook',0,'Gancho');
      INSERT INTO result_snapshot(id,workspace_id,adaptation_id,recorded_on,views) VALUES('result','W','adaptation','2026-11-11',987);
    ".replace("'W'", "'00000000-0000-4000-8000-000000000001'");
    sqlx::raw_sql(&sql).execute(pool).await.unwrap();
    let version: i64=sqlx::query_scalar("SELECT MAX(version) FROM _sqlx_migrations").fetch_one(pool).await.unwrap();
    if version>=16 {
        sqlx::raw_sql("INSERT INTO obs_session(id,workspace_id,kind,game_id) VALUES('obs-session','00000000-0000-4000-8000-000000000001','recording','game'); INSERT INTO obs_marker(id,workspace_id,session_id,title,record_ms,game_id,game_title) VALUES('obs-marker','00000000-0000-4000-8000-000000000001','obs-session','Buena jugada 🎮',123450,'game','Juego');").execute(pool).await.unwrap();
    }
    if version>=18 {
        sqlx::query("UPDATE idea SET game_id='game',capture_key='clip:clip' WHERE id='idea'").execute(pool).await.unwrap();
    }
    if version>=17 {
        sqlx::raw_sql("INSERT INTO obs_clip(id,workspace_id,marker_id,title,output_path,game_id,game_title,record_ms) VALUES('clip','00000000-0000-4000-8000-000000000001','obs-marker','Victoria','D:/Vídeos/Replay.mkv','game','Juego',123450)").execute(pool).await.unwrap();
    }

    if version>=19 {
        sqlx::raw_sql("INSERT INTO game_target(id,workspace_id,game_id,title,collection_key) VALUES('target','00000000-0000-4000-8000-000000000001','game','Buscar objeto','curio-1'); UPDATE game_overlay SET game_id='game',target_id='target';").execute(pool).await.unwrap();
    }

}

#[tokio::test]
async fn round_trip_all_tables_survives_reopen() {
    let temp = Temp::new();
    let path = temp.0.join("test.db");
    let pool = database(&path, 19).await;
    populate(&pool).await;
    let (original, count) = snapshot(&pool, &TABLES, "20261111-120000").await.unwrap();
    assert_eq!(count, 27);
    sqlx::query("UPDATE counter SET value=999")
        .execute(&pool)
        .await
        .unwrap();
    assert_eq!(restore(&pool, &original.to_string()).await.unwrap(), count);
    pool.close().await;
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(
            SqliteConnectOptions::new()
                .filename(&path)
                .foreign_keys(true),
        )
        .await
        .unwrap();
    let (restored, _) = snapshot(&pool, &TABLES, "20261111-120000").await.unwrap();
    assert_eq!(original, restored);
    assert!(
        sqlx::query("PRAGMA foreign_key_check")
            .fetch_all(&pool)
            .await
            .unwrap()
            .is_empty()
    );
    pool.close().await;
}

#[tokio::test]
async fn failed_import_rolls_back_deletes_and_inserts() {
    let temp = Temp::new();
    let pool = database(&temp.0.join("db"), 19).await;
    populate(&pool).await;
    let (original, _) = snapshot(&pool, &TABLES, "stamp").await.unwrap();
    let mut broken = original.clone();
    broken["tables"]["adaptation"][0]["profile_id"] = "missing".into();
    assert!(restore(&pool, &broken.to_string()).await.is_err());
    assert_eq!(snapshot(&pool, &TABLES, "stamp").await.unwrap().0, original);
    pool.close().await;
}

#[tokio::test]
async fn rejects_missing_workspace_required_tables_and_malformed_rows() {
    let temp = Temp::new();
    let pool = database(&temp.0.join("db"), 19).await;
    populate(&pool).await;
    let (original, _) = snapshot(&pool, &TABLES, "stamp").await.unwrap();
    for mode in 0..6 {
        let mut bad = original.clone();
        match mode {
            0 => bad["tables"]["workspace"] = serde_json::json!([]),
            1 => {
                bad["schema_version"] = 6.into();
                bad["tables"].as_object_mut().unwrap().remove("profile");
            }
            2 => {
                bad["schema_version"] = 6.into();
                bad["tables"]["counter"] = serde_json::Value::Null;
            }
            3 => bad["tables"]["idea"] = serde_json::json!([{}]),
            4 => bad["tables"]["idea"][0]["unknown_column"] = 1.into(),
            _ => bad["schema_version"] = 999.into(),
        }
        assert!(
            validate(&pool, &bad.to_string()).await.is_err(),
            "mode {mode}"
        );
    }
    assert_eq!(snapshot(&pool, &TABLES, "stamp").await.unwrap().0, original);
    pool.close().await;
}

#[tokio::test]
async fn imports_actual_schema_one_backup() {
    let temp = Temp::new();
    let old = database(&temp.0.join("old"), 1).await;
    sqlx::raw_sql(
        "INSERT INTO idea(id,workspace_id,title) SELECT 'old-idea',id,'Antigua' FROM workspace",
    )
    .execute(&old)
    .await
    .unwrap();
    let old_tables = TABLES
        .iter()
        .copied()
        .filter(|t| studio_data_safety::introduced_in(t) == 1)
        .collect::<Vec<_>>();
    let (backup, _) = snapshot(&old, &old_tables, "stamp").await.unwrap();
    let current = database(&temp.0.join("current"), 19).await;
    restore(&current, &backup.to_string()).await.unwrap();
    let title: String = sqlx::query_scalar("SELECT title FROM idea")
        .fetch_one(&current)
        .await
        .unwrap();
    assert_eq!(title, "Antigua");
    old.close().await;
    current.close().await;
}

#[tokio::test]
async fn backup_before_migration_is_valid_and_failure_preserves_source() {
    let temp = Temp::new();
    let path = temp.0.join("db");
    let pool = database(&path, 15).await;
    populate(&pool).await;
    let old_tables: Vec<_> = TABLES.iter().copied().filter(|t| studio_data_safety::introduced_in(t) <= 15).collect();
    let (before, _) = snapshot(&pool, &old_tables, "stamp").await.unwrap();
    let blocked = temp.0.join("not-a-directory");
    std::fs::write(&blocked, "blocked").unwrap();
    assert!(backup_if_pending(&path, &blocked, 19).await.is_err());
    assert_eq!(snapshot(&pool, &old_tables, "stamp").await.unwrap().0, before);
    let copy = backup_if_pending(&path, &temp.0.join("Copias con ' comilla"), 19)
        .await
        .unwrap()
        .unwrap();
    let backup = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(SqliteConnectOptions::new().filename(copy).read_only(true))
        .await
        .unwrap();
    assert_eq!(snapshot(&backup, &old_tables, "stamp").await.unwrap().0, before);
    backup.close().await;
    pool.close().await;
}

#[tokio::test]
async fn no_backup_for_first_install_or_current_schema() {
    let temp = Temp::new();
    let path = temp.0.join("db");
    let copies = temp.0.join("copies");
    assert!(
        backup_if_pending(&path, &copies, 19)
            .await
            .unwrap()
            .is_none()
    );
    assert!(!path.exists());
    let pool = database(&path, 19).await;
    assert!(
        backup_if_pending(&path, &copies, 19)
            .await
            .unwrap()
            .is_none()
    );
    assert!(!copies.exists());
    pool.close().await;
}

#[tokio::test]
async fn existing_database_without_history_is_backed_up() {
    let temp = Temp::new();
    let path = temp.0.join("db");
    let pool = SqlitePoolOptions::new()
        .connect_with(
            SqliteConnectOptions::new()
                .filename(&path)
                .create_if_missing(true),
        )
        .await
        .unwrap();
    sqlx::raw_sql("CREATE TABLE note(value TEXT); INSERT INTO note VALUES ('conservar')")
        .execute(&pool)
        .await
        .unwrap();
    assert!(
        backup_if_pending(&path, &temp.0.join("copies"), 19)
            .await
            .unwrap()
            .unwrap()
            .exists()
    );
    pool.close().await;
}

#[tokio::test]
async fn migrations_preserve_populated_schema_one() {
    let temp = Temp::new();
    let path = temp.0.join("db");
    let pool = database(&path, 1).await;
    sqlx::raw_sql("INSERT INTO income(id,workspace_id,source,amount_minor,received_on) SELECT 'old-income',id,'twitch_subs',12345,'2026-11-01' FROM workspace; INSERT INTO idea(id,workspace_id,title) SELECT 'old-idea',id,'Conservar 🎮' FROM workspace;").execute(&pool).await.unwrap();
    let old_tables = TABLES
        .iter()
        .copied()
        .filter(|t| studio_data_safety::introduced_in(t) == 1)
        .collect::<Vec<_>>();
    let (before, _) = snapshot(&pool, &old_tables, "stamp").await.unwrap();
    assert!(
        backup_if_pending(&path, &temp.0.join("copies"), 19)
            .await
            .unwrap()
            .is_some()
    );
    for (i, migration) in MIGRATIONS.iter().enumerate().skip(1) {
        sqlx::raw_sql(migration).execute(&pool).await.unwrap();
        sqlx::query("INSERT INTO _sqlx_migrations VALUES (?,1)")
            .bind(i as i64 + 1)
            .execute(&pool)
            .await
            .unwrap();
    }
    let (after, _) = snapshot(&pool, &TABLES, "stamp").await.unwrap();
    for table in old_tables {
        let rows = before["tables"][table].as_array().unwrap();
        for (i, row) in rows.iter().enumerate() {
            for (key, value) in row.as_object().unwrap() {
                assert_eq!(value, &after["tables"][table][i][key], "{table}.{key}");
            }
        }
    }
    let all:Vec<String>=sqlx::query_scalar("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '_sqlx_migrations' ORDER BY name").fetch_all(&pool).await.unwrap();
    let mut expected = TABLES.map(String::from).to_vec();
    expected.sort();
    assert_eq!(all, expected);
    assert!(
        sqlx::query("PRAGMA foreign_key_check")
            .fetch_all(&pool)
            .await
            .unwrap()
            .is_empty()
    );
    pool.close().await;
}

#[path="../../../src-tauri/src/obs_store.rs"]
mod obs_store;

#[tokio::test]
async fn imports_schema_fifteen_and_preserves_new_obs_tables_on_roundtrip() {
    let temp=Temp::new();
    let old=database(&temp.0.join("old"),15).await;populate(&old).await;
    let tables:Vec<_>=TABLES.iter().copied().filter(|t|studio_data_safety::introduced_in(t)<=15).collect();
    let (doc,_) = snapshot(&old,&tables,"old").await.unwrap();
    let current=database(&temp.0.join("new"),19).await;
    restore(&current,&doc.to_string()).await.unwrap();
    let count:i64=sqlx::query_scalar("SELECT COUNT(*) FROM obs_marker").fetch_one(&current).await.unwrap();assert_eq!(count,0);
    obs_store::open_session(&current,"session","recording",Some("game")).await.unwrap();
    obs_store::insert_marker(&current,"mark","session","Jugada",Some(123450),Some(89000),Some("game")).await.unwrap();
    obs_store::close_session(&current,"session","stopped",Some("D:/Vídeos/Fortnite.mkv")).await.unwrap();
    let markers=obs_store::list_markers(&current).await.unwrap();assert_eq!(markers[0]["record_ms"],123450);assert_eq!(markers[0]["stream_ms"],89000);assert_eq!(markers[0]["output_path"],"D:/Vídeos/Fortnite.mkv");
    let (backup,_) = snapshot(&current,&TABLES,"new").await.unwrap();restore(&current,&backup.to_string()).await.unwrap();
    assert_eq!(markers,obs_store::list_markers(&current).await.unwrap());
    old.close().await;current.close().await;
}

#[tokio::test]
async fn obs_marks_require_active_session_and_confirmed_time() {
    let temp=Temp::new();let pool=database(&temp.0.join("db"),19).await;
    obs_store::open_session(&pool,"s","recording",None).await.unwrap();
    assert!(obs_store::insert_marker(&pool,"a","s","Momento",None,None,None).await.is_err());
    assert!(obs_store::insert_marker(&pool,"b","s","Momento",Some(-1),None,None).await.is_err());
    obs_store::close_session(&pool,"s","connection_lost",None).await.unwrap();
    assert!(obs_store::insert_marker(&pool,"c","s","Momento",Some(1200),None,None).await.is_err());
    assert_eq!(obs_store::list_markers(&pool).await.unwrap().as_array().unwrap().len(),0);
    pool.close().await;
}

#[tokio::test]
async fn replay_clip_and_marker_are_atomic_and_survive_backups() {
    let temp=Temp::new();let pool=database(&temp.0.join("db"),19).await;
    obs_store::open_session(&pool,"s","recording",None).await.unwrap();
    obs_store::insert_clip(&pool,"c1",Some("m1"),Some("s"),"Jugada","D:/Vídeos/replay.mkv",Some(4567),None,None).await.unwrap();
    assert!(obs_store::insert_clip(&pool,"c2",Some("m2"),Some("s"),"Duplicado","D:/Vídeos/replay.mkv",Some(5000),None,None).await.is_err());
    assert_eq!(obs_store::list_markers(&pool).await.unwrap().as_array().unwrap().len(),1);
    obs_store::insert_clip(&pool,"c3",None,None,"Solo buffer","D:/Vídeos/buffer.mkv",None,None,None).await.unwrap();
    assert!(obs_store::insert_clip(&pool,"c4",None,None,"Sin confirmar","",None,None,None).await.is_err());
    let clips=obs_store::list_clips(&pool).await.unwrap();assert_eq!(clips.as_array().unwrap().len(),2);
    let (backup,_) = snapshot(&pool,&TABLES,"stamp").await.unwrap();restore(&pool,&backup.to_string()).await.unwrap();
    assert_eq!(clips,obs_store::list_clips(&pool).await.unwrap());pool.close().await;
}
#[tokio::test]
async fn actual_schema_sixteen_backup_imports_without_clips() {
    let temp=Temp::new();let old=database(&temp.0.join("old"),16).await;populate(&old).await;
    let tables:Vec<_>=TABLES.iter().copied().filter(|t|studio_data_safety::introduced_in(t)<=16).collect();
    let (doc,_) = snapshot(&old,&tables,"old").await.unwrap();let new=database(&temp.0.join("new"),19).await;
    restore(&new,&doc.to_string()).await.unwrap();assert_eq!(obs_store::list_markers(&new).await.unwrap().as_array().unwrap().len(),1);
    assert!(obs_store::list_clips(&new).await.unwrap().as_array().unwrap().is_empty());old.close().await;new.close().await;
}

#[tokio::test]
async fn imports_schema_seventeen_and_keeps_game_idea_relations_on_roundtrip() {
    let temp=Temp::new();let old=database(&temp.0.join("old"),17).await;populate(&old).await;
    let old_tables:Vec<_>=TABLES.iter().copied().filter(|t|studio_data_safety::introduced_in(t)<=17).collect();
    let (legacy,_) = snapshot(&old,&old_tables,"old").await.unwrap();
    let current=database(&temp.0.join("new"),19).await;
    restore(&current,&legacy.to_string()).await.unwrap();
    sqlx::query("UPDATE idea SET game_id='game',capture_key='clip:clip' WHERE id='idea'").execute(&current).await.unwrap();
    let (before,_) = snapshot(&current,&TABLES,"new").await.unwrap();
    restore(&current,&before.to_string()).await.unwrap();
    assert_eq!(before,snapshot(&current,&TABLES,"new").await.unwrap().0);
    assert!(sqlx::query("INSERT INTO idea(id,workspace_id,title,capture_key) VALUES('duplicate','00000000-0000-4000-8000-000000000001','Duplicate','clip:clip')").execute(&current).await.is_err());
    old.close().await;current.close().await;
}

#[path="../../../src-tauri/src/game_broadcast.rs"]
mod game_broadcast;
#[tokio::test]
async fn broadcast_controls_are_idempotent_and_share_collection_progress() {
 let temp=Temp::new();let pool=database(&temp.0.join("db"),19).await;populate(&pool).await;
 assert_eq!(game_broadcast::targets(&pool,"game").await.unwrap().as_array().unwrap().len(),1);
 game_broadcast::current_action(&pool,"complete").await.unwrap();game_broadcast::current_action(&pool,"complete").await.unwrap();
 let s=game_broadcast::state(&pool).await.unwrap();assert_eq!(s["done"],1);assert_eq!(s["target"]["done"],true);assert!(s["target"].get("detector_reference").is_none());
 assert!(game_broadcast::change_target(&pool,"missing",true,true).await.is_err());
 sqlx::query("DELETE FROM collection_item WHERE item_key='curio-1'").execute(&pool).await.unwrap();
 assert_eq!(game_broadcast::state(&pool).await.unwrap()["target"]["done"],false);
 game_broadcast::current_action(&pool,"complete").await.unwrap();game_broadcast::current_action(&pool,"undo").await.unwrap();assert_eq!(game_broadcast::state(&pool).await.unwrap()["done"],0);
 pool.close().await;
}
#[tokio::test]
async fn broadcast_counts_each_game_once_and_distinguishes_manual_records() {
 let temp=Temp::new();let pool=database(&temp.0.join("db"),19).await;populate(&pool).await;
 sqlx::query("UPDATE game SET status='platinum',platinum_at='2026-11-11' WHERE id='game'").execute(&pool).await.unwrap();
 let s=game_broadcast::state(&pool).await.unwrap();assert_eq!(s["platinos"],1);assert_eq!(s["manual"],1);assert_eq!(s["verified"],0);
 sqlx::query("UPDATE trophy SET type='platinum',earned_at='2026-11-11T12:00:00Z' WHERE game_id='game'").execute(&pool).await.unwrap();
 let s=game_broadcast::state(&pool).await.unwrap();assert_eq!(s["platinos"],1);assert_eq!(s["manual"],0);assert_eq!(s["verified"],1);
 pool.close().await;
}
#[tokio::test]
async fn schema_eighteen_import_and_target_backup_preserve_selection() {
 let temp=Temp::new();let old=database(&temp.0.join("old"),18).await;populate(&old).await;
 let old_tables:Vec<_>=TABLES.iter().copied().filter(|t|studio_data_safety::introduced_in(t)<=18).collect();
 let (doc,_) = snapshot(&old,&old_tables,"old").await.unwrap();let pool=database(&temp.0.join("new"),19).await;restore(&pool,&doc.to_string()).await.unwrap();
 assert_eq!(game_broadcast::state(&pool).await.unwrap()["target"],serde_json::Value::Null);
 sqlx::query("INSERT INTO game_target(id,workspace_id,game_id,title) VALUES('t','00000000-0000-4000-8000-000000000001','game','Objeto')").execute(&pool).await.unwrap();
 sqlx::query("INSERT INTO game_overlay(workspace_id,game_id,target_id) VALUES('00000000-0000-4000-8000-000000000001','game','t')").execute(&pool).await.unwrap();
 let before=game_broadcast::state(&pool).await.unwrap();let (doc,_) = snapshot(&pool,&TABLES,"new").await.unwrap();restore(&pool,&doc.to_string()).await.unwrap();assert_eq!(before,game_broadcast::state(&pool).await.unwrap());
 pool.close().await;old.close().await;
}
