# CHANGELOG

## [Sin publicar]

## [0.2.46] · 2026-11-18 · Alertas de suscriptores de YouTube

- Las alertas de YouTube ahora suenan también con suscriptores que tienen sus suscripciones privadas, que eran la mayoría y no aparecían: Nexus vigila el contador del canal cada 2 minutos y anuncia «Nuevo suscriptor» cuando sube. Los públicos siguen saliendo con su nombre y no se anuncian dos veces.
- Las bajas y vueltas no repiten alertas. Solo cuentan los suscriptores que llegan con Nexus abierto, y si entran varios de golpe sale una sola alerta con el total.

## [0.2.45] · 2026-11-18 · YouTube vuelve a conectar

- Corregido «Failed to fetch» al conectar YouTube: la política de seguridad de 0.2.38 bloqueaba la foto del canal y la conexión aparecía como fallida aunque ya se había guardado. Al reconectar, el chat del directo y los comandos de YouTube vuelven a funcionar.
- Si la foto del canal no se puede poner, la conexión sigue adelante y ya no se muestra como error.

## [0.2.44] · 2026-11-17 · Publicaciones, contenido y fiabilidad

- Crear contenido → Publicaciones y resultados detecta contenido reciente de YouTube, TikTok, Instagram, Facebook y vídeos/repeticiones y clips de Twitch mediante sus APIs oficiales. Guarda las métricas disponibles y su evolución; consulta cada diez minutos mientras Nexus esté abierto, con límites y permisos visibles. No promete tiempo real al segundo.
- Agrupa publicaciones por serie y proyecto y compara resultados dentro de cada cuenta y formato a 24 horas, 72 horas o siete días. Exige referencias suficientes antes de orientar una serie; no pausa ni publica contenido automáticamente. TikTok necesita video.list y las vistas de Meta requieren permisos de estadísticas adicionales.
- Corregida la selección de cifras recientes al mezclar API y registros manuales y el falso estado Publicado del calendario. Inicio añade evolución, varias metas, horas y vistas, fecha de consulta e hitos respaldados por registros reales.
- Borradores recuperables de ideas, metas, versiones, proyectos, guiones y notas de juego. El guion guarda durante la escritura. Cerrar con trabajo activo pide revisar la salida y el historial multimedia identifica trabajos interrumpidos para volver a solicitarlos.
- Actualizar al abrir ahora avisa: la instalación se elige cuando conviene y comprueba OBS, capturas y procesamiento activo. Los instaladores locales requieren verificación contra el canal oficial.
- Capturas reunidas en una bandeja con revisión y estados de proyecto, exportación, calendario y publicación. Vista previa del Short con reproducción y audio, selección de pistas recordada y encuadre con plantilla vertical de cámara más juego.
- Subtítulos accesibles desde el Short, corrección del SRT conservando el original, incorporación opcional en una copia del vídeo, selector de archivos y reparación de rutas. Los candidatos descartados sin vínculos se pueden enviar explícitamente a la papelera de Windows para liberar espacio.
- Conexiones permite configurar OBS, Spotify y PlayStation en su propio centro. TikTok reutiliza el cliente guardado al reautorizar; corregidas su primera consulta global y la actualización automática tras reconectar Twitch. Los fallos explican permisos, caducidad o disponibilidad sin borrar cifras válidas.
- Menos consultas de paneles ocultos, diagnóstico de alertas, atenuación de música local durante voz y alertas, catálogo de acciones Stream Deck y continuidad del resumen del directo hacia las capturas. Discord explica cuándo necesita Nexus abierto.
- Biblioteca local de Steam y Epic importable, prioridad y objetivos personales de juegos, próximos platinos ordenados por preferencia y ajustes de cofres con motivo, separados de las partidas detectadas. Rutina y colchón ajustables y calendario con atrasados y reprogramación.
- Ingresos previstos separados de cobros confirmados, sin duplicar pagos; formatos regionales de dinero y monedas independientes. Copias automáticas diarias con siete versiones, preferencias respaldadas y diagnóstico sin credenciales ni datos personales.
- Añadidas pruebas de interfaz en las comprobaciones automáticas, migración aditiva 25 con las nuevas tablas incluidas en copias y política de contenido web restringida. Las pruebas simuladas no sustituyen la comprobación de audio, dispositivos y permisos reales en tu equipo.

## [0.2.43] · 2026-11-16 · Autorizar TikTok desde Nexus

- Conexiones → TikTok permite autorizar la cuenta en el navegador con las credenciales de tu Sandbox, sin copiar manualmente un access token. Muestra la dirección de retorno que debes registrar en Login Kit → Desktop.
- Comprueba la sesión de autorización, usa PKCE según el protocolo de TikTok y valida la identidad y sus seguidores antes de guardar la cuenta. Client secret y tokens permanecen en el almacén de Windows; no se incluyen en las copias de la base de datos.
- Renueva el acceso al consultar las cifras cuando haga falta y conserva el refresh token rotado. Si el proveedor revoca el acceso o vence la renovación, solicita volver a autorizar. Mantiene el token manual como alternativa avanzada.
- La autorización exige la configuración y permisos de TikTok; las pruebas no equivalen a una aprobación para producción. No añade TikTok LIVE ni publicación de vídeos.

