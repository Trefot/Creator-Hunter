# ROADMAP.md — Ruta y tareas

Ritmo: trabajo por tareas verificables, con validación final en la app de pruebas de Windows.

## Prioridad actual · Estabilidad para uso personal (2026-11-11)

El producto es exclusivamente personal (PRODUCT.md). Las fases históricas de abajo se conservan como contexto, no como compromiso de implementar todos los módulos.

- [x] Implementar bloqueo de migraciones si falla la copia y recuperación visible con reintento.
- [x] Separar credenciales, archivos de YouTube y copias de pruebas.
- [x] Probar con datos temporales exportación/restauración de las 22 tablas, reapertura, rollback y migraciones con datos existentes.
- [x] Corregir errores de actualización que se mostraban como «al día» y clics duplicados al instalar.
- [x] Comprobar recuperación y vista previa aislada del overlay en Chromium con comandos nativos simulados.
- [x] Ejecutar y revisar la compilación y tests nativos en Windows (GitHub Actions).
- [ ] Confirmar en la app de PRUEBAS la persistencia, el audio en WebView2 y la separación de conexiones.
- [x] Preparar y publicar la actualización autorizada 0.2.10; revisión de uso real pendiente.

Resultados y límites en VALIDACION.md. Propuestas investigadas de uso en RECOMENDACIONES.md; ninguna función nueva se considera implementada por figurar allí.

## Automatización del trabajo creativo (autorizada por el usuario)

Diseño y orden de entrega en AUTOMATIZACION.md. La compilación y pruebas nativas de Windows pasaron; se mantiene pendiente la revisión de uso real.

- [x] Implementar sincronización periódica de YouTube con la app abierta, consultas compartidas y reintentos sin avisos repetidos del mismo error.
- [x] Refrescar métricas sin desmontar formularios y probar que un borrador sobrevive a la sincronización.
- [ ] Validar sincronización periódica con la conexión real de YouTube en Windows.
- [ ] Conectar eventos de OBS y registrar sesiones; vincular marcas y Replay Buffer con Stream Deck.
- [ ] Preparar el contexto y acciones del manager de IA; elegir proveedor/modelo y límites de uso antes de realizar llamadas de pago.
- [ ] Probar el ciclo preparación → directo → marcas → borradores → revisión con sesiones reales.

## Interfaz híbrida elegida por el usuario

- [x] Aplicar tema grafito/violeta/dorado y rediseñar la portada y los accesos del dashboard usando funciones y datos existentes.
- [x] Comprobar estados con datos de ejemplo, sin datos, navegación, formulario de Ideas y vista previa del overlay a distintos tamaños en Chromium.
- [ ] Validar apariencia y uso en WebView2 en el PC del usuario.

## Identidad definitiva · Nexus Studio

- [x] Emblema B aprobado por el usuario: compañero sosteniendo el farol; preparar original transparente y tamaños de escritorio/Stream Deck.
- [x] Aplicar nombre y símbolo en la interfaz, favicon y título de ventana sin cambiar datos ni credenciales.
- [ ] Verificar icono, título y actualización desde la versión instalada en el PC del usuario. Se conserva el nombre técnico de empaquetado.

## Entrega 0.2.10 · actualización autorizada

- [x] Sincronizar las seis referencias de versión y preparar las novedades de 0.2.10.
- [x] Preparar workflow Windows con pruebas, instalador NSIS, artefacto descargable y publicación compatible en releases sin force-push.
- [x] Preparar archivo BAT para compilar localmente en Windows y metadatos de origen en el ZIP.
- [x] Validar configuración de versión, tests del empaquetado y esquema YAML localmente.
- [x] Resolver HTTP 403 de escritura de GitHub; subir el código y ejecutar el workflow.
- [x] Compilar el ejecutable Windows y revisar el resultado de las pruebas nativas.
- [x] Publicar el instalador y comprobar manifiesto, integridad y coincidencia del canal de actualización.
- [ ] Confirmar la instalación desde 0.2.9 en el PC del usuario.

La release 0.2.10 y el canal remoto están publicados y verificados. Estado e instrucciones en ACTUALIZACION.md.

## Entrega 0.2.11 · Fortnite en PC e identidad de Windows

- [x] Detectar el proceso real de Fortnite sin depender de PSN ni confundir ediciones de PC y consola.
- [x] Añadir juegos de cualquier plataforma y elegir el juego actual manualmente.
- [x] Icono explícito de ventana y accesos Nexus Studio con icono dedicado.
- [x] Probar la actualización desde 0.2.10 en Windows: ejecutable, accesos, iconos, registro y versión.
- [x] Publicar y verificar descarga, manifiesto y coincidencia del canal.
- [x] Usuario confirma la franja «Fortnite · PC · detectado» en su PC.
- [ ] Confirmar el icono anclado en el PC del usuario.
- [x] Implementar conexión local al estado de grabación/emisión de OBS en 0.2.12; publicada, uso real pendiente.

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

