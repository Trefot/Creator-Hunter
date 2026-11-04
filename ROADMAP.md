# ROADMAP.md — Ruta y tareas

Ritmo: sesiones diarias, cada una con un presupuesto de ~8–9 % del uso semanal de Claude Code. Una tarea cerrada y probada por sesión.

## Fases

| Fase | Contenido | Estado |
|---|---|---|
| I | Preparación + **Creator Studio Alpha 0.1** | ✅ v0.1.0 (2026-11-04) |
| I | **Alpha 0.2**: conectores de YouTube y Twitch (local, sin nube) | 🟢 Siguiente |
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

### ✅ S11 · Calendario semanal
- [x] Vista de lunes a domingo con hora, red, título, formato y paso actual; hoy resaltado.
- [x] Navegación entre semanas, contador semanal y apertura del proyecto con un clic.
- [x] Lista "Sin programar" con las adaptaciones en producción sin fecha.
- [x] Sin datos propios: todo se deriva de `adaptation.scheduled_at`.
- [x] Prueba del usuario superada.

### ✅ S12 · Seguimiento de publicaciones y resultados
- [x] Publicar con fecha y enlace (completa el paso de publicación) y deshacer (conserva los resultados).
- [x] Resultados fechados con la evolución de las vistas; campos propios para los directos.
- [x] Metas de vistas conectadas: las cuatro métricas de metas ya funcionan.
- [x] Prueba del usuario superada.

### ✅ S13 · Dashboard multired
- [x] Sección inicial con redes, ingresos del mes, metas activas, próximos 7 días, producción por paso y últimas publicaciones.
- [x] Sin datos propios: todo se calcula desde las secciones; cada bloque y cada fila llevan a su origen.
- [x] Todas las secciones de Alpha 0.1 construidas.
- [x] Prueba del usuario superada.

### ✅ S14 · Exportar e importar
- [x] Sección "Copias de seguridad": exporta todo a JSON versionado en Documentos\TrophyHunter\Copias (sincronizado con OneDrive).
- [x] Importar: vista previa del contenido, validación completa, copia previa automática (`VACUUM INTO`) y reemplazo en una transacción todo o nada.
- [x] Prueba del usuario superada: ida y vuelta exacta y archivo inválido rechazado.

### ✅ S15 · Mejora visual (y ajustes pedidos por el usuario)
- [x] Identidad: logo e icono de ventana originales, paleta de marca y tipografía Inter (D-012).
- [x] Menú agrupado con iconos; títulos de sección con icono; ilustraciones en pantallas vacías.
- [x] Gráficas propias en SVG: seguidores, vistas e ingresos (Dashboard, Registros, Resultados e Ingresos).
- [x] Logos reales de las redes (Simple Icons) en toda la app.
- [x] Fotos de perfil y miniaturas de adaptaciones (migración 003, D-013).
- [x] Dashboard con portada, cifras clave, metas en anillos y distribución fija sin huecos.
- [x] Ideas y Proyectos en galería con portadas.
- [x] Ingresos divididos en total y por red, con filtro por red.
- [x] Umbrales de pago calculados desde los ingresos, con avisos y "Marcar como cobrado" (migraciones 004 y 005, D-014).
- [x] Revisión visual del usuario superada.

### ✅ S16 · Cierre de Alpha 0.1
- [x] Los 7 criterios de PRODUCT.md, confirmados por el usuario.
- [x] Limpieza: sin código ni textos sin uso.
- [x] Instalador de Windows de la versión (`npm run tauri build`).
- [x] Copia de seguridad de los datos de la versión en TrophyHunter-backups.
- [x] Etiqueta `v0.1.0` en Git.

## Alpha 0.2: conectores (decidido el 2026-11-03; empieza al cerrar 0.1)

Primeras integraciones automáticas. Todo local, con inicio de sesión OAuth desde la app de escritorio y sin servidor.