## [0.2.42] · 2026-11-16 · Conexión directa con Meta

- Instagram + Facebook permite indicar el ID de la página cuando Meta devuelve vacía la lista de páginas, aunque la autorización sí permite leer sus métricas.
- Verifica la identidad y los seguidores de la página y de su Instagram vinculado antes de guardar la autorización. Conserva el acceso anterior si la comprobación falla.
- Explica el caso de lista vacía sin atribuirlo automáticamente a permisos faltantes. El token sigue en el almacén de Windows y se elimina del formulario tras conectar; las autorizaciones que caduquen requieren renovación en Meta.

## [0.2.41] · 2026-11-16 · Tus redes al frente

- Inicio renovado con tarjetas de YouTube, Twitch, TikTok, Instagram y Facebook: cifras, fecha, origen, comparación con registros reales y metas de cada cuenta. No se inventa crecimiento cuando falta historial.
- Nuevo centro de Conexiones con pasos para cada servicio, perfiles existentes y actualización de seguidores de Twitch. Instagram de creador y su página de Facebook se configuran juntos con autorización de Meta; TikTok dispone de configuración personal mediante su API oficial. Meta y TikTok requieren credenciales y permisos del proveedor, no quedan conectados al instalar.
- Las credenciales nuevas se guardan en Windows. Las actualizaciones conservan el último registro válido, no duplican el registro automático diario ni modifican los manuales; Facebook e Instagram se guardan juntos o no se guarda ninguno.
- Capturas, revisión y Shorts reunidos en Crear contenido. La cabina muestra las acciones diarias; contadores y configuración quedan en herramientas secundarias. Se conservan los enlaces de OBS y Stream Deck.
- Las fichas de juegos separan los controles de detección y apariencia del progreso habitual. Se conserva el contador de cofres al terminar la partida; esta versión no incluye detección visual experimental.

## [0.2.40] · 2026-11-15 · Cofres de Fortnite sin pulsar botones

- En directo → Contadores permite activar el conteo de cofres a partir de las repeticiones locales de Fortnite. Al terminar una partida suma los cofres abiertos y destruidos atribuidos a tu jugador.
- Conserva el total existente y registra cada partida una sola vez. Las repeticiones anteriores a la activación y los cofres de compañeros no se añaden.
- Incluye un lector local para Windows: no requiere instalar .NET, iniciar sesión ni subir las repeticiones. Debes activar Guardar repeticiones en Fortnite y mantener Nexus abierto.
- El conteo se actualiza después de cada partida, no durante ella. Los casos sin atribución segura se excluyen; algunas destrucciones desde vehículos pueden faltar. Una actualización de Fortnite podría requerir actualizar el lector.

## [0.2.39] · 2026-11-15 · Recuperar la jugada anterior

- MOMENTO se usa después de la jugada: el recorte normal recupera 30 segundos anteriores y 5 posteriores. Se muestra el tiempo disponible antes de guardar.
- La vista previa muestra el inicio real del mismo tramo que se exportará; ya no muestra directamente el instante de pulsación.
- Pantalla de Shorts simplificada: Recuperar la jugada, Ver cómo empieza y Guardar Short. Imagen, audio y GPU quedan en opciones aparte.
- Las marcas sin grabación asociada muestran una explicación y ocultan opciones que no pueden usarse. Si falta vídeo anterior, se avisa sin inventarlo ni borrar otros archivos.

## [0.2.38] · 2026-11-15 · Estudio integrado y correcciones

- Elige o mezcla las pistas de audio para Shorts y subtítulos. Corregidos los formatos verticales y añadido Original, horizontal 16:9 y vista previa.
- Nueva cola de procesamiento con cancelación, progreso al navegar y modo ligero durante grabación o emisión. Prueba de NVIDIA antes de activar NVENC opcional.
- Subtítulos sin sobrescrituras, importación de grabaciones anteriores y continuidad del Short hacia subtítulos, proyecto y calendario.
- Corregido el seguimiento de vídeos programados de YouTube, sus coincidencias entre cuentas y plataformas, el colchón y el progreso semanal.
- Guía general de conexiones, estados más claros y navegación separada entre uso del directo y configuración. Historial de avisos de Discord.
- Perfiles e historial para la detección visual de objetos y guía PC/PlayStation. Los cofres de Fortnite mantienen el control manual hasta validar su detección.
- Carga de los apartados principales bajo demanda y protección de restauraciones mientras se procesa vídeo.

## [0.2.37] · 2026-11-15 · Subtítulos y capítulos

- Nuevo panel en En directo → Momentos: «Subtítulos y capítulos» con tus grabaciones de OBS.
- «Capítulos» convierte los momentos que marcaste con «¡Clip!» en capítulos listos para pegar en la descripción de YouTube (empiezan en 00:00 y cumplen la regla de 10 s); te avisa si faltan momentos.
- «Crear subtítulos» transcribe la grabación en tu PC con Whisper y guarda un .srt junto al vídeo para subirlo en YouTube Studio. El audio nunca sale de tu ordenador.
- La primera vez se instala la transcripción con un botón (unos 500 MB, una sola vez); Nexus comprueba la huella de cada descarga antes de usarla.

