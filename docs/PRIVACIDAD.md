# Nexus Studio — Política de privacidad

Actualizado: 17 de noviembre de 2026.

## Proyecto y alcance

Nexus Studio es una aplicación de escritorio de uso personal de Trefot. Su proyecto se publica en [Trefot/Creator-Hunter](https://github.com/Trefot/Creator-Hunter). Esta página describe el funcionamiento de la versión actual, incluida su integración de estadísticas de TikTok para la cuenta autorizada de prueba.

## Qué datos utiliza

Nexus conserva en el equipo los perfiles, registros de métricas y demás información que el usuario introduce o importa. Las funciones de creación de contenido también pueden utilizar archivos locales, como grabaciones, recortes y subtítulos.

Para TikTok se solicitan `user.info.basic` y `user.info.stats`. La API puede devolver el identificador de la cuenta, nombre público, seguidores, seguidos, número de vídeos y conteos de «me gusta», según los campos solicitados y permisos concedidos. La implementación actual valida la cuenta, guarda su identificador y nombre como configuración de conexión y conserva registros fechados de seguidores. No utiliza esos permisos para consultar mensajes privados, contactos ni para publicar contenido.

El seguimiento opcional de publicaciones añade `video.list` a la autorización de TikTok. Conserva metadatos de vídeos públicos de la cuenta, como identificador, título, enlace, miniatura y fecha, y mediciones fechadas de vistas, «me gusta», cantidad de comentarios y compartidos cuando la API las facilita. Las otras redes conectadas pueden aportar metadatos y contadores equivalentes según sus permisos. No se recopilan los textos ni los autores de comentarios mediante este seguimiento. Las series, proyectos y comparaciones se organizan localmente y no detienen ni publican contenido automáticamente.

Las otras conexiones opcionales pueden consultar la información autorizada de YouTube, Twitch, Meta, Spotify o PlayStation, o enviar avisos a Discord cuando el usuario configura esa función. Cada integración tiene sus propios controles; autorizar TikTok no activa por sí solo las demás.

## Almacenamiento y comunicaciones

Los perfiles, configuraciones sin credenciales y registros históricos se guardan en la base de datos local de Nexus. El Client key, Client secret y los tokens de acceso y renovación de la integración de TikTok se guardan en el almacén de credenciales del sistema operativo; no se incluyen en las copias de la base de datos ni en el código publicado. Durante el inicio de sesión se mantiene una solicitud temporal en memoria; los permisos se conceden en el navegador de TikTok y Nexus intercambia el código de retorno desde el equipo. La renovación utiliza el token más reciente entregado por TikTok.

Las consultas a las API se realizan por HTTPS desde el equipo hacia el proveedor correspondiente. Nexus no dispone de un servidor central del desarrollador que recopile estas métricas. El proveedor recibe la solicitud y puede tratar datos de conexión conforme a sus propias políticas. La comprobación y descarga de actualizaciones contacta con GitHub. Las miniaturas y algunas fuentes decorativas pueden descargarse desde los servidores del proveedor o Google Fonts.

No se vende la información de TikTok ni se utiliza para publicidad o seguimiento entre servicios. La integración de métricas no sube automáticamente las grabaciones locales ni publica el historial en redes sociales. Compartir archivos o configurar avisos en otras integraciones es una operación distinta controlada por el usuario.

## Conservación, desconexión y eliminación

Los registros históricos se conservan localmente hasta que el usuario los elimina mediante los controles de perfiles y registros de la aplicación. Desvincular las métricas de TikTok desactiva su actualización y solicita eliminar la credencial guardada; no elimina automáticamente los registros históricos ya creados. El acceso también puede revocarse desde TikTok.

Las copias de seguridad y exportaciones que haya creado el usuario pueden conservar los registros anteriores. Las copias automáticas, configurables en Nexus, mantienen hasta siete versiones diarias; las manuales no se eliminan por esa rotación. El usuario debe borrar por separado las copias que ya no desee mantener. Proteger el acceso al equipo y a esos archivos evita que otras personas lean los datos locales.

## Información y contacto

Las [condiciones de uso](TERMINOS.md), el código y la documentación están disponibles en el repositorio. Para consultas generales contacta con Trefot mediante las [incidencias del proyecto](https://github.com/Trefot/Creator-Hunter/issues). Ese canal es público: no envíes credenciales, documentos ni información privada. Las desconexiones y eliminaciones de esta aplicación personal se realizan desde el propio equipo y los controles del proveedor.
