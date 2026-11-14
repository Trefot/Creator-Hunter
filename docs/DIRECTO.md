# Chat y categoría automática · Nexus Studio

## Configurar

1. Instala la actualización y abre **Live Studio**.
2. En **Conexiones para eventos reales → Conectar mi Twitch**, vuelve a autorizar la cuenta emisora con el Client ID de tu aplicación pública. Los permisos nuevos son `user:read:chat` y `channel:manage:broadcast`; se mantienen los permisos de alertas. No se necesita Client Secret.
3. Activa la conexión de Twitch. Para YouTube, usa la cuenta de Perfiles y activa su conexión en Alertas.
4. En **Chat y categoría del directo**, activa **Recibir mensajes en Nexus**. El filtro permite leer ambas plataformas o una sola.

## Chat

- Solo recibe mensajes: esta entrega no publica respuestas ni ejecuta comandos del chat.
- Los mensajes se conservan en memoria (máximo 200), no en la base de datos ni en las copias de seguridad. Cerrar Nexus vacía el historial.
- Las bajas de mensajes, limpiezas y expulsiones recibidas se reflejan en el panel y el overlay. La recepción depende de permisos y de la conexión a cada plataforma.
- YouTube aprovecha el lector existente, respeta `pollingIntervalMillis` (mínimo 10 s) y omite la primera página histórica. Descubre directos cada minuto. No es recepción instantánea garantizada.
- Twitch usa EventSub WebSocket; las conexiones antiguas necesitan reautorización. Una conexión parcial enumera los eventos que Twitch no permitió.
- **Limpiar vista** afecta únicamente a Nexus y su overlay, no borra el chat de la plataforma.

## Overlay de OBS

En el apartado de overlays puedes ver mensajes ficticios antes de copiar los enlaces reales. Cada plataforma tiene su propia URL:

`http://127.0.0.1:7878/chat/twitch?key=CLAVE_LOCAL`

`http://127.0.0.1:7878/chat/youtube?key=CLAVE_LOCAL`

En desarrollo se usa el puerto 7879. La clave se obtiene desde Nexus; no publiques estos enlaces. El servidor solo escucha en este equipo y protege la lectura de mensajes con la clave local. No contiene tokens de Twitch/YouTube.

Añade una fuente de navegador de **600 × 900**, fondo transparente. Muestra hasta 8 mensajes y los retira a los 25 s de su recepción. Se representa el texto como texto, nunca como HTML. Por ahora los emotes especiales se muestran mediante su texto.

El panel privado de Nexus reúne ambas plataformas; los overlays están separados. Revisa las [directrices de emisión simultánea de Twitch](https://help.twitch.tv/s/article/simulcasting-guidelines?language=en_US) al decidir qué mostrar en cada destino.

## Categorías de Twitch

1. Elige un juego de tu biblioteca en **Categoría automática en Twitch**.
2. Busca su categoría oficial, pulsa el resultado y comprueba la asociación. PC y PS5 pueden tener asociaciones independientes.
3. Activa **Actualizar según el juego detectado**.

Nexus exige al menos 30 s de contexto estable y datos recientes (<45 s). Comprueba el canal como máximo una vez por minuto y solo cambia categorías si Twitch confirma un directo activo. Si la categoría ya coincide, no escribe nada. Antes de escribir vuelve a comprobar que no pausaste ni cambiaste de contexto durante la consulta.

Si hay varios juegos de PC reconocidos abiertos, la automatización espera. Puedes resolverlo seleccionando un juego manualmente en **Juegos**, o cerrar el otro juego. Si falla la detección también espera. La detección de PC reconoce procesos abiertos, no garantiza que la ventana esté en primer plano; un juego en segundo plano puede seguir detectado. En PS5 depende de la actividad accesible por PSN.

Desactiva la categoría automática cuando quieras controlar la categoría desde Twitch (por ejemplo, para charla o reacciones). No modifica título, etiquetas ni escenas. La actualización no se activa por defecto.

## Comprobación con cuentas reales

Con Nexus abierto y las cuentas autorizadas:

- Envía un mensaje desde otra cuenta a cada plataforma y verifica el filtro y su overlay correspondiente.
- Elimina un mensaje como moderador y comprueba su retirada tras el siguiente evento/consulta.
- Durante una emisión de prueba, asocia y selecciona un juego; espera la estabilidad y hasta la siguiente comprobación. Verifica la categoría en el panel de Twitch.
- Pausa la automatización antes de cambiar la categoría manualmente.

Las pruebas automatizadas usan eventos y cuentas simulados. No sustituyen esta comprobación en el canal real.

## Herramientas de estudio

Desde 0.2.26 consulta [ESTUDIO.md](ESTUDIO.md) para TTS por puntos, música, proyectos de captura, retomar partida y diagnóstico/perfiles de OBS.
