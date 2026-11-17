//! Clips para Shorts (D-031): recorta con ffmpeg alrededor de un momento marcado (sobre la
//! grabación de OBS) o convierte un clip del Replay Buffer, en horizontal o vertical 9:16.
//! ffmpeg no viene con Nexus: se busca en el PC y, si falta, se instala con winget.
use std::path::{Path, PathBuf};
use std::process::Command;

use serde_json::{Value, json};
use sqlx::Row;
use tauri::{AppHandle, Manager};

use crate::obs_store::WORKSPACE;
use crate::shorts_core::{self as core, Format};

const NO_WINDOW: u32 = 0x0800_0000;

pub(crate) fn hidden(cmd: &mut Command) -> &mut Command {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(NO_WINDOW);
    }
    cmd
}

/// Busca ffmpeg.exe: herramientas de Nexus, accesos de winget, paquetes de winget y PATH.
pub(crate) fn find_ffmpeg(app: &AppHandle) -> Option<PathBuf> {
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Ok(dir) = app.path().app_local_data_dir() {
        candidates.push(dir.join("tools").join("ffmpeg.exe"));
    }
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        let winget = Path::new(&local).join("Microsoft").join("WinGet");
        candidates.push(winget.join("Links").join("ffmpeg.exe"));
        // Paquetes de winget: …\Packages\Gyan.FFmpeg_…\ffmpeg-X-essentials_build\bin\ffmpeg.exe
        if let Ok(packages) = std::fs::read_dir(winget.join("Packages")) {
            for pkg in packages
                .flatten()
                .filter(|p| p.file_name().to_string_lossy().starts_with("Gyan.FFmpeg"))
            {
                if let Ok(inner) = std::fs::read_dir(pkg.path()) {
                    for build in inner.flatten() {
                        candidates.push(build.path().join("bin").join("ffmpeg.exe"));
                    }
                }
            }
        }
    }
    if let Some(found) = candidates.into_iter().find(|p| p.is_file()) {
        return Some(found);
    }
    let out = hidden(Command::new("where").arg("ffmpeg")).output().ok()?;
    String::from_utf8_lossy(&out.stdout)
        .lines()
        .map(PathBuf::from)
        .find(|p| p.is_file())
}

#[tauri::command]
pub async fn shorts_status(app: AppHandle) -> Result<Value, String> {
    let ffmpeg = tauri::async_runtime::spawn_blocking(move || find_ffmpeg(&app))
        .await
        .map_err(|e| e.to_string())?;
    Ok(json!({"ffmpeg": ffmpeg.map(|p| p.display().to_string())}))
}

/// Abre una consola visible que instala ffmpeg con winget (el usuario ve el progreso).
#[tauri::command]
pub fn shorts_install_ffmpeg() -> Result<(), String> {
    Command::new("cmd")
        .args([
            "/C", "start", "Instalar ffmpeg para Nexus", "cmd", "/K",
            "winget install --id Gyan.FFmpeg -e --accept-source-agreements --accept-package-agreements && echo. && echo Listo: vuelve a Nexus y pulsa Comprobar de nuevo.",
        ])
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("No se pudo abrir el instalador: {e}"))
}

