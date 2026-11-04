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

El esquema concreto se diseña en la **Sesión 2** y se revisa con el usuario antes de construir pantallas.

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

## Dependencias

| Dependencia | Para qué |
|---|---|
| Tauri 2 (+ plugin opener de la plantilla) | Aplicación de escritorio |
| React 19 + Vite | Interfaz |
| TypeScript | Tipos |

Las dependencias nuevas se añaden a esta tabla con su justificación.
