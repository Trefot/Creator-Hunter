use tauri_plugin_sql::{Migration, MigrationKind};

mod backup;
mod live;
mod alerts;
mod alerts_core;
mod alerts_assets;
mod social_alerts;
mod social_events;
mod stream_core;
mod streaming;
mod studio_core;
mod studio_tools;
mod engagement;
mod music;
mod income_tracking;
mod discord;
mod discord_core;
mod game_broadcast;
mod game_tracking;
mod obs;
mod obs_protocol;
mod obs_store;
mod premigrate;
mod chat_commands;
mod chat_commands_core;
mod recap;
mod shorts;
mod episode;
mod episode_core;
mod media_jobs;
mod fortnite_counter;
mod metrics_core;
mod tiktok_auth_core;
mod social_metrics;
mod content_performance;
mod content_core;
mod shorts_core;
mod shorts_layout;
mod subtitles;
mod subtitles_core;
mod auto_moments_core;
mod auto_moments;
mod stream_prep;
mod recap_core;
mod data_safety;
mod updater;
mod psn;
mod pc_games;
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
        Migration {
            version: 15,
            description: "tamaño del icono y colores de texto",
            sql: include_str!("../migrations/015_counter_text.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 16,
            description: "sesiones y marcas de OBS",
            sql: include_str!("../migrations/016_obs_moments.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 17,
            description: "clips confirmados del Replay Buffer de OBS",
            sql: include_str!("../migrations/017_obs_clips.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 18,
            description: "ideas y proyectos relacionados con juegos",
            sql: include_str!("../migrations/018_game_ideas.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 19,
            description: "platinos y objetivos de emisión",
            sql: include_str!("../migrations/019_game_broadcast.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 20,
            description: "preferencias de alertas independientes",
            sql: include_str!("../migrations/020_alert_settings.sql"),
            kind: MigrationKind::Up,
        },
        Migration {version:21,description:"Audio personalizado y eventos sociales",sql:include_str!("../migrations/021_alert_media_events.sql"),kind:MigrationKind::Up},
        Migration {
            version: 22,
            description: "resumen del directo",
            sql: include_str!("../migrations/022_stream_recap.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 23,
            description: "clips para shorts",
            sql: include_str!("../migrations/023_clip_exports.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 24,
            description: "habito de produccion",
            sql: include_str!("../migrations/024_work_plan.sql"),
            kind: MigrationKind::Up,
        },
        Migration {version:25,description:"publicaciones, métricas históricas y preferencias respaldadas",sql:include_str!("../migrations/025_content_performance.sql"),kind:MigrationKind::Up},
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
        .manage(alerts::AlertsState::default())
        .manage(social_alerts::SocialState::default())
        .manage(streaming::StreamingState::default())
        .manage(studio_tools::StudioState::default())
        .manage(engagement::EngagementState::default())
        .manage(music::MusicState::default())
        .manage(discord::DiscordState::default())
        .manage(obs::ObsState::default())
        .manage(auto_moments::AutoMomentsState::default())
        .manage(fortnite_counter::FortniteCounterState::default())
        .manage(social_metrics::MetricsState::default())
        .manage(content_performance::ContentState::default())
        .manage(premigrate::Preparation::default())
        .setup(|app| {
            if let Some(window) = tauri::Manager::get_webview_window(app, "main") {
                window.set_icon(tauri::include_image!("icons/128x128.png"))?;
            }
            // La interfaz espera a prepare_database antes de abrir SQLite (D-024).
            // D-019: la versión de pruebas se distingue a simple vista.
            #[cfg(debug_assertions)]
            if let Some(window) = tauri::Manager::get_webview_window(app, "main") {
                let _ = window.set_title("Nexus Studio · PRUEBAS");
            }
            media_jobs::init(app.handle());
            fortnite_counter::start(app.handle().clone());
            live::start(app.handle().clone());
            social_alerts::start(app.handle().clone());
            discord::start(app.handle().clone());
            streaming::start(app.handle().clone());
            engagement::start(app.handle().clone());
            music::start(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            auto_moments::auto_moments_status,
            auto_moments::auto_moments_activity,
            auto_moments::auto_moments_configure,
            auto_moments::auto_moments_control,
            auto_moments::auto_moments_review,
            auto_moments::auto_moments_delete_file,
            auto_moments::auto_moments_languages,
            auto_moments::auto_moments_cleanup,
            shorts::shorts_status,
            shorts::shorts_install_ffmpeg,
            shorts::shorts_render,
            shorts::studio_export_project,
            shorts::shorts_preview,
            shorts::shorts_video_preview,
            shorts::media_relink,
            shorts::shorts_plan,
            shorts::media_inspect,
            social_metrics::metrics_status,
            content_performance::content_sync,
            social_metrics::metrics_tiktok_begin,
            social_metrics::metrics_tiktok_reconnect,
            social_metrics::metrics_tiktok_cancel,
            social_metrics::metrics_connect_meta,
            social_metrics::metrics_connect_tiktok,
            social_metrics::metrics_sync,
            social_metrics::metrics_control,
            fortnite_counter::fortnite_counter_status,
            fortnite_counter::counter_correct,
            fortnite_counter::fortnite_counter_configure,
            media_jobs::media_jobs_status,
            media_jobs::media_jobs_stop_for_exit,
            media_jobs::media_jobs_cancel,
            media_jobs::media_jobs_light,
            media_jobs::media_gpu_test,
            shorts::shorts_list,
            subtitles::subtitles_status,
            subtitles::subtitles_install,
            subtitles::subtitles_recordings,
            subtitles::subtitles_chapters,
            subtitles::subtitles_generate,
            subtitles::choose_video_file,
            subtitles::subtitles_relink,
            subtitles::subtitles_burn,
            episode::episode_frame,
            episode::episode_saved,
            episode::episode_render,
            subtitles::subtitles_read_text,
            subtitles::subtitles_save_text,
            subtitles::subtitles_import,
            chat_commands::chat_commands_get,
            chat_commands::chat_commands_save,
            chat_commands::chat_commands_preview,
            stream_prep::twitch_scopes,
            stream_prep::stream_title_get,
            stream_prep::stream_title_set,
            recap::stream_recaps,
            recap::stream_recap,
            recap::stream_recap_seen,
            recap::stream_events_recent,
            recap::stream_recap_discord_preview,
            recap::stream_recap_discord,
            premigrate::prepare_database,
            backup::export_backup,
            backup::automatic_backup,
            backup::export_diagnostics,
            income_tracking::income_receive_expected,
            backup::import_backup,
            youtube::youtube_import_client,
            youtube::youtube_status,
            youtube::youtube_connect,
            youtube::youtube_channel,
            youtube::youtube_sync,
            youtube::youtube_video_stats,
            youtube::youtube_recent_uploads,
            psn::psn_connect,
            psn::psn_status,
            psn::psn_disconnect,
            psn::psn_titles,
            psn::psn_title_trophies,
            psn::psn_download_image,
            psn::psn_now_playing,
            pc_games::pc_now_playing,
            pc_games::pc_installed_games,
            pc_games::pc_running_apps,
            youtube::youtube_disconnect,
            obs::obs_initialize,
            obs::obs_status,
            obs::obs_cabina,
            obs::obs_choose_scene,
            obs::obs_configure,
            obs::obs_disconnect,
            obs::obs_context,
            obs::obs_mark,
            obs::obs_markers,
            obs::obs_save_replay,
            obs::obs_clips,
            game_tracking::game_target_change,
            game_tracking::game_targets,
            game_tracking::game_broadcast_state,
            game_tracking::game_broadcast_action,
            game_tracking::obs_capture,
            game_tracking::obs_sources,
            discord::discord_status,
            discord::discord_brand_image,
            discord::discord_configure,
            discord::discord_remove,
            discord::discord_test,
            discord::discord_publish,
            studio_tools::studio_capture_project,
            studio_tools::studio_resume,
            studio_tools::studio_obs_measure,
            studio_tools::studio_obs_apply,
            studio_tools::studio_obs_restore,
            engagement::studio_voices,
            engagement::studio_tts_configure,
            engagement::studio_tts_control,
            engagement::studio_tts_status,
            engagement::studio_tts_test,
            engagement::studio_reward_create,
            music::spotify_begin,
            music::spotify_refresh,
            music::spotify_control,
            music::spotify_disconnect,
            music::music_status,
            music::music_import,
            music::music_remove,
            music::music_requests_enable,
            music::music_manual,
            music::music_reward_create,
            music::music_request_resolve,
            music::music_play,
            music::music_volume,
            music::music_duck,
            streaming::stream_chat,
            streaming::stream_chat_enable,
            streaming::stream_chat_clear,
            streaming::stream_game_context,
            streaming::stream_settings,
            streaming::stream_category_enable,
            streaming::stream_category_search,
            streaming::stream_category_bind,
            social_alerts::social_status,
            social_alerts::social_enable,
            social_alerts::twitch_begin,
            social_alerts::twitch_reauthorize,
            social_alerts::twitch_finish,
            social_alerts::twitch_disconnect,
            alerts::alerts_import_audio,
            alerts::alerts_audio_data,
            alerts::alerts_status,
            alerts::alerts_save,
            alerts::alerts_save_event,
            alerts::alerts_asset,
            alerts::alerts_audio,
            alerts::alerts_action,
            alerts::alerts_announce,
            live::live_status,
            live::live_notify,
            updater::update_check,
            updater::update_apply,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| { if matches!(event, tauri::RunEvent::ExitRequested { .. }) { fortnite_counter::stop(app);
                media_jobs::shutdown(); std::thread::sleep(std::time::Duration::from_millis(250)); } });
}