/// De dónde sale el vídeo: grabación + segundo de la marca, o el archivo del clip.
pub(crate) async fn source(
    pool: &sqlx::SqlitePool,
    kind: &str,
    id: &str,
) -> Result<(String, String, Option<i64>), String> {
    match kind {
        "moment" => {
            let r = sqlx::query(
                "SELECT m.title, m.record_ms, s.output_path FROM obs_marker m JOIN obs_session s ON s.id = m.session_id
                  WHERE m.id = $1 AND m.workspace_id = $2",
            )
            .bind(id)
            .bind(WORKSPACE)
            .fetch_optional(pool)
            .await
            .map_err(|e| e.to_string())?
            .ok_or("No existe ese momento.")?;
            let record: Option<i64> = r.get("record_ms");
            let path: Option<String> = r.get("output_path");
            match (record, path) {
                (Some(ms), Some(p)) => Ok((r.get("title"), p, Some(ms))),
                (None, _) => Err("Esta marca no tiene una grabación asociada. Tus otros vídeos no se han borrado.".into()),
                (_, None) => Err("OBS todavía está grabando. Cuando termines la grabación, podrás recortar este momento.".into()),
            }
        }
        "clip" => {
            let r = sqlx::query(
                "SELECT title, output_path FROM obs_clip WHERE id = $1 AND workspace_id = $2",
            )
            .bind(id)
            .bind(WORKSPACE)
            .fetch_optional(pool)
            .await
            .map_err(|e| e.to_string())?
            .ok_or("No existe ese clip.")?;
            Ok((r.get("title"), r.get("output_path"), None))
        }
        _ => Err("Tipo de captura no válido.".into()),
    }
}

