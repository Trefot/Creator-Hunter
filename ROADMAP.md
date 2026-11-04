# ROADMAP.md — Ruta y tareas

Ritmo: sesiones diarias, cada una con un presupuesto de ~8–9 % del uso semanal de Claude Code. Una tarea cerrada y probada por sesión.

## Fases

| Fase | Contenido | Estado |
|---|---|---|
| I | Preparación + **Creator Studio Alpha 0.1** | 🟢 En curso |
| I | **Alpha 0.2**: conectores de YouTube y Twitch (local, sin nube) | ⚪ Tras 0.1 |
| II | Core e integraciones · Community Hub · Community Identity Sync | ⚪ |
| III | Live Studio · Automation Builder · Music Requests | ⚪ |
| IV | Video Studio · Growth Intelligence | ⚪ |
| V | Gaming Intelligence | ⚪ |

## Fase I: tareas

### ✅ S1 · Cimientos
- [x] Instalar Node.js, Rust y Visual Studio Build Tools.
- [x] Crear la app vacía de Tauri + React + TypeScript con el nombre interno `studio`.
- [x] Comprobar que la app abre en Windows.
- [x] Escribir los documentos base.
- [x] Iniciar Git y hacer el primer commit.
- [x] Repositorio privado en GitHub: https://github.com/Trefot/Creator-Hunter (rama `main`).

### ✅ S2 · Modelo de datos
- [x] Respuestas del usuario: todas las métricas (seguidores, vistas por publicación, horas, directos); todos los tipos de ingreso; Script Studio por secciones; volumen bajo.
- [x] Esquema de 11 tablas aprobado y documentado en ARCHITECTURE.md (D-005).

### ✅ S3 · SQLite y migraciones
- [x] Plugin oficial de SQLite y migración 001 con las 11 tablas.
- [x] Capa de datos (`src/db/`) y textos centralizados (`src/i18n/es.ts`).
- [x] Prueba del usuario: 5 perfiles creados, app cerrada y reabierta, los perfiles siguen ahí. Duplicados rechazados e integridad de relaciones activa.
- [x] Acceso directo `Abrir TrophyHunter.bat`.

### ✅ S4 · Estructura de la interfaz
- [x] Menú lateral con las seis secciones. Las que no están construidas muestran "Próximamente".
- [x] Tema oscuro con acento morado y etiquetas de color por red.
- [x] Pantalla de Perfiles definitiva: crear, editar (nombre visible, enlace, monetizado), abrir el enlace en el navegador y eliminar con confirmación.
- [x] Prueba del usuario superada, incluida la persistencia.

### ✅ S5 · Registros de cuenta
- [x] Panel "Registros" en cada perfil: fecha, seguidores y horas (opcionales por separado).
- [x] Historial con la diferencia respecto al registro anterior; el último valor aparece en la tarjeta.
- [x] Los registros no se editan: si hay un error, se borra y se crea otro.
- [x] Prueba del usuario superada.

### ✅ S6 · Metas
- [x] Nueva sección "Metas" en el menú: por red o global (suma de todas), con objetivo y fecha límite opcional.
- [x] Progreso calculado desde el último registro de cada perfil, con barra, porcentaje, "¡Conseguida!" y cuenta atrás.
- [x] Editar, abandonar o reactivar, y eliminar con confirmación.
- [x] Ingresos y vistas muestran "Pendiente de datos" hasta tener sus secciones.
- [x] Prueba del usuario superada.

### ✅ S7 · Ingresos
- [x] Sección Ingresos: cantidad (en centavos), moneda, tipo, fecha, red opcional y nota. Editar y eliminar.
- [x] Totales del mes y del año, separados por moneda.
- [x] Las metas de ingresos cuentan lo recibido en USD desde la creación de la meta.
- [x] Migración 002: tipo "Twitch (total)". Twitch paga subs, bits y anuncios juntos, así que los tipos separados ya no se ofrecen.
- [x] Prueba del usuario superada.

### ✅ S8 · Banco de ideas
- [x] Sección Ideas: crear, editar y eliminar; etiquetas que funcionan como filtro; pestañas por estado con contador.
- [x] Descartar y recuperar. Una idea aprobada no se puede desaprobar.
- [x] Aprobar crea el proyecto enlazado (idempotente: nunca se duplica). Lista básica en Proyectos.
- [x] Prueba del usuario superada.

### ✅ S9 · Proyectos y adaptaciones
- [x] Detalle de proyecto: editar, eliminar (en cascada) y lista de adaptaciones.
- [x] Adaptaciones con formato, red, título y fecha y hora programada; red y pasos sugeridos según el formato.
- [x] Pasos pulsables (hecho/pendiente) y "Configurar pasos" para activarlos o desactivarlos; estado y progreso calculados.
- [x] Prueba del usuario superada.

### ✅ S10 · Script Studio
- [x] Guion por secciones (gancho, desarrollo, cierre, llamada a la acción y nota) en cada adaptación con paso de guion.
- [x] Plantilla inicial, reordenar, guardado automático al salir de cada campo y contador de palabras.
- [x] Duración total: segundos indicados o estimados por palabras (unas 150 por minuto).
- [x] Prueba del usuario superada.

### ⬜ S11 · Calendario semanal (siguiente)
Vista de lunes a domingo con las adaptaciones programadas (qué, dónde y a qué hora), navegación entre semanas y acceso directo a su proyecto. Todo se deriva de `adaptation.scheduled_at`, sin datos propios.
**Terminado cuando:** las adaptaciones programadas aparecen en su día y hora, se puede cambiar de semana y, al cambiar la fecha de una adaptación, el calendario lo refleja.

### ⬜ Siguientes
- Seguimiento de publicaciones y resultados.
- Dashboard multired.
- Exportación e importación.
- Cierre de Alpha 0.1: revisión completa con los criterios de PRODUCT.md.

## Alpha 0.2: conectores (decidido el 2026-11-03; empieza al cerrar 0.1)

Primeras integraciones automáticas. Todo local, con inicio de sesión OAuth desde la app de escritorio y sin servidor.

- **YouTube (automático):** suscriptores, vistas, horas de visualización e ingresos estimados (YouTube Data API + YouTube Analytics API).
- **Twitch (solo seguidores en tiempo real):** total de seguidores y aviso de nuevos seguidores mientras la app está abierta (EventSub por WebSocket, sin servidor público).
- **El resto sigue manual:** TikTok, Instagram, Facebook, horas e ingresos de Twitch.
- Los datos automáticos se guardan en las mismas tablas de registros, con una columna nueva de origen (`manual` o `api`) añadida mediante migración.
- Los tokens de acceso se guardan de forma segura (almacén de credenciales del sistema), nunca en la base de datos en texto plano.
- Por investigar antes de empezar: cuotas de la API de YouTube y el flujo OAuth recomendado para apps de escritorio en cada plataforma.

## Ideas aparcadas
Las ideas nuevas se anotan aquí y no interrumpen la fase actual.
- Revisar el código de Firebot (open source) como referencia para Live Studio.
- Elegir la marca definitiva (verificando marca registrada y dominio).
- Metas de ingresos por periodo (por ejemplo, "$100 cada mes"). Requiere una columna de periodo en `goal`.