## [0.2.36] · 2026-11-15 · Planificar la semana entera el domingo

- En «Hoy toca» ya puedes planificar días de editar y programar con vídeos que aún no has grabado o editado; aparecen al final de la lista marcados «(aún por grabar)» o «(aún por editar)».
- Al marcar como hecha una edición o una programación, también se completan los pasos anteriores que faltaban (guion y grabación).

## [0.2.35] · 2026-11-15 · Hoy toca se actualiza solo

- Al parar una grabación en OBS, Nexus te pregunta cuál de las grabaciones de hoy hiciste; con un clic se marca como hecha y el vídeo pasa a Edición.
- «Hoy toca» detecta tus subidas recientes de YouTube y te propone a qué proyecto corresponden: con un clic quedan marcadas como Publicado (con enlace y fecha) o como Programado si las dejaste programadas.
- Nada cambia sin tu confirmación, y Nexus solo lee YouTube: nunca sube ni modifica vídeos.

## [0.2.34] · 2026-11-15 · Momentos por voz y Shorts

- Captura voluntaria por frase local de Windows («Nexus guarda esto») y por botón. Se activa en cada sesión; el micrófono tiene indicador global y controles de detener. Requiere un reconocedor local compatible y el micrófono predeterminado de Windows.
- Espera configurable para incluir lo posterior al momento y guardado confirmado del Replay Buffer de OBS. No inicia OBS, grabaciones, emisiones ni el buffer. Ajustes iniciales: 30 s antes, 15 s después y buffer declarado de 60 s.
- Bandeja de candidatos pendientes, conservados y descartados, con acceso al vídeo original. Solo los conservados se exportan como Shorts; descartar no elimina vídeos.
- Recorte de candidatos sobre la duración real medida por ffprobe, con aviso si falta parte del tramo. Exportación vertical con fondo, recorte central u horizontal; nunca publica automáticamente.
- Límites: una captura pendiente, 90 s entre solicitudes, seis solicitudes por hora, veinte pendientes y pausa de nuevas capturas al alcanzar 2 GB de archivos registrados. Un último archivo puede superar el umbral. Cancelación de la espera y limpieza explícita de fichas descartadas sin archivo.
- Nuevo enlace privado de Stream Deck para capturar con solo Replay Buffer; el botón Momento anterior conserva su marcado y también solicita clip si la captura está activada.
- La detección de juegos actualiza el aviso sin navegar automáticamente ni descartar formularios. Búsqueda directa de Momentos y Shorts y pestaña seleccionada visible en su fila desplazable.
- Guía y límites en docs/MOMENTOS.md. La detección de victorias, trofeos y reacciones visuales queda para siguientes detectores; la voz y el audio reales deben probarse en el PC.


## [0.2.33] · 2026-11-15 · Hoy toca: tu hábito de grabar, editar y publicar

- Nuevo panel «Hoy toca» en Inicio: según tu rutina semanal te dice si hoy toca grabar, editar, programar, directo o descanso, y tú eliges qué vídeo trabajar.
- Al pulsar «Hecho», Nexus marca el paso del proyecto (grabación, edición o programación) y suma la sesión a tu semana.
- Tira de 7 días para planificar la semana el domingo, y botón «Rutina» para cambiar qué toca cada día (empieza con el plan del colchón: lunes y martes grabar, miércoles editar, jueves directo, viernes editar, sábado grabar, domingo programar).
- Medidor del colchón de contenido: vídeos largos y Shorts ya editados frente a la meta de 2 semanas (4 largos y 10 Shorts), con aviso cuando toca semana de grabar.
- Migración 24 aditiva para la rutina y las sesiones, incluida en las copias de seguridad.

## [0.2.31] · 2026-11-14 · Añadir varias ideas de golpe

- Nuevo botón «Añadir varias» en Crear contenido → Ideas: pega una lista (una idea por línea: Título | descripción | etiquetas) y se crean todas a la vez.
- Las ideas cuyo título ya existe se saltan, así que pegar la misma lista dos veces no duplica nada.

## [0.2.30] · 2026-11-14 · Spotify en el overlay de música

- El overlay de música (/music) ahora muestra la canción de tu Spotify cuando no suena nada del reproductor local. Si ya lo tenías en OBS, empieza a funcionar sin tocar nada.
- Botones más claros en Sonido → Overlays: «overlay de música (local + Spotify)» y «tarjeta solo de Spotify».
- El overlay de música se recarga solo en las próximas actualizaciones. Esta vez, en OBS pulsa una vez «Actualizar caché de la página actual» en esa fuente (o reinicia OBS).

## [0.2.29] · 2026-11-14 · Preparar, responder y recortar