/// ffprobe mide el archivo realmente guardado; no suponemos que el buffer conserve todo.
pub(crate) fn probe(ffmpeg: &Path, input: &str) -> Result<Value, String> {
    let mut probes = vec![
        ffmpeg.with_file_name("ffprobe.exe"),
        ffmpeg.with_file_name("ffprobe"),
    ];
    if let Ok(real) = ffmpeg.canonicalize() {
        probes.push(real.with_file_name("ffprobe.exe"));
        probes.push(real.with_file_name("ffprobe"));
    }
    if let Ok(out) = hidden(Command::new("where").arg("ffprobe")).output() {
        probes.extend(
            String::from_utf8_lossy(&out.stdout)
                .lines()
                .map(PathBuf::from),
        );
    }
    let probe = probes
        .into_iter()
        .find(|p| p.is_file())
        .ok_or("Falta ffprobe, incluido en el paquete completo de ffmpeg.")?;
    let out = hidden(Command::new(probe).args([
        "-v",
        "error",
        "-show_entries",
        "format=duration:stream=index,codec_type,channels:stream_tags=title",
        "-of",
        "json",
        input,
    ]))
    .output()
    .map_err(|e| e.to_string())?;
    if !out.status.success() {
        return Err("No se pudo leer el vídeo. Comprueba que esté completo.".into());
    }
    serde_json::from_slice(&out.stdout).map_err(|_| "ffprobe no devolvió datos válidos.".into())
}
pub(crate) fn probe_duration(ffmpeg: &Path, input: &str) -> Result<f64, String> {
    let value = probe(ffmpeg, input)?;
    value["format"]["duration"]
        .as_str()
        .and_then(|s| s.parse::<f64>().ok())
        .filter(|s| s.is_finite() && *s > 0.)
        .ok_or("No se pudo leer la duración real del vídeo.".into())
}
pub(crate) fn tracks(value: &Value, selected: Option<Vec<usize>>) -> Result<Vec<usize>, String> {
    let count = value["streams"]
        .as_array()
        .map(|a| a.iter().filter(|v| v["codec_type"] == "audio").count())
        .unwrap_or(0);
    let tracks = selected.unwrap_or_else(|| if count > 0 { vec![0] } else { vec![] });
    core::audio_filter(&tracks)?;
    if tracks.iter().any(|n| *n >= count) {
        return Err(
            "La pista elegida ya no existe en este vídeo. Vuelve a consultar su audio.".into(),
        );
    }
    Ok(tracks)
}
#[tauri::command]
pub async fn media_inspect(app: AppHandle, kind: String, id: String) -> Result<Value, String> {
    let pool = crate::backup::pool(&app).await?;
    let input = if kind == "recording" {
        crate::subtitles::session_video(&app, &id).await?.0
    } else {
        source(&pool, &kind, &id).await?.1
    };
    tauri::async_runtime::spawn_blocking(move || {
        let f = find_ffmpeg(&app).ok_or("Falta ffmpeg.")?;
        let v = probe(&f, &input)?;
        let audio: Vec<Value> = v["streams"]
            .as_array()
            .into_iter()
            .flatten()
            .filter(|s| s["codec_type"] == "audio")
            .enumerate()
            .map(|(n, s)| json!({"index":n,"channels":s["channels"],"title":s["tags"]["title"]}))
            .collect();
        Ok(json!({"audio":audio,"duration":v["format"]["duration"]}))
    })
    .await
    .map_err(|e| e.to_string())?
}
/// Un mismo cálculo para el resumen, la primera imagen y el archivo exportado.
async fn planned_cut(
    app: &AppHandle,
    kind: &str,
    id: &str,
    mark: Option<i64>,
    duration: f64,
    before: Option<i64>,
    after: Option<i64>,
) -> Result<(Option<(f64, f64)>, Option<String>), String> {
    if kind == "clip" {
        let handle = app.clone();
        let identity = id.to_string();
        let candidate = tauri::async_runtime::spawn_blocking(move || {
            crate::auto_moments::candidates(&handle)
                .map(|items| items.into_iter().find(|c| c.id == identity))
        })
        .await
        .map_err(|e| e.to_string())??;
        if let Some(c) = candidate {
            if c.state != "kept" {
                return Err("Conserva este candidato antes de crear su Short.".into());
            }
            let (cut, warning) = crate::auto_moments_core::clip_window(
                duration,
                c.tail_ms,
                before.unwrap_or(c.before as i64).clamp(0, 120) as u32,
                after.unwrap_or(c.after as i64).clamp(0, 30) as u32,
            )?;
            return Ok((Some(cut), warning));
        }
    }
    match mark {
        Some(ms) => {
            let (cut, warning) = core::recording_window(
                ms,
                duration,
                before.unwrap_or(core::DEFAULT_BEFORE),
                after.unwrap_or(core::DEFAULT_AFTER),
            )?;
            Ok((Some(cut), warning))
        }
        None => Ok((None, None)),
    }
}
#[tauri::command]
pub async fn shorts_plan(
    app: AppHandle,
    kind: String,
    id: String,
    before: Option<i64>,
    after: Option<i64>,
) -> Result<Value, String> {
    let pool = crate::backup::pool(&app).await?;
    let (_, input, mark) = source(&pool, &kind, &id).await?;
    let handle = app.clone();
    let data = tauri::async_runtime::spawn_blocking(move || {
        let f = find_ffmpeg(&handle)
            .ok_or("Instala ffmpeg desde Clips para Shorts para preparar el vídeo.")?;
        probe(&f, &input)
    })
    .await
    .map_err(|e| e.to_string())??;
    let duration = data["format"]["duration"]
        .as_str()
        .and_then(|s| s.parse::<f64>().ok())
        .filter(|n| n.is_finite() && *n > 0.)
        .ok_or("No se pudo leer la duración del vídeo.")?;
    let (cut, warning) = planned_cut(&app, &kind, &id, mark, duration, before, after).await?;
    let (start, length) = cut.unwrap_or((0., duration));
    let audio: Vec<Value> = data["streams"]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|s| s["codec_type"] == "audio")
        .enumerate()
        .map(
            |(index, s)| json!({"index":index,"title":s["tags"]["title"],"channels":s["channels"]}),
        )
        .collect();
    Ok(
        json!({"start":start,"end":start+length,"duration":length,"warning":warning,"audio":audio,"has_window":cut.is_some()}),
    )
}

