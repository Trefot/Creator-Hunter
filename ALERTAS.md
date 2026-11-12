# Alertas separadas para OBS · 0.2.16

Esta entrega prepara dos fuentes independientes y funcionales de alertas locales. **Todavía no recibe automáticamente seguidores, suscripciones, bits, raids, Super Chats ni miembros.** La conexión existente con YouTube para métricas no activa por sí sola las alertas. La interfaz muestra que los eventos de las redes están sin conectar. No incluye todavía bot ni webhook de Discord.

## Configurar OBS

1. Abre Live Studio → Alertas por plataforma.
2. Copia la URL de Twitch. Crea una Fuente de navegador en OBS de 640×300 y pégala.
3. Repite con YouTube en otra fuente. Puedes situarlas, escalarlas y enrutarlas por separado.
4. En cada fuente activa «Controlar audio mediante OBS» y revisa su mezclador/pista de emisión. El sonido real de tu OBS no se ha verificado desde el entorno de desarrollo. Si el navegador bloquea audio, abre Interactuar en OBS y pulsa Activar sonido.
5. Pulsa Probar twitch o Probar youtube. Aparecen como PRUEBA. Entre alertas, la fuente es transparente.

Las URLs llevan una clave local; no compartirlas. El servidor solo escucha en el propio equipo. Desarrollo usa 7879 y producción 7878. Nexus debe permanecer abierto. Configurar estas fuentes no necesita OBS WebSocket; los controles de grabación existentes siguen en su panel.

## Controles independientes

Cada plataforma conserva título, color, duración (3–15 s), volumen y activación del sonido. Twitch y YouTube tienen un aviso sonoro diferente. Guarda los cambios en la tarjeta correspondiente; la vista previa dentro de Nexus no reproduce la cola ni emite sonidos.

- Pausar deja terminar la alerta actual y conserva las siguientes en su cola.
- Silenciar corta el sonido al recibir el siguiente estado, sin ocultar la alerta. La lectura se realiza cada 500 ms.
- Repetir crea otra reproducción identificada de la última alerta emitida de esa plataforma; falla si todavía no se emitió ninguna.
- Vaciar pendientes elimina solo las alertas que esperan, no la que está en pantalla.
- Anuncio manual permite enviar título y mensaje propios; se identifica como ANUNCIO, sin fingir un evento recibido de la red. Los textos largos se limitan visualmente a dos líneas de título y tres de mensaje.

Cada cola admite 50 alertas pendientes. Las colas y la última alerta viven solo durante esa ejecución de Nexus: se vacían al reiniciar para no volver a emitir avisos antiguos. Las preferencias se guardan en SQLite y están incluidas en las copias de seguridad. Migración 020, protegida por el respaldo previo existente; las 27 tablas siguen incluidas. Se admite importar una copia del esquema 19.

Evitar sonidos simultáneos coordina los avisos de ambas fuentes: pueden aparecer visualmente a la vez, pero el segundo sonido espera a que termine el primero. Son avisos breves de unos 600 ms. Silenciar una plataforma no silencia la otra. Una segunda fuente del mismo tipo no consume la cola simultáneamente; la titularidad caduca a los tres segundos sin lecturas. Un traspaso de fuente no reinicia el tiempo de la alerta ni reproduce un sonido antiguo.

## Stream Deck

Abre Controles de twitch/youtube para Stream Deck y copia cada URL a una acción Sitio web en segundo plano. Prueba, Pausa, Silencio y Repetir son independientes por plataforma. Pausa y Silencio alternan el estado; consulta Live Studio para verlo. No se añade aún un plugin nativo de Stream Deck ni iconos de estado bidireccionales.

## Pendiente para eventos reales

- Twitch: autorización de cuenta, permisos mínimos para los eventos elegidos y recepción EventSub con reconexión y deduplicación.
- YouTube: identificar el directo y recibir eventos de chat/monetización permitidos por la API, respetando cuotas y disponibilidad. Las suscripciones privadas no son un evento garantizado.
- Probar cada integración en las cuentas reales antes de confiar en ella durante el directo.
- Discord se implementará por separado; esta entrega no publica mensajes externos.

## Validación

Cuatro pruebas del motor cubren aislamiento de colas, coordinación de audio, pausa/silencio/repetición, titularidad de fuentes y límites. La prueba de datos verifica migración/importación desde esquema 19 y restauración de preferencias. `tests/alerts-browser.py` comprueba controles, URLs, guardado, adaptación a 960 px, texto seguro y ocultación del HTML real del overlay con RPC simulados. No acredita reproducción física en OBS ni recepción de eventos de servicios externos.
