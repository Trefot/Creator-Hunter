use tauri_plugin_sql::{Migration, MigrationKind};

/// Archivo de la base de datos, dentro de la carpeta de datos de la app.
/// El frontend la abre con la misma cadena (ver src/db/database.ts).
const DB_URL: &str = "sqlite:studio.db";

/// Migraciones de esquema, en orden. Una migración aplicada nunca se edita:
/// los cambios van siempre en una migración nueva.
fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "esquema inicial de Alpha 0.1",
            sql: include_str!("../migrations/001_initial.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "tipo de ingreso twitch_payout",
            sql: include_str!("../migrations/002_twitch_payout.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DB_URL, migrations())
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
