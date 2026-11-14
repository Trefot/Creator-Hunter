# Nexus 0.2.26 · cinco herramientas en una actualización

Esta entrega amplía Live Studio, Proyectos y Juegos. No requiere IA ni un servidor externo propio. Las cuentas y el audio se autorizan y prueban en tu PC; las pruebas automatizadas no pueden confirmar qué escucha tu público.

## 1. TTS con puntos de Twitch

En **Live Studio → Conexiones → Conectar mi Twitch**, pulsa **Renovar permisos de mi Twitch conectado**, autoriza en el navegador y completa la comprobación del código. Se añade `channel:manage:redemptions`; no necesitas volver a buscar el Client ID de una conexión existente.

Después, en **TTS**:

1. Busca las voces instaladas y elige una. La predeterminada es la voz de Windows. No se contrata un servicio de voz ni se cobra por carácter.
2. Guarda voz, velocidad, volumen y expresiones bloqueadas. Prueba una frase; si pausaste la cola, reanúdala.
3. Crea **Nexus · Leer mi mensaje** con el coste que prefieras. Requiere que tu canal tenga puntos habilitados. La recompensa debe crearse con Nexus para que su aplicación pueda completar o cancelar sus canjes.
4. Activa los canjes y guarda. Asigna el audio de la voz al canal de Wave Link que quieras (puede aparecer como Windows PowerShell en el mezclador de Windows) y verifica su entrada en OBS con una grabación local.

Reglas iniciales: hasta 180 caracteres, sin enlaces, filtro propio por expresiones, un mensaje por usuario por minuto, diez en cola y un máximo de 60 s por voz. La recompensa añade también un intervalo global de 30 s. El texto se envía como JSON a un script fijo de Windows, nunca se ejecuta como código.

**Detener voz y pausar** corta la voz y mantiene la cola pausada. **Pausar cola** no interrumpe la frase actual. Sus enlaces privados pueden usarse con la acción Sitio web en segundo plano de Stream Deck.

Los canjes que se rechazan o no terminan intentan cancelarse y devolver puntos; una lectura completada intenta marcarse como cumplida. Si se pierde la conexión, se cambia de cuenta/aplicación o se cierra Nexus, comprueba los pendientes en Twitch. No se reejecutan automáticamente tras reiniciar. Crear la recompensa tiene efecto en tu canal solo cuando pulsas el botón. Desactiva o pausa la recompensa desde Twitch cuando no vayas a mantener Nexus abierto.

## 2. Momentos y clips → proyectos

La **Bandeja de momentos y clips** está en Live Studio y Proyectos. Puedes filtrar capturas y crear/abrir un proyecto directamente. Se conservan el juego, la ruta confirmada y las marcas de grabación/directo, con una plantilla para gancho, edición y formato.

Repetir la conversión abre el mismo proyecto. Si borras el proyecto puedes volver a crearlo. Una ruta todavía desconocida se indica como no confirmada; no se inventa un MP4 ni un archivo exportado. Las marcas del Replay Buffer corresponden a la sesión completa, no al segundo de inicio del recorte. Esta entrega organiza la edición; no recorta, subtitula ni renderiza automáticamente.

## 3. Gaming: retomar partida y platinos

Cada ficha incluye **Retomar partida**: una nota de hasta 4000 caracteres para zona, objeto buscado y próximo paso, con fecha de actualización. No depende del plan diario. Se incluye en las copias de Nexus.

La colección de platinados mantiene la separación entre registros manuales y confirmación por trofeos PSN, y añade candidatos ordenados por porcentaje de trofeos registrados. No estima horas ni dificultad y puede incluir trofeos de expansiones. Los juegos sin datos usan objetivos manuales. Los overlays y el seguimiento existentes se conservan.

La detección de un juego sigue actualizando el contexto mientras estás en Live Studio, pero ya no te saca del panel para abrir su ficha.

## 4. Diagnóstico y actividades de OBS

Conecta OBS y pulsa **Medir rendimiento y leer perfiles**. La primera muestra usa los contadores acumulados; repite jugando para comparar el intervalo. Nexus distingue pérdidas de renderizado, codificación y red y ofrece recomendaciones. Una muestra sin carga no predice el rendimiento de una partida.

Para Charla, Gameplay y Reacciones puedes guardar:

- Un perfil que ya exista en OBS.
- Una escena existente.
- Conservar vídeo, o aplicar salida 1080p60 / 720p30.

