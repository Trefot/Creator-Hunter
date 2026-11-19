//! Episodio para YouTube (D-036): recorta una grabación completa, deja fuera el audio con
//! música y prepara la descripción con capítulos. Nunca sube nada: el usuario lo arrastra a YouTube Studio.

use std::path::Path;
use std::process::Command;

use serde_json::{Value, json};
use tauri::{AppHandle, Manager};

use crate::episode_core as core;
use crate::shorts::{find_ffmpeg, hidden, probe, probe_duration, tracks};

fn duration_of(value: &Value) -> Result<f64, String> {
    value["format"]["duration"]
        .as_str()
        .and_then(|s| s.parse::<f64>().ok())
        .filter(|n| n.is_finite() && *n > 0.)
        .ok_or("No se pudo leer la duración de la grabación.".into())
}

/// Imagen de un instante de la grabación para elegir dónde empieza y acaba el episodio.
#[tauri::command]
pub async fn episode_frame(app: AppHandle, session_id: String, at: f64) -> Result<String, String> {
    use base64::Engine;
    let (input, _) = crate::subtitles::session_video(&app, &session_id).await?;
    tauri::async_runtime::spawn_blocking(move || {
        let f = find_ffmpeg(&app).ok_or("Falta ffmpeg. Instálalo desde Shorts.")?;
        let duration = probe_duration(&f, &input)?;
        let at = at.clamp(0., (duration - 0.5).max(0.));
        let out = hidden(Command::new(f).args([
            "-hide_banner", "-loglevel", "error", "-ss", &format!("{at:.3}"), "-i", &input,
            "-frames:v", "1", "-vf", "scale=480:-2", "-vcodec", "mjpeg", "-f", "image2pipe", "pipe:1",
        ]))
        .output()
        .map_err(|e| e.to_string())?;
        if !out.status.success() || out.stdout.is_empty() {
            return Err("No se pudo ver ese momento del vídeo.".into());
        }
        Ok(format!("data:image/jpeg;base64,{}", base64::engine::general_purpose::STANDARD.encode(out.stdout)))
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Último episodio creado de esta grabación, si su archivo sigue existiendo.
#[tauri::command]
pub async fn episode_saved(app: AppHandle, session_id: String) -> Result<Option<Value>, String> {
    let pool = crate::backup::pool(&app).await?;
    let raw: Option<String> = sqlx::query_scalar("SELECT content FROM alert_cursor WHERE id = $1")
        .bind(format!("episode:{session_id}"))
        .fetch_optional(&pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(raw
        .and_then(|s| serde_json::from_str::<Value>(&s).ok())
        .filter(|v| v["path"].as_str().is_some_and(|p| Path::new(p).is_file())))
}

/// Crea el episodio en Vídeos\Nexus Episodios con su descripción en un .txt al lado.
#[tauri::command]
pub async fn episode_render(
    app: AppHandle,
    session_id: String,
    title: String,
    start: f64,
    end: f64,
    audio: Option<Vec<usize>>,
) -> Result<Value, String> {
    let title = title.trim().to_string();
    if title.is_empty() {
        return Err("Escribe el título del episodio.".into());
    }
    let ticket = crate::media_jobs::Ticket::enqueue("Crear episodio")?;
    ticket.request("episode_render", json!({"sessionId":session_id,"title":title,"start":start,"end":end,"audio":audio}));
    let handle = app.clone();
    let ticket = tauri::async_runtime::spawn_blocking(move || ticket.wait(&handle))
        .await
        .map_err(|e| e.to_string())??;
    ticket.title(&format!("Episodio · {title}"));
    let (input, marks) = crate::subtitles::session_video(&app, &session_id).await?;
    if !Path::new(&input).is_file() {
        return Err(format!("No se encuentra la grabación: {input}"));
    }
    let handle = app.clone();
    let file = input.clone();
    let (ffmpeg, metadata) = tauri::async_runtime::spawn_blocking(move || {
        let f = find_ffmpeg(&handle).ok_or("Falta ffmpeg. Instálalo desde Shorts.")?;
        let m = probe(&f, &file)?;
        Ok::<_, String>((f, m))
    })
    .await
    .map_err(|e| e.to_string())??;
    let (start, end) = core::validate(start, end, duration_of(&metadata)?)?;
    let audio = tracks(&metadata, audio)?;

    let dir = app.path().video_dir().map_err(|e| e.to_string())?.join("Nexus Episodios");
    std::fs::create_dir_all(&dir).map_err(|e| format!("No se pudo crear la carpeta de episodios: {e}"))?;
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let output = dir.join(format!("{} {stamp}.mp4", crate::shorts_core::file_stem(&title)));
    if output.exists() {
        return Err("Ya existe un episodio con ese nombre. Espera un segundo y vuelve a intentarlo.".into());
    }
    let arguments = core::args(&input, &output.display().to_string(), start, end - start, &audio)?;
    let length = end - start;
    let (mut ticket, result) = tauri::async_runtime::spawn_blocking(move || {
        let r = ticket.run(Command::new(&ffmpeg).args(&arguments), Some(length));
        (ticket, r)
    })
    .await
    .map_err(|e| e.to_string())?;
    let failure = match &result {
        Err(e) => Some(e.clone()),
        Ok(out) if !out.status.success() || !output.is_file() => {
            let err = String::from_utf8_lossy(&out.stderr);
            let tail: Vec<&str> = err.lines().rev().take(3).collect();
            Some(format!("ffmpeg no pudo crear el episodio. {}", tail.into_iter().rev().collect::<Vec<_>>().join(" · ")))
        }
        _ => None,
    };
    if let Some(error) = failure {
        let _ = std::fs::remove_file(&output);
        ticket.finish(Err(&error));
        return Err(error);
    }
    ticket.commit()?;

    let shifted = core::shifted_marks(&marks, start, end);
    let (chapters, warning) = crate::subtitles_core::chapters(&shifted, Some((length * 1000.) as i64));
    let description = core::description(&title, &chapters, warning.is_none());
    let path = output.display().to_string();
    let txt = format!("{}.txt", crate::subtitles_core::base_path(&path));
    let _ = std::fs::write(&txt, &description);
    let saved = json!({"path":path,"title":title,"start":start,"end":end,"description":description,"warning":warning});
    let pool = crate::backup::pool(&app).await?;
    sqlx::query("INSERT INTO alert_cursor(id,content) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET content=excluded.content")
        .bind(format!("episode:{session_id}"))
        .bind(saved.to_string())
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    ticket.finish(Ok(&path));
    Ok(saved)
}