- **YouTube (automático):** suscriptores, vistas, horas de visualización e ingresos estimados (YouTube Data API + YouTube Analytics API).
- **Twitch (solo seguidores en tiempo real):** total de seguidores y aviso de nuevos seguidores mientras la app está abierta (EventSub por WebSocket, sin servidor público).
- **El resto sigue manual:** TikTok, Instagram, Facebook, horas e ingresos de Twitch.
- Los datos automáticos se guardan en las mismas tablas de registros, con una columna nueva de origen (`manual` o `api`) añadida mediante migración.
- Los tokens de acceso se guardan de forma segura (almacén de credenciales del sistema), nunca en la base de datos en texto plano.
- **Orden decidido el 2026-11-04: primero solo YouTube** (es la red que el usuario usa a diario). Twitch, después.

### Alpha 0.2 · YouTube: sesiones (diseño en ARCHITECTURE.md, D-015)

#### ✅ S17 · App de Google y diseño
- [x] Investigación verificada en la documentación oficial (D-015).
- [x] Decisiones: app de Google "en producción" sin verificar; sincronizar al abrir (con límite de frecuencia) y con botón; foto del canal como foto del perfil.
- [x] El usuario crea el proyecto en Google Cloud, activa YouTube Data API v3 y YouTube Analytics API, configura la pantalla de consentimiento y crea un cliente OAuth "App de escritorio" (JSON descargado).
- [ ] **Pendiente:** publicar la app "en producción". Google exige una URL de página principal y otra de política de privacidad (y no tener logotipo subido). Mientras tanto, la app está en modo "Prueba" con el usuario como usuario de prueba: **la conexión caduca cada 7 días**. Plan: dos páginas públicas en GitHub Pages (repositorio público aparte).

#### ✅ S18 · Conectar YouTube
- [x] Importar el JSON del cliente desde Perfiles; inicio de sesión con el navegador (loopback + PKCE S256); refresh token en el Administrador de credenciales de Windows.
- [x] Canal conectado con sus estadísticas y la foto del canal como foto del perfil; comprobar conexión y desconectar (revoca en Google).
- [x] Tests del receptor loopback y de PKCE (5/5).
- [x] Prueba del usuario: canal conectado.

#### ✅ S19 · Sincronizar el canal
- [x] Migración 006: origen `manual`/`api` y vistas totales en los registros; como mucho un registro automático por perfil y día.
- [x] Sincronización al abrir la app (como mucho cada 3 horas) y con el botón "Sincronizar ahora"; aviso al terminar.
- [x] Suscriptores y vistas totales (Data API); horas de los últimos 365 días sin Shorts ni historias (Analytics por `creatorContentType`).
- [x] Registros muestran la etiqueta "YouTube" y las vistas totales.
- [x] Prueba del usuario: los datos cuadran con YouTube Studio.
- **Pendiente para cuando el canal pase de 1.000 suscriptores:** la Data API los redondea a 3 cifras; habrá que calcularlos con `subscribersGained`/`subscribersLost` de Analytics.

#### ⬜ S20 · Resultados automáticos por vídeo (siguiente)
Las adaptaciones publicadas con enlace de YouTube obtienen sus resultados (vistas, likes, comentarios, compartidos y horas) sin anotarlos.
**Terminado cuando:** un vídeo publicado muestra resultados de origen "YouTube" que coinciden con Studio.

#### Más adelante
Ingresos estimados (`yt-analytics-monetary.readonly`): solo funciona con el canal en el Programa de Socios; hoy daría error 403.

## Ideas aparcadas
Las ideas nuevas se anotan aquí y no interrumpen la fase actual.
- Revisar el código de Firebot (open source) como referencia para Live Studio.
- Elegir la marca definitiva (verificando marca registrada y dominio).
- Metas de ingresos por periodo (por ejemplo, "$100 cada mes"). Requiere una columna de periodo en `goal`.
