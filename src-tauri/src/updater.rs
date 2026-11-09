//! Actualización automática de la app instalada (D-021).
//!
//! Claude deja cada versión nueva en Documentos\TrophyHunter\Instaladores
//! (`TrophyHunter_X.Y.Z_x64-setup.exe`). La app instalada busca ahí una versión mayor que la suya;
//! si la encuentra, se cierra, ejecuta el instalador en silencio (`/S`, sin permisos de
//! administrador porque se instala para el usuario) y se vuelve a abrir.
//! En la versión de pruebas no hace nada.

use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::{AppHandle, Manager};

const PREFIX: &str = "TrophyHunter_";
const SUFFIX: &str = "_x64-setup.exe";

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

fn installers_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().document_dir().map_err(|e| e.to_string())?.join("TrophyHunter").join("Instaladores"))
}

fn pending(app: &AppHandle) -> Option<(Version, PathBuf)> {
    if cfg!(debug_assertions) {
        return None; // la versión de pruebas nunca se actualiza sola
    }
    let current = parse_version(&app.package_info().version.to_string())?;
    newest_in(&installers_dir(app).ok()?, current)
}

#[derive(Serialize)]
pub struct UpdateInfo {
    pub version: String,
}

/// ¿Hay una versión más nueva esperando en la carpeta de instaladores?
#[tauri::command]
pub fn update_check(app: AppHandle) -> Option<UpdateInfo> {
    pending(&app).map(|((a, b, c), _)| UpdateInfo { version: format!("{a}.{b}.{c}") })
}

/// Instala la versión nueva en silencio y vuelve a abrir la app.
#[tauri::command]
pub fn update_apply(app: AppHandle) -> Result<(), String> {
    let (_, setup) = pending(&app).ok_or("No hay ninguna actualización pendiente.")?;
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        // Espera ~2 s a que la app se cierre, instala en silencio y la vuelve a abrir.
        // `ping` sirve de pausa porque funciona sin consola visible (`timeout` no).
        let line = format!(
            "/C ping -n 3 127.0.0.1 >nul & \"{}\" /S & start \"\" \"{}\"",
            setup.display(),
            exe.display()
        );
        std::process::Command::new("cmd")
            .raw_arg(line)
            .creation_flags(CREATE_NO_WINDOW)
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
}
