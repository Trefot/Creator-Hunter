//! Local, opt-in replay counter. Only completed matches recorded after activation are applied.
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

use std::{
    collections::HashSet,
    io::Read,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::{
        Mutex,
        atomic::{AtomicBool, AtomicU64, Ordering},
    },
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager};
const CONFIG: &str = "fortnite-counter-config";
#[derive(Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct Config {
    enabled: bool,
    counter_id: String,
    directory: String,
    activated_ms: u64,
    account_id: Option<String>,
    player: Option<String>,
}
#[derive(Deserialize, Serialize, Clone)]
pub struct Match {
    schema: u32,
    match_id: String,
    account_id: String,
    player: String,
    started_ms: u64,
    ended_ms: u64,
    opened: u32,
    destroyed: u32,
    uncertain: u32,
    vehicle_missing: bool,
    reader_version: u32,
    game_version: String,
}
#[derive(Default)]
pub struct FortniteCounterState {
    started: AtomicBool,
    stopped: AtomicBool,
    generation: AtomicU64,
    pub(crate) operation: Mutex<()>,
    message: Mutex<String>,
}
fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
fn default_dir() -> String {
    std::env::var("LOCALAPPDATA")
        .map(|s| {
            Path::new(&s)
                .join("FortniteGame")
                .join("Saved")
                .join("Demos")
                .display()
                .to_string()
        })
        .unwrap_or_default()
}
fn helper(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .resolve(
            "nexus-fortnite-reader.exe",
            tauri::path::BaseDirectory::Resource,
        )
        .ok()
        .filter(|p| p.is_file())
}
async fn config(app: &AppHandle) -> Result<Config, String> {
    let v = crate::social_alerts::load(app, CONFIG).await?;
    let mut c = if v.is_null() {
        Config::default()
    } else {
        serde_json::from_value(v).map_err(|e| e.to_string())?
    };
    if c.directory.is_empty() {
        c.directory = default_dir();
    }
    Ok(c)
}
fn message(app: &AppHandle, text: &str) {
    *app.state::<FortniteCounterState>().message.lock().unwrap() = text.chars().take(600).collect();
}
fn valid_id(s: &str) -> bool {
    s.len() == 32 && s.bytes().all(|b| b.is_ascii_hexdigit())
}
fn validate(m: &Match) -> Result<(), String> {
    if m.schema != 1
        || !valid_id(&m.match_id)
        || !valid_id(&m.account_id)
        || m.player.is_empty()
        || m.player.len() > 256
        || m.ended_ms <= m.started_ms
        || m.opened.saturating_add(m.destroyed) > 2000
        || m.uncertain > 2000
    {
        return Err("El lector devolvió datos no válidos. No se ha sumado nada.".into());
    }
    Ok(())
}
/// Single transaction: identity ledger + addition + first-account binding. Never resets the base total.
async fn apply(
    pool: &sqlx::SqlitePool,
    expected: &Config,
    m: &Match,
    clock: u64,
) -> Result<bool, String> {
    validate(m)?;
    if m.ended_ms < expected.activated_ms || m.ended_ms > clock.saturating_add(300000) {
        return Ok(false);
    }
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
    let raw: Option<String> = sqlx::query_scalar("SELECT content FROM alert_cursor WHERE id=$1")
        .bind(CONFIG)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    let mut c: Config = raw
        .and_then(|s| serde_json::from_str(&s).ok())
        .ok_or("La configuración ha cambiado.")?;
    if !c.enabled
        || c.counter_id != expected.counter_id
        || c.activated_ms != expected.activated_ms
        || c.account_id.as_ref().is_some_and(|a| a != &m.account_id)
    {
        return Ok(false);
    }
    let key = format!(
        "fortnite-match:{}:{}:{}",
        c.counter_id, m.account_id, m.match_id
    );
    let claim = sqlx::query(
        "INSERT INTO alert_cursor(id,content) VALUES($1,$2) ON CONFLICT(id) DO NOTHING",
    )
    .bind(key)
    .bind(json!({"match":m,"counter_id":c.counter_id,"applied":m.opened+m.destroyed}).to_string())
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;
    if claim.rows_affected() == 0 {
        return Ok(false);
    }
    let total: i64 = (m.opened + m.destroyed).into();
    let changed=sqlx::query("UPDATE counter SET value=value+$1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=$2 AND workspace_id=$3 AND value>=0 AND value<=9007199254740991-$1").bind(total).bind(&c.counter_id).bind(crate::obs_store::WORKSPACE).execute(&mut *tx).await.map_err(|e|e.to_string())?;
    if changed.rows_affected() != 1 {
        return Err("No se encuentra el contador seleccionado o su total no es válido.".into());
    }
    if c.account_id.is_none() {
        c.account_id = Some(m.account_id.clone());
        c.player = Some(m.player.clone());
        sqlx::query("UPDATE alert_cursor SET content=$1 WHERE id=$2")
            .bind(serde_json::to_string(&c).unwrap())
            .bind(CONFIG)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
    }
    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(true)
}
#[tauri::command]
pub async fn fortnite_counter_status(app: AppHandle) -> Result<Value, String> {
    let c = config(&app).await?;
    let pool = crate::backup::pool(&app).await?;
    let raw: Vec<String> = sqlx::query_scalar(
        "SELECT content FROM alert_cursor WHERE id LIKE $1 ORDER BY rowid DESC LIMIT 100",
    )
    .bind(format!("fortnite-match:{}:%", c.counter_id))
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;
    let recent:Vec<Value>=raw.iter().filter_map(|s|serde_json::from_str::<Value>(s).ok()).take(10).map(|v|json!({"opened":v["match"]["opened"],"destroyed":v["match"]["destroyed"],"uncertain":v["match"]["uncertain"],"vehicle_missing":v["match"]["vehicle_missing"],"ended_ms":v["match"]["ended_ms"],"applied":v["applied"]})).collect();
    let text = app
        .state::<FortniteCounterState>()
        .message
        .lock()
        .unwrap()
        .clone();
    Ok(
        json!({"config":c,"reader_ready":helper(&app).is_some(),"directory_exists":Path::new(&c.directory).is_dir(),"message":text,"recent":recent}),
    )
}
#[tauri::command]
pub async fn fortnite_counter_configure(
    app: AppHandle,
    enabled: bool,
    counter_id: String,
    directory: Option<String>,
) -> Result<(), String> {
    let old = config(&app).await?;
    let pool = crate::backup::pool(&app).await?;
    if enabled {
        if helper(&app).is_none() {
            return Err(
                "Esta instalación no incluye el lector de repeticiones. Actualiza Nexus.".into(),
            );
        }
        let valid: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM counter WHERE id=$1 AND workspace_id=$2)",
        )
        .bind(&counter_id)
        .bind(crate::obs_store::WORKSPACE)
        .fetch_one(&pool)
        .await
        .map_err(|e| e.to_string())?;
        if !valid {
            return Err("Elige tu contador de cofres.".into());
        }
    }
    let path = directory
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(default_dir);
    if enabled && (!Path::new(&path).is_absolute() || path.len() > 2048) {
        return Err("La carpeta de repeticiones debe tener una ruta completa.".into());
    }
    let keep = old.enabled && enabled && old.counter_id == counter_id && old.directory == path;
    let c = Config {
        enabled,
        counter_id,
        directory: path,
        activated_ms: if keep { old.activated_ms } else { now() },
        account_id: if keep { old.account_id } else { None },
        player: if keep { old.player } else { None },
    };
    crate::social_alerts::save(&app, CONFIG, &json!(c)).await?;
    app.state::<FortniteCounterState>()
        .generation
        .fetch_add(1, Ordering::SeqCst);
    message(
        &app,
        if enabled {
            "Activado. Contaré las partidas que terminen desde ahora; el total anterior se conserva."
        } else {
            "Conteo automático desactivado."
        },
    );
    Ok(())
}
/// Only inspect the small public header while a match is live; do not start .NET yet.
fn ready_replay(path: &Path) -> bool {
    use std::io::Seek;
    fn word(f: &mut std::fs::File) -> Option<u32> {
        let mut b = [0; 4];
        f.read_exact(&mut b).ok()?;
        Some(u32::from_le_bytes(b))
    }
    let read = || -> Option<bool> {
        let mut f = std::fs::File::open(path).ok()?;
        if word(&mut f)? != 0x1CA2E27F {
            return Some(false);
        }
        let version = word(&mut f)?;
        if version >= 7 {
            let n = word(&mut f)?;
            if n > 64 {
                return Some(false);
            }
            f.seek_relative(n as i64 * 20).ok()?;
        }
        f.seek_relative(12).ok()?;
        let len = word(&mut f)? as i32;
        if len.unsigned_abs() > 4096 {
            return Some(false);
        }
        f.seek_relative(if len < 0 {
            -2i64 * len as i64
        } else {
            len as i64
        })
        .ok()?;
        if word(&mut f)? != 0 {
            return Some(false);
        }
        f.seek_relative(12).ok()?;
        if word(&mut f)? == 0 {
            return Some(true);
        }
        let len = word(&mut f)?;
        if len == 0 || len > 256 {
            return Some(false);
        }
        let mut key = vec![0; len as usize];
        f.read_exact(&mut key).ok()?;
        Some(key.iter().any(|b| *b != 0))
    };
    read().unwrap_or(false)
}
fn capture(mut pipe: impl Read) -> Vec<u8> {
    let mut result = Vec::new();
    let mut buf = [0; 4096];
    while let Ok(n) = pipe.read(&mut buf) {
        if n == 0 {
            break;
        }
        let room = 8192usize.saturating_sub(result.len());
        result.extend_from_slice(&buf[..n.min(room)]);
    }
    result
}
fn run(
    app: &AppHandle,
    binary: &Path,
    file: &Path,
    generation: u64,
) -> Result<Option<Match>, String> {
    let mut command = Command::new(binary);
    command
        .arg(file)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .env("DOTNET_PROCESSOR_COUNT", "2")
        .env("DOTNET_GCHeapHardLimit", "0x80000000");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000 | 0x00004000);
    }
    let mut child = command
        .spawn()
        .map_err(|e| format!("No se pudo iniciar el lector: {e}"))?;
    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();
    let out = std::thread::spawn(move || capture(stdout));
    let err = std::thread::spawn(move || capture(stderr));
    let start = std::time::Instant::now();
    let state = app.state::<FortniteCounterState>();
    let status = loop {
        if state.stopped.load(Ordering::SeqCst)
            || state.generation.load(Ordering::SeqCst) != generation
            || start.elapsed() > Duration::from_secs(90)
        {
            let _ = child.kill();
            let _ = child.wait();
            let _ = out.join();
            let _ = err.join();
            return Err("Lectura cancelada o demasiado larga. No se ha sumado nada.".into());
        }
        match child.try_wait() {
            Ok(Some(s)) => break s,
            Ok(None) => std::thread::sleep(Duration::from_millis(100)),
            Err(e) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(e.to_string());
            }
        }
    };
    let bytes = out.join().unwrap_or_default();
    let error = err.join().unwrap_or_default();
    if status.code() == Some(2) {
        return Ok(None);
    }
    if !status.success() {
        return Err(format!(
            "No se pudo leer la repetición: {}",
            String::from_utf8_lossy(&error)
                .chars()
                .take(400)
                .collect::<String>()
        ));
    }
    let m: Match =
        serde_json::from_slice(&bytes).map_err(|_| "El lector no devolvió un resultado válido.")?;
    validate(&m)?;
    Ok(Some(m))
}
pub fn start(app: AppHandle) {
    if app
        .state::<FortniteCounterState>()
        .started
        .swap(true, Ordering::SeqCst)
    {
        return;
    }
    std::thread::spawn(move || {
        let mut seen = HashSet::new();
        let mut epoch = u64::MAX;
        loop {
            let state = app.state::<FortniteCounterState>();
            if state.stopped.load(Ordering::SeqCst) {
                break;
            }
            let current = state.generation.load(Ordering::SeqCst);
            if current != epoch {
                seen.clear();
                epoch = current;
            }
            if let Ok(c) = tauri::async_runtime::block_on(config(&app)) {
                if c.enabled {
                    if let Some(binary) = helper(&app) {
                        match std::fs::read_dir(&c.directory) {
                            Err(_) => message(
                                &app,
                                "Esperando la carpeta de repeticiones. Activa Guardar repeticiones en Fortnite.",
                            ),
                            Ok(entries) => {
                                let mut files: Vec<_> = entries
                                    .flatten()
                                    .filter(|e| {
                                        e.path()
                                            .extension()
                                            .and_then(|x| x.to_str())
                                            .is_some_and(|x| x.eq_ignore_ascii_case("replay"))
                                    })
                                    .filter_map(|e| {
                                        let m = e.metadata().ok()?;
                                        let ms = m
                                            .modified()
                                            .ok()?
                                            .duration_since(UNIX_EPOCH)
                                            .ok()?
                                            .as_millis()
                                            as u64;
                                        if !m.is_file()
                                            || m.len() > 256 * 1024 * 1024
                                            || ms + 1000 < c.activated_ms
                                        {
                                            return None;
                                        }
                                        Some((ms, m.len(), e.path()))
                                    })
                                    .collect();
                                files.sort_by(|a, b| b.0.cmp(&a.0));
                                files.retain(|(ms, len, path)| {
                                    !seen.contains(&(path.clone(), *ms, *len))
                                });
                                for (ms, len, path) in files.into_iter().take(3) {
                                    let key = (path.clone(), ms, len);
                                    if seen.contains(&key) {
                                        continue;
                                    }
                                    if state.generation.load(Ordering::SeqCst) != epoch
                                        || state.stopped.load(Ordering::SeqCst)
                                    {
                                        break;
                                    }
                                    if now().saturating_sub(ms) < 5000 {
                                        continue;
                                    }
                                    if !ready_replay(&path) {
                                        message(
                                            &app,
                                            "Esperando que Fortnite termine de guardar la partida…",
                                        );
                                        continue;
                                    }
                                    message(
                                        &app,
                                        "Comprobando los cofres de una partida terminada…",
                                    );
                                    let result = run(&app, &binary, &path, epoch);
                                    seen.insert(key);
                                    if seen.len() > 1000 {
                                        seen.clear();
                                    }
                                    match result {
                                        Ok(Some(m)) => {
                                            let _gate = state.operation.lock().unwrap();
                                            if let Ok(pool) = tauri::async_runtime::block_on(
                                                crate::backup::pool(&app),
                                            ) {
                                                match tauri::async_runtime::block_on(apply(
                                                    &pool,
                                                    &c,
                                                    &m,
                                                    now(),
                                                )) {
                                                    Ok(true) => {
                                                        let _ = app.emit(
                                                            "counters-changed",
                                                            &c.counter_id,
                                                        );
                                                        crate::live::live_notify();
                                                        message(
                                                            &app,
                                                            &format!(
                                                                "{}: +{} cofres ({} abiertos, {} destruidos).{}",
                                                                m.player,
                                                                m.opened + m.destroyed,
                                                                m.opened,
                                                                m.destroyed,
                                                                if m.uncertain > 0
                                                                    || m.vehicle_missing
                                                                {
                                                                    " Hay detecciones inciertas que no se sumaron."
                                                                } else {
                                                                    ""
                                                                }
                                                            ),
                                                        );
                                                    }
                                                    Ok(false) => message(
                                                        &app,
                                                        "Partida anterior a la activación, de otra cuenta o ya contada. El total se conserva.",
                                                    ),
                                                    Err(e) => message(&app, &e),
                                                }
                                            }
                                        }
                                        Ok(None) => message(
                                            &app,
                                            "La partida aún no está cerrada. Esperando su repetición completa.",
                                        ),
                                        Err(e) => message(&app, &e),
                                    }
                                }
                            }
                        }
                    } else {
                        message(
                            &app,
                            "El lector de repeticiones no está disponible en esta instalación.",
                        );
                    }
                }
            }
            for _ in 0..25 {
                if state.stopped.load(Ordering::SeqCst) {
                    return;
                }
                std::thread::sleep(Duration::from_millis(200));
            }
        }
    });
}
pub fn stop(app: &AppHandle) {
    app.state::<FortniteCounterState>()
        .stopped
        .store(true, Ordering::SeqCst);
}
pub async fn reset_after_restore(app: &AppHandle) -> Result<(), String> {
    let mut c = config(app).await?;
    c.enabled = false;
    crate::social_alerts::save(app, CONFIG, &json!(c)).await?;
    app.state::<FortniteCounterState>()
        .generation
        .fetch_add(1, Ordering::SeqCst);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    async fn db(c: &Config) -> sqlx::SqlitePool {
        let p = sqlx::sqlite::SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::raw_sql("CREATE TABLE alert_cursor(id TEXT PRIMARY KEY,content TEXT NOT NULL);CREATE TABLE counter(id TEXT PRIMARY KEY,workspace_id TEXT,value INTEGER,updated_at TEXT);").execute(&p).await.unwrap();
        sqlx::query("INSERT INTO alert_cursor VALUES(?,?)")
            .bind(CONFIG)
            .bind(serde_json::to_string(c).unwrap())
            .execute(&p)
            .await
            .unwrap();
        sqlx::query("INSERT INTO counter VALUES('cofres',?,2255,NULL)")
            .bind(crate::obs_store::WORKSPACE)
            .execute(&p)
            .await
            .unwrap();
        p
    }
    fn cfg() -> Config {
        Config {
            enabled: true,
            counter_id: "cofres".into(),
            activated_ms: 10000,
            ..Default::default()
        }
    }
    fn game() -> Match {
        Match {
            schema: 1,
            match_id: "a".repeat(32),
            account_id: "b".repeat(32),
            player: "Jugador de prueba".into(),
            started_ms: 11000,
            ended_ms: 20000,
            opened: 8,
            destroyed: 4,
            uncertain: 3,
            vehicle_missing: false,
            reader_version: 17,
            game_version: "test".into(),
        }
    }
    async fn total(p: &sqlx::SqlitePool) -> i64 {
        sqlx::query_scalar("SELECT value FROM counter WHERE id='cofres'")
            .fetch_one(p)
            .await
            .unwrap()
    }
    #[test]
    fn header_waits_for_live_or_missing_keys_and_rejects_truncation() {
        let path =
            std::env::temp_dir().join(format!("nexus-replay-header-{}.replay", std::process::id()));
        let header = |live: u32, key: &[u8]| {
            let mut b = Vec::new();
            for v in [
                0x1CA2E27Fu32,
                7,
                0,
                0,
                0,
                0,
                0,
                live,
                0,
                0,
                0,
                1,
                key.len() as u32,
            ] {
                b.extend(v.to_le_bytes());
            }
            b.extend(key);
            b
        };
        std::fs::write(&path, header(1, &[1; 32])).unwrap();
        assert!(!ready_replay(&path));
        std::fs::write(&path, header(0, &[0; 32])).unwrap();
        assert!(!ready_replay(&path));
        std::fs::write(&path, header(0, &[1; 32])).unwrap();
        assert!(ready_replay(&path));
        std::fs::write(&path, [0; 8]).unwrap();
        assert!(!ready_replay(&path));
        std::fs::remove_file(path).unwrap();
    }
    #[tokio::test]
    async fn preserves_base_and_counts_a_match_once_without_uncertain_events() {
        let c = cfg();
        let p = db(&c).await;
        let m = game();
        assert!(apply(&p, &c, &m, 21000).await.unwrap());
        assert_eq!(total(&p).await, 2267);
        assert!(!apply(&p, &c, &m, 22000).await.unwrap());
        assert_eq!(total(&p).await, 2267);
        let mut other = game();
        other.match_id = "c".repeat(32);
        other.opened = 11;
        other.destroyed = 3;
        assert!(apply(&p, &c, &other, 22000).await.unwrap());
        assert_eq!(total(&p).await, 2281);
    }
    #[tokio::test]
    async fn rejects_history_other_accounts_disable_and_invalid_data() {
        let c = cfg();
        let p = db(&c).await;
        let mut m = game();
        m.ended_ms = 9999;
        m.started_ms = 1000;
        assert!(!apply(&p, &c, &m, 21000).await.unwrap());
        let m = game();
        assert!(apply(&p, &c, &m, 21000).await.unwrap());
        let mut other = game();
        other.account_id = "c".repeat(32);
        other.match_id = "d".repeat(32);
        assert!(!apply(&p, &c, &other, 21000).await.unwrap());
        let mut off = c.clone();
        off.enabled = false;
        sqlx::query("UPDATE alert_cursor SET content=? WHERE id=?")
            .bind(serde_json::to_string(&off).unwrap())
            .bind(CONFIG)
            .execute(&p)
            .await
            .unwrap();
        other.account_id = m.account_id.clone();
        assert!(!apply(&p, &c, &other, 21000).await.unwrap());
        assert_eq!(total(&p).await, 2267);
        other.opened = 9999;
        assert!(apply(&p, &c, &other, 21000).await.is_err());
    }
    #[tokio::test]
    async fn missing_counter_rolls_back_the_deduplication_claim() {
        let c = cfg();
        let p = db(&c).await;
        sqlx::query("DELETE FROM counter")
            .execute(&p)
            .await
            .unwrap();
        assert!(apply(&p, &c, &game(), 21000).await.is_err());
        let n: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM alert_cursor WHERE id LIKE 'fortnite-match:%'",
        )
        .fetch_one(&p)
        .await
        .unwrap();
        assert_eq!(n, 0);
    }
}
