# Actualizaciones de Nexus

Desde 0.2.24 el actualizador consulta el manifiesto público por HTTPS y descarga el instalador publicado para esa versión. No requiere Git ni modifica la antigua caché `actualizaciones/.git`. Un bloqueo `shallow.lock`, una consulta simultánea o un fetch interrumpido de versiones antiguas no bloquean este flujo.

Si la versión instalada ya tiene ese error, cierra Nexus e instala una vez el ejecutable oficial desde GitHub. No necesitas borrar los datos ni los bloqueos de otras aplicaciones. La comprobación automática de la versión antigua no puede repararse antes de sustituir su ejecutable.

La descarga se limita al tamaño esperado, verifica SHA256 y valida la cabecera PE de Windows antes de guardarla y ejecutarla. Cada descarga utiliza un nombre temporal independiente. Solo puede aplicarse una actualización a la vez por proceso de Nexus. Consultar actualizaciones no crea archivos de bloqueo ni descarga el instalador.

Se mantiene el respaldo local en Documentos/TrophyHunter/Instaladores, que reconoce nombres `TrophyHunter_X.Y.Z_x64-setup.exe` y `Nexus-Studio_X.Y.Z_x64-setup.exe`. Esa carpeta es una opción manual del usuario. Los errores de conexión siguen siendo errores, no una confirmación de estar al día. En desarrollo no se aplican actualizaciones.
