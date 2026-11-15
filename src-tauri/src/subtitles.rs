//! Subtítulos y capítulos (D-034). La transcripción es local con whisper.cpp: el audio nunca sale
//! del PC. El programa y el modelo se descargan una vez, cuando el usuario lo pide, desde fuentes
//! fijas y se comprueba su SHA-256 antes de usarlos.
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use sqlx::Row;
use tauri::{AppHandle, Emitter, Manager};

use crate::obs_store::WORKSPACE;
use crate::shorts::{find_ffmpeg, hidden, probe_duration};
use crate::subtitles_core as core;

const WHISPER_ZIP: &str = "https://github.com/ggml-org/whisper.cpp/releases/download/v1.9.2/whisper-bin-x64.zip";
const WHISPER_SHA: &str = "49dcc16de826f20bd53d44f947a1ae49dfa81f86cad67a64d80820cb192d674a";
const MODEL_URL: &str = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin";
const MODEL_SHA: &str = "1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b";
const MODEL_FILE: &str = "ggml-small.bin";

fn tools(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().app_local_data_dir().map_err(|e| e.to_string())?.join("tools").join("whisper"))
}

fn installed(dir: &Path) -> (bool, bool) {
    (dir.join("whisper-cli.exe").is_file(), dir.join(MODEL_FILE).is_file())
}

#[tauri::command]
pub async fn subtitles_status(app: AppHandle) -> Result<Value, String> {
    let dir = tools(&app)?;
    let (whisper, model) = installed(&dir);
    let handle = app.clone();
    let ffmpeg = tauri::async_runtime::spawn_blocking(move || find_ffmpeg(&handle)).await.map_err(|e| e.to_string())?;
    Ok(json!({"whisper": whisper, "model": model, "ffmpeg": ffmpeg.is_some()}))
}

/// Descarga a un archivo `.part` comprobando la huella; solo si coincide se renombra al destino.
async fn download(app: &AppHandle, url: &str, sha: &str, target: &Path, stage: &str) -> Result<(), String> {
    let part = target.with_extension("part");
    let mut response = reqwest::Client::new()
        .get(url)
        .send()
        .await
        .map_err(|e| format!("No se pudo descargar: {e}"))?
        .error_for_status()
        .map_err(|e| format!("La descarga falló: {e}"))?;
    let total = response.content_length().unwrap_or(0);
    let mut file = std::fs::File::create(&part).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    let (mut done, mut last) = (0u64, 0u64);
    while let Some(chunk) = response.chunk().await.map_err(|e| format!("La descarga se cortó: {e}"))? {
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        hasher.update(&chunk);
        done += chunk.len() as u64;
        if done - last > 2_000_000 || done == total {
            last = done;
            let _ = app.emit("subtitles-install", json!({"stage": stage, "done": done, "total": total}));
        }
    }
    drop(file);
    if format!("{:x}", hasher.finalize()) != sha {
        let _ = std::fs::remove_file(&part);
        return Err("El archivo descargado no coincide con la huella esperada; se ha borrado por seguridad.".into());
    }
    std::fs::rename(&part, target).map_err(|e| e.to_string())
}

/// Instala whisper.cpp (8 MB) y el modelo small (488 MB) en las herramientas de Nexus.
#[tauri::command]
pub async fn subtitles_install(app: AppHandle) -> Result<(), String> {
    let dir = tools(&app)?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let (whisper, model) = installed(&dir);
    if !whisper {
        let zip = dir.join("whisper-bin-x64.zip");
        download(&app, WHISPER_ZIP, WHISPER_SHA, &zip, "programa").await?;
        let unpack = dir.join("unpack");
        let _ = std::fs::remove_dir_all(&unpack);
        std::fs::create_dir_all(&unpack).map_err(|e| e.to_string())?;
        // tar.exe viene con Windows 10/11 y sabe abrir zip: no hace falta otra dependencia.
        let status = hidden(Command::new("tar").arg("-xf").arg(&zip).arg("-C").arg(&unpack))
            .status()
            .map_err(|e| format!("No se pudo descomprimir: {e}"))?;
        if !status.success() {
            return Err("No se pudo descomprimir whisper.cpp.".into());
        }
        let release = unpack.join("Release");
        for entry in std::fs::read_dir(&release).map_err(|e| e.to_string())?.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name == "whisper-cli.exe" || name == "whisper.dll" || (name.starts_with("ggml") && name.ends_with(".dll")) {
                std::fs::copy(entry.path(), dir.join(&name)).map_err(|e| e.to_string())?;
            }
        }
        let _ = std::fs::remove_dir_all(&unpack);
        let _ = std::fs::remove_file(&zip);
        if !dir.join("whisper-cli.exe").is_file() {
            return Err("El paquete de whisper.cpp no traía whisper-cli.exe.".into());
        }
    }
    if !model {
        download(&app, MODEL_URL, MODEL_SHA, &dir.join(MODEL_FILE), "modelo").await?;
    }
    Ok(())
}

