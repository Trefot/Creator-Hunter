# Alertas por evento · 0.2.19

Una fuente de navegador y una cola por plataforma. Los eventos comparten esa fuente, pero conservan su propia ilustración, duración, volumen, melodía, texto y activación. Los marcos de referencia de Twitch, YouTube y TikTok mantienen su paleta; las poses incluyen saludo, celebración, regalo, aporte, portal y corazones.

**Esta entrega prepara y prueba las plantillas. La recepción automática desde Twitch, YouTube o TikTok sigue pendiente.** La conexión de YouTube para métricas no activa alertas. Algunos eventos dependen de permisos, privacidad o disponibilidad de la plataforma; que exista una plantilla no garantiza que la API permita recibirlos. Discord no está incluido todavía.

## Plantillas incluidas

| Twitch (6) | YouTube (5) | TikTok (5) |
| --- | --- | --- |
| Seguidor | Suscriptor | Seguidor |
| Suscripción | Miembro | Suscripción |
| Renovación | Membresías regaladas | Regalo |
| Suscripciones regaladas | Super Chat | Me gusta |
| Bits | Super Sticker | Compartir |
| Raid | | |

## Preparar cada evento

1. Abre Live Studio → Alertas por plataforma y elige Tipo de alerta en la tarjeta de la red.
2. Usa Cargar diseño de la muestra para recuperar el diseño predeterminado **de ese evento**. Los seguidores conservan el arte completo ya aprobado; los demás utilizan el mismo marco con nuevas poses.
3. Personaliza ilustración, etiqueta, tipografía, tamaños, colores del texto, duración (3–15 s), volumen y melodía. Son cinco melodías sintéticas breves; no se han añadido todavía archivos propios de vídeo, audio o tipografía.
4. Elige el nombre, cantidad y mensaje de prueba. La plantilla admite `{usuario}`, `{cantidad}` y `{mensaje}`. Los valores se insertan literalmente, sin HTML y sin volver a interpretar variables contenidas en un nombre o mensaje.
5. Guarda el evento antes de pulsar Probar. La vista previa muestra el borrador, sin sonido ni lecturas de la cola. Probar utiliza la configuración guardada y lleva la marca PRUEBA en OBS.

Los borradores sobreviven al cambiar de evento y no los sobrescribe el refresco de estado. Guardar afecta solo al evento seleccionado. Desactivar una alerta impide encolar nuevas pruebas de ese tipo; no desactiva las demás. Las alertas ya aceptadas conservan su configuración: para quitarlas usa Vaciar pendientes.

Cada tipo puede usar cualquiera de las seis ilustraciones y cinco melodías. El botón de muestra devuelve los ajustes propios del evento; no sustituye los de otros eventos. El título aparece como texto auxiliar cuando es distinto del nombre de la plataforma.

## OBS: los mismos tres enlaces

1. Copia la URL de cada plataforma a su Fuente de navegador de **640×300**.
2. Todos sus eventos aparecerán en esa fuente y posición. No hace falta crear otra fuente por evento ni cambiar el enlace existente.
3. Activa Controlar audio mediante OBS y revisa mezclador y pistas. Si el navegador bloquea audio, abre Interactuar y pulsa Activar sonido.
4. Las fuentes de 0.2.18 detectan la nueva versión y se recargan. Si procedes de una fuente anterior que conserva el documento viejo, refresca una vez su caché.

Las URLs llevan la clave local y no se deben compartir. El servidor escucha solo en el propio equipo. Desarrollo usa 7879 y producción 7878. Nexus debe permanecer abierto. Las fuentes no necesitan la conexión WebSocket de grabación.

Los nombres se ajustan de tamaño si no caben. Las etiquetas largas reducen su tipografía; los textos personalizados demasiado largos muestran puntos suspensivos. El mensaje ocupa una línea. Se respeta la preferencia del sistema de reducir movimiento. Los PNG son ilustraciones con distintas poses; la animación añade entrada/salida, luces y movimientos suaves, sin articulación del personaje.

## Colas, pausa y silencio

- Cada plataforma admite 50 alertas pendientes en orden de llegada.
- Cada alerta conserva el tipo, texto, diseño, sonido y duración con que se envió. Cambiar una plantilla no altera las que ya esperan ni la que se está mostrando.
- Pausar deja terminar la alerta actual y detiene las siguientes de toda esa plataforma.
- Silenciar corta el sonido de la plataforma al recibir el siguiente estado, aproximadamente cada 500 ms. No oculta la alerta ni silencia las otras redes.
- Repetir última recupera también el tipo y la configuración originales, aunque el editor tenga seleccionado otro evento.
- Vaciar pendientes elimina solo las que esperan. Los anuncios manuales siguen disponibles y se identifican como ANUNCIO MANUAL.
- Evitar sonidos simultáneos coordina las melodías de las tres plataformas sin unir sus colas.
- Una segunda fuente de la misma plataforma no consume la cola simultáneamente. La titularidad caduca a los tres segundos sin lecturas; transferirla no reinicia tiempo ni sonido.

Las colas y la última alerta son temporales y se vacían al reiniciar Nexus, para no reemitir avisos antiguos.

## Stream Deck

El enlace principal de OBS no cambia. En Controles para Stream Deck puedes copiar una URL de prueba del evento seleccionado, por ejemplo `/api/alerts/twitch/test?key=…&event=raid`. Úsala en Sitio web en segundo plano.

Pausa, Silencio y Repetir controlan toda la plataforma y mantienen sus URLs anteriores. Una URL de prueba antigua sin `event` usa el evento inicial de esa red. Pausa y Silencio son interruptores; no hay plugin nativo ni botones con estado bidireccional. Una prueba de un evento desactivado o de una red incorrecta se rechaza sin encolar nada.

## Persistencia, recursos y comprobaciones

Las preferencias de 0.2.18 se conservan como configuración inicial de seguidores/suscriptores. Los nuevos ajustes se guardan en `event_templates` dentro de workspace.alert_settings. Están incluidos en las copias de las 27 tablas; no hay nueva migración y se mantiene el esquema 20.

Las ilustraciones se guardan una sola vez en el registro nativo compartido por OBS y la vista previa. El frontend las carga por IPC y las reutiliza, sin otra copia de los PNG en su bundle ni reenvíos continuos al editar. Inter incluye su licencia SIL OFL. La referencia original continúa en design/alertas-referencia-aprobada.png.

Las pruebas verifican las 16 configuraciones predeterminadas, aislamiento por evento, colas con configuraciones inmutables, repetición, desactivación, datos literales, restauración de preferencias y recursos gráficos. Chromium comprueba borradores, tipografía, variables, controles y recarga por versión. `tests/alerts-demo.py` muestra el renderer real recorriendo las 16 plantillas con eventos ficticios y duraciones abreviadas. Las pruebas de navegador necesitan Vite en :1420, Python/Playwright y Rust; `NEXUS_CARGO` permite indicar la ruta de Cargo. La grabación necesita FFmpeg disponible para Playwright.

La recepción real y el sonido físico de las fuentes en el OBS del usuario requieren una prueba posterior en su equipo.
