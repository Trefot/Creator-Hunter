# Métricas sociales en Nexus

Inicio muestra registros fechados, nunca datos de ejemplo. Las comparaciones usan el último registro anterior al límite elegido y muestran la fecha real de esa base. No se suman audiencias de plataformas distintas ni se presentan horas registradas como horas válidas de monetización.

## YouTube
Usa la conexión existente de Google. En Conexiones, selecciona tu perfil, importa tu cliente de OAuth y autoriza el canal. La sincronización conserva su funcionamiento anterior.

## Twitch
Autoriza Twitch y selecciona el perfil cuyo @usuario coincide con la cuenta autorizada. «Comprobar cuenta y traer seguidores» consulta el total oficial. No importa estadísticas históricas ni audiencia media. Desvincular métricas no desconecta chat y alertas.

## Instagram de creador y página de Facebook
Requiere una aplicación propia en Meta for Developers, acceso de tu usuario a la página y la cuenta profesional de Instagram vinculada. En Graph API Explorer solicita el token de usuario con pages_show_list, pages_read_engagement e instagram_basic. La disponibilidad depende de los permisos, modo y revisión exigidos por Meta.

Introduce ese token únicamente en el campo privado de Conexiones → Instagram + Facebook. Elige los perfiles existentes y, si administras varias páginas, selecciona la correcta. Nexus verifica acceso y guarda el token de página en el almacén de credenciales de Windows. El token no se incluye en copias de la base de datos. Comprueba la identidad de la página antes de confirmar: tus perfiles deben corresponder a las cuentas autorizadas.

Se consultan seguidores de ambas cuentas. No se importan alcance, ingresos, estadísticas privadas no autorizadas ni alertas automáticas de Instagram. Si una consulta falla no se reemplaza el historial por cero; el guardado de las dos redes es una transacción.

## TikTok
Requiere una aplicación de TikTok for Developers y un access token autorizado con user.info.basic y user.info.stats. En sandbox, añade tu cuenta de prueba. Para uso fuera de sandbox se necesita la aprobación correspondiente de TikTok. Pega el token únicamente en el campo privado; se valida la identidad y se consultan seguidores. No se conecta TikTok LIVE. El token no se renueva automáticamente: al caducar hay que volver a autorizar.

## Actualización y recuperación
Nexus consulta las cuentas configuradas cada tres horas mientras está abierto. Puedes pausar la actualización por proveedor y consultar manualmente. Cada perfil conserva un registro API por día, además de sus registros manuales. El centro distingue autorización guardada de última consulta correcta. Una restauración pausa estas nuevas actualizaciones: revisa los perfiles y reanuda desde Conexiones.

Nunca pegues tokens en un chat, captura pública, issue o repositorio. Una copia de Nexus no contiene estas autorizaciones y otro equipo debe configurarlas nuevamente.
