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
5. **Con `tauri dev` abierto**, guardar `lib.rs` recompila la app y aplica la migración al reiniciar: haz la copia del paso 1 *antes* de registrarla (pasó con la 010, que solo añade una tabla; sin daño).

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

### D-016 · Juegos y conexión NO oficial con PSN (2026-11-04)
**Decisión del usuario, con los riesgos explicados y aceptados.** Contradice el principio "no depender de métodos que comprometan las cuentas", así que queda acotada:
- **Solo uso personal y solo lectura.** No va en ninguna versión SaaS sin un acuerdo oficial con Sony.
- **Riesgos:** va contra los términos de Sony (sanción improbable pero posible); el NPSSO equivale a la contraseña; puede dejar de funcionar si Sony cambia algo; el NPSSO caduca (unos 2 meses).
- **Mitigaciones:** el usuario pega el NPSSO en la app (nunca en el chat); se canjea una sola vez por tokens y el **refresh token** se guarda en el Administrador de credenciales de Windows (nunca en la base de datos, Git ni registros); pocas consultas; los trofeos quedan **guardados en local** y se pueden marcar a mano si PSN falla.
- **Flujo (verificado en psn-api, MIT):** NPSSO (de `https://ca.account.sony.com/api/v1/ssocookie` con la sesión de playstation.com abierta) → `GET https://ca.account.sony.com/api/authz/v3/oauth/authorize` (cookie `npsso`, `client_id 09515159-7237-4370-9b40-3806e67c0891`, `redirect_uri com.scee.psxandroid.scecompcall://redirect`, `scope "psn:mobile.v2.core psn:clientapp"`, sin seguir la redirección 302) → `POST …/oauth/token` (Basic de la app móvil, `token_format=jwt`) → access y refresh token. Renovación: `grant_type=refresh_token`.
- **Endpoints (base `https://m.np.playstation.com/api/trophy`):** `/v1/users/me/trophyTitles` (juegos, progreso, icono, `npCommunicationId`, `npServiceName`); `/v1/npCommunicationIds/{id}/trophyGroups/all/trophies?npServiceName=…` (definición de trofeos); `/v1/users/me/npCommunicationIds/{id}/trophyGroups/all/trophies?npServiceName=…` (ganado, fecha y rareza).
- **Esquema (migración 007):** `game` (título, plataforma, estado, portada, `np_communication_id` único, `np_service_name`, notas); `trophy` (juego, `psn_trophy_id`, grupo, nombre, detalle, tipo, oculto, icono, `earned_at`, rareza, fase, perdible, nota; único por juego y `psn_trophy_id`); `trophy_phase` (juego, nombre, orden, nota); `game_goal` (juego, título, valor actual y objetivo, unidad, fecha límite, estado); `project.game_id` para enlazar vídeos. El % del platino se **calcula** a partir de los trofeos; con PSN conectado, PSN manda sobre el estado de "ganado".
- **Implementación (G2):** `src-tauri/src/psn.rs` (comandos `psn_connect`, `psn_status`, `psn_disconnect`, `psn_titles`, `psn_title_trophies`, `psn_download_image`), `src/db/games.ts` y `src/features/games/`. El NPSSO se acepta solo o dentro del JSON de la página de Sony y no se guarda. Sony puede rotar el refresh token: si llega uno nuevo, se reemplaza. Se piden los textos en español (`Accept-Language`). Las portadas se descargan solo desde dominios de PlayStation. La sincronización de trofeos es un upsert por `(game_id, psn_trophy_id)` que no toca fase, perdible ni nota.
- **Ruta al platino (G3):** la fase actual se **calcula** (primera fase, en orden, con trofeos pendientes). Las rutas sugeridas viven en el código (`src/features/games/roadmaps/`, una por `npCommunicationId`, con sus fuentes) y se aplican con `applyRoadmap`, que crea las fases y asigna fase, perdible y nota sin pisar las notas propias. Solo se ofrece en juegos sin fases.
- **Guía (G4):** tablas `guide_entry` y `guide_entry_trophy` (migración 008). Los borradores viven en `src/features/games/guides/` y se enlazan a la fase por nombre y a los trofeos por `psn_trophy_id`. Regla de contenido: solo datos comprobados o del usuario; lo demás va como "por verificar" con su fuente, nunca inventado ni copiado.
- **Modo juego (G5):** comando `psn_now_playing` (presencia de `me`). La vigilancia vive en `useGameMode` (cada 60 s, solo si PSN está conectado y el modo está activo; preferencia en `localStorage`). El emparejamiento es por nombre normalizado (`matchPlaying`), porque la presencia usa el `npTitleId` (PPSA…) y no el `npCommunicationId` (NPWR…) de los trofeos. Solo salta una vez por partida para no arrastrar al usuario mientras navega.
- **Copias de seguridad:** las tablas de juegos van antes de `project` (por `project.game_id`). Una copia de una versión anterior sin alguna tabla la importa como vacía.
- **Orden por capítulos:** PSN no lo da. La agrupación inicial por fases para Wukong la escribe Claude a partir de guías públicas (sin copiar su texto) y el usuario la edita.