#### ✅ S20 · Resultados automáticos por vídeo
- [x] Las publicaciones con enlace de YouTube (watch, youtu.be, shorts, live, embed) reciben un resultado diario de origen "YouTube".
- [x] Vistas, likes y comentarios al día (Data API); compartidos y horas desde Analytics (1–2 días de retraso).
- [x] Se traen al sincronizar, al abrir el panel de Resultados de esa publicación y con el botón "Traer de YouTube".
- [x] Prueba del usuario superada.

**Parte de YouTube de Alpha 0.2 terminada (2026-11-04).** Siguiente: Twitch (seguidores en tiempo real) y, cuando se quiera, las páginas públicas para publicar la app de Google.

#### Más adelante
Ingresos estimados (`yt-analytics-monetary.readonly`): solo funciona con el canal en el Programa de Socios; hoy daría error 403.

## Gaming Alpha (adelantado por el usuario el 2026-11-04; antes era la Fase V)

Objetivo: el platino de Black Myth: Wukong (y los siguientes juegos) desde TrophyHunter. Diseño y riesgos en ARCHITECTURE.md (D-016).

#### ✅ G1 · Investigación y diseño
- [x] Conexión no oficial con PSN verificada en el código de psn-api (MIT): NPSSO → código → tokens; endpoints de juegos, trofeos y trofeos ganados.
- [x] Riesgos explicados y **aceptados por el usuario**: va contra los términos de Sony (solo lectura, uso personal) y el NPSSO equivale a la contraseña. **Nunca irá en el SaaS** sin un acuerdo oficial.
- [x] Esquema diseñado (migración 007).

#### ✅ G2 · Biblioteca de juegos y conexión con PSN
- [x] Migración 007: juegos, trofeos, fases, objetivos de juego y `project.game_id`.
- [x] Sección "Juegos" (grupo Gaming): conectar PSN pegando el NPSSO (se canjea y se descarta; el refresh token queda en el Administrador de credenciales de Windows).
- [x] Importador con todos los juegos de la cuenta y buscador; portada guardada en local.
- [x] Ficha del juego: % al platino, recuento por tipo, trofeos pendientes/conseguidos/todos con icono, rareza y fecha; estado del juego; actualizar desde PSN; quitar de la biblioteca.
- [x] Las copias de seguridad incluyen juegos y trofeos (y aceptan copias anteriores sin esas tablas).
- [x] Prueba del usuario: Black Myth: Wukong importado con sus trofeos correctos.

#### ✅ G3 · Ruta al platino por fases
- [x] Vista "Ruta al platino": fases en orden con progreso, fase actual calculada (la primera con pendientes) y "Qué hacer ahora" con los perdibles pendientes de otras fases.
- [x] Ruta sugerida para Black Myth: Wukong (9 fases, 7 perdibles, una nota por trofeo), redactada sin copiar guías y con su fuente; comprobado que los 36 trofeos están en una sola fase.
- [x] Fases editables (crear, renombrar, nota, reordenar, borrar) y plan por trofeo (fase, perdible y nota), que la sincronización con PSN conserva.
- [x] Prueba del usuario superada.

#### ✅ G4 · Guía del juego
- [x] Migración 008: entradas de guía (jefe, build, atajo/ruta, farmeo y consejo) con fase, resumen, contenido, captura, vídeo, fuente y "comprobado", enlazadas a trofeos.
- [x] Pestaña "Guía" con filtros por tipo, editor completo y tarjetas; la guía de la fase actual aparece en "Qué hacer ahora".
- [x] 16 borradores para Wukong: datos comprobados (capítulo, si es secreto y trofeo) y el farmeo real del usuario; las estrategias quedan "por verificar" en vez de inventarlas.
- [x] Las copias de seguridad incluyen la guía.
- [x] Prueba del usuario superada.
- **Cómo crece:** cuando el usuario llegue a un jefe, Claude investiga una guía fiable de ese jefe y redacta un resumen original con la fuente.

#### ✅ G5 · Detección del juego abierto ("modo juego")
- [x] Presencia de PSN (`basicPresences` de `me`, verificado en psn-api) consultada cada minuto con la app abierta.
- [x] Emparejamiento con la biblioteca por nombre normalizado (8/8 casos de prueba), porque la presencia usa otro ID.
- [x] Al empezar a jugar, la app abre la ficha del juego una sola vez por partida y muestra la franja "Jugando ahora" con "Ver ruta".
- [x] Interruptor "Modo juego automático" con su estado (activo, detectado, error o desactivado).
- [x] Prueba del usuario: detectó Black Myth: Wukong abierto en la PS5.
- **PC:** Fortnite por proceso implementado en 0.2.11; detección automática de otros juegos pendiente.

