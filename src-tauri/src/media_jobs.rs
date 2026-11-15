//! Cola global de procesamiento local. Un proceso pesado a la vez; cancelar mata y recoge al hijo.
use serde::Serialize;
use serde_json::{Value, json};
use std::{
    collections::VecDeque,
    io::{BufRead, BufReader, Read},
    process::{Command, Output, Stdio},
    sync::{
        Mutex, OnceLock,
        atomic::{AtomicBool, AtomicU64, Ordering},
    },
    time::Duration,
};
use tauri::{AppHandle, Manager};

#[derive(Clone, Serialize)]
pub struct Job {
    pub id: u64,
    pub title: String,
    pub state: String,
    pub progress: u8,
    pub result: Option<String>,
    pub error: Option<String>,
}
struct Data {
    jobs: VecDeque<Job>,
    active: Option<u64>,
    paused: bool,
}
struct Queue {
    data: Mutex<Data>,
    light: AtomicBool,
    serial: AtomicU64,
}
fn queue() -> &'static Queue {
    static Q: OnceLock<Queue> = OnceLock::new();
    Q.get_or_init(|| Queue {
        data: Mutex::new(Data {
            jobs: VecDeque::new(),
            active: None,
            paused: false,
        }),
        light: AtomicBool::new(true),
        serial: AtomicU64::new(1),
    })
}

