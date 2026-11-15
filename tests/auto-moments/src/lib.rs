#![allow(dead_code, unused_imports)]
use std::{
    any::{Any, TypeId},
    collections::HashMap,
    path::PathBuf,
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, AtomicUsize, Ordering},
    },
};
mod tauri {
    use super::*;
    pub struct Env {
        pub pool: sqlx::SqlitePool,
        pub states: HashMap<TypeId, Box<dyn Any + Send + Sync>>,
        pub saves: AtomicUsize,
        pub buffer: AtomicBool,
        pub fail: AtomicBool,
        pub block: AtomicBool,
        pub dir: PathBuf,
        pub events: Mutex<Vec<serde_json::Value>>,
    }
    #[derive(Clone)]
    pub struct AppHandle {
        pub env: Arc<Env>,
    }
    pub struct State<'a, T>(&'a T);
    impl<T> std::ops::Deref for State<'_, T> {
        type Target = T;
        fn deref(&self) -> &T {
            self.0
        }
    }
    impl AppHandle {
        pub fn state<T: Any + Send + Sync>(&self) -> State<'_, T> {
            State(
                self.env
                    .states
                    .get(&TypeId::of::<T>())
                    .unwrap()
                    .downcast_ref()
                    .unwrap(),
            )
        }
        pub fn path(&self) -> Paths {
            Paths(self.env.dir.clone())
        }
    }
    pub struct Paths(PathBuf);
    impl Paths {
        pub fn app_local_data_dir(&self) -> Result<PathBuf, String> {
            Ok(self.0.clone())
        }
        pub fn video_dir(&self) -> Result<PathBuf, String> {
            Ok(self.0.clone())
        }
    }
    pub trait Manager {}
    impl Manager for AppHandle {}
    pub trait Emitter {
        fn emit<T: serde::Serialize>(&self, _: &str, payload: T) -> Result<(), String>;
    }
    impl Emitter for AppHandle {
        fn emit<T: serde::Serialize>(&self, _: &str, payload: T) -> Result<(), String> {
            self.env
                .events
                .lock()
                .unwrap()
                .push(serde_json::to_value(payload).unwrap());
            Ok(())
        }
    }
    pub mod async_runtime {
        pub type Mutex<T> = tokio::sync::Mutex<T>;
        pub async fn spawn_blocking<F, T>(f: F) -> Result<T, String>
        where
            F: FnOnce() -> T + Send + 'static,
            T: Send + 'static,
        {
            tokio::task::spawn_blocking(f)
                .await
                .map_err(|e| e.to_string())
        }
        pub fn block_on<F: std::future::Future>(f: F) -> F::Output {
            if let Ok(h) = tokio::runtime::Handle::try_current() {
                h.block_on(f)
            } else {
                {
                    static RT: std::sync::OnceLock<tokio::runtime::Runtime> =
                        std::sync::OnceLock::new();
                    RT.get_or_init(|| tokio::runtime::Runtime::new().unwrap())
                        .block_on(f)
                }
            }
        }
    }
}
mod backup {
    pub async fn pool(app: &crate::tauri::AppHandle) -> Result<sqlx::SqlitePool, String> {
        Ok(app.env.pool.clone())
    }
}
mod social_alerts {
    use serde_json::Value;
    pub async fn load(app: &crate::tauri::AppHandle, id: &str) -> Result<Value, String> {
        let s: Option<String> = sqlx::query_scalar("SELECT content FROM alert_cursor WHERE id=?")
            .bind(id)
            .fetch_optional(&app.env.pool)
            .await
            .map_err(|e| e.to_string())?;
        s.map(|s| serde_json::from_str(&s).map_err(|e| e.to_string()))
            .unwrap_or(Ok(Value::Null))
    }
    pub async fn save(app: &crate::tauri::AppHandle, id: &str, v: &Value) -> Result<(), String> {
        sqlx::query("INSERT INTO alert_cursor VALUES(?,?) ON CONFLICT(id) DO UPDATE SET content=excluded.content").bind(id).bind(v.to_string()).execute(&app.env.pool).await.map_err(|e|e.to_string())?;
        Ok(())
    }
}
mod studio_tools {
    pub async fn capture_project(_: &sqlx::SqlitePool, _: &str, _: &str) -> Result<String, String> {
        Ok("fixture-project".into())
    }
}
mod obs_store {
    pub const WORKSPACE: &str = "test";
}
mod obs {
    pub fn media_busy(_: &crate::tauri::AppHandle) -> bool {
        false
    }
    use super::*;
    pub struct Client(bool);
    impl Client {
        pub fn request(&mut self, _: &str) -> Result<serde_json::Value, String> {
            Ok(serde_json::json!({"outputActive":self.0}))
        }
    }
    pub fn operate<T>(
        app: &tauri::AppHandle,
        run: impl FnOnce(&mut Client) -> Result<T, String>,
    ) -> Result<T, String> {
        run(&mut Client(app.env.buffer.load(Ordering::SeqCst)))
    }
    pub fn save_replay(
        app: &tauri::AppHandle,
        _: Option<String>,
    ) -> Result<serde_json::Value, String> {
        let n = app.env.saves.fetch_add(1, Ordering::SeqCst);
        if app.env.fail.load(Ordering::SeqCst) {
            return Err("OBS falló".into());
        }
        while app.env.block.load(Ordering::SeqCst) {
            std::thread::sleep(std::time::Duration::from_millis(5));
        }
        let path = app.env.dir.join(format!("clip-{n}.mkv"));
        std::fs::write(&path, b"mock clip").unwrap();
        Ok(
            serde_json::json!({"id":format!("clip-{n}"),"marker_id":null,"output_path":path.to_str().unwrap(),"requested_at_ms":std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis()as u64}),
        )
    }
}
mod tauri_plugin_opener {
    pub trait OpenerExt {
        fn opener(&self) -> Opener {
            Opener
        }
    }
    impl OpenerExt for crate::tauri::AppHandle {}
    pub struct Opener;
    impl Opener {
        pub fn open_path(
            &self,
            _: impl Into<String>,
            _: Option<impl Into<String>>,
        ) -> Result<(), String> {
            Ok(())
        }
    }
}
include!(concat!(env!("OUT_DIR"), "/modules.rs"));
#[cfg(test)]
mod tests {
    use super::*;
    use auto_moments::*;
    use serde_json::{Value, json};
    use std::time::{Duration, SystemTime, UNIX_EPOCH};
    static MEDIA_TEST_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());
    async fn app() -> tauri::AppHandle {
        let pool = sqlx::sqlite::SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::query("CREATE TABLE alert_cursor(id TEXT PRIMARY KEY,content TEXT)")
            .execute(&pool)
            .await
            .unwrap();
        let dir = std::env::temp_dir().join(format!("nexus-auto-test-{}", rand::random::<u64>()));
        std::fs::create_dir_all(&dir).unwrap();
        let mut states: HashMap<TypeId, Box<dyn Any + Send + Sync>> = HashMap::new();
        states.insert(
            TypeId::of::<AutoMomentsState>(),
            Box::new(AutoMomentsState::default()),
        );
        tauri::AppHandle {
            env: Arc::new(tauri::Env {
                pool,
                states,
                saves: AtomicUsize::new(0),
                buffer: AtomicBool::new(true),
                fail: AtomicBool::new(false),
                block: AtomicBool::new(false),
                dir,
                events: Mutex::new(vec![]),
            }),
        }
    }
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn media_queue_serializes_cancels_and_blocks_restore() {
        let _guard = MEDIA_TEST_LOCK.lock().unwrap();
        let a = app().await;
        let first = media_jobs::Ticket::enqueue("first")
            .unwrap()
            .wait(&a)
            .unwrap();
        let first_id = first.id;
        let second = media_jobs::Ticket::enqueue("second").unwrap();
        let other = a.clone();
        let waiter = std::thread::spawn(move || second.wait(&other));
        let runner = std::thread::spawn(move || {
            let command = if cfg!(windows) {
                let mut c = std::process::Command::new("powershell");
                c.args([
                    "-NoProfile",
                    "-NonInteractive",
                    "-Command",
                    "Start-Sleep -Seconds 10",
                ]);
                c
            } else {
                let mut c = std::process::Command::new("/bin/sleep");
                c.arg("10");
                c
            };
            let mut command = command;
            first.run(&mut command, None)
        });
        tokio::time::sleep(Duration::from_millis(100)).await;
        assert!(!waiter.is_finished());
        assert!(media_jobs::pause_for_restore().is_err());
        media_jobs::media_jobs_cancel(first_id).unwrap();
        assert!(runner.join().unwrap().unwrap_err().contains("cancelado"));
        let mut second = waiter.join().unwrap().unwrap();
        second.finish(Ok("fixture"));
        let queued = media_jobs::Ticket::enqueue("cancel queued").unwrap();
        media_jobs::media_jobs_cancel(queued.id).unwrap();
        assert!(queued.wait(&a).is_err());
        let guard = media_jobs::pause_for_restore().unwrap();
        assert!(media_jobs::Ticket::enqueue("during restore").is_err());
        drop(guard);
        assert!(media_jobs::Ticket::enqueue("after restore").is_ok());
    }
    #[test]
    fn real_exports_preserve_selected_audio_and_handle_tall_video() {
        use std::process::Command;
        if !std::path::Path::new("/usr/bin/ffmpeg").is_file() {
            return;
        }
        let dir =
            std::env::temp_dir().join(format!("nexus-media-regression-{}", rand::random::<u64>()));
        std::fs::create_dir_all(&dir).unwrap();
        let input = dir.join("two.mkv");
        assert!(
            Command::new("ffmpeg")
                .args([
                    "-v",
                    "error",
                    "-f",
                    "lavfi",
                    "-i",
                    "color=c=blue:s=320x800:r=2:d=1.5",
                    "-f",
                    "lavfi",
                    "-i",
                    "sine=frequency=400:sample_rate=8000:duration=1.5",
                    "-f",
                    "lavfi",
                    "-i",
                    "sine=frequency=1000:sample_rate=8000:duration=1.5",
                    "-map",
                    "0:v",
                    "-map",
                    "1:a",
                    "-map",
                    "2:a",
                    "-c:v",
                    "libx264",
                    "-preset",
                    "ultrafast",
                    "-c:a",
                    "aac"
                ])
                .arg(&input)
                .output()
                .unwrap()
                .status
                .success()
        );
        fn ratio(path: &std::path::Path) -> f64 {
            let out = Command::new("ffmpeg")
                .args(["-v", "error", "-i"])
                .arg(path)
                .args([
                    "-map", "0:a:0", "-t", "1", "-f", "s16le", "-ac", "1", "-ar", "8000", "-",
                ])
                .output()
                .unwrap();
            assert!(out.status.success());
            let samples: Vec<f64> = out
                .stdout
                .chunks_exact(2)
                .map(|b| i16::from_le_bytes([b[0], b[1]]) as f64)
                .collect();
            let power = |frequency: f64| {
                let (re, im) = samples.iter().enumerate().fold((0., 0.), |(r, j), (i, x)| {
                    let a = 2. * std::f64::consts::PI * frequency * i as f64 / 8000.;
                    (r + x * a.cos(), j + x * a.sin())
                });
                re * re + im * im
            };
            power(400.) / power(1000.).max(1.)
        }
        for (mode, w, h) in [
            (shorts_core::Format::Horizontal, 1920, 1080),
            (shorts_core::Format::Original, 320, 800),
            (shorts_core::Format::VerticalCrop, 1080, 1920),
            (shorts_core::Format::VerticalBlur, 1080, 1920),
        ] {
            let output = dir.join(format!("{}.mp4", mode.key()));
            let args = shorts_core::args_audio(
                input.to_str().unwrap(),
                output.to_str().unwrap(),
                None,
                mode,
                &[0, 1],
                2,
            );
            let result = Command::new("ffmpeg").args(args).output().unwrap();
            assert!(
                result.status.success(),
                "{}",
                String::from_utf8_lossy(&result.stderr)
            );
            let info = Command::new("ffprobe")
                .args(["-v", "error", "-show_streams", "-of", "json"])
                .arg(&output)
                .output()
                .unwrap();
            let info: Value = serde_json::from_slice(&info.stdout).unwrap();
            let streams = info["streams"].as_array().unwrap();
            let video = streams.iter().find(|s| s["codec_type"] == "video").unwrap();
            assert_eq!(video["width"], w);
            assert_eq!(video["height"], h);
            assert_eq!(
                streams
                    .iter()
                    .filter(|s| s["codec_type"] == "audio")
                    .count(),
                1
            );
            assert!((0.3..3.).contains(&ratio(&output)));
        }
        let voice = dir.join("voice.wav");
        let args = subtitles_core::audio_args_selected(
            input.to_str().unwrap(),
            voice.to_str().unwrap(),
            &[1],
        )
        .unwrap();
        assert!(
            Command::new("ffmpeg")
                .args(args)
                .output()
                .unwrap()
                .status
                .success()
        );
        assert!(ratio(&voice) < 0.001);
        let mixed = dir.join("mixed.wav");
        let args = subtitles_core::audio_args_selected(
            input.to_str().unwrap(),
            mixed.to_str().unwrap(),
            &[0, 1],
        )
        .unwrap();
        assert!(
            Command::new("ffmpeg")
                .args(args)
                .output()
                .unwrap()
                .status
                .success()
        );
        assert!((0.3..3.).contains(&ratio(&mixed)));
        std::fs::remove_dir_all(dir).unwrap();
    }
    #[tokio::test]
    async fn subtitle_history_returns_the_actual_unique_srt() {
        let a = app().await;
        let path = a.env.dir.join("clip.mkv");
        let srt = a.env.dir.join("clip (Nexus 2).srt");
        std::fs::write(&path, b"fixture").unwrap();
        std::fs::write(&srt, b"subtitles").unwrap();
        sqlx::raw_sql("CREATE TABLE game(id TEXT,title TEXT);CREATE TABLE obs_session(id TEXT,workspace_id TEXT,observed_at TEXT,output_path TEXT,game_id TEXT,kind TEXT,ended_at TEXT);CREATE TABLE obs_marker(session_id TEXT);").execute(&a.env.pool).await.unwrap();
        sqlx::query(
            "INSERT INTO obs_session VALUES('r',?,'2026-11-16',?,NULL,'recording','2026-11-16')",
        )
        .bind(obs_store::WORKSPACE)
        .bind(path.display().to_string())
        .execute(&a.env.pool)
        .await
        .unwrap();
        social_alerts::save(&a, "subtitle:r", &json!({"srt":srt.display().to_string()}))
            .await
            .unwrap();
        let rows = subtitles::subtitles_recordings(a.clone(), Some(0))
            .await
            .unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0]["srt"], srt.display().to_string());
        assert_eq!(rows[0]["exists"], true);
        assert!(
            subtitles::subtitles_recordings(a.clone(), Some(30))
                .await
                .unwrap()
                .is_empty()
        );
        std::fs::remove_dir_all(&a.env.dir).unwrap();
    }
    #[cfg(unix)]
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn preview_and_export_recover_the_same_thirty_seconds_before_the_button() {
        use base64::Engine;
        use std::io::Write;
        use std::process::{Command, Stdio};
        if !std::path::Path::new("/usr/bin/ffmpeg").is_file() {
            return;
        }
        let _guard = MEDIA_TEST_LOCK.lock().unwrap();
        let a = app().await;
        let tools = a.env.dir.join("tools");
        std::fs::create_dir_all(&tools).unwrap();
        std::os::unix::fs::symlink("/usr/bin/ffmpeg", tools.join("ffmpeg.exe")).unwrap();
        std::os::unix::fs::symlink("/usr/bin/ffprobe", tools.join("ffprobe.exe")).unwrap();
        let input = a.env.dir.join("recording.mkv");
        let out = Command::new("ffmpeg")
            .args([
                "-v",
                "error",
                "-f",
                "lavfi",
                "-i",
                "color=c=red:s=160x90:r=1:d=80",
                "-vf",
                "drawbox=x=0:y=0:w=iw:h=ih:color=lime:t=fill:enable='between(t,40,69)'",
                "-c:v",
                "libx264",
                "-preset",
                "ultrafast",
            ])
            .arg(&input)
            .output()
            .unwrap();
        assert!(
            out.status.success(),
            "{}",
            String::from_utf8_lossy(&out.stderr)
        );
        sqlx::raw_sql("CREATE TABLE obs_session(id TEXT PRIMARY KEY,output_path TEXT);CREATE TABLE obs_marker(id TEXT PRIMARY KEY,workspace_id TEXT,session_id TEXT,title TEXT,record_ms INTEGER);CREATE TABLE clip_export(id TEXT,workspace_id TEXT,source_kind TEXT,source_id TEXT,title TEXT,format TEXT,path TEXT);").execute(&a.env.pool).await.unwrap();
        sqlx::query("INSERT INTO obs_session VALUES('session',?)")
            .bind(input.display().to_string())
            .execute(&a.env.pool)
            .await
            .unwrap();
        sqlx::query("INSERT INTO obs_marker VALUES('moment',?,'session','Jugada buena',70000)")
            .bind(obs_store::WORKSPACE)
            .execute(&a.env.pool)
            .await
            .unwrap();
        let plan = shorts::shorts_plan(a.clone(), "moment".into(), "moment".into(), None, None)
            .await
            .unwrap();
        assert_eq!(plan["start"], 40.);
        assert_eq!(plan["end"], 75.);
        let preview = shorts::shorts_preview(
            a.clone(),
            "moment".into(),
            "moment".into(),
            "original".into(),
            None,
            None,
        )
        .await
        .unwrap();
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(preview.split_once(',').unwrap().1)
            .unwrap();
        let mut child = Command::new("ffmpeg")
            .args([
                "-v",
                "error",
                "-i",
                "pipe:0",
                "-vf",
                "format=rgb24,crop=1:1:40:40",
                "-frames:v",
                "1",
                "-f",
                "rawvideo",
                "-",
            ])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .spawn()
            .unwrap();
        child.stdin.take().unwrap().write_all(&bytes).unwrap();
        let pixel = child.wait_with_output().unwrap().stdout;
        assert!(
            pixel[1] > 150 && pixel[0] < 100,
            "preview must show the green BEFORE section"
        );
        let result = shorts::shorts_render(
            a.clone(),
            "moment".into(),
            "moment".into(),
            "original".into(),
            None,
            None,
            Some(vec![]),
            None,
        )
        .await
        .unwrap();
        let path = result["path"].as_str().unwrap();
        let pixel = Command::new("ffmpeg")
            .args([
                "-v",
                "error",
                "-i",
                path,
                "-vf",
                "format=rgb24,crop=1:1:40:40",
                "-frames:v",
                "1",
                "-f",
                "rawvideo",
                "-",
            ])
            .output()
            .unwrap()
            .stdout;
        assert!(
            pixel[1] > 150 && pixel[0] < 100,
            "export must start at the same BEFORE section"
        );
        assert!(
            (shorts::probe_duration(&tools.join("ffmpeg.exe"), path).unwrap() - 35.).abs() < 0.2
        );
        std::fs::remove_dir_all(&a.env.dir).unwrap();
    }
    async fn setup(app: &tauri::AppHandle, after: u32) {
        auto_moments_configure(
            app.clone(),
            auto_moments_core::Config {
                before: 5,
                after,
                buffer_seconds: 20,
                buffer_confirmed: true,
                ..Default::default()
            },
        )
        .await
        .unwrap();
        auto_moments_control(app.clone(), "arm".into())
            .await
            .unwrap();
    }
    async fn settled(app: &tauri::AppHandle) -> Value {
        for _ in 0..100 {
            let s = auto_moments_status(app.clone()).await.unwrap();
            if s["activity"]["pending"].is_null() {
                return s;
            }
            tokio::time::sleep(std::time::Duration::from_millis(20)).await;
        }
        panic!("did not settle")
    }
    #[tokio::test]
    async fn capture_is_opt_in_and_metadata_survives_review() {
        let a = app().await;
        assert!(
            auto_moments_control(a.clone(), "capture".into())
                .await
                .is_err()
        );
        setup(&a, 0).await;
        auto_moments_control(a.clone(), "capture".into())
            .await
            .unwrap();
        let s = settled(&a).await;
        assert_eq!(s["items"].as_array().unwrap().len(), 1);
        assert!(s["bytes"].as_u64().is_some());
        assert_eq!(a.env.saves.load(Ordering::SeqCst), 1);
        let id = s["items"][0]["id"].as_str().unwrap().to_string();
        auto_moments_review(a.clone(), id.clone(), "discarded".into())
            .await
            .unwrap();
        let p = s["items"][0]["output_path"].as_str().unwrap();
        assert!(std::path::Path::new(p).is_file());
        auto_moments_review(a.clone(), id, "kept".into())
            .await
            .unwrap();
        assert!(
            auto_moments_control(a.clone(), "capture".into())
                .await
                .unwrap_err()
                .contains("90 segundos")
        );
    }
    #[tokio::test]
    async fn cancellation_and_disarm_prevent_delayed_save() {
        for action in ["cancel", "off"] {
            let a = app().await;
            setup(&a, 1).await;
            auto_moments_control(a.clone(), "capture".into())
                .await
                .unwrap();
            assert!(
                auto_moments_control(a.clone(), "capture".into())
                    .await
                    .is_err()
            );
            auto_moments_control(a.clone(), action.into())
                .await
                .unwrap();
            tokio::time::sleep(Duration::from_millis(1200)).await;
            assert_eq!(a.env.saves.load(Ordering::SeqCst), 0);
            assert!(
                auto_moments_status(a.clone()).await.unwrap()["items"]
                    .as_array()
                    .unwrap()
                    .is_empty()
            );
        }
    }
    #[tokio::test]
    async fn obs_failure_is_not_retried_or_reported_as_saved() {
        let a = app().await;
        setup(&a, 0).await;
        a.env.fail.store(true, Ordering::SeqCst);
        auto_moments_control(a.clone(), "capture".into())
            .await
            .unwrap();
        let s = settled(&a).await;
        assert!(s["items"].as_array().unwrap().is_empty());
        assert!(
            s["activity"]["message"]
                .as_str()
                .unwrap()
                .contains("No se confirmó")
        );
        tokio::time::sleep(Duration::from_millis(200)).await;
        assert_eq!(a.env.saves.load(Ordering::SeqCst), 1);
    }
    #[tokio::test]
    async fn cleanup_only_removes_discarded_missing_files() {
        let a = app().await;
        setup(&a, 0).await;
        auto_moments_control(a.clone(), "capture".into())
            .await
            .unwrap();
        let s = settled(&a).await;
        let id = s["items"][0]["id"].as_str().unwrap().to_string();
        auto_moments_review(a.clone(), id.clone(), "discarded".into())
            .await
            .unwrap();
        assert_eq!(auto_moments_cleanup(a.clone()).await.unwrap(), 0);
        std::fs::remove_file(s["items"][0]["output_path"].as_str().unwrap()).unwrap();
        assert_eq!(auto_moments_cleanup(a.clone()).await.unwrap(), 1);
        assert!(
            auto_moments_status(a).await.unwrap()["items"]
                .as_array()
                .unwrap()
                .is_empty()
        );
    }
    #[tokio::test]
    async fn pending_limit_and_config_lock_are_enforced() {
        let a = app().await;
        setup(&a, 0).await;
        assert!(
            auto_moments_configure(a.clone(), Default::default())
                .await
                .is_err()
        );
        for n in 0..20 {
            let c = Candidate {
                id: format!("pending{n}"),
                marker_id: None,
                output_path: "/missing".into(),
                source: "button".into(),
                reason: "fixture".into(),
                state: "pending".into(),
                created_ms: 1,
                tail_ms: 0,
                before: 5,
                after: 0,
            };
            social_alerts::save(&a, &format!("auto-moment:{}", c.id), &json!(c))
                .await
                .unwrap();
        }
        assert!(
            auto_moments_control(a.clone(), "capture".into())
                .await
                .unwrap_err()
                .contains("20 candidatos")
        );
    }
    #[tokio::test]
    async fn buffer_and_acknowledgement_are_required() {
        let a = app().await;
        assert!(auto_moments_control(a.clone(), "arm".into()).await.is_err());
        setup(&a, 0).await;
        auto_moments_control(a.clone(), "off".into()).await.unwrap();
        a.env.buffer.store(false, Ordering::SeqCst);
        assert!(auto_moments_control(a.clone(), "arm".into()).await.is_err());
    }
    #[tokio::test]
    async fn persisted_hourly_limit_survives_rearming() {
        let a = app().await;
        setup(&a, 0).await;
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;
        for n in 0..6 {
            let c = Candidate {
                id: format!("old{n}"),
                marker_id: None,
                output_path: "/nonexistent".into(),
                source: "voice".into(),
                reason: "fixture".into(),
                state: "discarded".into(),
                created_ms: stamp,
                tail_ms: 0,
                before: 5,
                after: 0,
            };
            social_alerts::save(&a, &format!("auto-moment:{}", c.id), &json!(c))
                .await
                .unwrap();
        }
        auto_moments_control(a.clone(), "off".into()).await.unwrap();
        auto_moments_control(a.clone(), "arm".into()).await.unwrap();
        assert!(
            auto_moments_control(a.clone(), "capture".into())
                .await
                .unwrap_err()
                .contains("seis")
        );
        assert_eq!(a.env.saves.load(Ordering::SeqCst), 0);
    }
    #[tokio::test]
    async fn saving_cannot_be_cancelled_or_lost_on_disarm() {
        let a = app().await;
        setup(&a, 0).await;
        a.env.block.store(true, Ordering::SeqCst);
        auto_moments_control(a.clone(), "capture".into())
            .await
            .unwrap();
        for _ in 0..100 {
            if a.env.saves.load(Ordering::SeqCst) > 0 {
                break;
            }
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
        let cancelled = auto_moments_control(a.clone(), "cancel".into()).await;
        auto_moments_control(a.clone(), "off".into()).await.unwrap();
        let mid = auto_moments_status(a.clone()).await.unwrap();
        a.env.block.store(false, Ordering::SeqCst);
        let done = settled(&a).await;
        assert!(cancelled.is_err());
        assert!(!mid["activity"]["pending"].is_null());
        assert_eq!(done["activity"]["armed"], false);
        assert_eq!(done["items"].as_array().unwrap().len(), 1);
    }
    #[tokio::test]
    async fn storage_budget_counts_discarded_files_that_still_exist() {
        let a = app().await;
        setup(&a, 0).await;
        let path = a.env.dir.join("large.mkv");
        let f = std::fs::File::create(&path).unwrap();
        f.set_len(2 * 1024 * 1024 * 1024).unwrap();
        drop(f);
        let c = Candidate {
            id: "large".into(),
            marker_id: None,
            output_path: path.to_string_lossy().to_string(),
            source: "button".into(),
            reason: "fixture".into(),
            state: "discarded".into(),
            created_ms: 1,
            tail_ms: 0,
            before: 5,
            after: 0,
        };
        social_alerts::save(&a, "auto-moment:large", &json!(c))
            .await
            .unwrap();
        let result = auto_moments_control(a.clone(), "capture".into()).await;
        std::fs::remove_file(path).unwrap();
        assert!(result.unwrap_err().contains("2 GB"));
        assert_eq!(a.env.saves.load(Ordering::SeqCst), 0);
    }
    #[test]
    fn ffmpeg_exports_real_vertical_clip_with_requested_duration() {
        let ffmpeg = std::path::Path::new("/usr/bin/ffmpeg");
        if !ffmpeg.is_file() {
            return;
        }
        let dir = std::env::temp_dir().join(format!("nexus-render-test-{}", rand::random::<u64>()));
        std::fs::create_dir_all(&dir).unwrap();
        let input = dir.join("in.mkv");
        let output = dir.join("out.mp4");
        assert!(
            std::process::Command::new(ffmpeg)
                .args([
                    "-v",
                    "error",
                    "-f",
                    "lavfi",
                    "-i",
                    "color=c=blue:s=640x360:r=2:d=6",
                    "-f",
                    "lavfi",
                    "-i",
                    "sine=frequency=440:sample_rate=22050:duration=6",
                    "-c:v",
                    "libx264",
                    "-preset",
                    "ultrafast",
                    "-c:a",
                    "aac",
                    "-shortest",
                    "-y"
                ])
                .arg(&input)
                .status()
                .unwrap()
                .success()
        );
        let (cut, warning) = auto_moments_core::clip_window(6.0, 2000, 2, 1).unwrap();
        assert!(warning.is_none());
        let args = shorts_core::args(
            input.to_str().unwrap(),
            output.to_str().unwrap(),
            Some(cut),
            shorts_core::Format::VerticalBlur,
        );
        assert!(
            std::process::Command::new(ffmpeg)
                .args(args)
                .output()
                .unwrap()
                .status
                .success()
        );
        let info = std::process::Command::new("/usr/bin/ffprobe")
            .args([
                "-v",
                "error",
                "-show_entries",
                "stream=codec_type,width,height:format=duration",
                "-of",
                "json",
            ])
            .arg(&output)
            .output()
            .unwrap();
        let value: Value = serde_json::from_slice(&info.stdout).unwrap();
        let video = value["streams"]
            .as_array()
            .unwrap()
            .iter()
            .find(|s| s["codec_type"] == "video")
            .unwrap();
        assert_eq!(video["width"], 1080);
        assert_eq!(video["height"], 1920);
        assert!(
            value["streams"]
                .as_array()
                .unwrap()
                .iter()
                .any(|s| s["codec_type"] == "audio")
        );
        assert!(
            (value["format"]["duration"]
                .as_str()
                .unwrap()
                .parse::<f64>()
                .unwrap()
                - 3.0)
                .abs()
                < 0.2
        );
        std::fs::remove_dir_all(dir).unwrap();
    }
    #[tokio::test]
    async fn restore_cancels_waiting_and_reloads_config_without_rearming() {
        let a = app().await;
        setup(&a, 1).await;
        auto_moments_control(a.clone(), "capture".into())
            .await
            .unwrap();
        let handle = a.clone();
        tokio::task::spawn_blocking(move || {
            with_capture_paused(&handle, || {
                tauri::async_runtime::block_on(social_alerts::save(
                    &handle,
                    "auto-moments-config",
                    &json!(auto_moments_core::Config {
                        phrase: "Nexus nuevo momento".into(),
                        ..Default::default()
                    }),
                ))
            })
        })
        .await
        .unwrap()
        .unwrap();
        tokio::time::sleep(Duration::from_millis(1200)).await;
        let s = auto_moments_status(a.clone()).await.unwrap();
        assert_eq!(s["config"]["phrase"], "Nexus nuevo momento");
        assert_eq!(s["activity"]["armed"], false);
        assert!(s["activity"]["pending"].is_null());
        assert_eq!(a.env.saves.load(Ordering::SeqCst), 0);
    }
}