### D-017 · Listas por trofeo y plan de hoy (2026-11-04)
- **Contenido en la app, progreso en la base de datos.** Las listas (qué conseguir, dónde, fijo o aleatorio) son archivos TypeScript por juego en `src/features/games/collections/`, redactados con fuentes (nunca copiados) y con `verified: false` cuando las fuentes no coinciden. La base de datos solo guarda qué marcó el usuario (`collection_item`, por clave estable) y sus puntos propios (`trophy_task`). Así se pueden corregir textos sin migraciones.
- **Lo derivado no se guarda:** un punto con `doneWithTrophy` sale hecho si ese trofeo está ganado en PSN; el progreso y el siguiente paso se calculan.
- **El plan de hoy lo arma el usuario** (decisión del usuario: las sugerencias automáticas no le servían). Se reutilizan `play_session` y `session_objective` (migración 009); la app solo recomienda el siguiente trofeo de la ruta.
- **"Ya lo perdí → NG+"** mueve el trofeo a la fase cuyo nombre contiene "NG+", quita la marca de perdible y lo anota en su nota.

### D-018 · Live Studio: servidor local para OBS y Stream Deck (2026-11-08)
- **Servidor HTTP mínimo (`tiny_http`) en un hilo**, solo en `127.0.0.1` (nunca en la red). Sirve el overlay (`/overlay`) y la lista de contadores (`/api/counters`); el overlay pregunta cada 0,6 s.
- **Cambios con clave local:** `/api/counters/{id}/{inc|dec|reset}?key=…`. La clave se genera una vez (`live-key.txt` en la carpeta de datos). Sin ella, cualquier web abierta en el navegador podría tocar los contadores pidiendo a `127.0.0.1`.
- **Stream Deck sin plugins:** la acción «Sitio web» en segundo plano hace un GET; por eso los cambios son GET con clave.
- El servidor escribe con el mismo pool de SQLite que la app y avisa a la interfaz con el evento `counters-changed`.
- `counter.source` ya admite `youtube_subscribers`, `twitch_followers` y `screen` para las fases L2 y L3 sin reconstruir la tabla.

### D-019 · App instalada para el usuario, app de pruebas para Claude (2026-11-08)
**Decisión del usuario, siguiendo cómo funciona Lumen.** Motivo: el usuario usaba la versión de desarrollo sobre sus datos reales; dos copias abiertas chocaron y una migración se aplicó sola al guardar `lib.rs`.
- **Instalada (release):** `studio.db`, puerto 7878. Es la que usa el usuario a diario; se actualiza con el instalador de cada versión.
- **Pruebas (`tauri dev`, `debug_assertions`):** `studio-dev.db`, puerto 7879, clave `live-key-dev.txt`, título «TrophyHunter · PRUEBAS» y marca en el menú. Se rellena copiando `studio.db` con la API de backup (nunca al revés).
- Lo comprobado se commitea y se sube **sin preguntar**; las versiones se publican con instalador y etiqueta.
- **Ojo, Claude corre dentro del paquete de la app de Claude:** lo que arranca (Python, `tauri dev`) tiene AppData **redirigido** a `%LOCALAPPDATA%\Packages\Claude_…\LocalCache\Roaming` (copia al escribir). Sus pruebas nunca tocan los datos reales, pero lo que lee con Python puede ser esa copia y no el archivo real. Para comprobar datos, mirar dentro de la propia app; la prueba final se hace en la app instalada del usuario.

