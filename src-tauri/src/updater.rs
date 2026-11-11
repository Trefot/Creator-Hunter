//! Actualización automática de la app instalada (D-021, D-023).
//!
//! **Como Lumen:** cada versión se publica en la rama `releases` del repositorio privado de GitHub
//! (un `latest.json` con la versión y las novedades, más el instalador). La app instalada hace
//! `git fetch --depth 1` de esa rama con las credenciales de git del PC, lee `latest.json` y, si hay
//! una versión mayor que la suya, saca el instalador, lo ejecuta en silencio (`/S`) y se reabre.
//!
//! **Plan B:** si GitHub no responde (sin internet, sin git…), mira la carpeta
//! Documentos\TrophyHunter\Instaladores (`TrophyHunter_X.Y.Z_x64-setup.exe`).
//! En la versión de pruebas no hace nada.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

const PREFIX: &str = "TrophyHunter_";
const SUFFIX: &str = "_x64-setup.exe";
const REPO_URL: &str = "https://github.com/Trefot/Creator-Hunter.git";
const BRANCH: &str = "releases";

type Version = (u32, u32, u32);

/// "0.2.1" → (0, 2, 1). Solo acepta tres números.
pub fn parse_version(text: &str) -> Option<Version> {
    let mut parts = text.trim().split('.');
    let v = (parts.next()?.parse().ok()?, parts.next()?.parse().ok()?, parts.next()?.parse().ok()?);
    if parts.next().is_some() {
        return None;
    }
    Some(v)
}

/// El instalador más nuevo de la carpeta que sea mayor que `current`.
pub fn newest_in(dir: &Path, current: Version) -> Option<(Version, PathBuf)> {
    fs::read_dir(dir)
        .ok()?
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| {
            let name = entry.file_name().into_string().ok()?;
            let version = parse_version(name.strip_prefix(PREFIX)?.strip_suffix(SUFFIX)?)?;
            Some((version, entry.path()))
        })
        .filter(|(version, _)| *version > current)
        .max_by_key(|(version, _)| *version)
}

/// Lo que se publica en la rama `releases`.
#[derive(Deserialize)]
pub struct Manifest {
    pub version: String,
    #[serde(default)]
    pub notes: Vec<String>,
    pub installer: String,
}

/// Una actualización disponible, para la interfaz.
#[derive(Serialize, Clone)]
pub struct UpdateInfo {
    pub version: String,
    pub notes: Vec<String>,
    /// "github" o "carpeta".
    pub source: String,
}

enum Found {
    GitHub { info: UpdateInfo, installer: String, dir: PathBuf },
    Folder { info: UpdateInfo, setup: PathBuf },
}

fn installers_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().document_dir().map_err(|e| e.to_string())?.join("TrophyHunter").join("Instaladores"))
}

/// Ejecuta git en `dir` sin ventana y sin pedir nada por consola (si faltan credenciales, falla).
fn git(dir: &Path, args: &[&str]) -> Result<Vec<u8>, String> {
    let mut cmd = Command::new("git");
    cmd.current_dir(dir).args(args).env("GIT_TERMINAL_PROMPT", "0");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    let out = cmd.output().map_err(|e| format!("No se pudo ejecutar git: {e}"))?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
    }
    Ok(out.stdout)
}

/// Busca en GitHub: trae solo el último commit de la rama `releases` y lee su `latest.json`.
fn check_github(app: &AppHandle, current: Version) -> Result<Option<Found>, String> {
    let dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?.join("actualizaciones");
    if !dir.join(".git").exists() {
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        git(&dir, &["init", "-q"])?;
    }
    git(&dir, &["fetch", "--quiet", "--depth", "1", REPO_URL, BRANCH])?;
    let raw = git(&dir, &["show", "FETCH_HEAD:latest.json"])?;
    let manifest: Manifest = serde_json::from_slice(&raw).map_err(|e| format!("latest.json no válido: {e}"))?;
    let version = parse_version(&manifest.version).ok_or("Versión no válida en latest.json.")?;
    if version <= current {
        return Ok(None);
    }
    // Solo un nombre de archivo simple: nunca rutas.
    if manifest.installer.contains(['/', '\\', ':']) || !manifest.installer.ends_with(".exe") {
        return Err("Nombre de instalador no válido en latest.json.".into());
    }
    Ok(Some(Found::GitHub {
        info: UpdateInfo { version: manifest.version, notes: manifest.notes, source: "github".into() },
        installer: manifest.installer,
        dir,
    }))
}

