# Capturar momentos y preparar Shorts

Primera entrega: frase de voz y botón. No detecta todavía victorias de Fortnite, trofeos de Wukong ni reacciones visuales. No usa una API de IA de pago, no publica contenido y no genera Shorts sin una acción tuya.

## Preparar OBS una vez

1. Conecta OBS a Nexus desde En directo → OBS.
2. En OBS → Ajustes → Salida → Búfer de repetición, habilita el Replay Buffer y configura 60 segundos (para la ventana inicial de 30 s antes + 15 s después). Vuelve a OBS y pulsa Iniciar búfer de repetición.
3. Deja que acumule vídeo antes de la primera prueba. Si el buffer acaba de empezar, no puede recuperar lo que ocurrió antes de activarlo.

Nexus comprueba que el buffer esté activo, pero no puede confirmar por sí solo su ajuste de duración: el campo de segundos es una declaración tuya, no una lectura de OBS. Se exige un margen de cinco segundos sobre antes + después. Los vídeos originales permanecen en la carpeta de Replay Buffer elegida en OBS.

## Activar en cada sesión

1. Abre En directo → Momentos o busca «clips» con Ctrl+K. También está en Crear contenido → Momentos y clips.
2. En Ajustes de la captura, confirma los segundos que configuraste en OBS y guarda. Puedes cambiar la frase y la ventana: de 5 a 120 s antes, de 0 a 30 s después.
3. Pulsa Activar captura para esta sesión. Esto habilita los botones, sin abrir el micrófono.
4. Opcionalmente consulta los idiomas de reconocimiento instalados, elige uno compatible y pulsa Escuchar mi frase. La frase inicial es «Nexus guarda esto».

La voz requiere Windows y un reconocedor **System.Speech** instalado para el idioma seleccionado; disponer de una voz TTS no garantiza disponer del reconocedor. Utiliza el micrófono predeterminado de Windows, por ejemplo Wave XLR. Si no arranca, desactiva todo, revisa el micrófono y los idiomas instalados y guarda un idioma compatible. Puede ser necesario configurar el reconocimiento de voz local de Windows. El botón funciona aunque la voz no esté disponible.

La escucha no envía audio a Internet ni crea grabaciones aparte del micrófono. Los clips de OBS sí conservan el audio que OBS tenga configurado. Usa audífonos: voces del juego, altavoces o TTS podrían provocar un reconocimiento equivocado. Solo se acepta la frase completa y una confianza mínima (80 % inicial); no se transcribe el resto de tu conversación.

## Capturar y revisar

- La frase o Capturar un momento ahora solicita un candidato. Nexus espera los segundos posteriores y pide a OBS guardar el Replay Buffer. Solo se admite una solicitud pendiente.
- Cancelar espera impide el guardado mientras todavía está esperando. Si OBS ya está guardando, no se cancela ni elimina el resultado. Desactivar todo cancela esperas y detiene el micrófono; un guardado ya enviado a OBS termina y se registra.
- El indicador superior muestra si el micrófono está activo, si solo están habilitados los botones y si hay una captura pendiente. Incluye mensajes de rechazo y errores de captura.
- Ver clip original abre el reproductor predeterminado de Windows. Conservar candidato habilita Crear Short. Descartar de la lista solo cambia su clasificación; no borra el archivo. Puedes volver a revisarlo.
- El original guarda lo que contenga el buffer de OBS, que puede ser más largo que la ventana. Al crear el Short, ffprobe mide el archivo y Nexus recorta la ventana alrededor de la solicitud. Avisa si faltan segundos y rechaza el recorte si la marca quedó fuera del buffer, por ejemplo tras un reinicio. La sincronización es aproximada al guardado de OBS, no una garantía de precisión de fotograma.

Para exportar necesitas ffmpeg y ffprobe del paquete completo de ffmpeg. Puedes instalarlo desde el apartado de Shorts. Elige vertical con fondo, recorte central o formato horizontal, y ajusta los segundos. El resultado se guarda en Vídeos → Nexus Shorts. Codificar usa CPU: es mejor hacerlo fuera de una partida exigente o del directo. No incluye subtítulos, seguimiento de cámara ni publicación automática.

## Stream Deck

El botón Momento anterior (`/api/moments/mark`) conserva su comportamiento: requiere grabación o directo para crear la marca. Si activaste la captura de esta sesión, también solicita un candidato. Si la solicitud se rechaza por un límite, la marca se conserva.

Para capturar con **solo Replay Buffer**, copia «Stream Deck · capturar momento» y pégalo en Sitio web en segundo plano. Usa `/api/moments/capture?key=…` en el servidor local habitual. La respuesta 202 confirma la solicitud, no que el archivo ya exista; revisa Momentos para la confirmación. La URL requiere la clave privada y la captura activada en Nexus. No activa el micrófono ni el Replay Buffer.

## Límites y almacenamiento

- Una solicitud pendiente y 90 segundos entre solicitudes aceptadas, incluso si la anterior falla o se cancela.
- Seis solicitudes aceptadas por hora (también cuentan las canceladas o fallidas) y veinte pendientes de revisión.
- Al alcanzar 2 GB de archivos registrados se bloquean nuevas capturas. El último archivo puede superar ese umbral; no es una reserva de espacio ni limita el resto de archivos de OBS.
- Descartar no libera espacio. Gestiona los originales desde su carpeta; el cómputo incluye también descartados cuyo archivo siga existiendo.
- Historial máximo de 500 fichas. Después de eliminar tú los originales, «Limpiar fichas descartadas sin archivo» permite liberar esas fichas con confirmación. No borra vídeos ni los registros originales de OBS; comprueba primero que tus discos estén conectados.
- Si no se puede medir un archivo por un problema de acceso, se pide revisar la carpeta en vez de dar por libre ese espacio.
- No hay reintentos automáticos cuando OBS no confirma el archivo. Si falla el registro del candidato después de guardarse, el clip original sigue disponible en la bandeja ordinaria y se indica su ruta.
- Cerrar Nexus desactiva captura y micrófono; no se restauran esperas ni se reactivan al abrirlo. Los ajustes y fichas se conservan en la base de datos; sus copias no incluyen los vídeos originales.

## Validación

`npm run build`, `npm test` y `cargo test --locked --manifest-path tests/auto-moments/Cargo.toml`.

El banco de Rust compila la lógica real sustituyendo solo Tauri, OBS y el sistema de archivos de prueba. Comprueba activación, cancelación, límites, revisión, errores sin reintentos y guardados que ya están en curso. En Linux con ffmpeg también exporta un vídeo sintético vertical y verifica resolución, duración y audio. En Windows valida la sintaxis del script de reconocimiento, sin abrir un micrófono.

`tests/moments-browser.py` recorre la interfaz con SQLite desechable y servicios simulados (Vite en 1432, Playwright y Chromium). La compilación completa de Tauri y el instalador se verifican en Windows. La escucha real, el idioma instalado, el dispositivo de audio y la captura de tu OBS necesitan una prueba en tu PC.
