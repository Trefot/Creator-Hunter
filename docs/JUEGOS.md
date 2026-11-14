# Juegos de PC y PlayStation

## Qué detecta Nexus

En Windows consulta los nombres de los procesos abiertos cada 15 segundos. Reconoce los ejecutables de Fortnite, 7DS (`7ds.exe`) y Black Myth: Wukong. No lee memoria del juego, su ventana ni sus archivos. Otros clientes de 7DS y cualquier otro juego se pueden asociar una vez a su ejecutable real.

En PS4/PS5 utiliza la actividad visible de la cuenta conectada a PSN, como máximo una vez por minuto. La consola debe compartir su actividad/estado en línea; esta integración no oficial no garantiza detectar actividades ocultas, desconexiones o cambios que PSN aún no haya actualizado. Una selección manual de juego tiene prioridad, y un juego reconocido de PC tiene prioridad sobre PSN.

La detección identifica actividad, no un catálogo de todos los juegos instalados. No descarga portadas ni inventa trofeos, logros o progreso de partidas.

## PC: añadir y asociar

1. Abre el juego y entra en Juegos → Elegir o añadir un juego.
2. Escribe el nombre, elige PC y pulsa Ver juegos y aplicaciones abiertos.
3. Elige el ejecutable del juego, no Steam, Epic o Netmarble Launcher. También puedes escribir solo el nombre, sin la ruta.
4. Pulsa Añadir y abrir ficha. Se abre el espacio de objetivos, contenido, notas y portada.
5. Para ajustar la asociación: ficha → Detección de este juego en PC. Guardar y detectar automáticamente activa la detección y retira la selección manual.

Las asociaciones se guardan solo en ese equipo. Un proceso solo puede asociarse a una ficha; se informa de conflictos antes de crear otra. Volver a añadir el mismo título y plataforma abre su ficha existente; otra plataforma mantiene una edición independiente.

## Añadir automáticamente

Activa Añadir a la biblioteca los juegos detectados. La opción está apagada por defecto. Crea fichas locales de títulos reconocidos por los procesos de PC o por la actividad visible de PSN. Para un juego de PC desconocido primero debes añadir su ficha y asociar el ejecutable. Con Modo juego apagado no se detectan ni añaden juegos. Si quedó una elección manual, usa Volver a la detección automática.

## PS5: completar con trofeos

Puedes crear la ficha del juego visible en PSN o elegir Importar desde PSN con trofeos. Una ficha local de PlayStation sin importación muestra el acceso Importar trofeos de PSN. Se necesita la conexión a PSN.

Al importar, si existe una ficha local de la misma plataforma y exactamente el mismo título sin identificar en PSN, se completa esa ficha, conservando sus notas, objetivos y relaciones. Si los títulos difieren, no se fusionan a ciegas. La portada oficial y los trofeos dependen de la respuesta de PSN; los juegos de PC conservan su portada manual y sus objetivos propios.

## Validación

Pruebas de nombres de proceso y asociaciones en Rust; pruebas de prioridad PC/manual, ediciones PS4/PS5, actividad offline y alta opcional en frontend; prueba de navegador con SQLite real para abrir fichas, no duplicar altas, guardar asociaciones e importar datos de PSN conservando notas. Las respuestas de procesos/PSN del navegador son simuladas; la validación final de 7DS y la cuenta de PSN se hace en el equipo del usuario.
