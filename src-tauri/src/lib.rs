use tauri_plugin_sql::{Migration, MigrationKind};

mod backup;
mod youtube;

/// Archivo de la base de datos, dentro de la carpeta de datos de la app.
/// El frontend la abre con la misma cadena (ver src/db/database.ts).
pub(crate) const DB_URL: &str = "sqlite:studio.db";

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
        Migration {
            version: 3,
            description: "foto de perfil y miniatura de adaptación",
            sql: include_str!("../migrations/003_images.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "umbral de pago y saldo pendiente",
            sql: include_str!("../migrations/004_payout_thresholds.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "fecha del último cobro",
            sql: include_str!("../migrations/005_last_payout.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "origen manual/api y vistas totales",
            sql: include_str!("../migrations/006_api_source.sql"),
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
        .manage(youtube::YouTubeState::default())
        .invoke_handler(tauri::generate_handler![
            backup::export_backup,
            backup::import_backup,
            youtube::youtube_import_client,
            youtube::youtube_status,
            youtube::youtube_connect,
            youtube::youtube_channel,
            youtube::youtube_sync,
            youtube::youtube_disconnect,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