- Nuevo En directo → Estado: semáforos de todas tus conexiones (OBS, Twitch y sus permisos, YouTube, Discord, Spotify, PlayStation, comandos y ffmpeg) con un botón para arreglar cada una antes del directo.
- «Empezar directo» en la Cabina: lista de preparación de unos dos minutos con conexiones, OBS, juego y objetivo, título de Twitch editable, comandos de chat y comprobaciones tuyas. Nexus nunca empieza la emisión.
- Comandos de chat en En directo → Comandos: !platino, !juego, !redes, !discord y los que crees, con variables como {platinos}, {juego}, {progreso} y {contador:Nombre}, espera entre usos y vista previa. Responden en Twitch y YouTube.
- Para que los comandos puedan contestar hay que renovar una vez los permisos de Twitch (Conexiones) y volver a conectar YouTube; Estado te avisa.
- Clips para Shorts: «Crear Short» en cada momento o clip recorta la grabación alrededor de la marca en vertical con fondo difuminado, vertical recortado u horizontal, y lo guarda en Vídeos → Nexus Shorts. Necesita ffmpeg, que se instala con un clic mediante winget.
- Migración 23 aditiva para el historial de Shorts, incluido en las copias de seguridad.

## [0.2.28] · 2026-11-14 · Resumen del directo

- Al detener la emisión en OBS aparece el resumen del directo: duración, juego, personas nuevas, subs y miembros, bits, raids y Super Chats.
- Agradece por nombre a quienes apoyaron (bits, subs, regalos, raids y Super Chats) y muestra cuánto subió cada contador.
- Incluye los momentos y clips guardados durante el directo y los trofeos conseguidos mientras emitías.
- Nuevo apartado En directo → Resúmenes con el historial de tus últimos 30 directos.
- Botón para agradecer en tu canal de directos de Discord, con vista previa antes de publicar y sin menciones masivas. Cada resumen se publica una sola vez.
- Migración 22 aditiva: registro de eventos recibidos y valor de los contadores al empezar y terminar cada emisión, incluidos en las copias de seguridad.

## [0.2.27] · 2026-11-14 · El taller de Nexus

- Nueva identidad visual V2 en tinta, violeta y latón, con el taller ilustrado y el Nexus original. Inicio conserva tus datos reales y permite reducir el detalle con Modo enfoque.
- Navegación principal simplificada: Inicio, Crear contenido, En directo y Juegos. Mi estudio agrupa cuentas, metas e ingresos; búsqueda de secciones con Ctrl+K y ayuda de orientación.
- Crear contenido reúne proyectos, ideas y capturas. El tablero calcula la etapa y el siguiente paso de todas las versiones pendientes; los borradores se conservan al cambiar de pestaña.
- Cabina de directo con escenas reales de OBS, cambio explícito de escena y captura fija a petición; sin previsualización continua. Chat, sonido, alertas, overlays, contadores, categoría, OBS, conexiones y momentos tienen sus propios apartados.
- Biblioteca con banner de la partida activa y su nota real; añadir juegos, detección e importación reunidos en un panel desplegable. Conserva fichas, platinos y overlays existentes.
- Se mantienen datos, identidad de instalación y enlaces de Stream Deck. La señal, el audio y las conexiones reales requieren OBS y tus cuentas configuradas en el PC.

## [0.2.26] · 2026-11-14 · Directo, contenido y gaming

- TTS local de Windows mediante recompensa propia de puntos de Twitch: selección de voz, velocidad, volumen, filtros, cola limitada y controles de detener/pausar para Stream Deck. Requiere renovar permisos de Twitch y probar el audio en el PC.
- Bandeja de momentos y clips en Live Studio y Proyectos, con conversión directa e idempotente a proyecto, archivo confirmado y marcas de la sesión. No renderiza ni recorta vídeos automáticamente.
- Notas persistentes para retomar cada partida y candidatos a próximos platinos según los trofeos registrados. La detección de juegos ya no cambia de página mientras usas Live Studio.
- Diagnóstico de OBS por red, renderizado y codificación; actividades de charla, gameplay y reacciones con perfiles existentes, escena y presets de vídeo. Aplicación fuera de emisión con copia previa y restauración de perfil/vídeo/escena; no modifica encoder ni bitrate.
- Conexión personal de Spotify Premium mediante PKCE, controles y tarjeta informativa sin audio. Reproductor local para música autorizada, volumen, overlay y peticiones !sr moderadas de Twitch/YouTube. Tokens guardados en Windows, fuera de las copias.
- Las conexiones, voces, dispositivos y audio de emisión se configuran en el PC del usuario. Guía de los cinco módulos en docs/ESTUDIO.md.

## [0.2.25] · 2026-11-14 · Chat y categoría de Twitch

- Live Studio reúne mensajes de Twitch y YouTube con filtros por plataforma y un historial efímero de hasta 200 mensajes.
- Overlays de chat independientes con estilo Nexus, vista previa ficticia y enlaces locales protegidos. Los mensajes desaparecen a los 25 segundos; las eliminaciones recibidas también se reflejan.
- Categoría automática de Twitch por juego de la biblioteca: búsqueda oficial, asociación por edición, espera de estabilidad, pausa ante detección ambigua y comprobación del directo antes de escribir. Desactivada por defecto.
- Nuevos permisos de Twitch para chat y categoría; las conexiones existentes deben volver a autorizarse. Las alertas conservan su conexión y preferencias.
- Guía de configuración y límites en docs/DIRECTO.md. TTS, peticiones musicales y diagnóstico de OBS continúan pendientes.

## [0.2.24] · 2026-11-14 · Actualizaciones sin bloqueos de Git

