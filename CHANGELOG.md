# CHANGELOG

## [Sin publicar]

### 2026-11-03 · S3 SQLite y migraciones
- Base de datos local SQLite (`tauri-plugin-sql`) con la migración 001: las 11 tablas de Alpha 0.1 y el espacio de trabajo TrefotG (USD).
- Capa de datos `src/db/` (conexión y perfiles) y textos en `src/i18n/es.ts`.
- Pantalla temporal de prueba de perfiles. Verificado que los datos sobreviven al cierre de la app.
- Acceso directo `Abrir TrophyHunter.bat` para abrir la app sin usar la terminal.
- Eliminados el saludo y los logos de la plantilla.

### 2026-11-03 · S2 Modelo de datos
- Esquema de Alpha 0.1 aprobado (11 tablas) y documentado en ARCHITECTURE.md, con la decisión D-005.

### 2026-11-03 · S1 Cimientos
- App de escritorio vacía con Tauri 2 + React + TypeScript (nombre interno `studio`, identificador `com.trefotg.studio`).
- Ventana "TrophyHunter" de 1280×800 (mínimo 960×640).
- Documentos base: CLAUDE.md, PRODUCT.md, ARCHITECTURE.md, ROADMAP.md y CHANGELOG.md.
