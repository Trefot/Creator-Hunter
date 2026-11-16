# Métricas sociales en Nexus

Inicio muestra registros fechados, nunca datos de ejemplo. Las comparaciones usan el último registro anterior al límite elegido y muestran la fecha real de esa base. No se suman audiencias de plataformas distintas ni se presentan horas registradas como horas válidas de monetización.

## YouTube
Usa la conexión existente de Google. En Conexiones, selecciona tu perfil, importa tu cliente de OAuth y autoriza el canal. La sincronización conserva su funcionamiento anterior.

## Twitch
Autoriza Twitch y selecciona el perfil cuyo @usuario coincide con la cuenta autorizada. «Comprobar cuenta y traer seguidores» consulta el total oficial. No importa estadísticas históricas ni audiencia media. Desvincular métricas no desconecta chat y alertas.

## Instagram de creador y página de Facebook
Requiere una aplicación propia en Meta for Developers, acceso de tu usuario a la página y la cuenta profesional de Instagram vinculada. En Graph API Explorer solicita el token de usuario con pages_show_list, pages_read_engagement e instagram_basic. La disponibilidad depende de los permisos, modo y revisión exigidos por Meta.

Introduce ese token únicamente en el campo privado de Conexiones → Instagram + Facebook. Elige los perfiles existentes y, si administras varias páginas, selecciona la correcta. Nexus verifica acceso y guarda el token de página en el almacén de credenciales de Windows. El token no se incluye en copias de la base de datos. Comprueba la identidad de la página antes de confirmar: tus perfiles deben corresponder a las cuentas autorizadas.

### Si la lista de páginas está vacía

Una autorización puede incluir explícitamente tu página e Instagram y permitir consultar sus cifras por ID aunque `me/accounts` devuelva `data: []`. En ese caso introduce el ID numérico de tu página de Facebook en el campo opcional de Conexiones. No es el ID de tu usuario, de Instagram ni de la aplicación de Meta. Nexus consulta directamente la página, verifica su identidad y seguidores, obtiene el Instagram vinculado y comprueba también su identidad y seguidores antes de guardar nada. Si falla una lectura conserva la conexión anterior. Este recorrido usa el token de usuario autorizado; su duración depende de Meta y no incluye renovación automática. Si caduca, genera un nuevo token e introdúcelo de nuevo.

Se consultan seguidores de ambas cuentas. No se importan alcance, ingresos, estadísticas privadas no autorizadas ni alertas automáticas de Instagram. Si una consulta falla no se reemplaza el historial por cero; el guardado de las dos redes es una transacción.

## TikTok

En TikTok for Developers crea una aplicación Individual, de tipo Other, y un Sandbox. Añade tu propia cuenta en Target users, el producto Login Kit y los permisos user.info.basic y user.info.stats. En App details activa Desktop y completa los datos de la aplicación. Los enlaces de términos y privacidad están en el README.

En Login Kit → Desktop registra exactamente `http://127.0.0.1:7878/tiktok/callback` para la app instalada. Desarrollo utiliza el puerto 7879 y requiere registrar también esa dirección si vas a probar desde el código. La Web/Desktop URL de App details es la página informativa del proyecto, no esta dirección de retorno.

En Nexus → Conexiones → TikTok elige tu perfil e introduce el Client key y Client secret **del mismo Sandbox** en sus campos privados. Pulsa Autorizar TikTok, inicia sesión en el navegador y concede los dos permisos. Nexus comprobará la cuenta y consultará sus seguidores al regresar. Nunca publiques las credenciales ni el código de retorno.

El flujo de escritorio usa un estado aleatorio de sesión y PKCE con SHA-256 hexadecimal según la documentación de TikTok. Guarda las credenciales y los tokens en el almacén de Windows; cuando se consulta la API renueva el acceso si hace falta y conserva el refresh token nuevo que devuelva el proveedor. No puede renovar una autorización revocada ni un refresh token caducado: en esos casos vuelve a autorizar.

La alternativa de token manual continúa disponible en opciones avanzadas, sin renovación automática al no tener un refresh token. Desvincular métricas cancela la espera y elimina la credencial local; también puedes retirar la autorización en TikTok. Sandbox es para cuentas de prueba: no representa aprobación de producción. No se conecta TikTok LIVE ni se publican vídeos.

Referencias oficiales: [Desktop Login Kit](https://developers.tiktok.com/docs/en/login-kit-desktop), [intercambio de código](https://developers.tiktok.com/docs/en/oauth-get-a-user-access-token), [rotación de tokens](https://developers.tiktok.com/docs/en/oauth-refresh-a-user-access-token).

## Actualización y recuperación
Nexus consulta las cuentas configuradas cada tres horas mientras está abierto. Puedes pausar la actualización por proveedor y consultar manualmente. Cada perfil conserva un registro API por día, además de sus registros manuales. El centro distingue autorización guardada de última consulta correcta. Una restauración pausa estas nuevas actualizaciones: revisa los perfiles y reanuda desde Conexiones.

Nunca pegues tokens en un chat, captura pública, issue o repositorio. Una copia de Nexus no contiene estas autorizaciones y otro equipo debe configurarlas nuevamente.
