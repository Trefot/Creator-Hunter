# Pruebas de captura

Ejecuta `cargo test --locked --manifest-path tests/auto-moments/Cargo.toml`.

`build.rs` importa los cuatro módulos reales de captura y Shorts, retirando únicamente las macros de comandos y redirigiendo Tauri al adaptador de prueba. SQLite y las reglas de captura son reales; OBS, la apertura del reproductor y los eventos de la ventana se simulan. Nunca se abre el micrófono. En Windows se valida la sintaxis de PowerShell; en Linux, si existe ffmpeg, se verifica una exportación sintética real. El trabajo normal de publicación compila además Tauri completo.
