# ARCHITECTURE.md — Arquitectura y decisiones

## Visión general (Alpha 0.1)

```
┌──────────────────────────── App de escritorio (Tauri 2) ───────────────────────────┐
│  Interfaz: React + TypeScript (src/)                                              │
│        │  comandos de Tauri                                                       │
│        ▼                                                                          │
│  Núcleo: Rust (src-tauri/)  ──►  SQLite (archivo local en la carpeta de datos)    │
└───────────────────────────────────────────────────────────────────────────────────┘
```

Todo es local. No hay servidor, cuentas ni red. El backend en la nube aparece en la Fase II, cuando el bot de Discord y las integraciones necesiten funcionar con el PC apagado.

## Principios del modelo de datos

- **Una sola fuente de verdad.** El dashboard y el calendario son vistas calculadas sobre proyectos, adaptaciones y métricas; nunca copias.
- Cada tabla lleva `id` (UUID), `created_at`, `updated_at` y `workspace_id`. Hoy hay un único espacio de trabajo, pero esto permite pasar a SaaS sin rehacer los datos.
- Las migraciones de esquema están numeradas y versionadas en el repositorio.
- Los importes guardan cantidad y moneda (USD por defecto).
- La exportación es un archivo autocontenido y versionado que la importación sabe validar.

## Esquema de datos de Alpha 0.1 (aprobado el 2026-11-03)

```
workspace
├── profile ──┬── account_snapshot
│             └── goal (también puede ser global, sin perfil)
├── income (perfil opcional)
└── idea ──(aprobada)──► project
                           └── adaptation ──┬── adaptation_step
                                            ├── script_section
                                            └── result_snapshot
```

Todas las tablas incluyen además `id`, `workspace_id`, `created_at` y `updated_at`.

| Tabla | Campos principales | Notas |
|---|---|---|
| `workspace` | name, default_currency (`USD`) | Hoy hay uno solo. |
| `profile` | platform, handle, display_name, url, is_monetized, avatar?, payout_threshold_minor?, last_payout_on? | `platform` ∈ youtube, twitch, tiktok, instagram, facebook (lista en código, no tabla). Admite varias cuentas por red. Foto (003), umbral de pago (004) y último cobro (005). |
| `account_snapshot` | profile_id, recorded_on, followers, watch_hours | Registros fechados; nunca se sobrescriben. La columna `pending_minor` (004) existe pero no se usa (D-014). |
| `goal` | profile_id?, metric, target_value, deadline, status | `metric` ∈ followers, watch_hours, income, views. **El progreso se calcula**, no se guarda. |
| `income` | profile_id?, source, amount_minor, currency, received_on, note | `source` ∈ platform_ads, twitch_payout, membership, donation, sponsorship, affiliate, other. Los antiguos twitch_subs/bits/ads siguen siendo válidos, pero ya no se ofrecen (migración 002). |
| `idea` | title, description, tags, status | `status` ∈ new, approved, discarded. `tags` es texto simple en Alpha. |
| `project` | idea_id?, title, summary | Contenido "madre" que agrupa las adaptaciones. |
| `adaptation` | project_id, profile_id, format, title, scheduled_at?, published_at?, published_url?, thumbnail? | `format` ∈ long_video, short, tiktok, reel, post, live. **El calendario se deriva de `scheduled_at`.** |
| `adaptation_step` | adaptation_id, step, enabled, completed_at? | `step` ∈ script, recording, editing, scheduling, publishing, analysis. Cada paso se puede desactivar. **Estado actual = primer paso activo sin completar.** |
| `script_section` | adaptation_id, kind, position, content, est_seconds | `kind` ∈ hook, body, closing, cta, note. La duración total se calcula sumando. |
| `result_snapshot` | adaptation_id, recorded_on, views, likes, comments, shares, watch_hours, avg_viewers?, peak_viewers?, duration_min? | Registros fechados (día 1, 7, 30…). Los campos de directo solo se usan con `format = live`. |

Valores **derivados, nunca almacenados**: estado de producción, progreso de metas, totales de ingresos, duración de guiones, calendario y dashboard.

Las etapas Idea y Aprobación viven en `idea.status`. Al aprobar una idea se crea su `project`.

## Cómo crecerá el Core

El Core se construye **solo cuando una función real lo necesita**. Orden previsto: Identity → Event Engine → Integration Layer → Automation Engine → Approval System → Notification Engine → Analytics. En Alpha 0.1 el Core se limita a la configuración y al acceso a datos.

## Registro de decisiones