/// Grabaciones de OBS con archivo, de la más reciente a la más antigua, con sus marcas.
#[tauri::command]
pub async fn subtitles_recordings(app: AppHandle) -> Result<Vec<Value>, String> {
    let pool = crate::backup::pool(&app).await?;
    let rows = sqlx::query(
        "SELECT s.id, s.observed_at, s.output_path, g.title AS game,
                (SELECT COUNT(*) FROM obs_marker m WHERE m.session_id = s.id) AS marks
           FROM obs_session s LEFT JOIN game g ON g.id = s.game_id
          WHERE s.workspace_id = $1 AND s.kind = 'recording' AND s.output_path IS NOT NULL AND s.ended_at IS NOT NULL
          ORDER BY s.observed_at DESC LIMIT 30",
    )
    .bind(WORKSPACE)
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(rows
        .iter()
        .map(|r| {
            let path: String = r.get("output_path");
            let srt = format!("{}.srt", core::base_path(&path));
            json!({
                "id": r.get::<String, _>("id"),
                "observed_at": r.get::<String, _>("observed_at"),
                "path": path,
                "exists": Path::new(&path).is_file(),
                "game": r.get::<Option<String>, _>("game"),
                "marks": r.get::<i64, _>("marks"),
                "srt": Path::new(&srt).is_file().then_some(srt),
            })
        })
        .collect())
}

async fn session_video(app: &AppHandle, session_id: &str) -> Result<(String, Vec<(i64, String)>), String> {
    let pool = crate::backup::pool(app).await?;
    let path: Option<String> = sqlx::query_scalar("SELECT output_path FROM obs_session WHERE id = $1 AND workspace_id = $2 AND kind = 'recording'")
        .bind(session_id)
        .bind(WORKSPACE)
        .fetch_optional(&pool)
        .await
        .map_err(|e| e.to_string())?
        .flatten();
    let path = path.ok_or("Esta grabación no tiene archivo guardado por OBS.")?;
    let marks = sqlx::query("SELECT record_ms, title FROM obs_marker WHERE session_id = $1 AND record_ms IS NOT NULL ORDER BY record_ms")
        .bind(session_id)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?
        .iter()
        .map(|r| (r.get::<i64, _>("record_ms"), r.get::<String, _>("title")))
        .collect();
    Ok((path, marks))
}

/// Capítulos para la descripción a partir de las marcas de la grabación. No necesita Whisper.
#[tauri::command]
pub async fn subtitles_chapters(app: AppHandle, session_id: String) -> Result<Value, String> {
    let (path, marks) = session_video(&app, &session_id).await?;
    let handle = app.clone();
    let file = path.clone();
    // La duración solo afina el último capítulo; sin ffprobe se calcula igualmente.
    let duration = tauri::async_runtime::spawn_blocking(move || find_ffmpeg(&handle).and_then(|f| probe_duration(&f, &file).ok()))
        .await
        .map_err(|e| e.to_string())?
        .map(|s| (s * 1000.0) as i64);
    let (text, warning) = core::chapters(&marks, duration);
    Ok(json!({"text": text, "warning": warning}))
}

/// Transcribe la grabación y guarda `<vídeo>.srt` junto al vídeo (sin sobrescribir uno existente).
#[tauri::command]
pub async fn subtitles_generate(app: AppHandle, session_id: String) -> Result<Value, String> {
    let (video, _) = session_video(&app, &session_id).await?;
    if !Path::new(&video).is_file() {
        return Err(format!("No se encuentra el vídeo: {video}"));
    }
    let dir = tools(&app)?;
    if installed(&dir) != (true, true) {
        return Err("Falta instalar la transcripción (botón de este panel).".into());
    }
    let handle = app.clone();
    let ffmpeg = tauri::async_runtime::spawn_blocking(move || find_ffmpeg(&handle))
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Falta ffmpeg. Instálalo desde el panel de Shorts.")?;
    let base = core::base_path(&video);
    let out_base = if Path::new(&format!("{base}.srt")).exists() { format!("{base} (Nexus)") } else { base };
    let temp = app.path().app_local_data_dir().map_err(|e| e.to_string())?.join("tmp");
    std::fs::create_dir_all(&temp).map_err(|e| e.to_string())?;
    let wav = temp.join(format!("{session_id}.wav"));
    let wav_text = wav.display().to_string();
    let threads = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4).min(8);
    let emitter = app.clone();
    let id = session_id.clone();
    let srt_base = out_base.clone();
    let result = tauri::async_runtime::spawn_blocking(move || -> Result<(), String> {
        let audio = hidden(Command::new(&ffmpeg).args(core::audio_args(&video, &wav_text)))
            .output()
            .map_err(|e| format!("No se pudo ejecutar ffmpeg: {e}"))?;
        if !audio.status.success() {
            return Err("ffmpeg no pudo extraer el audio de la grabación.".into());
        }
        let mut child = hidden(
            Command::new(dir.join("whisper-cli.exe"))
                .args(core::whisper_args(&dir.join(MODEL_FILE).display().to_string(), &wav_text, &srt_base, threads))
                .current_dir(&dir)
                .stdout(Stdio::null())
                .stderr(Stdio::piped()),
        )
        .spawn()
        .map_err(|e| format!("No se pudo ejecutar Whisper: {e}"))?;
        if let Some(err) = child.stderr.take() {
            for line in BufReader::new(err).lines().map_while(Result::ok) {
                if let Some(p) = core::parse_progress(&line) {
                    let _ = emitter.emit("subtitles-progress", json!({"session_id": id, "percent": p}));
                }
            }
        }
        let status = child.wait().map_err(|e| e.to_string())?;
        if !status.success() {
            return Err("Whisper no pudo transcribir la grabación.".into());
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?;
    let _ = std::fs::remove_file(&wav);
    result?;
    let srt = format!("{out_base}.srt");
    if !Path::new(&srt).is_file() {
        return Err("Whisper terminó pero no se encontró el archivo de subtítulos.".into());
    }
    Ok(json!({"srt": srt}))
}