#### ✅ G5+ · Skin del juego, listas por trofeo y plan de hoy
- [x] Skin: colores y fondo de la app sacados de la portada del juego que se está jugando.
- [x] Ficha por trofeo con lista para marcar, siguiente paso, puntos propios y "Ya lo perdí → NG+".
- [x] Pestaña "Hoy" armada a mano desde los trofeos pendientes, con progreso y siguiente paso por trofeo.
- [x] Listas de Wukong: final del cap. 6, final secreto, hechizos, reliquias y semillas.
- [x] Lista de las 36 curiosidades (8 aleatorias, 2 perdibles).
- [x] Lista de calabazas, bebidas e infusiones (47).
- [ ] Listas grandes de Wukong (una sesión de investigación cada una): armaduras, armas, espíritus y transformaciones, fórmulas de medicina y diario.

#### ⬜ G6 · Objetivos de juego y enlace con vídeos (siguiente)
Objetivos con progreso (nivel, XP farmeada…) y proyectos del Creator Studio enlazados al juego.

### Live Studio (adelantado por el usuario el 2026-11-08)

#### ✅ L1 · Contadores con overlay de OBS y Stream Deck
- [x] Contadores (migración 012) con plantillas rápidas, icono, color, paso y juego.
- [x] Servidor local (127.0.0.1) con overlay para OBS y URLs del Stream Deck con clave local.
- [x] Prueba del usuario en OBS y con el Stream Deck (funciona).
- [x] Imagen PNG propia y fondo ajustable (color y opacidad), pedido del usuario.
- [x] Estilo gamer, animación, sonido y reacción instantánea (referencia: overlay de cofres de un streamer de Fortnite).
- [x] Sonido confirmado por el usuario en OBS (2026-11-10). Con «Controlar audio mediante OBS» hay que poner la fuente en «Monitorizar y emitir» y elegir el dispositivo de monitorización (el usuario usa Elgato Wave Link).

- [x] Actualización automática desde GitHub como Lumen (v0.2.4), confirmada por el usuario el 2026-11-10.

#### 💡 Ideas para los directos (propuestas el 2026-11-10, por elegir)
- Celebraciones por hitos: cada 100/1.000, confeti, sonido especial y mensaje («¡10.000 COFRES!»).
- Camino al platino en pantalla: % al platino, trofeo actual y su progreso; se actualiza solo con PSN.
- Botón «¡Clip!» en el Stream Deck: apunta el minuto del directo para cortar Shorts después (va a Ideas/Proyectos).
- Resumen al terminar el directo: duración, contadores, trofeos y seguidores nuevos.
- Escenas automáticas en OBS según el juego detectado en la PS5 (OBS WebSocket).
- ~~Contador «de hoy» + total~~ (descartada por el usuario).

#### ⬜ L2 · Seguidores y suscriptores automáticos
YouTube (ya conectado) y Twitch (EventSub, pendiente de Alpha 0.2) como contadores de origen automático.

#### ⬜ L3 · Detección automática por imagen
Muertes y jefes de Wukong desde la captura (como TrefotWukong); después, experimento con los cofres de Fortnite. Solo se lee la imagen, nunca la memoria del juego (antitrampas).

## Ideas aparcadas
Las ideas nuevas se anotan aquí y no interrumpen la fase actual.
- Revisar el código de Firebot (open source) como referencia para Live Studio.
- Elegir la marca definitiva (verificando marca registrada y dominio).
- Metas de ingresos por periodo (por ejemplo, "$100 cada mes"). Requiere una columna de periodo en `goal`.

## Entrega 0.2.12 · OBS y marcas para Stream Deck

- [x] Cliente WebSocket local v5 con contraseña en credenciales de Windows, consulta de salidas y reconexión.
- [x] Marcas con juego y tiempos consultados en OBS desde la interfaz o la URL local protegida.
- [x] Historial y copia de lista; ruta de archivo cuando OBS la confirma.
- [x] Migración 016 y copias de las 24 tablas; compatibilidad con esquema 15 y escritura serializada durante restauración.
- [x] Pruebas de protocolo, SQLite e interfaz con servicios simulados.
- [x] Publicación Windows y descarga verificadas (43068021591).
- [x] Usuario confirma marcas con OBS y Stream Deck reales (0.2.12).

Guardar Replay Buffer se implementa en 0.2.13; recortar/editar vídeo sigue pendiente. Una marca por sí sola no es un archivo de vídeo.

## Entrega 0.2.13 · Replay Buffer