fn check_folder(app: &AppHandle, current: Version) -> Option<Found> {
    let ((a, b, c), setup) = newest_in(&installers_dir(app).ok()?, current)?;
    Some(Found::Folder {
        info: UpdateInfo { version: format!("{a}.{b}.{c}"), notes: vec![], source: "carpeta".into() },
        setup,
    })
}

fn pending(app: &AppHandle) -> Option<Found> {
    if cfg!(debug_assertions) {
        return None; // la versión de pruebas nunca se actualiza sola
    }
    let current = parse_version(&app.package_info().version.to_string())?;
    match check_github(app, current) {
        Ok(Some(found)) => Some(found),
        Ok(None) => check_folder(app, current), // GitHub al día; por si acaso, la carpeta
        Err(e) => {
            eprintln!("Actualizaciones: GitHub no respondió ({e}); se mira la carpeta.");
            check_folder(app, current)
        }
    }
}

/// ¿Hay una versión más nueva? Devuelve la versión y sus novedades.
#[tauri::command]
pub async fn update_check(app: AppHandle) -> Option<UpdateInfo> {
    // git puede tardar unos segundos: fuera del hilo principal.
    tauri::async_runtime::spawn_blocking(move || match pending(&app)? {
        Found::GitHub { info, .. } | Found::Folder { info, .. } => Some(info),
    })
    .await
    .ok()
    .flatten()
}

/// Descarga (si viene de GitHub), instala en silencio y vuelve a abrir la app.
#[tauri::command]
pub async fn update_apply(app: AppHandle) -> Result<(), String> {
    let handle = app.clone();
    let setup = tauri::async_runtime::spawn_blocking(move || -> Result<PathBuf, String> {
        match pending(&handle).ok_or("No hay ninguna actualización pendiente.")? {
            Found::Folder { setup, .. } => Ok(setup),
            Found::GitHub { info, installer, dir } => {
                let bytes = git(&dir, &["cat-file", "blob", &format!("FETCH_HEAD:{installer}")])?;
                let path = std::env::temp_dir().join(format!("TrophyHunter_{}_x64-setup.exe", info.version));
                fs::write(&path, bytes).map_err(|e| format!("No se pudo guardar el instalador: {e}"))?;
                Ok(path)
            }
        }
    })
    .await
    .map_err(|e| e.to_string())??;

    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // Espera ~2 s a que la app se cierre, instala en silencio y la vuelve a abrir.
        // `ping` sirve de pausa porque funciona sin consola visible (`timeout` no).
        let line = format!(
            "/C ping -n 3 127.0.0.1 >nul & \"{}\" /S & start \"\" \"{}\"",
            setup.display(),
            exe.display()
        );
        Command::new("cmd")
            .raw_arg(line)
            .creation_flags(0x0800_0000)
            .spawn()
            .map_err(|e| format!("No se pudo lanzar la actualización: {e}"))?;
    }
    app.exit(0);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_versions() {
        assert_eq!(parse_version("0.2.1"), Some((0, 2, 1)));
        assert_eq!(parse_version("1.10.0"), Some((1, 10, 0)));
        assert_eq!(parse_version("0.2"), None);
        assert_eq!(parse_version("0.2.1.4"), None);
        assert_eq!(parse_version("a.b.c"), None);
    }

    #[test]
    fn picks_newest_installer_above_current() {
        let dir = std::env::temp_dir().join(format!("th-updater-test-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        for name in [
            "TrophyHunter_0.1.0_x64-setup.exe",
            "TrophyHunter_0.2.1_x64-setup.exe",
            "TrophyHunter_0.2.10_x64-setup.exe",
            "TrophyHunter_0.2.9_x64-setup.exe",
            "TrophyHunter_0.3_x64-setup.exe",
            "Otra_0.9.0_x64-setup.exe",
            "notas.txt",
        ] {
            fs::write(dir.join(name), b"").unwrap();
        }
        let found = newest_in(&dir, (0, 2, 1)).map(|(v, p)| (v, p.file_name().unwrap().to_string_lossy().into_owned()));
        assert_eq!(found, Some(((0, 2, 10), "TrophyHunter_0.2.10_x64-setup.exe".to_string())));
        assert_eq!(newest_in(&dir, (0, 2, 10)), None);
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn reads_manifest() {
        let m: Manifest = serde_json::from_str(r#"{"version":"0.2.4","notes":["Uno","Dos"],"installer":"TrophyHunter-setup.exe"}"#).unwrap();
        assert_eq!(parse_version(&m.version), Some((0, 2, 4)));
        assert_eq!(m.notes.len(), 2);
        let sin_notas: Manifest = serde_json::from_str(r#"{"version":"0.2.4","installer":"a.exe"}"#).unwrap();
        assert!(sin_notas.notes.is_empty());
    }
}
