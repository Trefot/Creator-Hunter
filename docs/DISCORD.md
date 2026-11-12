# Discord desde Nexus

Live Studio incorpora un panel con dos destinos: directos y publicaciones. No instala un bot de Discord ni cambia canales o roles. Los webhooks se crean en Discord y se introducen en la app instalada; nunca deben enviarse por chat.

## Primera configuración

1. En `directos` y `videos`: Editar canal → Integraciones → Webhooks, crear uno para Nexus y copiar cada URL.
2. En Live Studio → Discord → Conectar canales, guardar los dos enlaces. Los campos vacíos conservan los enlaces existentes. Las URLs se almacenan en las credenciales del sistema, con nombres separados en desarrollo y producción; no se incluyen en SQLite ni en las copias de seguridad.
3. Enviar una prueba a cada destino. Esto sí publica un mensaje claramente identificado como prueba.
4. Elegir avisos y activar la automatización. Twitch y YouTube deben estar conectados en Nexus. No hace falta activar sus alertas para recibir estos anuncios.

## Cobertura

| Plataforma | Directos | Publicaciones |
|---|---|---|
| Twitch | Consulta de streams de la cuenta autorizada | Clips de las últimas 24 h (hasta 100 por consulta); destacados y subidas entre los últimos 20 vídeos. No anuncia archivos de emisiones completas. |
| YouTube | Emisiones activas de la cuenta conectada | Vídeos públicos entre las últimas 20 subidas, incluidos Shorts. Un replay público puede aparecer como vídeo cuando termine su emisión. |
| TikTok | No conectado | Envío por enlace desde el formulario. |
| Instagram | No conectado | Envío por enlace desde el formulario. |

Las consultas ocurren cada 120 segundos con Nexus abierto; las plataformas pueden actualizar sus datos más tarde. No es un servicio activo con Nexus cerrado. La primera observación de publicaciones guarda una referencia sin inundar Discord con el historial. Un directo ya iniciado sí puede anunciarse. La ventana de consulta no garantiza recuperar publicaciones antiguas tras periodos largos sin ejecutar la app.

La automatización de TikTok e Instagram requiere otra integración oficial y no forma parte de esta versión. No se utilizan contraseñas, cookies del navegador ni scraping.

## Entrega y duplicados

Cada publicación utiliza una identidad persistente; las URLs de seguimiento se limpian y las formas corta y larga de YouTube se normalizan. Las pruebas son independientes de los avisos reales. Todas las solicitudes incluyen `allowed_mentions: {parse: []}`; no hay menciones a roles ni a usuarios.

Se registra una reserva antes del envío. Una entrega confirmada no se repite tras reiniciar Nexus. Si se pierde la respuesta o la app se cierra en ese instante, se conserva como no confirmada y no se reintenta a ciegas. Esto prioriza evitar duplicados, pero puede omitir un aviso: hay que comprobar el canal. La resolución de esas reservas desde la interfaz queda pendiente; no ofrece una garantía de entrega exactamente una vez. Los rechazos 400/401/403/404 permiten reintentar tras corregir la configuración. El límite 429 respeta `retry_after` antes de nuevos envíos; no se reintenta antes de la siguiente consulta periódica.

No se siguen redirecciones del webhook y solo se admiten URLs HTTPS exactas de `discord.com/api/webhooks/<id>/<token>`. Los errores no imprimen el enlace secreto ni la respuesta completa de Discord.

## Verificación

- Compilación TypeScript/Vite y pruebas existentes.
- `cargo test --locked --manifest-path tests/alerts/Cargo.toml`: valida destinos, URL de publicaciones, normalización y mensajes sin menciones.
- `python tests/discord-browser.py` con Vite en :1420 y RPC simulados: configuración, limpieza de campos secretos, ausencia de envío implícito, prueba explícita, publicación, duplicados y desconexión.
- La compilación nativa completa requiere las dependencias de Tauri en Linux o las comprobaciones Windows de CI. La comprobación local sin GTK usa un adaptador de Tauri para verificar tipos del módulo; no sustituye la integración nativa ni las pruebas reales.
- No se han utilizado webhooks reales durante el desarrollo.

Referencias de APIs: https://discord.com/developers/docs/resources/webhook#execute-webhook · https://dev.twitch.tv/docs/api/reference/#get-streams · https://dev.twitch.tv/docs/api/reference/#get-videos · https://dev.twitch.tv/docs/api/reference/#get-clips · https://developers.google.com/youtube/v3/live/docs/liveBroadcasts/list · https://developers.google.com/youtube/v3/docs/playlistItems/list