- El actualizador consulta y descarga por HTTPS desde las publicaciones oficiales. Ya no necesita Git ni utiliza la caché que podía quedar bloqueada por shallow.lock.
- Verifica el tamaño, SHA256 y cabecera de Windows antes de ejecutar una descarga. Los archivos temporales son independientes y se evita aplicar dos actualizaciones simultáneas desde una misma instancia.
- Se conserva la opción de instaladores locales y se reconocen también los nombres Nexus-Studio. Las versiones con la caché Git bloqueada deben instalar esta actualización una vez mediante la descarga directa.

## [0.2.23] · 2026-11-14 · Detección y fichas de juegos

- Añadir un juego abre su ficha con objetivos, notas, portada y contenido. Repetir el alta del mismo título y plataforma reutiliza la ficha; las ediciones de PC y PS5 permanecen separadas.
- Detección de PC ampliada a 7DS y Black Myth: Wukong, además de Fortnite. Asocia otros juegos una vez a su ejecutable desde la ficha o el alta; la lista de aplicaciones abiertas permite elegir el proceso sin buscar rutas ni leer memoria de los juegos.
- Opción para añadir a la biblioteca los juegos detectados de PC o PSN, apagada por defecto. Una elección manual puede retirarse para volver a la detección automática.
- Los juegos de PSN visibles que aún no están en la biblioteca se muestran para crear su ficha o importar trofeos. Importar una ficha local con el mismo título y plataforma conserva sus notas y relaciones.
- La detección no descarga por sí sola logros o portadas: PS5 utiliza la conexión e importación de PSN, y los juegos de PC mantienen objetivos y portadas propios.

## [0.2.22] · 2026-11-12 · Identidad Nexus en los avisos de Discord

- Carga una imagen PNG propia para los avisos de directo de Twitch y YouTube desde Live Studio → Discord. La tarjeta conserva título, enlace y miniatura de la plataforma y muestra la ilustración adjunta a tamaño grande.
- El adjunto se envía directamente a Discord, sin alojamiento público. Admite PNG de hasta 6 MB y 4096 píxeles por lado, se guarda en Nexus y entra en sus copias de seguridad.
- Las pruebas del canal de directos incluyen la imagen elegida y se identifican como pruebas. Cargar o retirar el arte no publica mensajes y no modifica los webhooks guardados.

## [0.2.21] · 2026-11-12 · Avisos para tu comunidad de Discord

- Nuevo apartado Discord en Live Studio, con webhooks separados para directos y vídeos. Enlaces guardados en las credenciales de Windows, fuera de las copias de seguridad, y pruebas explícitas por destino.
- Avisos de directos de Twitch y YouTube y de vídeos públicos de YouTube, destacados y subidas de Twitch y clips recientes, con consultas cada 2 minutos mientras Nexus está abierto. La primera consulta de publicaciones crea una referencia sin anunciar el historial.
- Comparte publicaciones de TikTok, Instagram, YouTube y Twitch pegando su enlace. TikTok e Instagram todavía no tienen detección automática.
- Registro persistente y reserva atómica de cada aviso, normalización de enlaces compartidos y respeto de los límites de Discord. Las entregas sin confirmar no se repiten automáticamente; hay que comprobar el canal.
- Mensajes con título, enlace, plataforma y miniatura cuando está disponible, sin menciones masivas. No requiere un bot con Administrador ni cambia los canales o roles del servidor.

## [0.2.20] · 2026-11-12 · Eventos reales y sonidos propios

- Recepción oficial de Twitch mediante EventSub WebSocket: seguidores, suscripciones, renovaciones, regalos, bits y raids según permisos y afiliación. Autorización de aplicación pública con código de dispositivo y tokens guardados en el Administrador de credenciales de Windows.
- YouTube consulta nuevos suscriptores públicos cada 2 minutos y el chat del directo para miembros, membresías regaladas, Super Chat y Super Stickers. La primera lectura establece una base sin emitir eventos antiguos; no se identifican suscripciones privadas ni se garantiza un aviso por volver a suscribirse.
- Panel de conexiones con errores visibles, estado parcial y último evento recibido. TikTok mantiene pruebas y anuncios manuales; no se anuncia como conectado automáticamente.
- Audios MP3, WAV y OGG propios por evento, hasta 2 MB, con inicio, fin, volumen, escucha del recorte y salida suave. Biblioteca local separada de las plantillas e incluida en las copias.
- Coordinación del audio según la duración real del recorte. Las alertas esperan su turno de sonido antes de entrar; silencio, pausa y repetición conservan sus controles.
- Entrada escalonada del marco y texto, brillos y partículas por celebración, regalo, portal y corazones, respetando los artes aprobados y la preferencia de reducir movimiento.
- Migración aditiva 21 para medios y cursores, con copia previa y compatibilidad con respaldos antiguos. Las cuentas se autorizan en el equipo del usuario; las pruebas automatizadas no sustituyen un evento real con OBS.

## [0.2.19] · 2026-11-12 · Alertas por evento

