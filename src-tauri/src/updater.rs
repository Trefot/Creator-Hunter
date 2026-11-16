//! Actualizaciones públicas por HTTPS. No usa Git ni comparte su caché/bloqueos.
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
    sync::atomic::{AtomicBool, Ordering},
    time::Duration,
};
use tauri::{AppHandle, Manager};
const PREFIX: &str = "TrophyHunter_";
const SUFFIX: &str = "_x64-setup.exe";
const CHANNEL: &str =
    "https://raw.githubusercontent.com/Trefot/Creator-Hunter/releases/latest.json";
static APPLYING: AtomicBool = AtomicBool::new(false);
struct ApplyGuard;
impl Drop for ApplyGuard {
    fn drop(&mut self) {
        APPLYING.store(false, Ordering::Release);
    }
}
type Version = (u32, u32, u32);
pub fn parse_version(text: &str) -> Option<Version> {
    let text = text.trim();
    let mut p = text.split('.');
    let mut next = || {
        p.next()
            .filter(|s| !s.is_empty() && s.bytes().all(|b| b.is_ascii_digit()))
            .and_then(|s| s.parse::<u32>().ok())
    };
    let v = (next()?, next()?, next()?);
    if p.next().is_some() {
        return None;
    }
    Some(v)
}
pub fn newest_in(dir: &Path, current: Version) -> Option<(Version, PathBuf)> {
    fs::read_dir(dir)
        .ok()?
        .filter_map(Result::ok)
        .filter_map(|e| {
            if !e.file_type().ok()?.is_file() {
                return None;
            }
            let name = e.file_name().into_string().ok()?;
            let version = parse_version(
                name.strip_prefix(PREFIX)
                    .or_else(|| name.strip_prefix("Nexus-Studio_"))?
                    .strip_suffix(SUFFIX)?,
            )?;
            Some((version, e.path()))
        })
        .filter(|(v, _)| *v > current)
        .max_by_key(|(v, _)| *v)
}
#[derive(Deserialize)]
pub struct Manifest {
    pub version: String,
    #[serde(default)]
    pub notes: Vec<String>,
    pub installer: String,
    #[serde(default)]
    pub sha256: Option<String>,
    #[serde(default)]
    pub size: Option<u64>,
}
#[derive(Serialize, Clone)]
pub struct UpdateInfo {
    pub version: String,
    pub notes: Vec<String>,
    pub source: String,
}
enum Found {
    GitHub {
        info: UpdateInfo,
        sha: String,
        size: u64,
    },
    Folder {
        info: UpdateInfo,
        setup: PathBuf,
    },
}
fn installers_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .document_dir()
        .map_err(|e| e.to_string())?
        .join("TrophyHunter")
        .join("Instaladores"))
}
fn http(timeout: u64) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(timeout))
        .https_only(true)
        .user_agent("Nexus-Studio-Updater")
        .build()
        .map_err(|_| "No se pudo iniciar la conexión de actualización.".into())
}
fn integrity(m: &Manifest) -> Result<(String, u64), String> {
    if m.installer.contains(['/', '\\', ':']) || !m.installer.ends_with(".exe") {
        return Err("Nombre de instalador no válido.".into());
    }
    let sha = m
        .sha256
        .as_deref()
        .filter(|s| s.len() == 64 && s.bytes().all(|b| b.is_ascii_hexdigit()))
        .ok_or("El canal no incluye un SHA256 válido.")?;
    let size = m
        .size
        .filter(|n| *n >= 160 && *n <= 128 * 1024 * 1024)
        .ok_or("El canal no incluye un tamaño de instalador válido.")?;
    Ok((sha.to_ascii_lowercase(), size))
}
async fn limited(mut r: reqwest::Response, limit: usize) -> Result<Vec<u8>, String> {
    if !r.status().is_success() {
        return Err(format!(
            "GitHub rechazó la descarga ({}).",
            r.status().as_u16()
        ));
    }
    if r.content_length().is_some_and(|n| n > limit as u64) {
        return Err("La descarga supera el tamaño esperado.".into());
    }
    let mut b = Vec::new();
    while let Some(chunk) = r
        .chunk()
        .await
        .map_err(|_| "La descarga se interrumpió. Puedes reintentar.")?
    {
        if chunk.len() > limit.saturating_sub(b.len()) {
            return Err("La descarga supera el tamaño esperado.".into());
        }
        b.extend_from_slice(&chunk);
    }
    Ok(b)
}
async fn check_github(current: Version) -> Result<Option<Found>, String> {
    let nonce = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let r = http(20)?
        .get(CHANNEL)
        .query(&[("nexus", nonce)])
        .header("Cache-Control", "no-cache")
        .send()
        .await
        .map_err(
            |_| "No se pudo consultar GitHub por HTTPS. Revisa la conexión e inténtalo de nuevo.",
        )?;
    let raw = limited(r, 256 * 1024).await?;
    let m: Manifest = serde_json::from_slice(&raw)
        .map_err(|_| "GitHub devolvió un canal de actualización no válido.")?;
    let v = parse_version(&m.version).ok_or("Versión no válida en el canal de actualizaciones.")?;
    if v <= current {
        return Ok(None);
    }
    let (sha, size) = integrity(&m)?;
    Ok(Some(Found::GitHub {
        info: UpdateInfo {
            version: format!("{}.{}.{}", v.0, v.1, v.2),
            notes: m.notes,
            source: "github".into(),
        },
        sha,
        size,
    }))
}
fn check_folder(app: &AppHandle, current: Version) -> Option<Found> {
    let ((a, b, c), setup) = newest_in(&installers_dir(app).ok()?, current)?;
    Some(Found::Folder {
        info: UpdateInfo {
            version: format!("{a}.{b}.{c}"),
            notes: vec![],
            source: "carpeta".into(),
        },
        setup,
    })
}
async fn pending(app: &AppHandle) -> Result<Option<Found>, String> {
    if cfg!(debug_assertions) {
        return Ok(None);
    }
    let current = parse_version(&app.package_info().version.to_string())
        .ok_or("Versión instalada no válida.")?;
    match check_github(current).await {
        Ok(Some(f)) => Ok(Some(f)),
        Ok(None) => Ok(check_folder(app, current)),
        Err(e) => check_folder(app, current).map(Some).ok_or(e),
    }
}
fn verify(bytes: &[u8], sha: &str, size: u64) -> Result<(), String> {
    if bytes.len() as u64 != size || format!("{:x}", Sha256::digest(bytes)) != sha {
        return Err("El instalador no coincide con su tamaño o SHA256. No se ejecutará; vuelve a descargarlo.".into());
    }
    if bytes.len() < 160 || &bytes[..2] != b"MZ" {
        return Err("El archivo no es un instalador de Windows.".into());
    }
    let o = u32::from_le_bytes(bytes[60..64].try_into().unwrap()) as usize;
    if o < 64
        || o.checked_add(24).is_none_or(|n| n > bytes.len())
        || bytes.get(o..o + 4) != Some(&[80, 69, 0, 0])
    {
        return Err("La cabecera del instalador de Windows no es válida.".into());
    }
    Ok(())
}
#[tauri::command]
pub async fn update_check(app: AppHandle) -> Result<Option<UpdateInfo>, String> {
    Ok(pending(&app).await?.map(|f| match f {
        Found::GitHub { info, .. } | Found::Folder { info, .. } => info,
    }))
}
#[tauri::command]
pub async fn update_apply(app: AppHandle) -> Result<(), String> {
    APPLYING
        .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
        .map_err(|_| "Ya hay una actualización en curso.".to_string())?;
    let _guard = ApplyGuard;
    if crate::obs::media_busy(&app) { return Err("Termina la grabación o emisión antes de instalar. La actualización queda disponible.".into()); }
    let jobs=crate::media_jobs::media_jobs_status(app.clone());
    if jobs["jobs"].as_array().is_some_and(|jobs|jobs.iter().any(|j|j["state"]=="running"||j["state"]=="queued")){return Err("Espera a que termine el procesamiento antes de actualizar.".into())}
    let setup = match pending(&app)
        .await?
        .ok_or("No hay ninguna actualización pendiente.")?
    {
        Found::Folder { setup, info } => {
            let current=parse_version(&app.package_info().version.to_string()).ok_or("Versión instalada no válida.")?;
            let trusted=check_github(current).await?;
            let Some(Found::GitHub {info:remote_info,sha,size})=trusted else {return Err("No se pudo verificar el instalador local con el canal oficial. Descarga la actualización oficial.".into())};
            if remote_info.version!=info.version{return Err("El instalador local no coincide con la versión oficial disponible.".into())}
            let bytes=fs::read(&setup).map_err(|_|"No se pudo leer el instalador local.")?;verify(&bytes,&sha,size)?;setup
        },
        Found::GitHub { info, sha, size } => {
            let url = format!(
                "https://github.com/Trefot/Creator-Hunter/releases/download/v{}/Nexus-Studio_{}_x64-setup.exe",
                info.version, info.version
            );
            let r = http(120)?
                .get(url)
                .send()
                .await
                .map_err(|_| "No se pudo descargar el instalador por HTTPS.")?;
            let bytes = limited(r, size as usize).await?;
            verify(&bytes, &sha, size)?;
            let path = std::env::temp_dir().join(format!(
                "Nexus-Studio_{}-{}_x64-setup.exe",
                info.version,
                rand::random::<u64>()
            ));
            fs::write(&path, &bytes)
                .map_err(|_| "No se pudo guardar el instalador en la carpeta temporal.")?;
            path
        }
    };
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        let line = format!(
            r#"/C ping -n 3 127.0.0.1 >nul & "{}" /S & start "" "{}""#,
            setup.display(),
            exe.display()
        );
        Command::new("cmd")
            .raw_arg(line)
            .creation_flags(0x0800_0000)
            .spawn()
            .map_err(|e| format!("No se pudo lanzar la actualización: {e}"))?;
    }
    #[cfg(not(windows))]
    let _ = setup;
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
        let found = newest_in(&dir, (0, 2, 1))
            .map(|(v, p)| (v, p.file_name().unwrap().to_string_lossy().into_owned()));
        assert_eq!(
            found,
            Some(((0, 2, 10), "TrophyHunter_0.2.10_x64-setup.exe".to_string()))
        );
        assert_eq!(newest_in(&dir, (0, 2, 10)), None);
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn reads_manifest() {
        let m: Manifest = serde_json::from_str(
            r#"{"version":"0.2.4","notes":["Uno","Dos"],"installer":"TrophyHunter-setup.exe"}"#,
        )
        .unwrap();
        assert_eq!(parse_version(&m.version), Some((0, 2, 4)));
        assert_eq!(m.notes.len(), 2);
        let sin_notas: Manifest =
            serde_json::from_str(r#"{"version":"0.2.4","installer":"a.exe"}"#).unwrap();
        assert!(sin_notas.notes.is_empty());
    }
    #[test]
    fn remote_installer_requires_hash_size_and_real_pe_header() {
        let mut bytes = vec![0u8; 160];
        bytes[..2].copy_from_slice(b"MZ");
        bytes[60..64].copy_from_slice(&128u32.to_le_bytes());
        bytes[128..132].copy_from_slice(&[80, 69, 0, 0]);
        let sha = format!("{:x}", Sha256::digest(&bytes));
        assert!(verify(&bytes, &sha, 160).is_ok());
        assert!(verify(&bytes, &sha, 161).is_err());
        let mut corrupt = bytes.clone();
        corrupt[140] = 1;
        assert!(verify(&corrupt, &sha, 160).is_err());
        let zip = vec![b'P'; 160];
        let hash = format!("{:x}", Sha256::digest(&zip));
        assert!(verify(&zip, &hash, 160).is_err());
        let mut manifest = Manifest {
            version: "0.2.24".into(),
            notes: vec![],
            installer: "TrophyHunter-setup.exe".into(),
            sha256: Some(sha),
            size: Some(160),
        };
        assert!(integrity(&manifest).is_ok());
        manifest.installer = "../installer.exe".into();
        assert!(integrity(&manifest).is_err());
        manifest.installer = "installer.exe".into();
        manifest.sha256 = None;
        assert!(integrity(&manifest).is_err());
    }
    #[test]
    fn accepts_modern_local_installer_name_and_rejects_signed_versions() {
        let dir =
            std::env::temp_dir().join(format!("nexus-updater-modern-{}", rand::random::<u64>()));
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("Nexus-Studio_0.2.24_x64-setup.exe"), b"test").unwrap();
        assert_eq!(newest_in(&dir, (0, 2, 23)).unwrap().0, (0, 2, 24));
        fs::remove_dir_all(dir).unwrap();
        assert!(parse_version("0.2.+24").is_none());
        assert!(parse_version("0.2.-1").is_none());
    }
    #[test]
    fn limits_streamed_downloads_and_rejects_http_errors() {
        fn response(raw: &'static [u8]) -> reqwest::Response {
            use std::io::{Read, Write};
            let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
            let addr = listener.local_addr().unwrap();
            std::thread::spawn(move || {
                let (mut socket, _) = listener.accept().unwrap();
                let mut buffer = [0; 4096];
                let _ = socket.read(&mut buffer);
                socket.write_all(raw).unwrap();
            });
            tauri::async_runtime::block_on(
                reqwest::Client::new()
                    .get(format!("http://{addr}/fixture"))
                    .send(),
            )
            .unwrap()
        }
        let r = response(b"HTTP/1.1 200 OK\r\nContent-Length: 4\r\nConnection: close\r\n\r\ntest");
        assert_eq!(
            tauri::async_runtime::block_on(limited(r, 4)).unwrap(),
            b"test"
        );
        let r=response(b"HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n4\r\ntest\r\n4\r\nmore\r\n0\r\n\r\n");
        assert!(tauri::async_runtime::block_on(limited(r, 4)).is_err());
        let r =
            response(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
        assert!(tauri::async_runtime::block_on(limited(r, 4)).is_err());
    }
}
