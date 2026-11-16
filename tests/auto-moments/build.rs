use std::{env, fs, path::PathBuf};
fn main() {
    let source = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap()).join("../../src-tauri/src");
    let out = PathBuf::from(env::var("OUT_DIR").unwrap());
    let mut modules = String::new();
    for name in [
        "auto_moments",
        "auto_moments_core",
        "shorts",
        "shorts_core",
        "subtitles",
        "subtitles_core",
        "media_jobs",
        "fortnite_counter",
        "metrics_core",
    ] {
        let file = source.join(format!("{name}.rs"));
        println!("cargo:rerun-if-changed={}", file.display());
        let code = fs::read_to_string(file)
            .unwrap()
            .replace("#[tauri::command]", "")
            .replace("use tauri::", "use crate::tauri::")
            .replace(
                "use tauri_plugin_opener::",
                "use crate::tauri_plugin_opener::",
            )
            .replace("tauri::path::", "crate::tauri::path::")
            .replace("tauri::async_runtime", "crate::tauri::async_runtime");
        fs::write(out.join(format!("{name}.rs")), code).unwrap();
        modules.push_str(&format!(
            "#[path={:?}] mod {name};\n",
            out.join(format!("{name}.rs"))
        ));
    }
    let script = source.join("auto_moments_voice.ps1");
    println!("cargo:rerun-if-changed={}", script.display());
    fs::copy(script, out.join("auto_moments_voice.ps1")).unwrap();
    fs::write(out.join("modules.rs"), modules).unwrap();
}
