//! Subtítulos y capítulos (D-034). La transcripción es local con whisper.cpp: el audio nunca sale
//! del PC. El programa y el modelo se descargan una vez, cuando el usuario lo pide, desde fuentes
//! fijas y se comprueba su SHA-256 antes de usarlos.
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use sqlx::Row;
use tauri::{AppHandle, Emitter, Manager};

use crate::obs_store::WORKSPACE;
use crate::shorts::{find_ffmpeg, hidden, probe_duration};
use crate::subtitles_core as core;

const WHISPER_ZIP: &str =
    "https://github.com/ggml-org/whisper.cpp/releases/download/v1.9.2/whisper-bin-x64.zip";
const WHISPER_SHA: &str = "49dcc16de826f20bd53d44f947a1ae49dfa81f86cad67a64d80820cb192d674a";
const MODEL_URL: &str = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin";
const MODEL_SHA: &str = "1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b";
const MODEL_FILE: &str = "ggml-small.bin";

fn tools(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join("tools")
        .join("whisper"))
}

fn installed(dir: &Path) -> (bool, bool) {
    (
        dir.join("whisper-cli.exe").is_file(),
        dir.join(MODEL_FILE).is_file(),
    )
}

#[tauri::command]
pub async fn subtitles_status(app: AppHandle) -> Result<Value, String> {
    let dir = tools(&app)?;
    let (whisper, model) = installed(&dir);
    let handle = app.clone();
    let ffmpeg = tauri::async_runtime::spawn_blocking(move || find_ffmpeg(&handle))
        .await
        .map_err(|e| e.to_string())?;
    Ok(json!({"whisper": whisper, "model": model, "ffmpeg": ffmpeg.is_some()}))
}