### D-001 · Tauri 2 + SQLite en lugar de web + IndexedDB (2026-11-03)
**Motivo:** el valor de la app son los datos del usuario. IndexedDB puede borrarse con el navegador y no es relacional. SQLite es un archivo propio, fácil de respaldar, y se migra casi directamente a Postgres en un futuro SaaS. Tauri, además, deja preparada la ventana flotante (Live Companion) y el acceso local a OBS. Pesa mucho menos que Electron.
**Coste:** requiere Rust y Visual Studio Build Tools en Windows.

### D-002 · Nombre interno neutro `studio` (2026-11-03)
**Motivo:** la marca está pendiente. El código, los paquetes y el identificador (`com.trefotg.studio`) no dependen de ella, así que renombrar solo afecta a los textos visibles.
**Nota:** el identificador determina la carpeta de datos local. No se cambia sin migrar los datos.

### D-003 · Proyecto fuera de OneDrive (2026-11-03)
**Motivo:** la sincronización de miles de archivos (`node_modules`, `target`) causa bloqueos y lentitud. El respaldo lo dan Git y un repositorio privado en GitHub.

### D-004 · Interfaz en español con textos centralizados (2026-11-03)
**Motivo:** preparar la traducción para el SaaS con un coste mínimo hoy.

### D-005 · Diseño del modelo de datos (2026-11-03)
- **Los directos son una adaptación** con `format = live`. Así aparecen en el calendario y comparten la tabla de resultados.
- **Las métricas son registros fechados** (`*_snapshot`), no números que se sobrescriben. Esto permite ver la evolución.
- **El dinero se guarda en unidades menores enteras** (`amount_minor`, centavos), para evitar errores de redondeo.
- **Los enumerados viven en el código**, no en tablas, mientras no los edite el usuario.
- Volumen esperado bajo (menos de 20 ideas y 1–3 proyectos activos): sin paginación ni búsqueda avanzada en Alpha.

### D-006 · Plugin oficial `tauri-plugin-sql` para SQLite (2026-11-03)
**Motivo:** es el plugin oficial de Tauri y trae migraciones integradas. Las consultas se hacen desde TypeScript a través de una única capa (`src/db/`). Las relaciones entre tablas se verifican en la propia base de datos (`PRAGMA foreign_keys` activo, comprobado en la app).
**Cómo funciona:**
- Las migraciones viven en `src-tauri/migrations/NNN_*.sql`, se registran en `src-tauri/src/lib.rs` y se aplican solas al abrir la app.
- Una migración aplicada **nunca se edita**: los cambios van siempre en una migración nueva.
- El archivo de datos está en `%APPDATA%\com.trefotg.studio\studio.db`.
**Alternativa descartada:** `rusqlite` con comandos propios en Rust. Da más control, pero obliga a escribir mucho más código para cada consulta.

