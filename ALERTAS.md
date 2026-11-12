# Alertas de Trefot para OBS · 0.2.17

Primera plantilla animada y editable con el personaje de Nexus: entrada y salida, movimiento suave del personaje, destellos y luz del farol. Tres variantes: Twitch violeta/dorado, YouTube rojo/dorado y TikTok cian/rosa, con un pequeño efecto glitch en la entrada. El personaje conserva su identidad en todas ellas. La animación utiliza el logo existente y CSS; no es una animación articulada del personaje ni un vídeo generado.

**Todavía no recibe automáticamente eventos de Twitch, YouTube o TikTok.** La conexión de YouTube para métricas no activa las alertas. La interfaz muestra que los eventos de las redes están sin conectar. No incluye bot ni webhook de Discord. Esta versión ofrece una plantilla por plataforma, pruebas identificadas y anuncios manuales; las variantes por cada tipo de evento serán un paso adicional.

## Configurar OBS

1. Abre Live Studio → Alertas por plataforma.
2. Personaliza la tarjeta de Twitch y pulsa Guardar twitch.
3. Copia su URL y crea una Fuente de navegador en OBS de **640×300**. Pégala y sitúala donde quieras.
4. Repite con YouTube y, si lo utilizas, TikTok. Cada fuente tiene URL, cola y sonido propios.
5. Activa «Controlar audio mediante OBS» en cada fuente y revisa mezclador y pistas. Si se bloquea el audio automático, abre Interactuar y pulsa Activar sonido. El sonido físico de tu OBS requiere comprobación en tu equipo.
6. Pulsa Probar en la plataforma correspondiente: la alerta lleva la marca PRUEBA. Entre alertas el fondo es transparente.

Si ya utilizabas las fuentes de 0.2.16, conserva sus URLs y tamaño. El nuevo diseño se sirve después de actualizar Nexus; si OBS conserva el documento anterior, refresca la fuente.

Las URLs llevan la clave local; no compartirlas. El servidor solo escucha en el propio equipo. Desarrollo usa 7879 y producción 7878. Nexus debe permanecer abierto. Estas fuentes no requieren OBS WebSocket; la conexión de grabación continúa en su panel existente.

## Editor y vista previa

La vista previa incrustada utiliza el mismo documento y estilos que OBS, aislados y sin sonido ni lecturas de la cola. Puedes repetirla sin enviar eventos a OBS. Los cambios del borrador se ven de inmediato; solo Guardar cambia la fuente real.

Por plataforma puedes editar:

- Título de la fuente, color principal y secundario.
- Color del nombre y del mensaje, tipografía moderna/clásica/monoespaciada.
- Tamaño del nombre (24–48 px) y del mensaje (12–22 px).
- Etiqueta de la alerta; vacía usa NUEVO SEGUIDOR o NUEVO SUSCRIPTOR en YouTube.
- Nombre de prueba y mensaje de hasta 160 caracteres. `{usuario}` inserta el nombre de prueba. No se admite HTML ni CSS personalizados.
- Duración (3–15 s), volumen y activación del sonido. Cada plataforma tiene un aviso breve distinto.

Los nombres largos reducen su tamaño hasta 20 px para caber y después muestran puntos suspensivos si es necesario. El mensaje se limita visualmente a dos líneas. Se respeta la preferencia del sistema de reducir movimiento. La primera plantilla usa la pose original del logo, con movimiento del conjunto y luz del farol; las poses articuladas, vídeos/audios importados y fuentes tipográficas propias no están implementados.

## Controles y Stream Deck

- Pausar deja terminar la alerta actual y conserva las siguientes.
- Silenciar corta el sonido al recibir el siguiente estado (lecturas cada 500 ms).
- Repetir reproduce de nuevo la última alerta emitida, identificada como repetición. Falla si todavía no se emitió ninguna.
- Vaciar pendientes elimina solo las que esperan.
- Anuncio manual envía título y mensaje propios, con la etiqueta ANUNCIO MANUAL.

En Controles para Stream Deck copia las URLs a acciones Sitio web en segundo plano. Prueba, Pausa, Silencio y Repetir son independientes; Pausa y Silencio alternan el estado. No hay plugin nativo ni botones con estado bidireccional.

Cada cola admite 50 pendientes. Las colas y la última alerta viven solo durante la ejecución de Nexus; se vacían al reiniciar para no reemitir avisos antiguos. Evitar sonidos simultáneos coordina los avisos de las tres fuentes sin unir sus colas. Una segunda fuente de la misma plataforma no reproduce la cola a la vez; la titularidad caduca tras tres segundos sin lecturas. Al transferirla no se reinicia el tiempo de la alerta ni su sonido.

## Preferencias y compatibilidad

Se conservan las preferencias de 0.2.16. Los campos de estilo y TikTok obtienen valores predeterminados cuando no existen. Las preferencias están en workspace.alert_settings, incluidas en las copias de las 27 tablas; no hace falta una nueva migración y se mantiene el esquema 20. Se probó la exportación/restauración de la tipografía y los colores nuevos.

## Validación y próximos pasos

- Siete pruebas del motor: aislamiento de colas, coordinación de audio, controles, fuentes duplicadas, límites, estilos válidos, compatibilidad con ajustes antiguos y texto editable de prueba.
- Prueba de interfaz con RPC simulados: tipografía/tamaños/texto, vista previa silenciosa sin consumo de cola, tres plataformas, URLs, texto seguro, recuperación y permiso de audio.
- `tests/alerts-demo.py` graba el HTML real con eventos ficticios; no acredita recepción de servicios externos.
- Pendientes: recepción oficial de eventos sociales, plantillas por cada evento, archivos propios y comprobación de sonido/fuentes en el OBS del usuario. Discord se implementará por separado.