- 16 plantillas: seguidores, suscripciones, renovaciones, regalos, bits y raids en Twitch; suscriptores, miembros, membresías regaladas, Super Chat y Super Sticker en YouTube; seguidores, suscripciones, regalos, me gusta y compartir en TikTok.
- Un enlace y una cola por plataforma. Cada evento guarda su ilustración, melodía, duración, volumen, texto, tipografía y activación independientemente.
- Nuevas poses de celebración, regalo, aporte, portal y corazones, sobre los marcos de referencia de cada red.
- Variables de prueba {usuario}, {cantidad} y {mensaje}; borradores conservados al cambiar de evento y pruebas de Stream Deck con selección de tipo.
- Las alertas en cola conservan la configuración con la que se enviaron; repetir recupera también el tipo y el diseño originales. Pausa y silencio siguen siendo globales por plataforma.
- Ilustraciones compartidas entre OBS y la vista previa sin duplicarlas en el bundle del frontend. Preferencias incluidas en las copias, sin nueva migración.
- La recepción automática de eventos sociales sigue pendiente. Las plantillas se pueden probar y los anuncios manuales permanecen disponibles.

## [0.2.18] · 2026-11-12 · Arte de las alertas de referencia

- Sustituye los marcos simplificados y el logo estático por artes completos preparados desde la muestra aprobada: personaje saludando, marcos detallados, placas y efectos propios de Twitch, YouTube y TikTok.
- Texto dinámico sobre el arte, con Inter integrada y ajustes de posición para respetar la composición. Mensaje en cursiva y etiqueta dorada independiente.
- Botón Cargar diseño de la muestra para recuperar textos, tamaños y colores de referencia antes de guardar.
- La ilustración conserva su paleta; etiqueta, nombre y mensaje mantienen color y tipografía editables. Se conservan las colas y controles existentes.
- Vista previa y OBS comparten artes, fuente y renderer; las modificaciones del overlay también se actualizan durante el desarrollo.
- Las fuentes nuevas recargan el documento cuando cambia la versión de Nexus; al actualizar desde 0.2.17 hay que refrescar la fuente una vez.
- Sin nueva migración ni recepción automática de eventos sociales.

## [0.2.17] · 2026-11-12 · Primera alerta animada de Trefot

- Primera plantilla animada con el personaje de Nexus, farol iluminado, destellos y entrada/salida sobre fondo transparente.
- Variantes visuales Twitch violeta/dorado, YouTube rojo/dorado y TikTok cian/rosa. TikTok dispone de fuente y cola locales independientes; no hay integración automática con sus eventos.
- Editor de tipografía, tamaños, colores, etiqueta, nombre de prueba y mensaje con {usuario}. Los nombres largos ajustan su tamaño.
- Vista previa animada y aislada en Nexus, sin sonido ni consumo de la cola de OBS.
- Preferencias anteriores conservadas y nuevos campos con valores por defecto; sin migración adicional. La recepción automática de eventos y la configuración de varias plantillas por evento siguen pendientes.

## [0.2.16] · 2026-11-12 · Fuentes de alertas separadas

- Dos overlays locales independientes, Twitch y YouTube, con color, título, volumen, duración y cola separados.
- Pruebas identificadas y anuncios manuales; la recepción automática de eventos sociales todavía no está implementada y se indica en la interfaz.
- Controles por plataforma en Live Studio y URLs para Stream Deck: prueba, pausa, silencio y repetición.
- Coordinación opcional de sonidos y exclusión de fuentes duplicadas de una misma plataforma.
- Preferencias incluidas en copias de seguridad mediante migración 020; las colas temporales se vacían al reiniciar para evitar reemitir alertas antiguas.

## [0.2.15] · 2026-11-11 · Platinos y objetivos en directo

- Portada oficial de Fortnite incluida como alternativa a la ilustración genérica; conserva las portadas personales.
- Colección de platinados con fecha y distinción entre trofeos obtenidos y registros manuales, sin contar dos veces el mismo juego.
- Overlay transparente para OBS/Twitch con total de platinos, juego y objetivo elegido; URLs para Conseguido, Deshacer y Siguiente en Stream Deck.
- Listas de Wukong conectadas al progreso de sus guías y objetivos personalizados, incluido el token de la tienda pirata de Fortnite.
- Detección visual experimental por referencia de un aviso en OBS, con región calibrable, modo de prueba, dos coincidencias y corrección manual. No reconoce todos los objetos sin calibración ni usa IA generativa.
- Migración 019 protegida y seguimiento incluido en las copias de seguridad.

## [0.2.14] · 2026-11-11 · Juegos para crear contenido

- Biblioteca con búsqueda, filtro por plataforma, ilustración de portada y sin barras ni recuentos de trofeos vacíos.
- Ficha de Fortnite y juegos sin trofeos con plan diario, objetivos manuales, notas de sesión y portada editable; mantiene rutas, guía y trofeos de PlayStation.
- Clips, momentos, ideas y proyectos reunidos por juego; convierte capturas en ideas sin duplicarlas y conserva el juego al aprobar una idea como proyecto.
- Portadas y notas generales editables, historial de los últimos planes y asociación explícita de proyectos existentes.
- Migración 018 protegida para las relaciones de ideas; copias compatibles con el esquema 17 y exportación sin metadatos SQLite obsoletos tras cambios de esquema.

