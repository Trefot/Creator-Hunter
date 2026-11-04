# CHANGELOG

## [Sin publicar]

### 2026-11-04 · G2 Biblioteca de juegos y PlayStation Network
- Nueva sección "Juegos": conectar PSN (no oficial, solo lectura), importar juegos con su portada y todos sus trofeos.
- Ficha del juego con % al platino, trofeos por tipo, rareza y fecha de obtención.
- Migración 007 (juegos, trofeos, fases y objetivos); las copias de seguridad incluyen los juegos.

### 2026-11-04 · S20 Resultados automáticos por vídeo de YouTube
- Las publicaciones con enlace de YouTube reciben solas sus vistas, likes y comentarios, y compartidos y horas cuando Analytics los tiene.
- Se traen al abrir sus Resultados, al publicarlas, con "Traer de YouTube" y en cada sincronización.

### 2026-11-04 · S19 Sincronizar el canal de YouTube
- Al abrir la app (como mucho cada 3 horas) o con "Sincronizar ahora", se guarda el registro del día con suscriptores, vistas totales y horas de los últimos 365 días sin Shorts.
- Migración 006: origen manual/YouTube y vistas totales en los registros.
- Registros: etiqueta "YouTube" y columna de vistas totales.

### 2026-11-04 · S17–S18 Conectar YouTube (Alpha 0.2)
- Plan de integración con YouTube verificado en la documentación oficial (D-015).
- Perfiles → YouTube: importar el cliente OAuth de Google, conectar con el navegador (loopback + PKCE), ver el canal y desconectar.
- El acceso se guarda en el Administrador de credenciales de Windows; la foto del canal se usa como foto del perfil.

## [0.1.0] · 2026-11-04 · Creator Studio Alpha 0.1

Primera versión completa: los 7 criterios de PRODUCT.md cumplidos.

### 2026-11-03/04 · S15 Mejora visual
- Logo e icono de la app originales, paleta de marca, tipografía Inter y menú agrupado con iconos.
- Gráficas de evolución en SVG propio; logos oficiales de las redes; títulos de sección con icono e ilustraciones.
- Fotos de perfil y miniaturas de adaptaciones, incluidas en las copias de seguridad (migración 003).
- Dashboard con portada, cifras clave, metas en anillos de progreso y distribución fija por áreas.
- Ideas y Proyectos en galería; Ingresos divididos en total y por red, con filtro.
- Umbrales de pago por red: saldo calculado desde los ingresos, aviso al superarlos y "Marcar como cobrado" (migraciones 004 y 005).
- Las copias de seguridad antiguas siguen siendo importables (las migraciones solo añaden).

### 2026-11-03 · S14 Exportar e importar
- Nueva sección "Copias de seguridad": exportar todos los datos a un JSON versionado e importarlo.
- La importación muestra el contenido antes, valida el archivo completo, guarda una copia de los datos actuales y lo reemplaza todo en una sola transacción.

### 2026-11-03 · S13 Dashboard
- Nueva pantalla de inicio: redes, ingresos del mes, metas activas, próximos 7 días, producción agrupada por paso y últimas publicaciones con sus vistas.
- Cada bloque lleva a su sección y cada publicación abre su proyecto.

### 2026-11-03 · S12 Seguimiento de publicaciones y resultados
- Publicar una adaptación con fecha y enlace, y deshacer la publicación.
- Resultados fechados (vistas, likes, comentarios, compartidos y horas; espectadores y duración en los directos) con la evolución de las vistas.
- Metas de vistas con progreso real.

### 2026-11-03 · S11 Calendario semanal
- Calendario de lunes a domingo con las adaptaciones programadas, navegación entre semanas y apertura del proyecto con un clic.
- Lista "Sin programar" con las adaptaciones en producción sin fecha.
- Las consultas de adaptaciones comparten un único cargador (`loadAdaptations`), que incluye el título del proyecto mediante JOIN.

### 2026-11-03 · S10 Script Studio
- Guion por secciones con tipo, texto y segundos, dentro de cada adaptación que use el paso de guion.
- Plantilla inicial, reordenar con ↑ ↓, guardado automático y duración total calculada (indicada o estimada por palabras).

### 2026-11-03 · S9 Proyectos y adaptaciones
- Detalle de proyecto con edición y borrado.
- Adaptaciones por formato y red, con fecha y hora programada, y red y pasos sugeridos según el formato.
- Pasos de producción pulsables y configurables; el estado ("En: Grabación") y el progreso se calculan solos.

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
