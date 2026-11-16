//! Detección por nombres de procesos, sin leer memoria ni archivos de los juegos.
use serde::{Deserialize, Serialize};

#[derive(Serialize, Debug, PartialEq)]
pub struct PcGame {
    name: String,
    process: String,
    game_id: Option<String>,
}
#[derive(Deserialize)]
pub struct ProcessBinding {
    game_id: String,
    name: String,
    process: String,
}
fn executable(value: &str) -> bool {
    !value.trim().is_empty()
        && value.len() <= 255
        && value.to_ascii_lowercase().ends_with(".exe")
        && !value
            .chars()
            .any(|c| c.is_control() || matches!(c, '/' | '\\' | ':'))
}
fn recognized_games(csv: &str, bindings: &[ProcessBinding]) -> Vec<PcGame> {
    let mut games = Vec::new();
    for line in csv.lines() {
        let Some(process) = line
            .trim()
            .strip_prefix('"')
            .and_then(|s| s.split('"').next())
        else {
            continue;
        };
        if !executable(process)
            || games
                .iter()
                .any(|g: &PcGame| g.process.eq_ignore_ascii_case(process))
        {
            continue;
        }
        let bound = bindings
            .iter()
            .find(|b| executable(&b.process) && b.process.eq_ignore_ascii_case(process));
        let known = match process.to_ascii_lowercase().as_str() {
            "fortniteclient-win64-shipping.exe" => Some("Fortnite"),
            "7ds.exe" => Some("7DS"),
            "b1-win64-shipping.exe" => Some("Black Myth: Wukong"),
            _ => None,
        };
        if let Some(binding) = bound {
            games.push(PcGame {
                name: binding.name.clone(),
                process: process.into(),
                game_id: Some(binding.game_id.clone()),
            });
        } else if let Some(name) = known {
            games.push(PcGame {
                name: name.into(),
                process: process.into(),
                game_id: None,
            });
        }
    }
    games.sort_by(|a, b| a.name.cmp(&b.name));
    games
}
#[tauri::command]
pub async fn pc_now_playing(bindings: Option<Vec<ProcessBinding>>) -> Result<Vec<PcGame>, String> {
    #[cfg(windows)]
    {
        tauri::async_runtime::spawn_blocking(move || {
            use std::os::windows::process::CommandExt;
            let out = std::process::Command::new("tasklist.exe")
                .args(["/FO", "CSV", "/NH"])
                .creation_flags(0x0800_0000)
                .output()
                .map_err(|e| format!("No se pudo consultar los juegos abiertos: {e}"))?;
            if !out.status.success() {
                return Err("Windows no pudo consultar los procesos.".into());
            }
            Ok(recognized_games(
                &String::from_utf8_lossy(&out.stdout),
                &bindings.unwrap_or_default(),
            ))
        })
        .await
        .map_err(|e| e.to_string())?
    }
    #[cfg(not(windows))]
    {
        let _ = bindings;
        Ok(vec![])
    }
}
/// Lista solo ejecutables con ventana visible, para que el usuario elija el juego.
/// Nunca usa nombres o rutas aportados por el usuario en un comando del sistema.
#[tauri::command]
pub async fn pc_running_apps() -> Result<Vec<String>, String> {
    #[cfg(windows)]
    {
        tauri::async_runtime::spawn_blocking(||{
            use std::os::windows::process::CommandExt;
            let out=std::process::Command::new("powershell.exe").args(["-NoProfile","-NonInteractive","-Command",
                "[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new(); $ErrorActionPreference='Stop'; @(Get-Process | Where-Object { $_.MainWindowHandle -ne 0 } | ForEach-Object { $_.ProcessName + '.exe' } | Sort-Object -Unique) | ConvertTo-Json -Compress"])
                .creation_flags(0x0800_0000).output().map_err(|_|"No se pudieron consultar las aplicaciones abiertas.")?;
            if !out.status.success(){return Err("Windows no pudo listar las aplicaciones. Puedes escribir el ejecutable manualmente.".into());}
            let raw=String::from_utf8_lossy(&out.stdout);let raw=raw.trim().trim_start_matches('\u{feff}');
            if raw.is_empty(){return Ok(vec![]);}
            let v:serde_json::Value=serde_json::from_str(raw).map_err(|_|"Windows devolvió una lista no válida.")?;
            let mut names:Vec<String>=if let Some(s)=v.as_str(){vec![s.into()]}else{v.as_array().into_iter().flatten().filter_map(|s|s.as_str().map(String::from)).collect()};
            names.retain(|s|executable(s));names.sort();names.dedup();Ok(names)
        }).await.map_err(|e|e.to_string())?
    }
    #[cfg(not(windows))]
    Ok(vec![])
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn known_games_exclude_launchers_and_deduplicate() {
        assert!(recognized_games("\"EpicGamesLauncher.exe\",\"1\"\n\"FortniteLauncher.exe\",\"2\"\n\"FortniteClient-Win64-Shipping_EAC_EOS.exe\",\"3\"",&[]).is_empty());
        let g = recognized_games(
            "\"7ds.exe\",\"1\"\n\"7DS.EXE\",\"2\"\n\"FortniteClient-Win64-Shipping.exe\",\"3\"",
            &[],
        );
        assert_eq!(g.len(), 2);
        assert_eq!(g[0].name, "7DS");
    }
    #[test]
    fn custom_binding_recognizes_other_games_without_guessing() {
        let binding = ProcessBinding {
            game_id: "my-game".into(),
            name: "Mi juego".into(),
            process: "Game-Win64-Shipping.exe".into(),
        };
        let g = recognized_games("\"game-win64-shipping.exe\",\"123\"", &[binding]);
        assert_eq!(g[0].game_id.as_deref(), Some("my-game"));
        assert_eq!(g[0].name, "Mi juego");
        assert!(recognized_games("\"SomeOtherGame.exe\",\"2\"", &[]).is_empty());
        assert!(!executable("C:\\game.exe"));
        assert!(!executable("game.exe\n"));
    }
}