### D-007 · Procedimiento para migraciones con datos reales (2026-11-03)
1. **Copia de seguridad consistente** con la API de backup de SQLite (por ejemplo, `sqlite3.Connection.backup` en Python), guardada en `C:\Users\trefo\TrophyHunter-backups\<fecha>-<motivo>\`. **Nunca copiar los archivos `.db`, `-wal` y `-shm` con la app abierta**: la copia sale incoherente.
2. Probar la migración sobre una copia de esa copia: mismo número de filas, datos idénticos, `foreign_key_check` vacío e `integrity_check = ok`.
3. Solo entonces registrarla en `lib.rs`; la app la aplica al arrancar.
4. Para cambiar un `CHECK`, se reconstruye la tabla (crear la nueva, copiar, borrar, renombrar y recrear índices), comprobando antes que ninguna otra tabla la referencie.

### D-008 · Metas de ingresos (2026-11-03)
Cuentan lo recibido en USD desde la fecha local de creación de la meta, filtrado por red si la meta tiene perfil. Las metas por periodo quedan aparcadas en ROADMAP.md.

### D-009 · Adaptaciones y pasos (2026-11-03)
- `adaptation.scheduled_at` se guarda como **hora local sin zona** (`AAAA-MM-DDTHH:MM`), porque lo que importa al programar es la hora de tu reloj. Es la única excepción a "fechas en UTC". Si llega el SaaS con usuarios en varias zonas, se añadirá la zona mediante migración.
- Al crear una adaptación se insertan sus seis pasos en **una sola sentencia** (todos o ninguno). Los pasos desactivados por defecto dependen del formato (`DEFAULT_DISABLED_STEPS`).
- Aprobar una idea crea el proyecto con `INSERT OR IGNORE` sobre `project.idea_id UNIQUE`, así que repetirlo nunca duplica.

### D-010 · Publicación y metas de vistas (2026-11-03)
- `adaptation.published_at` usa la misma hora local sin zona que `scheduled_at` (D-009).
- Publicar completa el paso `publishing`; deshacer la publicación lo devuelve a pendiente y conserva los `result_snapshot`.
- Las metas de vistas suman el último registro con vistas de cada adaptación publicada desde la fecha local de creación de la meta (filtrado por red si la meta tiene perfil). Es el mismo criterio que las metas de ingresos (D-008).

### D-011 · Copias de seguridad en Rust (2026-11-03)
- Exportar e importar viven en `src-tauri/src/backup.rs` como comandos de Tauri, porque una importación necesita una **transacción real** (todo o nada), algo que el plugin no ofrece desde el frontend.
- Usan la misma conexión de la app (`tauri_plugin_sql::DbInstances`) con `sqlx` 0.8, la misma versión que ya trae el plugin, así que no se añade código nuevo a la app.
- Formato: JSON con `format = "trophyhunter-studio-backup"`, `format_version`, `schema_version` (la última migración aplicada), `exported_at` y todas las tablas. Solo se importa una copia con el **mismo** `schema_version`.
- La importación valida antes de tocar nada (formato, versiones, tablas, columnas reales y tipos de valor), guarda la base actual con `VACUUM INTO` en la carpeta de copias, borra de hijos a padres e inserta de padres a hijos dentro de una transacción, y comprueba `foreign_key_check` antes del commit.

### D-012 · Identidad visual (2026-11-03)
- **Tokens de tema** en `:root` de `src/App.css` (fondos violeta oscuro, acento `#8b5cf6`, degradado de marca `#8b5cf6 → #c026d3`). Ningún color se escribe fuera de ellos, salvo los de marca de cada red.
- **Logo original** (trofeo sobre degradado) en `src/components/Logo.tsx` y en `src-tauri/app-icon.svg`, del que salen los iconos de la app con `npx tauri icon src-tauri/app-icon.svg`. No usa nada derivado de Minecraft ni de Faithful.
- **Gráficas propias en SVG** (`src/components/charts/`): una serie, el color `--chart-1` (validado contra `--surface` en modo oscuro), línea de 2 px, barras con la parte superior redondeada, tooltip al pasar el ratón y sin leyenda (el título nombra la serie).
- **Dashboard** con distribución fija por áreas (`.dash-grid`): Ingresos alto a la izquierda, Redes y Metas a la derecha y tres listas abajo. Una columna por debajo de 1100 px.
- Hover de los botones con `filter: brightness`, para no pisar los hover propios de chips, pasos y pestañas.

### D-013 · Imágenes propias dentro de la base de datos (2026-11-03)
- Foto de perfil (256×256) y miniatura de adaptación (640×360) se recortan y reducen en la interfaz (`src/components/images.ts`) y se guardan como data URL JPEG en `profile.avatar` y `adaptation.thumbnail` (migración 003).
- **Motivo:** viajan solas en las copias de seguridad, sin archivos sueltos ni permisos de sistema de archivos. Pesan unos 20–60 KB cada una, aceptable para el volumen de un creador.
- La portada de un proyecto es la miniatura de su primera adaptación que tenga una; si no hay, un degradado estable según el título (`src/components/cover.ts`).

### D-014 · Umbrales de pago (2026-11-03)
- Cada perfil puede tener `payout_threshold_minor` (en centavos USD). Los valores sugeridos en el formulario son solo orientativos; el usuario los confirma en cada plataforma.
- **El saldo pendiente se calcula**, nunca se anota: ingresos USD de la red con `received_on` **posterior** a `profile.last_payout_on`. Los del mismo día del cobro se consideran cobrados.
- **Regla de uso:** los ingresos se registran cuando se ganan; "Marcar como cobrado" solo fija `last_payout_on` y no crea otro ingreso (sin dobles conteos).
- Avisos al superar el umbral: al guardar el ingreso que lo cruza (Ingresos) y un banner en el Dashboard mientras haya algo por cobrar.
- `account_snapshot.pending_minor` (migración 004) quedó sin uso al pasar del saldo manual al calculado. SQLite no borra columnas con facilidad, así que se deja vacía.
- Las copias de seguridad aceptan versiones de esquema desde `MIN_IMPORTABLE_SCHEMA = 1` porque todas las migraciones hasta la 005 solo añaden (D-011).

