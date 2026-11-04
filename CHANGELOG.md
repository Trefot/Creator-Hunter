# CHANGELOG

## [Sin publicar]

### 2026-11-03 · S8 Banco de ideas
- Sección Ideas: título, descripción y etiquetas; pestañas por estado (nuevas, aprobadas, descartadas y todas) y filtro por etiqueta.
- Aprobar una idea crea su proyecto enlazado, sin duplicados aunque se repita la acción.
- Sección Proyectos: primera lista básica.

### 2026-11-03 · S7 Ingresos
- Sección Ingresos: registrar, editar y eliminar ingresos con tipo, red, moneda y nota; totales del mes y del año por moneda.
- Las metas de ingresos muestran su progreso en dinero (USD desde la creación de la meta).
- Migración 002: nuevo tipo "Twitch (total)", porque Twitch paga subs, bits y anuncios en un solo total. Probada sobre una copia de los datos reales antes de aplicarla.

### 2026-11-03 · S6 Metas
- Sección "Metas": metas por red o globales de seguidores, horas, ingresos o vistas, con fecha límite opcional.
- Progreso calculado (nunca guardado) a partir del último registro de cada perfil, con barra, porcentaje y cuenta atrás.
- Abandonar/reactivar, editar y eliminar metas.

### 2026-11-03 · S5 Registros de cuenta
- Registros fechados de seguidores y horas de visualización en cada perfil (`account_snapshot`).
- Historial con la diferencia respecto al registro anterior, y el último valor visible en la tarjeta del perfil.
- Formato de números y fechas centralizado (`src/i18n/format.ts`, locale `es-MX`).

### 2026-11-03 · S4 Estructura de la interfaz
- Menú lateral (Dashboard, Perfiles, Ideas, Proyectos, Calendario, Ingresos) y tema visual oscuro.
- Pantalla de Perfiles: crear, editar nombre visible, enlace y estado de monetización, abrir el enlace en el navegador y eliminar con confirmación.
- Validaciones: usuario obligatorio, enlace con `http(s)://`, perfiles duplicados y perfiles con publicaciones asociadas.
- Se elimina la pantalla temporal de prueba de la S3.

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
