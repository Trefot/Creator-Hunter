//! Detección local por nombre de proceso. No lee memoria, ventanas ni archivos del juego.
use serde::Serialize;

#[derive(Serialize, Debug, PartialEq)]
pub struct PcGame {
    name: &'static str,
}

fn recognized_games(csv: &str) -> Vec<PcGame> {
    // tasklist /FO CSV: solo interesa el primer campo, nunca PID, usuario o consumo.
    let fortnite = csv.lines().any(|line| {
        line.trim().strip_prefix('"').and_then(|s| s.split('"').next())
            .is_some_and(|name| name.eq_ignore_ascii_case("FortniteClient-Win64-Shipping.exe"))
    });
    if fortnite { vec![PcGame { name: "Fortnite" }] } else { vec![] }
}

#[tauri::command]
pub async fn pc_now_playing() -> Result<Vec<PcGame>, String> {
    #[cfg(windows)]
    {
        tauri::async_runtime::spawn_blocking(|| {
            use std::os::windows::process::CommandExt;
            let output = std::process::Command::new("tasklist.exe")
                .args(["/FO", "CSV", "/NH", "/FI", "IMAGENAME eq FortniteClient-Win64-Shipping.exe"])
                .creation_flags(0x0800_0000)
                .output().map_err(|e| format!("No se pudo comprobar Fortnite: {e}"))?;
            if !output.status.success() {
                return Err("Windows no pudo consultar los procesos del juego.".into());
            }
            Ok(recognized_games(&String::from_utf8_lossy(&output.stdout)))
        }).await.map_err(|e| e.to_string())?
    }
    #[cfg(not(windows))]
    Ok(vec![])
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn detects_actual_game_only_and_deduplicates() {
        assert!(recognized_games("\"EpicGamesLauncher.exe\",\"123\"\n\"FortniteLauncher.exe\",\"2\"\n\"FortniteClient-Win64-Shipping_EAC_EOS.exe\",\"3\"").is_empty());
        assert_eq!(recognized_games("\"FortniteClient-Win64-Shipping.exe\",\"123\"\n\"FORTNITECLIENT-WIN64-SHIPPING.EXE\",\"456\""), vec![PcGame { name: "Fortnite" }]);
    }
    #[test]
    fn handles_empty_localized_and_malformed_output() {
        for value in ["", "INFO: No hay tareas ejecutándose.", "FortniteClient-Win64-Shipping.exe", "\"FakeFortniteClient-Win64-Shipping.exe\",\"1\""] {
            assert!(recognized_games(value).is_empty());
        }
    }
}