### D-020 · Copia automática antes de migrar (2026-11-08)
- Al arrancar, antes de que el frontend abra la base, `premigrate.rs` lee la versión del esquema (solo lectura). Si hay migraciones pendientes, guarda una copia completa con `VACUUM INTO` en `Documentos\TrophyHunter\Copias\antes-de-migrar-vX-a-vY-<segundos>.db`.
- Motivo: con D-019 los datos reales solo los toca la app instalada, y Claude no puede leerlos (ver la nota de D-019). Así cada actualización protege los datos sola, cumpliendo el paso 1 de D-007 sin intervención.
- Si la copia falla, se avisa en el registro y la app sigue (no bloquea el arranque).

### D-021 · Actualización automática desde la carpeta de instaladores (2026-11-08)
**Pedido del usuario: no instalar actualizaciones a mano.**
- La app instalada busca en `Documentos\TrophyHunter\Instaladores` un `TrophyHunter_X.Y.Z_x64-setup.exe` mayor que su versión (`updater.rs`, con tests).
- **Al abrirla:** si lo hay, muestra «Actualizando…», se cierra y un `cmd` oculto espera ~2 s, ejecuta el instalador con `/S` (silencioso; instalación por usuario, sin administrador) y vuelve a abrir la app.
- **Con la app abierta:** comprueba cada 10 min y solo avisa con «Actualizar ahora» (no reinicia a mitad de un stream).
- La versión de pruebas nunca se actualiza sola.
- **Por qué así y no el plugin oficial de actualización:** el repositorio es privado (el plugin necesita un servidor público o con token) y el usuario usa un solo PC; la carpeta ya existía y Claude no puede instalar por el usuario (sus procesos tienen AppData redirigido, ver D-019).
- **Riesgo aceptado:** se ejecuta lo que haya en esa carpeta del propio usuario con el nombre esperado. Si algún día se distribuye la app, pasar al plugin oficial con firma.

### D-022 · Overlay instantáneo, con estilo y sonido (2026-11-10)
- **Espera larga en vez de preguntar cada 0,6 s:** `/api/counters/live?since=N` se queda esperando (hasta 20 s) a que suba el número de cambio y responde en el acto. Cada petición del servidor va en su propio hilo, así esas esperas no bloquean al Stream Deck. La app avisa de sus propios cambios con `live_notify`.
- Si `since` no coincide con el número actual (por ejemplo, tras reiniciar la app, que vuelve a 0), responde al momento: un overlay abierto nunca se queda colgado.
- **Estilo y sonido en la base (`style`, `sound`, `sound_on`, `sound_volume`)**; el sonido propio se sirve aparte (`/sound`) y solo se vuelve a pedir si cambia. El sonido por defecto se genera con Web Audio, sin archivos.
- **La vista previa del editor es el propio overlay** en un iframe (`?preview=1`, datos por `postMessage`): una sola fuente de diseño.
- La tipografía gamer (Luckiest Guy) se carga de Google Fonts; sin internet, el overlay usa Impact.