/// Descarga a un archivo `.part` comprobando la huella; solo si coincide se renombra al destino.
async fn download(
    app: &AppHandle,
    url: &str,
    sha: &str,
    target: &Path,
    stage: &str,
) -> Result<(), String> {
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
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|e| format!("La descarga se cortó: {e}"))?
    {
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        hasher.update(&chunk);
        done += chunk.len() as u64;
        if done - last > 2_000_000 || done == total {
            last = done;
            let _ = app.emit(
                "subtitles-install",
                json!({"stage": stage, "done": done, "total": total}),
            );
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
    static INSTALL: std::sync::OnceLock<tauri::async_runtime::Mutex<()>> =
        std::sync::OnceLock::new();
    let _guard = INSTALL
        .get_or_init(|| tauri::async_runtime::Mutex::new(()))
        .lock()
        .await;
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
        let status = hidden(
            Command::new("tar")
                .arg("-xf")
                .arg(&zip)
                .arg("-C")
                .arg(&unpack),
        )
        .status()
        .map_err(|e| format!("No se pudo descomprimir: {e}"))?;
        if !status.success() {
            return Err("No se pudo descomprimir whisper.cpp.".into());
        }
        let release = unpack.join("Release");
        for entry in std::fs::read_dir(&release)
            .map_err(|e| e.to_string())?
            .flatten()
        {
            let name = entry.file_name().to_string_lossy().to_string();
            if name == "whisper-cli.exe"
                || name == "whisper.dll"
                || (name.starts_with("ggml") && name.ends_with(".dll"))
            {
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
pub async fn subtitles_recordings(
    app: AppHandle,
    offset: Option<i64>,
) -> Result<Vec<Value>, String> {
    let pool = crate::backup::pool(&app).await?;
    let rows = sqlx::query(
        "SELECT s.id, s.observed_at, s.output_path, g.title AS game, c.content AS subtitle_result,
                (SELECT COUNT(*) FROM obs_marker m WHERE m.session_id = s.id) AS marks
           FROM obs_session s LEFT JOIN game g ON g.id = s.game_id LEFT JOIN alert_cursor c ON c.id = 'subtitle:' || s.id
          WHERE s.workspace_id = $1 AND s.kind = 'recording' AND s.output_path IS NOT NULL AND s.ended_at IS NOT NULL
          ORDER BY s.observed_at DESC LIMIT 30 OFFSET $2",
    )
    .bind(WORKSPACE)
    .bind(offset.unwrap_or(0).clamp(0,100000))
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(rows
        .iter()
        .map(|r| {
            let path: String = r.get("output_path");
            let saved: Option<String> = r.get("subtitle_result");
            let srt = saved
                .and_then(|s| serde_json::from_str::<Value>(&s).ok())
                .and_then(|v| v["srt"].as_str().map(str::to_owned))
                .filter(|p| Path::new(p).is_file())
                .unwrap_or_else(|| format!("{}.srt", core::base_path(&path)));
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

pub(crate) async fn session_video(
    app: &AppHandle,
    session_id: &str,
) -> Result<(String, Vec<(i64, String)>), String> {
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
    let duration = tauri::async_runtime::spawn_blocking(move || {
        find_ffmpeg(&handle).and_then(|f| probe_duration(&f, &file).ok())
    })
    .await
    .map_err(|e| e.to_string())?
    .map(|s| (s * 1000.0) as i64);
    let (text, warning) = core::chapters(&marks, duration);
    Ok(json!({"text": text, "warning": warning}))
}

/// Importa una grabación existente sin moverla ni modificarla.
#[tauri::command]
pub async fn subtitles_import(app: AppHandle, path: String) -> Result<String, String> {
    let input = PathBuf::from(path.trim().trim_matches('"'));
    if !input.is_file() {
        return Err(
            "No se encuentra ese archivo. Copia su ruta completa desde el Explorador.".into(),
        );
    }
    let ext = input
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if !["mkv", "mp4", "mov", "webm", "avi", "flv", "ts", "m4v"].contains(&ext.as_str()) {
        return Err("Elige un archivo de vídeo compatible.".into());
    }
    let input = input
        .canonicalize()
        .map_err(|e| e.to_string())?
        .display()
        .to_string();
    let handle = app.clone();
    let file = input.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let f = find_ffmpeg(&handle).ok_or("Instala ffmpeg antes de importar.")?;
        let v = crate::shorts::probe(&f, &file)?;
        if !v["streams"]
            .as_array()
            .is_some_and(|a| a.iter().any(|s| s["codec_type"] == "video"))
        {
            return Err("El archivo no contiene vídeo.".to_string());
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())??;
    let pool = crate::backup::pool(&app).await?;
    if let Some(id) = sqlx::query_scalar::<_, String>(
        "SELECT id FROM obs_session WHERE workspace_id=$1 AND output_path=$2 AND kind='recording'",
    )
    .bind(WORKSPACE)
    .bind(&input)
    .fetch_optional(&pool)
    .await
    .map_err(|e| e.to_string())?
    {
        return Ok(id);
    }
    let id = format!("{:032x}", rand::random::<u128>());
    sqlx::query("INSERT INTO obs_session(id,workspace_id,kind,output_path,ended_at,end_reason) VALUES($1,$2,'recording',$3,strftime('%Y-%m-%dT%H:%M:%fZ','now'),'imported')").bind(&id).bind(WORKSPACE).bind(input).execute(&pool).await.map_err(|e|e.to_string())?;
    Ok(id)
}

/// Reserva un nombre único sin sobrescribir. El temporal de Whisper nunca usa el nombre final.
fn publish_srt(temp: &Path, base: &str) -> Result<String, String> {
    for n in 0..10000 {
        let path = if n == 0 {
            format!("{base}.srt")
        } else {
            format!("{base} (Nexus {n}).srt")
        };
        match std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&path)
        {
            Ok(mut target) => {
                let result = std::fs::File::open(temp)
                    .and_then(|mut source| std::io::copy(&mut source, &mut target));
                drop(target);
                if let Err(e) = result {
                    let _ = std::fs::remove_file(&path);
                    return Err(e.to_string());
                }
                return Ok(path);
            }
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(e) => return Err(format!("No se pudieron guardar los subtítulos: {e}")),
        }
    }
    Err("Hay demasiados archivos de subtítulos con ese nombre.".into())
}
struct Temporary(Vec<PathBuf>);
impl Drop for Temporary {
    fn drop(&mut self) {
        for path in &self.0 {
            let _ = std::fs::remove_file(path);
        }
    }
}

#[tauri::command]
pub async fn subtitles_generate(
    app: AppHandle,
    session_id: String,
    audio: Option<Vec<usize>>,
) -> Result<Value, String> {
    let ticket = crate::media_jobs::Ticket::enqueue("Crear subtítulos")?;
    ticket.request("subtitles_generate",serde_json::json!({"sessionId":session_id,"audio":audio}));
    let handle = app.clone();
    let ticket = tauri::async_runtime::spawn_blocking(move || ticket.wait(&handle))
        .await
        .map_err(|e| e.to_string())??;
    let (video, _) = session_video(&app, &session_id).await?;
    ticket.title(&format!(
        "Subtítulos · {}",
        Path::new(&video)
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
    ));
    if !Path::new(&video).is_file() {
        return Err(format!("No se encuentra el vídeo: {video}"));
    }
    let dir = tools(&app)?;
    if installed(&dir) != (true, true) {
        return Err("Instala la transcripción desde este panel.".into());
    }
    let handle = app.clone();
    let ffmpeg = tauri::async_runtime::spawn_blocking(move || find_ffmpeg(&handle))
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Falta ffmpeg.")?;
    let base = core::base_path(&video);
    let temp = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join("tmp");
    std::fs::create_dir_all(&temp).map_err(|e| e.to_string())?;
    let temp_base = temp.join(format!("subtitle-{:032x}", rand::random::<u128>()));
    let wav = temp_base.with_extension("wav");
    let srt_temp = temp_base.with_extension("srt");
    let _cleanup = Temporary(vec![wav.clone(), srt_temp.clone()]);
    let wav_text = wav.display().to_string();
    let output_base = temp_base.display().to_string();
    let (mut ticket, result) = tauri::async_runtime::spawn_blocking(move || {
        let result = (|| -> Result<(), String> {
            let info = crate::shorts::probe(&ffmpeg, &video)?;
            let tracks = crate::shorts::tracks(&info, audio)?;
            if tracks.is_empty() {
                return Err("Selecciona una pista con voz para transcribir.".into());
            }
            let args = core::audio_args_selected(&video, &wav_text, &tracks)?;
            let out = ticket.run(Command::new(&ffmpeg).args(args), None)?;
            if !out.status.success() {
                return Err("ffmpeg no pudo extraer las pistas elegidas.".into());
            }
            let out = ticket.run(
                Command::new(dir.join("whisper-cli.exe"))
                    .args(core::whisper_args(
                        &dir.join(MODEL_FILE).display().to_string(),
                        &wav_text,
                        &output_base,
                        crate::media_jobs::threads(),
                    ))
                    .current_dir(&dir),
                None,
            )?;
            if !out.status.success() {
                return Err(format!(
                    "Whisper no pudo transcribir: {}",
                    String::from_utf8_lossy(&out.stderr)
                        .chars()
                        .rev()
                        .take(500)
                        .collect::<String>()
                        .chars()
                        .rev()
                        .collect::<String>()
                ));
            }
            Ok(())
        })();
        (ticket, result)
    })
    .await
    .map_err(|e| e.to_string())?;
    if let Err(e) = result {
        ticket.finish(Err(&e));
        return Err(e);
    }
    ticket.commit()?;
    if !srt_temp.is_file() {
        return Err("Whisper terminó sin generar subtítulos.".into());
    }
    let srt = publish_srt(&srt_temp, &base)?;
    let pool = crate::backup::pool(&app).await?;
    sqlx::query("INSERT INTO alert_cursor(id,content) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET content=excluded.content").bind(format!("subtitle:{session_id}")).bind(json!({"srt":srt}).to_string()).execute(&pool).await.map_err(|e|e.to_string())?;
    ticket.finish(Ok(&srt));
    Ok(json!({"srt":srt}))
}

#[cfg(test)]
mod output_tests {
    use super::*;
    #[test]
    fn srt_names_are_reserved_without_overwriting_existing_files() {
        let dir =
            std::env::temp_dir().join(format!("nexus-srt-test-{:032x}", rand::random::<u128>()));
        std::fs::create_dir_all(&dir).unwrap();
        let base = dir.join("clip").display().to_string();
        let temp = dir.join("temporary.srt");
        std::fs::write(&temp, b"new subtitles").unwrap();
        std::fs::write(format!("{base}.srt"), b"original").unwrap();
        std::fs::write(format!("{base} (Nexus 1).srt"), b"previous").unwrap();
        let next = publish_srt(&temp, &base).unwrap();
        assert_eq!(next, format!("{base} (Nexus 2).srt"));
        assert_eq!(std::fs::read(format!("{base}.srt")).unwrap(), b"original");
        assert_eq!(
            std::fs::read(format!("{base} (Nexus 1).srt")).unwrap(),
            b"previous"
        );
        assert_eq!(std::fs::read(next).unwrap(), b"new subtitles");
        std::fs::remove_dir_all(dir).unwrap();
    }
}

#[tauri::command]
pub async fn choose_video_file()->Result<Option<String>,String>{
 tauri::async_runtime::spawn_blocking(||{
  #[cfg(windows)] {let out=crate::shorts::hidden(std::process::Command::new("powershell.exe").args(["-NoProfile","-STA","-Command","Add-Type -AssemblyName System.Windows.Forms; $d=New-Object System.Windows.Forms.OpenFileDialog; $d.Filter='Vídeos|*.mp4;*.mkv;*.mov;*.webm;*.avi'; if($d.ShowDialog() -eq 'OK'){[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; [Console]::Write($d.FileName)}"])).output().map_err(|_|"No se pudo abrir el explorador de archivos.")?;if !out.status.success(){return Err("No se pudo abrir el explorador de archivos.".into())}let path=String::from_utf8_lossy(&out.stdout).trim().to_string();Ok((!path.is_empty()).then_some(path))}
  #[cfg(not(windows))] {Err("El selector de archivos está disponible en Windows. Puedes introducir la ruta.".into())}
 }).await.map_err(|e|e.to_string())?
}
#[tauri::command]
pub async fn subtitles_relink(app:AppHandle,session_id:String,path:String)->Result<(),String>{
 if !Path::new(&path).is_file(){return Err("El vídeo seleccionado no existe.".into())}
 let handle=app.clone();let source=path.clone();
 tauri::async_runtime::spawn_blocking(move||{let f=crate::shorts::find_ffmpeg(&handle).ok_or("Falta ffmpeg para comprobar el vídeo.")?;crate::shorts::probe_duration(&f,&source)}).await.map_err(|e|e.to_string())??;
 let pool=crate::backup::pool(&app).await?;
 let n=sqlx::query("UPDATE obs_session SET output_path=$1 WHERE id=$2 AND workspace_id=$3 AND kind='recording' AND ended_at IS NOT NULL").bind(path).bind(session_id).bind(WORKSPACE).execute(&pool).await.map_err(|e|e.to_string())?.rows_affected();
 if n!=1{return Err("La grabación no está disponible o sigue activa.".into())}Ok(())
}
#[tauri::command]
pub async fn subtitles_burn(app:AppHandle,session_id:String,font_size:Option<u32>)->Result<String,String>{
 let (video,_)=session_video(&app,&session_id).await?;
 let pool=crate::backup::pool(&app).await?;
 let raw:String=sqlx::query_scalar("SELECT content FROM alert_cursor WHERE id=$1").bind(format!("subtitle:{session_id}")).fetch_one(&pool).await.map_err(|_|"Crea primero los subtítulos de esta grabación.")?;
 let result:Value=serde_json::from_str(&raw).map_err(|_|"No se pudo leer el resultado de subtítulos.")?;
 let srt=result["srt"].as_str().ok_or("Crea primero los subtítulos.")?;
 if !Path::new(srt).is_file(){return Err("No se encuentra el archivo SRT. Vuelve a generar los subtítulos.".into())}
 let ticket=crate::media_jobs::Ticket::enqueue("Vídeo con subtítulos incorporados")?;
 let handle=app.clone();let mut ticket=tauri::async_runtime::spawn_blocking(move||ticket.wait(&handle)).await.map_err(|e|e.to_string())??;
 let dir=app.path().video_dir().map_err(|e|e.to_string())?.join("Nexus Shorts");std::fs::create_dir_all(&dir).map_err(|e|e.to_string())?;
 let output=dir.join(format!("Subtitulado-{:016x}.mp4",rand::random::<u64>()));
 let temp=std::env::temp_dir().join(format!("nexus-captions-{:016x}",rand::random::<u64>()));std::fs::create_dir(&temp).map_err(|e|e.to_string())?;
 if let Err(e)=std::fs::copy(srt,temp.join("captions.srt")){let _=std::fs::remove_dir_all(&temp);return Err(e.to_string())}
 let size=font_size.unwrap_or(24).clamp(18,48);let handle=app.clone();let file=output.clone();
 let operation=tauri::async_runtime::spawn_blocking(move||{
  let result:Result<String,String>=(||{let f=crate::shorts::find_ffmpeg(&handle).ok_or("Falta ffmpeg.")?;
   let filter=format!("subtitles=captions.srt:force_style='FontName=Arial,FontSize={size},Outline=2,Shadow=1,MarginV=30'");
   let args=vec!["-hide_banner","-loglevel","error","-n","-i",video.as_str(),"-vf",filter.as_str(),"-map","0:v:0","-map","0:a?","-c:v","libx264","-preset","veryfast","-crf","22","-threads","2","-c:a","aac","-movflags","+faststart"];
   let out=ticket.run(std::process::Command::new(f).current_dir(&temp).args(args).arg(&file),None)?;
   if !out.status.success(){return Err("No se pudo incorporar el SRT. Comprueba que ffmpeg incluya el filtro subtitles (libass).".into())}
   Ok(file.to_string_lossy().into_owned())})();
  let _=std::fs::remove_dir_all(temp);
  match &result {Ok(path)=>ticket.finish(Ok(path)),Err(e)=>{let _=std::fs::remove_file(&file);ticket.finish(Err(e));}}result
 }).await.map_err(|e|e.to_string())?;
 operation
}

async fn saved_srt(app:&AppHandle,session:&str)->Result<(Value,std::path::PathBuf),String>{
 let pool=crate::backup::pool(app).await?;
 let raw:String=sqlx::query_scalar("SELECT content FROM alert_cursor WHERE id=$1").bind(format!("subtitle:{session}")).fetch_one(&pool).await.map_err(|_|"Crea primero los subtítulos.")?;
 let value:Value=serde_json::from_str(&raw).map_err(|_|"No se pudo leer el registro de subtítulos.")?;
 let path=std::path::PathBuf::from(value["srt"].as_str().ok_or("No existe un SRT asociado.")?);
 if path.extension().and_then(|e|e.to_str()).is_none_or(|e|!e.eq_ignore_ascii_case("srt")){return Err("El archivo asociado no es un SRT.".into())}
 Ok((value,path))
}
#[tauri::command]
pub async fn subtitles_read_text(app:AppHandle,session_id:String)->Result<String,String>{
 let (_,path)=saved_srt(&app,&session_id).await?;
 if std::fs::metadata(&path).map_err(|_|"No se encuentra el archivo SRT.")?.len()>2*1024*1024{return Err("El SRT supera 2 MB. Ábrelo con un editor de texto externo.".into())}
 std::fs::read_to_string(path).map_err(|_|"No se pudo leer el SRT en UTF-8.".into())
}
#[tauri::command]
pub async fn subtitles_save_text(app:AppHandle,session_id:String,content:String)->Result<String,String>{
 crate::subtitles_core::validate_srt(&content)?;let (mut value,path)=saved_srt(&app,&session_id).await?;
 let title=path.file_stem().and_then(|s|s.to_str()).unwrap_or("Subtítulos").chars().take(70).collect::<String>();
 let target=path.with_file_name(format!("{title} corregido {:08x}.srt",rand::random::<u32>()));
 use std::io::Write;
 let mut file=std::fs::OpenOptions::new().write(true).create_new(true).open(&target).map_err(|_|"No se pudo reservar una copia del SRT corregido.")?;
 let written=file.write_all(content.as_bytes()).and_then(|_|file.sync_all());drop(file);
 if written.is_err(){let _=std::fs::remove_file(&target);return Err("No se pudo guardar la copia corregida; el original se conserva.".into())}
 value["srt"]=json!(target.to_string_lossy());value["revised_from"]=json!(path.to_string_lossy());
 if let Err(error)=crate::social_alerts::save(&app,&format!("subtitle:{session_id}"),&value).await{let _=std::fs::remove_file(&target);return Err(error)}
 Ok(target.to_string_lossy().into())
}