#[derive(Serialize)]
pub struct InstalledGame {name:String,launcher:String}
/// Reads only local launcher manifests. Import is a separate user action; no accounts or game files are modified.
#[tauri::command]
pub fn pc_installed_games()->Vec<InstalledGame>{
 use std::path::PathBuf;
 let mut roots=Vec::new();
 for var in ["ProgramFiles(x86)","ProgramFiles"]{if let Some(base)=std::env::var_os(var){roots.push(PathBuf::from(base).join("Steam/steamapps"));}}
 let initial=roots.clone();
 for root in initial{if let Ok(v)=std::fs::read_to_string(root.join("libraryfolders.vdf")){for line in v.lines(){let parts:Vec<_>=line.split('"').collect();if parts.get(1)==Some(&"path"){if let Some(path)=parts.get(3){if path.len()<1024&&!path.starts_with("\\\\"){let p=PathBuf::from(path.replace("\\\\","\\")).join("steamapps");if !roots.contains(&p){roots.push(p)}}}}}}}
 let mut found=Vec::new();
 for root in roots{if let Ok(entries)=std::fs::read_dir(root){for e in entries.filter_map(Result::ok){let name=e.file_name().to_string_lossy().into_owned();if !name.starts_with("appmanifest_")||!name.ends_with(".acf")||e.metadata().map(|m|m.len()>1024*1024).unwrap_or(true){continue}
  if let Ok(v)=std::fs::read_to_string(e.path()){for line in v.lines(){let parts:Vec<_>=line.split('"').collect();if parts.get(1)==Some(&"name"){if let Some(name)=parts.get(3){if !name.trim().is_empty()&&name.len()<300{found.push(InstalledGame{name:name.to_string(),launcher:"Steam".into()})}}}}}
 }}}
 if let Some(base)=std::env::var_os("ProgramData"){let path=PathBuf::from(base).join("Epic/EpicGamesLauncher/Data/Manifests");if let Ok(entries)=std::fs::read_dir(path){for e in entries.filter_map(Result::ok){if e.path().extension().and_then(|s|s.to_str())!=Some("item")||e.metadata().map(|m|m.len()>1024*1024).unwrap_or(true){continue}if let Ok(text)=std::fs::read_to_string(e.path()){if let Ok(v)=serde_json::from_str::<serde_json::Value>(&text){if v["bIsIncompleteInstall"]==true{continue}if let Some(name)=v["DisplayName"].as_str().filter(|n|!n.trim().is_empty()&&n.len()<300){found.push(InstalledGame{name:name.into(),launcher:"Epic".into()})}}}}}}
 found.sort_by_key(|g|g.name.to_lowercase());found.dedup_by(|a,b|a.name.eq_ignore_ascii_case(&b.name));found.truncate(500);found
}
