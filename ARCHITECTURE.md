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
| `profile` | platform, handle, display_name, url, is_monetized | `platform` ∈ youtube, twitch, tiktok, instagram, facebook (lista en código, no tabla). Admite varias cuentas por red. |
| `account_snapshot` | profile_id, recorded_on, followers, watch_hours | Registros fechados; nunca se sobrescriben. |
| `goal` | profile_id?, metric, target_value, deadline, status | `metric` ∈ followers, watch_hours, income, views. **El progreso se calcula**, no se guarda. |
| `income` | profile_id?, source, amount_minor, currency, received_on, note | `source` ∈ platform_ads, twitch_payout, membership, donation, sponsorship, affiliate, other. Los antiguos twitch_subs/bits/ads siguen siendo válidos, pero ya no se ofrecen (migración 002). |
| `idea` | title, description, tags, status | `status` ∈ new, approved, discarded. `tags` es texto simple en Alpha. |
| `project` | idea_id?, title, summary | Contenido "madre" que agrupa las adaptaciones. |
| `adaptation` | project_id, profile_id, format, title, scheduled_at?, published_at?, published_url? | `format` ∈ long_video, short, tiktok, reel, post, live. **El calendario se deriva de `scheduled_at`.** |
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

## Dependencias

| Dependencia | Para qué |
|---|---|
| Tauri 2 (+ plugin opener de la plantilla) | Aplicación de escritorio |
| React 19 + Vite | Interfaz |
| TypeScript | Tipos |
| `tauri-plugin-sql` (sqlite) + `@tauri-apps/plugin-sql` | Base de datos local y migraciones (D-006) |

Las dependencias nuevas se añaden a esta tabla con su justificación.
