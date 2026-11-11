# OBS y «Marcar momento» · Nexus Studio 0.2.12

## Conectar una vez

1. En OBS 28 o posterior abre **Herramientas → Ajustes del servidor WebSocket**.
2. Activa el servidor y conserva la autenticación. Consulta el puerto (normalmente **4455**) y la contraseña.
3. En Nexus abre **Live Studio → Configurar OBS**, introduce esos datos y pulsa **Conectar**. No pegues la contraseña en chats.
4. Comprueba **OBS conectado**. Inicia una grabación de prueba en OBS: Nexus debe mostrar **Grabando** y su tiempo. No inicia ni detiene salidas por su cuenta.

La conexión se recuerda y se reintenta con Nexus abierto. Solo usa `127.0.0.1`; no necesita servicios de pago. La contraseña va a las credenciales de Windows. Las pruebas tienen configuración y credenciales separadas.

## Stream Deck

1. En Live Studio abre **Botón de Stream Deck → Copiar URL para marcar momento**.
2. En Stream Deck añade **Sistema → Sitio web**, pega la URL y activa la solicitud **en segundo plano**. Ponle «Marcar momento» y el icono que prefieras.
3. Con Nexus y OBS abiertos y una grabación activa, pulsa una vez. Comprueba la marca en **Últimos 200 momentos**.

La URL lleva la clave local del servidor de Nexus. No contiene la contraseña de OBS. La acción Sitio web no ofrece confirmación de guardado en el botón: verifica la primera pulsación en la app. Los puertos de pruebas y producción difieren; copia la URL desde la app que utilizarás.

## Qué se guarda

- Fecha, título opcional, juego actual y tiempo confirmado por OBS.
- Tiempos de grabación y directo por separado si ambos están activos. Si la grabación está pausada, solo se puede marcar el directo activo.
- La sesión de grabación tiene prioridad para asociar la marca. Sin ninguna salida activa no se guarda una marca.
- La ruta del archivo cuando OBS notifica el fin de la grabación con Nexus conectado. Si no llega, se indica «sin confirmar»; no se inventa un archivo.
- La lista puede copiarse para revisar y editar contenido. Se muestran los últimos 200 momentos, aunque los anteriores siguen en la base y en las copias.

El botón guarda un punto de referencia, no corta vídeo ni guarda Replay Buffer. Esas acciones son una siguiente entrega. El tiempo se consulta al procesar la pulsación; no se promete precisión de fotograma.

Si Nexus se conecta con una salida ya iniciada, el tiempo sigue siendo el de OBS y la fecha de sesión es el momento en que Nexus la detectó. Las pausas de conexión producen segmentos distintos: «conexión perdida» no significa que OBS haya dejado de grabar. Al restaurar datos se serializan las escrituras de OBS y se descartan los identificadores de sesión en memoria.

## Verificación

Autenticación y lectura con servidor WebSocket local simulado; errores de conexión y rechazo de operaciones de control. Pruebas SQLite sobre migración 016, conservación de copias del esquema 15 y roundtrip de sesiones/marcas. Interfaz con IPC simulado: configuración, guardado, copia de URL, fallo sin duplicados y pausa. La conexión al OBS del usuario requiere esa configuración inicial en su PC.

Fuentes oficiales: [guía de control remoto de OBS](https://obsproject.com/kb/remote-control-guide) y [protocolo OBS WebSocket](https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md) (`GetRecordStatus`, `GetStreamStatus`, `RecordStateChanged`).