#[tauri::command]
pub async fn shorts_preview(
    app: AppHandle,
    kind: String,
    id: String,
    format: String,
    before: Option<i64>,
    after: Option<i64>,
    layout: Option<crate::shorts_layout::Layout>,
) -> Result<String, String> {
    use base64::Engine;
    let pool = crate::backup::pool(&app).await?;
    let (_, input, mark) = source(&pool, &kind, &id).await?;
    let handle = app.clone();
    let file = input.clone();
    let duration = tauri::async_runtime::spawn_blocking(move || {
        let f = find_ffmpeg(&handle).ok_or("Falta ffmpeg.")?;
        probe_duration(&f, &file)
    })
    .await
    .map_err(|e| e.to_string())??;
    let (cut, _) = planned_cut(&app, &kind, &id, mark, duration, before, after).await?;
    tauri::async_runtime::spawn_blocking(move || {
        let f = find_ffmpeg(&app).ok_or("Falta ffmpeg.")?;
        let mut args = core::args_audio(
            &input,
            "pipe:1",
            Some((cut.map(|c| c.0).unwrap_or(0.), 1.)),
            Format::parse(&format)?,
            &[],
            2,
        );
        crate::shorts_layout::apply(&mut args,layout)?;
        let end = args.iter().position(|s| s == "-c:v").unwrap();
        args.truncate(end);
        args.extend(
            [
                "-frames:v",
                "1",
                "-vcodec",
                "mjpeg",
                "-f",
                "image2pipe",
                "pipe:1",
            ]
            .iter()
            .map(|s| s.to_string()),
        );
        let out = hidden(Command::new(f).args(args))
            .output()
            .map_err(|e| e.to_string())?;
        if !out.status.success() || out.stdout.is_empty() {
            return Err("No se pudo generar la vista previa.".into());
        }
        Ok(format!(
            "data:image/jpeg;base64,{}",
            base64::engine::general_purpose::STANDARD.encode(out.stdout)
        ))
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Solo limpia una salida reservada exclusivamente por este trabajo.
struct OwnedOutput {
    path: PathBuf,
    persist: bool,
}
impl OwnedOutput {
    fn reserve(path: &Path) -> Result<Self, String> {
        std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(path)
            .map_err(|e| format!("No se pudo reservar la salida del Short: {e}"))?;
        Ok(Self {
            path: path.to_path_buf(),
            persist: false,
        })
    }
}
impl Drop for OwnedOutput {
    fn drop(&mut self) {
        if !self.persist {
            let _ = std::fs::remove_file(&self.path);
        }
    }
}

/// Crea el Short y devuelve la ruta del archivo. Tarda lo que ffmpeg tarde en codificar.
#[tauri::command]
pub async fn shorts_render(
    app: AppHandle,
    kind: String,
    id: String,
    format: String,
    before: Option<i64>,
    after: Option<i64>,
    audio: Option<Vec<usize>>,
    encoder: Option<String>,
    layout: Option<crate::shorts_layout::Layout>,
) -> Result<Value, String> {
    let format = Format::parse(&format)?;
    let gpu = match encoder.as_deref().unwrap_or("cpu") {
        "cpu" => false,
        "nvenc" if crate::media_jobs::gpu_available() => true,
        "nvenc" => {
            return Err(
                "Primero ejecuta la prueba de GPU en Procesamiento local, o elige CPU.".into(),
            );
        }
        _ => return Err("Codificador no válido.".into()),
    };
    let ticket = crate::media_jobs::Ticket::enqueue("Crear Short")?;
    ticket.request("shorts_render",serde_json::json!({"layout":layout,"kind":kind,"id":id,"format":format.key(),"before":before,"after":after,"audio":audio,"encoder":encoder}));
    let handle = app.clone();
    let ticket = tauri::async_runtime::spawn_blocking(move || ticket.wait(&handle))
        .await
        .map_err(|e| e.to_string())??;
    let pool = crate::backup::pool(&app).await?;
    let (title, input, mark) = source(&pool, &kind, &id).await?;
    ticket.title(&format!("Short · {title}"));
    if !Path::new(&input).is_file() {
        return Err(format!("No se encuentra el archivo de vídeo: {input}"));
    }
    let handle = app.clone();
    let ffmpeg = tauri::async_runtime::spawn_blocking(move || find_ffmpeg(&handle))
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Falta ffmpeg. Instálalo desde el botón de Shorts.")?;
    let dir = app
        .path()
        .video_dir()
        .map_err(|e| e.to_string())?
        .join("Nexus Shorts");
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("No se pudo crear la carpeta de Shorts: {e}"))?;
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let output = dir.join(format!(
        "{} {stamp} {}.mp4",
        core::file_stem(&title),
        format!("{}-{:08x}", format.key(), rand::random::<u128>())
    ));
    let mut output_guard = OwnedOutput::reserve(&output)?;
    let binary = ffmpeg.clone();
    let file = input.clone();
    let metadata = tauri::async_runtime::spawn_blocking(move || probe(&binary, &file))
        .await
        .map_err(|e| e.to_string())??;
    let duration = metadata["format"]["duration"]
        .as_str()
        .and_then(|s| s.parse::<f64>().ok())
        .filter(|n| n.is_finite() && *n > 0.)
        .ok_or("No se pudo leer la duración del vídeo.")?;
    let (cut, warning) = planned_cut(&app, &kind, &id, mark, duration, before, after).await?;
    let audio = tracks(&metadata, audio)?;
    let mut arguments = core::args_audio(
        &input,
        &output.display().to_string(),
        cut,
        format,
        &audio,
        crate::media_jobs::threads(),
    );
    crate::shorts_layout::apply(&mut arguments,layout)?;
    if let Some(flag) = arguments.iter_mut().find(|s| s.as_str() == "-n") {
        *flag = "-y".into();
    }
    if gpu {
        for arg in &mut arguments {
            if arg == "libx264" {
                *arg = "h264_nvenc".into()
            } else if arg == "veryfast" {
                *arg = "p4".into()
            } else if arg == "-crf" {
                *arg = "-cq".into()
            }
        }
        let last = arguments.len() - 1;
        arguments.splice(last..last, ["-b:v".to_string(), "0".to_string()]);
    }
    let duration = cut.map(|(_, d)| d).or_else(|| {
        metadata["format"]["duration"]
            .as_str()
            .and_then(|s| s.parse().ok())
    });
    let (mut ticket, result) = tauri::async_runtime::spawn_blocking(move || {
        let result = ticket.run(Command::new(&ffmpeg).args(&arguments), duration);
        (ticket, result)
    })
    .await
    .map_err(|e| e.to_string())?;
    let result = match result {
        Ok(out) => out,
        Err(e) => {
            ticket.finish(Err(&e));
            return Err(e);
        }
    };
    if !result.status.success() || !output.is_file() {
        let err = String::from_utf8_lossy(&result.stderr);
        let tail: String = err
            .lines()
            .rev()
            .take(3)
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect::<Vec<_>>()
            .join(" · ");
        let error = format!("ffmpeg no pudo crear el Short. {tail}");
        ticket.finish(Err(&error));
        return Err(error);
    }
    if let Err(e) = ticket.commit() {
        return Err(e);
    }
    let path = output.display().to_string();
    let export_id = format!("{:032x}", rand::random::<u128>());
    sqlx::query("INSERT INTO clip_export(id,workspace_id,source_kind,source_id,title,format,path) VALUES($1,$2,$3,$4,$5,$6,$7)")
        .bind(&export_id)
        .bind(WORKSPACE)
        .bind(&kind)
        .bind(&id)
        .bind(&title)
        .bind(format.key())
        .bind(&path)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    output_guard.persist = true;
    ticket.finish(Ok(&path));
    Ok(json!({"id":export_id,"path": path,"warning":warning}))
}

/// Últimos 50 Shorts creados, indicando si el archivo sigue existiendo.
#[tauri::command]
pub async fn shorts_list(app: AppHandle) -> Result<Vec<Value>, String> {
    let pool = crate::backup::pool(&app).await?;
    let rows = sqlx::query(
        "SELECT id, created_at, source_kind, title, format, path FROM clip_export WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 50",
    )
    .bind(WORKSPACE)
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(rows
        .iter()
        .map(|r| {
            let path: String = r.get("path");
            json!({"id":r.get::<String,_>("id"),"created_at":r.get::<String,_>("created_at"),"source_kind":r.get::<String,_>("source_kind"),
                   "title":r.get::<String,_>("title"),"format":r.get::<String,_>("format"),"exists":Path::new(&path).is_file(),"path":path})
        })
        .collect())
}

/// Continúa desde un export al proyecto original, adjuntando su ruta una sola vez.
#[tauri::command]
pub async fn studio_export_project(app: AppHandle, export_id: String) -> Result<String, String> {
    let pool = crate::backup::pool(&app).await?;
    let row = sqlx::query(
        "SELECT source_kind,source_id,path FROM clip_export WHERE id=$1 AND workspace_id=$2",
    )
    .bind(export_id)
    .bind(WORKSPACE)
    .fetch_optional(&pool)
    .await
    .map_err(|e| e.to_string())?
    .ok_or("No se encuentra ese Short.")?;
    let kind: String = row.get("source_kind");
    let id: String = row.get("source_id");
    let path: String = row.get("path");
    let project = crate::studio_tools::capture_project(&pool, &kind, &id).await?;
    sqlx::query("UPDATE project SET summary=COALESCE(summary,'') || $1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=$2 AND workspace_id=$3 AND instr(COALESCE(summary,''),$4)=0").bind(format!("\n\nShort exportado: {path}")).bind(&project).bind(WORKSPACE).bind(path).execute(&pool).await.map_err(|e|e.to_string())?;
    Ok(project)
}

/// Playable preview of the SAME planned interval and chosen audio. Disposable lower-resolution copy.
#[tauri::command]
pub async fn shorts_video_preview(app:AppHandle,kind:String,id:String,format:String,before:Option<i64>,after:Option<i64>,audio:Option<Vec<usize>>,layout:Option<crate::shorts_layout::Layout>)->Result<String,String>{
 use base64::Engine;
 let ticket=crate::media_jobs::Ticket::enqueue("Vista previa con audio")?;
 let handle=app.clone();let mut ticket=tauri::async_runtime::spawn_blocking(move||ticket.wait(&handle)).await.map_err(|e|e.to_string())??;
 let pool=crate::backup::pool(&app).await?;let (_,input,mark)=source(&pool,&kind,&id).await?;
 let handle=app.clone();let file=input.clone();
 let (ffmpeg,probe)=tauri::async_runtime::spawn_blocking(move||{let f=find_ffmpeg(&handle).ok_or("Falta ffmpeg.")?;let p=probe(&f,&file)?;Ok::<_,String>((f,p))}).await.map_err(|e|e.to_string())??;
 let duration=probe["format"]["duration"].as_str().and_then(|s|s.parse::<f64>().ok()).ok_or("No se pudo leer la duración.")?;
 let (cut,_)=planned_cut(&app,&kind,&id,mark,duration,before,after).await?;
 let selected=tracks(&probe,audio)?;let format=Format::parse(&format)?;
 let output=std::env::temp_dir().join(format!("nexus-preview-{:016x}.mp4",rand::random::<u64>()));
 let mut guard=OwnedOutput::reserve(&output)?;
 let mut args=core::args_audio(&input,&output.to_string_lossy(),cut,format,&selected,2);
 crate::shorts_layout::apply(&mut args,layout)?;
 for arg in &mut args{if arg.contains("[0:v:0]"){*arg=arg.replace("1920","640").replace("1080","360").replace("boxblur=24:2","boxblur=8:2")}}
 if matches!(format,Format::Original)&&layout.is_none_or(|l|l.camera.is_none()){let i=args.len()-1;args.splice(i..i,["-vf".into(),"scale=640:-2".into()]);}
 if let Some(i)=args.iter().position(|s|s=="-n"){args[i]="-y".into()}
 if let Some(i)=args.iter().position(|s|s=="-preset"){args[i+1]="ultrafast".into()}
 if let Some(i)=args.iter().position(|s|s=="-crf"){args[i+1]="30".into()}
 let file=output.clone();
 let result=tauri::async_runtime::spawn_blocking(move||{
  let out=ticket.run(Command::new(ffmpeg).args(args),cut.map(|c|c.1));
  let result=out.and_then(|out|if out.status.success(){
    let size=std::fs::metadata(&file).map_err(|_|"No se pudo leer la vista previa.")?.len();
    if size>32*1024*1024{return Err("La vista previa supera 32 MB. Reduce el tramo antes de previsualizar.".into())}
    let bytes=std::fs::read(&file).map_err(|_|"No se pudo leer la vista previa.")?;
    Ok(format!("data:video/mp4;base64,{}",base64::engine::general_purpose::STANDARD.encode(bytes)))
  }else{Err("No se pudo crear la vista previa. Comprueba formato y audio.".into())});
  match &result{Ok(_)=>ticket.finish(Ok("")),Err(e)=>ticket.finish(Err(e))};result
 }).await.map_err(|e|e.to_string())?;
 guard.persist=false;result
}

#[tauri::command]
pub async fn media_relink(app:AppHandle,kind:String,id:String,path:String)->Result<(),String>{
 if !std::path::Path::new(&path).is_file(){return Err("No existe el vídeo seleccionado.".into())}
 let handle=app.clone();let input=path.clone();let duration=tauri::async_runtime::spawn_blocking(move||{let f=find_ffmpeg(&handle).ok_or("Falta ffmpeg para comprobar la grabación.")?;probe_duration(&f,&input)}).await.map_err(|e|e.to_string())??;
 let pool=crate::backup::pool(&app).await?;let mut tx=pool.begin().await.map_err(|e|e.to_string())?;
 let n=match kind.as_str(){
  "clip"=>{let n=sqlx::query("UPDATE obs_clip SET output_path=$1 WHERE id=$2 AND workspace_id=$3").bind(&path).bind(&id).bind(WORKSPACE).execute(&mut *tx).await.map_err(|e|e.to_string())?.rows_affected();sqlx::query("UPDATE alert_cursor SET content=json_set(content,'$.output_path',$1) WHERE id=$2").bind(&path).bind(format!("auto-moment:{id}")).execute(&mut *tx).await.map_err(|e|e.to_string())?;n},
  "moment"=>{let session:Option<String>=sqlx::query_scalar("SELECT session_id FROM obs_marker WHERE id=$1 AND workspace_id=$2").bind(&id).bind(WORKSPACE).fetch_optional(&mut *tx).await.map_err(|e|e.to_string())?;
   let session=session.ok_or("No existe esta marca.")?;let max:Option<i64>=sqlx::query_scalar("SELECT MAX(record_ms) FROM obs_marker WHERE session_id=$1").bind(&session).fetch_one(&mut *tx).await.map_err(|e|e.to_string())?;if max.is_some_and(|m|m as f64/1000.>duration+0.5){return Err("El vídeo es más corto que las marcas de esta grabación. Selecciona el archivo original completo.".into())}
   sqlx::query("UPDATE obs_session SET output_path=$1 WHERE id=$2 AND workspace_id=$3 AND ended_at IS NOT NULL").bind(&path).bind(session).bind(WORKSPACE).execute(&mut *tx).await.map_err(|e|e.to_string())?.rows_affected()
  },_=>return Err("Tipo de captura no válido.".into())};
 if n!=1{return Err("La captura no existe o la grabación sigue activa.".into())}
 tx.commit().await.map_err(|e|e.to_string())?;Ok(())
}
