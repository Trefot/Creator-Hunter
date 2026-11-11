use tauri_plugin_sql::{Migration, MigrationKind};

mod backup;
mod live;
mod premigrate;
mod updater;
mod psn;
mod youtube;

/// Archivo de la base de datos, dentro de la carpeta de datos de la app.
/// El frontend la abre con la misma cadena (ver src/db/database.ts).
/// D-019: la versión de desarrollo usa su propia base de pruebas y nunca toca los datos reales.
pub(crate) const DB_URL: &str = if cfg!(debug_assertions) { "sqlite:studio-dev.db" } else { "sqlite:studio.db" };

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
        Migration {
            version: 7,
            description: "juegos, trofeos, fases y objetivos",
            sql: include_str!("../migrations/007_games.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "guía del juego",
            sql: include_str!("../migrations/008_game_guide.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "partidas del día y objetivos",
            sql: include_str!("../migrations/009_play_sessions.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 10,
            description: "progreso de coleccionables",
            sql: include_str!("../migrations/010_collection_items.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 11,
            description: "puntos propios por trofeo",
            sql: include_str!("../migrations/011_trophy_tasks.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 12,
            description: "contadores del Live Studio",
            sql: include_str!("../migrations/012_counters.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 13,
            description: "aspecto de los contadores",
            sql: include_str!("../migrations/013_counter_style.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 14,
            description: "estilo y sonido de los contadores",
            sql: include_str!("../migrations/014_counter_fx.sql"),
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
        .manage(psn::PsnState::default())
        .manage(live::LiveState::default())
        .setup(|app| {
            // D-020: copia de los datos antes de aplicar migraciones nuevas (el frontend aún no abrió la base).
            let latest = migrations().iter().map(|m| m.version).max().unwrap_or(0);
            match premigrate::backup_if_pending(app.handle(), latest) {
                Ok(Some(path)) => eprintln!("Copia antes de migrar: {path}"),
                Ok(None) => {}
                Err(e) => eprintln!("Aviso: {e}"),
            }
            // D-019: la versión de pruebas se distingue a simple vista.
            #[cfg(debug_assertions)]
            if let Some(window) = tauri::Manager::get_webview_window(app, "main") {
                let _ = window.set_title("TrophyHunter · PRUEBAS");
            }
            live::start(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            backup::export_backup,
            backup::import_backup,
            youtube::youtube_import_client,
            youtube::youtube_status,
            youtube::youtube_connect,
            youtube::youtube_channel,
            youtube::youtube_sync,
            youtube::youtube_video_stats,
            psn::psn_connect,
            psn::psn_status,
            psn::psn_disconnect,
            psn::psn_titles,
            psn::psn_title_trophies,
            psn::psn_download_image,
            psn::psn_now_playing,
            youtube::youtube_disconnect,
            live::live_status,
            live::live_notify,
            updater::update_check,
            updater::update_apply,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