pub struct Ticket {
    pub id: u64,
    complete: bool,
}
impl Ticket {
    pub fn enqueue(title: &str) -> Result<Self, String> {
        let q = queue();
        let mut d = q.data.lock().unwrap();
        if d.paused {
            return Err(
                "Hay una restauración de datos en curso. Espera antes de añadir trabajos.".into(),
            );
        }
        if d.jobs
            .iter()
            .filter(|j| j.state == "queued" || j.state == "running" || j.state == "finishing")
            .count()
            >= 20
        {
            return Err("La cola está llena (20 trabajos). Espera o cancela alguno.".into());
        }
        while d.jobs.len() >= 60 {
            if let Some(pos) = d
                .jobs
                .iter()
                .position(|j| matches!(j.state.as_str(), "done" | "error" | "cancelled"))
            {
                d.jobs.remove(pos);
            } else {
                break;
            }
        }
        let id = q.serial.fetch_add(1, Ordering::SeqCst);
        d.jobs.push_back(Job {
            id,
            title: title.chars().take(180).collect(),
            state: "queued".into(),
            progress: 0,
            result: None,
            error: None,
        });
        Ok(Self {
            id,
            complete: false,
        })
    }
    pub fn cancelled(&self) -> bool {
        queue()
            .data
            .lock()
            .unwrap()
            .jobs
            .iter()
            .find(|j| j.id == self.id)
            .is_none_or(|j| j.state == "cancelled")
    }
    pub fn check(&self) -> Result<(), String> {
        if self.cancelled() {
            Err("Trabajo cancelado.".into())
        } else {
            Ok(())
        }
    }
    pub fn wait(self, app: &AppHandle) -> Result<Self, String> {
        loop {
            self.check()?;
            let busy = crate::obs::media_busy(app);
            let q = queue();
            let mut d = q.data.lock().unwrap();
            if !(q.light.load(Ordering::SeqCst) && busy)
                && d.active.is_none()
                && d.jobs
                    .iter()
                    .find(|j| j.state == "queued")
                    .is_some_and(|j| j.id == self.id)
            {
                d.active = Some(self.id);
                if let Some(j) = d.jobs.iter_mut().find(|j| j.id == self.id) {
                    j.state = "running".into();
                }
                return Ok(self);
            }
            drop(d);
            std::thread::sleep(Duration::from_millis(200));
        }
    }
    pub fn commit(&self) -> Result<(), String> {
        let mut d = queue().data.lock().unwrap();
        let j = d
            .jobs
            .iter_mut()
            .find(|j| j.id == self.id)
            .ok_or("Trabajo no encontrado")?;
        if j.state == "cancelled" {
            return Err("Trabajo cancelado.".into());
        }
        j.state = "finishing".into();
        Ok(())
    }
    pub fn title(&self, title: &str) {
        if let Some(j) = queue()
            .data
            .lock()
            .unwrap()
            .jobs
            .iter_mut()
            .find(|j| j.id == self.id)
        {
            j.title = title.chars().take(180).collect();
        }
    }
    pub fn progress(&self, p: u8) {
        if let Some(j) = queue()
            .data
            .lock()
            .unwrap()
            .jobs
            .iter_mut()
            .find(|j| j.id == self.id)
        {
            j.progress = p.min(99);
        }
    }
    pub fn finish(&mut self, result: Result<&str, &str>) {
        let mut d = queue().data.lock().unwrap();
        if let Some(j) = d.jobs.iter_mut().find(|j| j.id == self.id) {
            if j.state != "cancelled" {
                match result {
                    Ok(path) => {
                        j.state = "done".into();
                        j.progress = 100;
                        j.result = Some(path.into());
                    }
                    Err(e) => {
                        j.state = "error".into();
                        j.error = Some(e.chars().take(1000).collect());
                    }
                }
            }
        }
        if d.active == Some(self.id) {
            d.active = None;
        }
        self.complete = true;
    }
    pub fn run(&self, command: &mut Command, duration: Option<f64>) -> Result<Output, String> {
        self.check()?;
        let mut child = crate::shorts::hidden(command)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("No se pudo ejecutar la herramienta: {e}"))?;
        let id = self.id;
        fn reader<T: Read + Send + 'static>(
            pipe: T,
            id: u64,
            duration: Option<f64>,
        ) -> std::thread::JoinHandle<Vec<u8>> {
            std::thread::spawn(move || {
                let mut tail = Vec::new();
                for line in BufReader::new(pipe).split(b'\n').map_while(Result::ok) {
                    let text = String::from_utf8_lossy(&line);
                    let p = crate::subtitles_core::parse_progress(&text).or_else(|| {
                        text.strip_prefix("out_time_us=")
                            .and_then(|s| s.trim().parse::<f64>().ok())
                            .zip(duration)
                            .map(|(us, s)| {
                                (us / 1_000_000.0 / s.max(0.001) * 100.0).clamp(0., 99.) as u8
                            })
                    });
                    if let Some(p) = p {
                        if let Some(j) = queue()
                            .data
                            .lock()
                            .unwrap()
                            .jobs
                            .iter_mut()
                            .find(|j| j.id == id)
                        {
                            j.progress = p.min(99);
                        }
                    }
                    tail.extend_from_slice(&line);
                    tail.push(b'\n');
                    if tail.len() > 64_000 {
                        tail.drain(..tail.len() - 64_000);
                    }
                }
                tail
            })
        }
        let stdout = reader(child.stdout.take().unwrap(), id, duration);
        let stderr = reader(child.stderr.take().unwrap(), id, duration);
        let status = loop {
            if self.cancelled() {
                let _ = child.kill();
                let _ = child.wait();
                let _ = stdout.join();
                let _ = stderr.join();
                return Err("Trabajo cancelado.".into());
            }
            match child.try_wait() {
                Ok(Some(status)) => break status,
                Ok(None) => std::thread::sleep(Duration::from_millis(100)),
                Err(e) => {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(e.to_string());
                }
            }
        };
        Ok(Output {
            status,
            stdout: stdout.join().unwrap_or_default(),
            stderr: stderr.join().unwrap_or_default(),
        })
    }
}
impl Drop for Ticket {
    fn drop(&mut self) {
        if !self.complete {
            self.finish(Err("El trabajo no pudo terminar."));
        }
    }
}
pub fn threads() -> usize {
    if queue().light.load(Ordering::SeqCst) {
        2
    } else {
        std::thread::available_parallelism()
            .map(|n| n.get())
            .unwrap_or(4)
            .clamp(1, 8)
    }
}
pub fn shutdown() {
    let mut d = queue().data.lock().unwrap();
    for j in &mut d.jobs {
        if j.state == "queued" || j.state == "running" {
            j.state = "cancelled".into();
        }
    }
}
#[tauri::command]
pub fn media_jobs_status(app: AppHandle) -> Value {
    let d = queue().data.lock().unwrap();
    json!({"jobs":d.jobs,"light":queue().light.load(Ordering::SeqCst),"obs_busy":crate::obs::media_busy(&app)})
}
#[tauri::command]
pub fn media_jobs_cancel(id: u64) -> Result<(), String> {
    let mut d = queue().data.lock().unwrap();
    let j = d
        .jobs
        .iter_mut()
        .find(|j| j.id == id)
        .ok_or("Trabajo no encontrado")?;
    if j.state == "queued" || j.state == "running" {
        j.state = "cancelled".into();
    }
    Ok(())
}
#[tauri::command]
pub fn media_jobs_light(app: AppHandle, enabled: bool) -> Result<(), String> {
    let path = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join("media-light.json");
    std::fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;
    std::fs::write(path, if enabled { "true" } else { "false" }).map_err(|e| e.to_string())?;
    queue().light.store(enabled, Ordering::SeqCst);
    Ok(())
}
pub fn init(app: &AppHandle) {
    if let Ok(dir) = app.path().app_local_data_dir() {
        if let Ok(v) = std::fs::read_to_string(dir.join("media-light.json")) {
            queue().light.store(v.trim() != "false", Ordering::SeqCst);
        }
    }
}

