# Publicaciones y resultados

Nexus consulta las cuentas conectadas cada diez minutos mientras permanece abierto. Vistas, likes, cantidad de comentarios y compartidos se guardan cuando la API los entrega. No son lecturas al segundo. No se leen textos de comentarios ni se publica, elimina o pausa contenido por una recomendación.

- YouTube: descubre 50 subidas recientes y consulta también hasta 200 publicaciones ya seguidas por recorrido. No anuncia vídeos privados o todavía programados. Consulta también horas y compartidos de Analytics cuando están disponibles; pueden llegar con uno o dos días de retraso y no certifican monetización. El formato vídeo/Short se clasifica explícitamente: duración por sí sola no acredita que sea un Short.
- TikTok: requiere Display API y el permiso video.list añadido en el portal y autorizado por el usuario. Las conexiones anteriores de seguidores siguen funcionando sin ese permiso. Descubre los 20 vídeos públicos recientes y actualiza hasta 200 seguidos.
- Instagram: publicaciones profesionales vinculadas. Likes y cantidad de comentarios disponibles según permisos; vistas mediante insights/views con instagram_manage_insights. Hasta 50 recientes por consulta.
- Facebook: publicaciones de la página. Las vistas de contenido mostrado/reproducido usan insights/post_media_view con read_insights y pages_read_engagement; no equivalen necesariamente a reproducciones únicas. Hasta 50 recientes.
- Twitch: hasta 50 vídeos/repeticiones y 50 clips de los últimos siete días, con sus vistas. Los clips se comparan como formato separado. No se inventan likes ni comentarios.

Las consultas de vistas de Meta se limitan a diez por red y recorrido: se priorizan las cinco publicaciones más recientes y se rotan las demás. Cada métrica conserva la fecha de su última lectura válida; omitir una consulta no convierte el dato anterior en cero ni lo presenta como recién leído.

La primera consulta no importa todo el archivo histórico. Los límites de las APIs y sus permisos se muestran en el apartado. Cambiar serie, formato o proyecto solo modifica la organización local. Las referencias compartidas no cambian datos remotos.

Las comparaciones usan observaciones cercanas a 24, 72 o 168 horas desde la publicación, con tolerancia del 20 %. No sustituyen un registro ausente por el total actual de un vídeo antiguo. Se requieren cinco publicaciones de referencia del mismo perfil y formato; la orientación de una serie necesita tres publicaciones con comparación suficiente. La referencia es la mediana: no es una prueba de causalidad. No se suman vistas entre plataformas como si fueran métricas idénticas.

## Referencias oficiales consultadas el 16 de noviembre de 2026

- https://developers.google.com/youtube/v3/docs/playlistItems/list
- https://developers.google.com/youtube/v3/docs/videos/list
- https://developers.tiktok.com/doc/tiktok-api-v2-video-list/
- https://developers.tiktok.com/doc/tiktok-api-v2-video-query/
- https://developers.tiktok.com/doc/tiktok-api-scopes/
- https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/
- https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-media/insights/
- https://developers.facebook.com/docs/graph-api/reference/insights/
- https://dev.twitch.tv/docs/api/reference/#get-videos

Los permisos o la aprobación del proveedor no se conceden al instalar Nexus. La validación física de las cuentas del usuario sigue siendo una comprobación aparte de los ensayos con datos simulados.

- Referencia de clips: https://dev.twitch.tv/docs/api/reference/clips