## [0.2.13] · 2026-11-11 · Guardar clip

- Guardar clips del Replay Buffer de OBS desde Live Studio o Stream Deck, sin iniciar ni detener el búfer, la grabación o el directo.
- Solo registra el clip cuando OBS confirma un archivo nuevo; informa de búfer apagado, rechazo o espera agotada sin mostrar un guardado falso.
- Historial de clips con juego y ruta, y marca asociada si había una sesión de grabación o directo activa. También funciona con el Replay Buffer solo.
- Clips y marcas se guardan juntos y se incluyen en las copias; conserva la compatibilidad con copias anteriores mediante la migración 017.

## [0.2.12] · 2026-11-11 · OBS y momentos

- Conexión local con OBS WebSocket v5: estado de grabación, pausa y directo, reconexión automática y contraseña en las credenciales de Windows.
- Marcar momentos desde Live Studio o Stream Deck con tiempos consultados en OBS y el juego actual; no inicia ni detiene grabaciones o emisiones.
- Historial de los últimos 200 momentos y copia de la lista para editar contenido; guarda la ruta del archivo cuando OBS la confirma al finalizar la grabación.
- Sesiones y marcas incluidas en las copias de seguridad, con migración protegida y compatibilidad con copias de versiones anteriores.

## [0.2.11] - 2026-11-11

- Detección de Fortnite abierto en Windows sin depender de PSN; comprueba el proceso del juego cada 15 segundos.
- Añadir juegos de PC y otras plataformas a la biblioteca y elegir el juego actual manualmente; indica si la actividad procede de PC, PlayStation o selección manual.
- Icono de ventana explícito y accesos del escritorio/Inicio con nombre Nexus Studio e icono propio. Conserva instalación, identificador y datos existentes.
- El instalador actualiza los accesos antiguos que apuntan a esta instalación y solicita a Windows refrescar los iconos.

## [0.2.10] · 2026-11-11 · Nexus Studio

- Nueva identidad Nexus Studio, con el compañero violeta y su farol, e interfaz grafito con acentos violeta y dorado.
- Dashboard centrado en tu próximo directo, contenido en producción y accesos a Ideas y Live Studio.
- YouTube se sincroniza con la app abierta sin descartar lo que estés escribiendo ni duplicar consultas simultáneas.
- La app espera a una copia previa válida antes de aplicar migraciones y permite reintentar si falla.
- Conexiones y copias de pruebas separadas de producción; exportaciones consistentes e importaciones con validación más estricta.
- La búsqueda manual de actualizaciones informa de los fallos de conexión y evita instalaciones duplicadas por clics repetidos.
- Se conservan tus datos, conexiones y rutas de TrophyHunter; el nombre técnico del instalador se mantiene para actualizar la versión existente.

## [0.2.9] · 2026-11-10 · Botón para actualizar

- Nuevo botón «Buscar actualizaciones» abajo en el menú, como en Lumen.
- Si hay versión nueva, te enseña las novedades y con «Actualizar ahora» se instala y TrophyHunter se vuelve a abrir solo: ya no hace falta cerrarlo.
- Si no hay nada nuevo, te dice qué versión tienes.

## [0.2.8] · 2026-11-10 · Vista previa a medida

- La vista previa del editor se ajusta al tamaño del contador: al agrandar el icono ya no se corta.
- Si el contador es más grande que el editor, se ve entero en pequeño (en OBS sale a tamaño real).
- El texto del contador ya nunca salta debajo del icono.

## [0.2.7] · 2026-11-10 · Icono más grande y colores de texto

- Nuevo control «Tamaño del icono» para hacer tu PNG (o el emoji) más grande, hasta el triple.
- El título del contador se ve mucho más: más grande, con contorno grueso y sombra.
- Ahora puedes elegir el color del título y el del número (con colores rápidos o cualquier color).

## [0.2.6] · 2026-11-10 · Sonido más rápido

- El sonido de los contadores suena a la vez que la animación: queda cargado desde que se abre el overlay, en vez de prepararse al sumar.
- Si tu sonido propio empieza con silencio (muchos MP3 lo traen), ese silencio se salta solo.
- El audio arranca listo desde el principio en OBS.

## [0.2.5] · 2026-11-10 · Arreglos de la vista previa y el sonido

- Arreglada la vista previa del editor de contadores: «Probar animación y sonido» ya se ve y se oye.
- El sonido de los contadores ya no se queda bloqueado en silencio.
- El overlay de OBS se recarga solo cuando TrophyHunter se actualiza: ya no hace falta refrescarlo a mano.
- Instrucciones de OBS corregidas: cómo oír tú también el sonido cuando lo controla OBS.

## [0.2.4] · 2026-11-10 · Se actualiza como Lumen

- TrophyHunter ahora se actualiza desde GitHub, igual que Lumen: cada versión nueva llega sola al abrir la app.
- Antes de instalarse te enseña las novedades, y al volver a abrirse te muestra «¡Actualizado!» con la lista.
- Si la app está abierta (por ejemplo, en pleno directo), solo te avisa con «Actualizar ahora»: nunca se reinicia sola a mitad de un stream.
- Si GitHub no responde, sigue usando la carpeta Instaladores como plan B.