pub struct RestorePause;
impl Drop for RestorePause {
    fn drop(&mut self) {
        queue().data.lock().unwrap().paused = false;
    }
}
pub fn pause_for_restore() -> Result<RestorePause, String> {
    let mut d = queue().data.lock().unwrap();
    if d.paused || d.active.is_some() || d.jobs.iter().any(|j| j.state == "queued") {
        return Err(
            "Espera o cancela los trabajos de vídeo y subtítulos antes de restaurar una copia."
                .into(),
        );
    }
    d.paused = true;
    Ok(RestorePause)
}

static NVENC_READY: AtomicBool = AtomicBool::new(false);
pub fn gpu_available() -> bool {
    NVENC_READY.load(Ordering::SeqCst)
}
/// Ejecuta una prueba corta del codificador y el controlador reales; no basta con listar encoders.
#[tauri::command]
pub async fn media_gpu_test(app: AppHandle) -> Result<Value, String> {
    let ticket = Ticket::enqueue("Comprobar aceleración de vídeo")?;
    let handle = app.clone();
    let mut ticket = tauri::async_runtime::spawn_blocking(move || ticket.wait(&handle))
        .await
        .map_err(|e| e.to_string())??;
    let ffmpeg =
        crate::shorts::find_ffmpeg(&app).ok_or("Instala ffmpeg antes de probar la GPU.")?;
    tauri::async_runtime::spawn_blocking(move || {
        let result = ticket.run(
            Command::new(ffmpeg).args([
                "-hide_banner",
                "-loglevel",
                "error",
                "-f",
                "lavfi",
                "-i",
                "color=size=1280x720:rate=30:duration=1",
                "-frames:v",
                "10",
                "-c:v",
                "h264_nvenc",
                "-f",
                "null",
                "-",
            ]),
            None,
        );
        match result {
            Ok(out) => {
                let available = out.status.success();
                NVENC_READY.store(available, Ordering::SeqCst);
                let detail = if available {
                    "Prueba NVENC correcta. Puedes elegir GPU al exportar Shorts.".to_string()
                } else {
                    format!(
                        "NVENC no está disponible: {}. Puedes continuar con CPU.",
                        String::from_utf8_lossy(&out.stderr)
                            .chars()
                            .take(500)
                            .collect::<String>()
                    )
                };
                ticket.finish(Ok(""));
                Ok(json!({"available":available,"detail":detail}))
            }
            Err(e) => {
                ticket.finish(Err(&e));
                Err(e)
            }
        }
    })
    .await
    .map_err(|e| e.to_string())?
}
