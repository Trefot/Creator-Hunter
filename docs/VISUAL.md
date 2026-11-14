# Nexus · Taller V2

La navegación principal reúne Inicio, Crear contenido, En directo y Juegos. Calendario sigue independiente; Mi estudio contiene Cuentas y perfiles, Metas e Ingresos. Copias de seguridad y actualización siguen en el pie. Ctrl+K busca secciones sin exigir acentos; Escape cierra la búsqueda. Las flechas, Inicio y Fin permiten recorrer las pestañas.

## Tus datos, sin ejemplos

Inicio muestra planificación y métricas existentes. Modo enfoque guarda una preferencia local y reduce únicamente el detalle secundario del inicio. No oculta avisos de cobros ni cambia datos. La ilustración es decorativa y no representa la señal de OBS.

Crear contenido mantiene Ideas, Proyectos y Momentos montados mientras alternas las pestañas: no se descartan formularios. El tablero considera todas las versiones sin publicar: ninguna versión o pasos sin configurar se consideran preparación, algún progreso se considera producción, y todas las versiones pendientes completas se consideran listas. Los proyectos enteramente publicados tienen su sección desplegable. El tablero no modifica la producción.

En directo separa Cabina, Chat, Sonido, Alertas, Overlays, Contadores, Categoría, OBS, Conexiones y Momentos. Los campos permanecen al cambiar sus pestañas. Cambiar de sección principal conserva el comportamiento anterior: guarda tus formularios antes de salir.

## Cabina y OBS

Conecta OBS desde su pestaña. La cabina consulta estado y nombres de escena cada cinco segundos mientras está visible. «Actualizar vista» pide una sola captura PNG de la escena de programa, sin audio. No hay reproducción continua, ni captura automática al entrar. Cambiar de escena requiere pulsar su botón; no inicia o detiene emisión, grabación ni Replay Buffer. Un cambio de escena descarta la imagen anterior. Cambios externos en OBS se reflejan en la siguiente consulta.

Detener TTS pausa también la cola. Marcar momento requiere grabación sin pausa o emisión activa; guardar replay requiere Replay Buffer activo. Son las mismas acciones nativas de los controles anteriores. Los controles del Stream Deck conservan sus URLs.

La biblioteca muestra el juego activo o marcado como jugando y su nota guardada. Para agregar juegos abre «Añadir juegos · detección e importación». Esta actualización no añade una nueva fuente de detección, ni importa logros de PC, ni modifica la detección de cofres.

## Validación

Pruebas de compilación y lógica del tablero; prueba de navegador con SQLite real y puente nativo simulado para navegación, búsqueda, borradores, captura explícita, escenas y anchos de 960/1280. Las cuentas, audio y señal reales no se validan con ese puente. La compilación y prueba del instalador Windows se realizan al publicar.