### D-015 · Integración con YouTube (2026-11-04; verificado en la documentación oficial de Google)
- **OAuth para app de escritorio:** redirección a `http://127.0.0.1:<puerto>` (loopback) con **PKCE S256**. El esquema personalizado y el copiar/pegar (OOB) ya no se admiten. Una app de escritorio es un cliente público: su `client_secret` no se considera confidencial.
- **Publicación de la app de Google "en producción" sin verificar:** en modo "Testing", los refresh tokens caducan a los 7 días. En producción no caducan; al conectar se ve el aviso de "app no verificada" (aceptable para uso personal; la verificación sería necesaria para el SaaS).
- **Permisos:** `youtube.readonly` (datos del canal y de los vídeos) y `yt-analytics.readonly` (horas, vistas, suscriptores ganados/perdidos). El de ingresos (`yt-analytics-monetary.readonly`) exige que el canal esté en el Programa de Socios (si no, error 403); se pospone.
- **Suscriptores:** `channels.statistics.subscriberCount` está **redondeado hacia abajo a 3 cifras significativas**. Para precisión se usan `subscribersGained`/`subscribersLost` de Analytics.
- **Cuota:** 10.000 unidades al día; `channels.list` y `videos.list` cuestan 1 unidad. Sobra para el uso previsto.
- **Credenciales del cliente OAuth** (el JSON descargado de Google): se importan desde la app y se guardan en la carpeta de datos de la app, nunca en Git. **Tokens** de acceso: en el Administrador de credenciales de Windows.
- **Sincronización:** al abrir la app (como mucho una vez cada pocas horas) y con un botón. Los datos automáticos se marcan con origen `api` en las mismas tablas de registros.
- **Implementación (S18):** `src-tauri/src/youtube.rs`. Comandos `youtube_import_client`, `youtube_status`, `youtube_connect`, `youtube_channel` y `youtube_disconnect`. Archivos en la carpeta de datos: `google-client.json` (cliente OAuth) y `youtube-connection.json` (perfil enlazado y canal). El access token solo vive en memoria (`YouTubeState`).
- **Publicar en producción** exige en Google Auth Platform una URL de página principal y otra de política de privacidad, y no tener logotipo subido (con logo hay que pasar la verificación). Hasta tenerlas, la app está en "Prueba" con el usuario como usuario de prueba.
- `reqwest` usa el TLS nativo de Windows (`native-tls`, SChannel) para no compilar `aws-lc` en C.
- **Sincronización del canal (S19):** comando `youtube_sync(start, end)`. Suscriptores y vistas totales de la Data API (exactos por debajo de 1.000 suscriptores). Horas = `estimatedMinutesWatched` de los últimos 365 días con `dimensions=creatorContentType`, **excluyendo `SHORTS` y `STORY`**, que es lo más parecido al contador de monetización; si esa consulta falla, se usa el total del canal. Studio también descuenta vídeos ocultos, privados o borrados, y eso Analytics no lo filtra.
- El registro del día se guarda con `INSERT … ON CONFLICT (profile_id, recorded_on) WHERE source = 'api' DO UPDATE` (índice único parcial de la migración 006). La hora de la última sincronización se guarda en `localStorage` (solo limita la frecuencia; perderla no rompe nada).
- **Resultados por vídeo (S20):** comando `youtube_video_stats(ids, start, end)`. Vistas, likes y comentarios de `videos.list` (bloques de 50, 1 unidad cada uno); compartidos y minutos de Analytics con `dimensions=video`, `filters=video==id1,id2…`, `sort` y `maxResults ≤ 200` (obligatorios en informes por vídeo). Los IDs se validan (11 caracteres `[A-Za-z0-9_-]`) antes de usarlos en filtros. El ID se extrae del enlace publicado (`src/features/profiles/youtubeVideo.ts`).
- **Dónde se traen los resultados:** en la sincronización general, y además al abrir el panel de Resultados de una publicación con enlace de YouTube (y al publicarla), porque es donde el usuario los espera.

## Dependencias

| Dependencia | Para qué |
|---|---|
| Tauri 2 (+ plugin opener de la plantilla) | Aplicación de escritorio |
| React 19 + Vite | Interfaz |
| TypeScript | Tipos |
| `tauri-plugin-sql` (sqlite) + `@tauri-apps/plugin-sql` | Base de datos local y migraciones (D-006) |
| `sqlx` 0.8 (sqlite, runtime-tokio) | Transacciones en exportar/importar; misma versión que la del plugin (D-011) |
| `lucide-react` (ISC) | Iconos coherentes; solo se incluyen los que se usan |
| `@fontsource-variable/inter` (OFL) | Tipografía Inter incluida en la app, sin depender de internet |
| `simple-icons` (CC0) | Logos de las cinco redes, solo para identificarlas; solo se incluyen esos cinco |
| `reqwest` 0.13 (native-tls, json, form, query) | Llamadas HTTPS a Google y YouTube (D-015); ya estaba en el árbol de dependencias |
| `keyring` 3 (windows-native) | Guardar el refresh token en el Administrador de credenciales de Windows |
| `sha2`, `base64`, `rand`, `url` | PKCE, `state` aleatorio y construcción de URLs del OAuth; ya estaban en el árbol |

Las dependencias nuevas se añaden a esta tabla con su justificación.