La aplicación y la restauración requieren detener directo, grabación y Replay Buffer. Antes de aplicar, Nexus guarda en sus datos `obs-copias/perfil-video-*.json` con el nombre del perfil, ajustes de vídeo y escena anteriores. **Restaurar último ajuste** recupera esos valores si el perfil y la escena siguen existiendo.

Esta copia no contiene las fuentes completas ni encoder, bitrate o destinos de emisión. No exporta ni reemplaza tus perfiles completos. Los cambios de vídeo se aplican al perfil seleccionado; si falla una operación puede haber cambios parciales y la app muestra la ubicación de la copia. Nexus no inicia ni detiene emisiones. Configura y prueba NVENC/bitrate desde OBS; esta entrega no los cambia automáticamente.

## 5. Música, tarjeta y peticiones

### Spotify personal

Necesitas Spotify Premium y una aplicación personal de Spotify for Developers, con tu cuenta permitida. Registra la URL de retorno que muestra Nexus, normalmente:

`http://127.0.0.1:7878/spotify/callback`

En desarrollo es el puerto 7879. Pega únicamente el **Client ID**, pulsa autorizar y termina en el navegador. Se usa PKCE con estado y caducidad; no se necesita Client Secret. Los tokens se guardan en las credenciales de Windows y no se exportan en copias. Abre Spotify y selecciona un dispositivo para usar reproducir/pausar/siguiente.

Nexus consulta periódicamente la reproducción y puede mostrar su tarjeta informativa **sin audio**. Una conexión expirada o un límite de API se muestra como error; los cambios de cola no se repiten automáticamente. Spotify Premium permite controlar tu escucha personal, no concede derechos para retransmitir el catálogo.

### Reproductor local para emisión

Importa MP3, WAV u OGG cuyo uso tengas autorizado, con título propio. Máximo 20 MB por archivo y aproximadamente 100 MB de biblioteca para limitar el tamaño de las copias. Los audios se guardan en Nexus y entran en sus respaldos.

Añade a OBS el enlace **Reproductor local**, como fuente de navegador de unos 650 × 180. Activa **Controlar audio mediante OBS** y revisa su monitorización. Debe permanecer una fuente disponible; se reserva un único reproductor para reducir audio duplicado. El panel indica si espera esa fuente. Los controles permiten volumen, pausa, reanudar, siguiente y detener; hay enlaces de siguiente/detener para Stream Deck.

La tarjeta separada de Spotify no reproduce su audio. No necesitas usar Spotify para la biblioteca local.

### Peticiones

Activa **Recibir peticiones !sr** y la conexión de chat correspondiente:

- `!sr Título exacto de una pista local`
- `!sr https://open.spotify.com/track/IDENTIFICADOR`

Nexus limita las peticiones a una por usuario por minuto, veinte pendientes y sin duplicados pendientes de la misma pista. Tú apruebas o rechazas. Una petición local aprobada entra en la cola local; una de Spotify entra en tu cola personal. No se descargan canciones de Spotify ni se transforma un enlace en un archivo.

Las respuestas sin confirmar de Spotify quedan identificadas para revisar la cola antes de retirarlas. No se reenvían automáticamente. Las peticiones y colas viven en memoria y se vacían al cerrar Nexus. Restaurar una copia detiene la música y pausa/vacía el TTS para no reproducir interacciones antiguas.

## Prueba en tu PC

1. Voz local: probar frase, detenerla y comprobar una grabación con el canal de Wave Link.
2. Twitch: renovar permisos, crear recompensa y probar un canje real; comprobar devolución si se rechaza.
3. Spotify: autorizar y probar en un dispositivo activo; comprobar tarjeta y petición moderada.
4. Música local: importar una pista autorizada, montar una fuente de OBS y comprobar volumen, pausa y siguiente.
5. OBS: medir con juego abierto; fuera de emisión aplicar una actividad y restaurarla.
6. Contenido/gaming: convertir un momento dos veces y comprobar un único proyecto; guardar y reabrir la nota de partida.

Referencias: [voz local de Windows](https://learn.microsoft.com/en-us/dotnet/api/system.speech.synthesis.speechsynthesizer), [recompensas y canjes de Twitch](https://dev.twitch.tv/docs/api/reference/channel-points), [PKCE de Spotify](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow), [política de Spotify](https://developer.spotify.com/policy), [protocolo oficial OBS WebSocket](https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md).