- [x] Guardar clip con confirmación de archivo en OBS, sin iniciar/parar salidas.
- [x] Botón Live Studio y URL independiente para Stream Deck.
- [x] Historial con ruta, juego y marca opcional, válido con búfer solo.
- [x] Migración 017 y copias de 25 tablas; pruebas de rollback y esquema anterior.
- [x] Pruebas de protocolo e interfaz sin mostrar guardados falsos.
- [x] Publicar y verificar Windows desde 0.2.12 (43074073595).
- [ ] Probar un clip real del Replay Buffer del usuario.

## Entrega 0.2.14 · Juegos y creación

- [x] Biblioteca con búsqueda/filtro, portada y sin trofeos/progreso vacíos.
- [x] Ficha creativa sin trofeos con objetivos diarios, notas e historial.
- [x] Portada editable y notas generales conservadas en game.
- [x] Contenido por juego: capturas, ideas y proyectos; conversión idempotente y aprobación conservando contexto.
- [x] Relación idea.game_id y origen único (migración 018); copias y prueba de esquema anterior.
- [x] Prueba de interfaz con SQLite real, recarga y navegación de trofeos de PSN.
- [x] Publicar y verificar Windows desde 0.2.13 (43080516190).
- [ ] Revisar el uso de Fortnite/PSN en el equipo del usuario.

## Entrega 0.2.15 · Platinos y objetivos en directo

- [x] Portada oficial de Fortnite como fallback sin sustituir portadas personales.
- [x] Colección de platinados con origen manual/PSN y sin duplicación por ficha.
- [x] Listas de Wukong compartidas con las guías y objetivo personal para el token de Fortnite.
- [x] Overlay de platinos/objetivo y controles Conseguido, Deshacer y Siguiente para Stream Deck.
- [x] Detección visual local por referencia y región desde OBS, con modos Prueba y automático.
- [x] Copias de las 27 tablas y compatibilidad con esquema 18.
- [x] Prueba de interfaz, detección sintética y progreso del overlay.
- [x] Publicar y verificar Windows desde 0.2.14 (43099483059).
- [ ] Calibrar avisos reales de Wukong y el token de Fortnite en el OBS del usuario; comprobar falsos positivos y duración de avisos.

## Entrega 0.2.16 · Fuentes separadas de alertas

- [x] Dos fuentes locales para OBS, con preferencias y colas independientes.
- [x] Pruebas identificadas y anuncios manuales, sin fingir recepción de eventos sociales.
- [x] Controles de prueba, pausa, silencio y repetición para Live Studio y Stream Deck.
- [x] Coordinación opcional de sonidos y exclusión de una segunda fuente simultánea.
- [x] Preferencias en copias de seguridad y compatibilidad con esquema 19.
- [x] Pruebas del motor, restauración e interfaz/overlay.
- [x] Publicar y verificar Windows desde 0.2.15 (43126432738).
- [ ] Comprobar las dos fuentes y su audio en el OBS del usuario.
- [ ] Implementar autorización y recepción real de eventos de Twitch y YouTube.
- [ ] Implementar anuncios de directos en Discord por separado.

## Entrega 0.2.17 · Identidad animada de Trefot

- [x] Primera plantilla con el personaje de Nexus, movimiento, farol y destellos.
- [x] Variantes Twitch violeta/dorado, YouTube rojo/dorado y TikTok cian/rosa.
- [x] Fuente y cola locales independientes para TikTok, sin fingir integración social.
- [x] Editor de etiqueta, nombre/mensaje de prueba, tipografía, tamaños y colores.
- [x] Vista previa aislada con el mismo renderer de OBS, sin sonido ni consumo de eventos.
- [x] Conservar preferencias anteriores; pruebas de estilos, copia/restauración e interfaz.
- [x] Grabar una muestra real con las tres variantes y eventos ficticios.
- [x] Publicar y verificar actualización Windows desde 0.2.16 (43135451689).
- [ ] Verificar audio y fuentes en el OBS real del usuario.
- [ ] Plantillas por cada tipo de evento y recepción automática de eventos sociales.

## Entrega 0.2.18 · Fidelidad a la muestra aprobada

- [x] Conservar la muestra de referencia y sustituir marcos simplificados por artes completos.
- [x] Poses de saludo y marcos propios de Twitch, YouTube y TikTok.
- [x] Inter integrada, composición del texto sobre el arte y preset para recuperar la muestra.
- [x] Etiqueta dorada editable y texto colocado dentro del marco.
- [x] Recarga de las fuentes nuevas al cambiar la versión de Nexus.
- [x] Pruebas de interfaz, tipografía real y grabación de la composición corregida.
- [x] Publicar y verificar Windows desde 0.2.17 (43140822089).
- [ ] Refrescar las fuentes antiguas y comprobar el resultado en el OBS del usuario.
