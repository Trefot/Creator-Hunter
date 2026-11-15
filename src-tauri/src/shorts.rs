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

fn hidden(cmd: &mut Command) -> &mut Command {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(NO_WINDOW);
    }
    cmd
}

/// Busca ffmpeg.exe: herramientas de Nexus, accesos de winget, paquetes de winget y PATH.
fn find_ffmpeg(app: &AppHandle) -> Option<PathBuf> {
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Ok(dir) = app.path().app_local_data_dir() {
        candidates.push(dir.join("tools").join("ffmpeg.exe"));
    }
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        let winget = Path::new(&local).join("Microsoft").join("WinGet");
        candidates.push(winget.join("Links").join("ffmpeg.exe"));
        // Paquetes de winget: …\Packages\Gyan.FFmpeg_…\ffmpeg-X-essentials_build\bin\ffmpeg.exe
        if let Ok(packages) = std::fs::read_dir(winget.join("Packages")) {
            for pkg in packages.flatten().filter(|p| p.file_name().to_string_lossy().starts_with("Gyan.FFmpeg")) {
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
    String::from_utf8_lossy(&out.stdout).lines().map(PathBuf::from).find(|p| p.is_file())
}

#[tauri::command]
pub async fn shorts_status(app: AppHandle) -> Result<Value, String> {
    let ffmpeg = tauri::async_runtime::spawn_blocking(move || find_ffmpeg(&app)).await.map_err(|e| e.to_string())?;
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
async fn source(pool: &sqlx::SqlitePool, kind: &str, id: &str) -> Result<(String, String, Option<i64>), String> {
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
                (None, _) => Err("Ese momento se marcó sin grabación local: activa la grabación en OBS (o usa el Replay Buffer) para poder recortarlo.".into()),
                (_, None) => Err("OBS aún no confirmó el archivo de esa grabación. Detén la grabación y vuelve a intentarlo.".into()),
            }
        }
        "clip" => {
            let r = sqlx::query("SELECT title, output_path FROM obs_clip WHERE id = $1 AND workspace_id = $2")
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

/// Crea el Short y devuelve la ruta del archivo. Tarda lo que ffmpeg tarde en codificar.
#[tauri::command]
pub async fn shorts_render(
    app: AppHandle,
    kind: String,
    id: String,
    format: String,
    before: Option<i64>,
    after: Option<i64>,
) -> Result<Value, String> {
    let format = Format::parse(&format)?;
    let pool = crate::backup::pool(&app).await?;
    let (title, input, mark) = source(&pool, &kind, &id).await?;
    if !Path::new(&input).is_file() {
        return Err(format!("No se encuentra el archivo de vídeo: {input}"));
    }
    let handle = app.clone();
    let ffmpeg = tauri::async_runtime::spawn_blocking(move || find_ffmpeg(&handle))
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Falta ffmpeg. Instálalo desde el botón de Shorts.")?;
    let dir = app.path().video_dir().map_err(|e| e.to_string())?.join("Nexus Shorts");
    std::fs::create_dir_all(&dir).map_err(|e| format!("No se pudo crear la carpeta de Shorts: {e}"))?;
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let output = dir.join(format!("{} {stamp} {}.mp4", core::file_stem(&title), format.key()));
    let cut = mark.map(|ms| core::window(ms, before.unwrap_or(20), after.unwrap_or(10)));
    let arguments = core::args(&input, &output.display().to_string(), cut, format);
    let result = tauri::async_runtime::spawn_blocking(move || hidden(Command::new(&ffmpeg).args(&arguments)).output())
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| format!("No se pudo ejecutar ffmpeg: {e}"))?;
    if !result.status.success() || !output.is_file() {
        let err = String::from_utf8_lossy(&result.stderr);
        let tail: String = err.lines().rev().take(3).collect::<Vec<_>>().into_iter().rev().collect::<Vec<_>>().join(" · ");
        return Err(format!("ffmpeg no pudo crear el Short. {tail}"));
    }
    let path = output.display().to_string();
    sqlx::query("INSERT INTO clip_export(id,workspace_id,source_kind,source_id,title,format,path) VALUES($1,$2,$3,$4,$5,$6,$7)")
        .bind(format!("{:032x}", rand::random::<u128>()))
        .bind(WORKSPACE)
        .bind(&kind)
        .bind(&id)
        .bind(&title)
        .bind(format.key())
        .bind(&path)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(json!({"path": path}))
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