## [0.2.3] · 2026-11-10 · Contadores estilo gamer, con sonido y al instante

- Estilo «Gamer» para los contadores: icono grande y número gigante con contorno y degradado (como los overlays de Fortnite), además del estilo «Tarjeta».
- Al sumar: el número salta, destello del color del contador, chispas y sonido. Sonido por defecto tipo «cofre abierto» o tu propio MP3/WAV, con volumen.
- El overlay reacciona en el mismo instante en que pulsas el Stream Deck (antes podía tardar hasta 0,6 s).
- Vista previa real en el editor (el mismo overlay de OBS) con «Probar animación y sonido».
- Migración 014. Primera versión que se instala sola (D-021).

## [0.2.2] · 2026-11-08 · Actualización automática

- La app se actualiza sola: al abrirla, si hay una versión nueva en Documentos\TrophyHunter\Instaladores, muestra «Actualizando…», la instala en silencio y se vuelve a abrir (D-021).
- Con la app abierta, solo avisa con «Actualizar ahora»; nunca se reinicia a mitad de un stream.
- Esta es la última versión que hay que instalar a mano.

## [0.2.1] · 2026-11-08 · Contadores a tu gusto y copia antes de migrar

- Cada contador puede llevar tu propia imagen PNG (con transparencia, sin recortar) en lugar del emoji.
- Fondo del contador en OBS: color y opacidad de 0 % (transparente) a 100 % (sólido), con vista previa tal cual se verá.
- La app hace una copia completa de los datos en Documentos\TrophyHunter\Copias antes de aplicar cambios de base de datos al actualizarse (D-020).
- Migración 013.

## [0.2.0] · 2026-11-08 · Alpha 0.2: YouTube, Gaming y Live Studio

### 2026-11-08 · Live Studio fase 1: contadores
- Nueva sección «Live Studio»: contadores para el stream (muertes, jefes, cofres, victorias…) con icono, color, paso y juego.
- Overlay para OBS («Fuente de navegador») con fondo transparente y animación al sumar.
- URLs para el Stream Deck (acción «Sitio web» en segundo plano): sumar, restar y reiniciar, protegidas con una clave local.
- Servidor local solo en 127.0.0.1; migración 012.

### 2026-11-08 · App instalada y app de pruebas separadas
- La versión de pruebas usa su propia base de datos y otro puerto, y se ve marcada como «PRUEBAS»: nunca toca los datos reales.
- La app diaria es la instalada (v0.2.0).

### 2026-11-04 · Lista de calabazas, bebidas e infusiones de Wukong
- «Refrescante abundancia»: 11 calabazas, 9 bebidas y 27 infusiones con ubicación, compras al Mono Shen por capítulo, aleatorias, perdible y objetos de NG+.

### 2026-11-04 · Lista de curiosidades de Wukong
- «Una rara colección»: las 36 curiosidades por capítulo, con dónde están, cuáles son aleatorias (8) o perdibles (2) y la build de botín.

### 2026-11-04 · G5+ Listas por trofeo y plan de hoy
- Cada trofeo tiene su ficha (panel lateral): lo siguiente que toca, la lista de lo que hay que conseguir con casillas, fijo o aleatorio, perdibles, build de farmeo, consejos y fuentes.
- Los puntos se marcan solos cuando ya tienes el trofeo relacionado; en cualquier trofeo puedes añadir puntos propios.
- Listas investigadas para Black Myth: Wukong: final del capítulo 6, final secreto, 18 hechizos, 6 reliquias y 15 semillas.
- Pestaña "Hoy": el plan lo arma el jugador con «Plan de hoy» en cada trofeo pendiente; cada trofeo del plan muestra su progreso y su siguiente paso.
- "Ya lo perdí → NG+": un perdible ya perdido pasa a la fase NG+ y deja de avisar.
- Skin del juego: con el modo juego activo, los colores y el fondo de la app salen de la portada del juego.
- Corregida la barra de progreso de la biblioteca.
- Migraciones 009 (partidas del día), 010 (progreso de listas) y 011 (puntos propios); las copias de seguridad las incluyen.

### 2026-11-04 · G5 Modo juego
- La app detecta el juego que tienes abierto en la PS5 (presencia de PSN, cada minuto) y abre su ficha con la ruta al platino.
- Franja "Jugando ahora" con "Ver ruta" e interruptor "Modo juego automático".

### 2026-11-04 · G4 Guía del juego
- Pestaña "Guía" en cada juego: jefes, builds, atajos, farmeo y consejos, con captura, vídeo, fuente, fase y trofeos enlazados.
- "Qué hacer ahora" muestra la guía de la fase actual.
- 16 borradores para Black Myth: Wukong; migración 008.

### 2026-11-04 · G3 Ruta al platino por fases
- Vista "Ruta al platino" en cada juego: fases con progreso, fase actual y "Qué hacer ahora" con perdibles pendientes.
- Ruta sugerida para Black Myth: Wukong (9 fases, 7 perdibles, notas por trofeo) con su fuente.
- Fases editables y plan por trofeo (fase, perdible y nota), conservado al sincronizar con PSN.

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