### D-023 · Actualizaciones desde GitHub, como Lumen (2026-11-10)
**Pedido del usuario: que TrophyHunter se actualice «como Lumen», desde el repositorio privado.**
- Lumen es Python y su instalación es un clon del repositorio (`fetch` + `reset --hard`). TrophyHunter se compila, así que lo que se reparte por GitHub es el **instalador ya compilado**, no el código.
- **Rama `releases`** del repositorio privado: un solo commit con `latest.json` (versión, fecha, novedades, nombre del instalador) y `TrophyHunter-setup.exe`. Se reemplaza con `--force` en cada versión, así el repositorio no crece. Lo publica `scripts/publicar-version.sh`, que saca las novedades del CHANGELOG.
- **La app** hace `git fetch --depth 1` de esa rama en `%LOCALAPPDATA%\com.trefotg.studio\actualizaciones` con las credenciales de git del PC (Git Credential Manager; `GIT_TERMINAL_PROMPT=0`, sin ventana), lee `latest.json` y, si la versión es mayor, saca el instalador con `git cat-file` y lo instala en silencio (como en D-021).
- **Novedades:** se enseñan mientras se instala y, al volver a abrirse, «¡Actualizado!» una vez.
- **Plan B:** si GitHub falla, la carpeta `Documentos\TrophyHunter\Instaladores` (D-021). Por eso el script también copia ahí el instalador.
- En otro PC hará falta tener git e iniciar sesión en GitHub una vez (el repositorio es privado).

### D-024 · Estabilidad y uso exclusivamente personal (2026-11-11)
- Por decisión del usuario, no se prepara distribución a terceros ni SaaS. Se conserva la arquitectura de escritorio y las decisiones históricas de arriba como contexto.
- Sustituye el comportamiento de fallo abierto de D-020: `getDb()` espera al comando `prepare_database` antes de llamar a `Database.load`. La preparación se serializa en Rust y solo se recuerda si termina correctamente. No configurar `plugins.sql.preload`: aplicaría migraciones antes de esta protección.
- `Startup` monta la app, las sincronizaciones y el modo juego solo después de abrir correctamente SQLite; un fallo muestra el motivo y permite reintentar sin borrar datos.
- `data_safety.rs` concentra la lógica SQLite de copia previa, instantánea y restauración, sin depender de una ventana. `backup.rs` mantiene los comandos y las rutas del sistema. Las migraciones históricas no se modifican.
- La copia previa comprueba su integridad. Una base existente sin historial de migraciones también se respalda. No se crea la carpeta de destino si el esquema ya está al día.
- La exportación lee todas las tablas dentro de una transacción y crea un archivo nuevo; no sobrescribe copias existentes. Importar conserva la copia previa y la transacción con rollback. Solo pueden faltar tablas que aún no existían en la versión declarada de una copia antigua; el workspace fijo es obligatorio.
- Producción conserva sus identificadores y archivos de conexión. Desarrollo usa `youtube-refresh-token-dev`, `psn-refresh-token-dev`, `google-client-dev.json`, `youtube-connection-dev.json` y `Copias/Pruebas`. No se copian credenciales automáticamente.
- Desconectar YouTube en desarrollo elimina el acceso local sin revocarlo en Google: la revocación puede invalidar todos los clientes del mismo proyecto OAuth. Para aislamiento remoto completo al probar nuevas autorizaciones, usar otro proyecto de Google; separar archivos no cambia los límites del proveedor. Referencia: https://developers.google.com/identity/protocols/oauth2/native-app#tokenrevoke
- El error de comprobar GitHub se propaga a la búsqueda manual si tampoco hay instalador local. Los fallos de las comprobaciones automáticas no interrumpen el uso. Se conserva la actualización automática solicitada en D-021/D-023.
- El overlay de vista previa se ejecuta en un iframe con `sandbox="allow-scripts"`, sin acceso al origen de la app. Su animación y renderizado se comprobaron en Chromium; audio en WebView2 pendiente.
- Las pruebas de `tests/data-safety` compilan el mismo `data_safety.rs` con SQLx, no una réplica. Tokio solo es dependencia directa de pruebas para ejecutarlas sin GTK/WebView. No se añade una dependencia de ejecución a la aplicación.
- Los cambios quedan sin publicar hasta verificar Windows. La firma del actualizador y la CSP completa siguen pendientes; no se afirma que estén resueltas por el aislamiento del iframe.

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

| `tiny_http` 0.12 | Servidor HTTP local y pequeño para el overlay de OBS y el Stream Deck (D-018) |

Las dependencias nuevas se añaden a esta tabla con su justificación.
