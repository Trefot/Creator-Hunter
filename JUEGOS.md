# Juegos · Nexus Studio 0.2.14

La biblioteca reúne todas las plataformas. Se puede buscar por nombre, filtrar por plataforma y elegir una portada desde la ficha. Sin una portada propia se utiliza una ilustración decorativa original, no una captura oficial del juego.

## Fortnite y juegos sin trofeos

- **Hoy:** objetivos manuales, notas de la partida y últimos planes anteriores. Se reutiliza una sola sesión por juego/día; cambiar de pestaña o cerrar no borra lo guardado. Los objetivos se marcan manualmente: no detectan victorias por imagen.
- **Contenido:** últimos 100 clips y momentos de ese juego, ideas y proyectos asociados. La consulta filtra por ID del juego antes del límite, para no confundir versiones de PC y consola. Se actualiza al recibir capturas de OBS sin vaciar formularios.
- **Portada y notas:** imagen local recortada a 640×360 y notas generales, distintas de las notas de una partida.

«Crear idea» desde una captura conserva la ruta y los tiempos disponibles. Una clave única impide duplicarla al repetir la conversión del mismo origen. Aprobarla desde Ideas crea su proyecto con el mismo juego. También puede asociarse expresamente un proyecto que todavía no tenga juego; no se reasignan otros proyectos automáticamente.

## PlayStation

Los juegos importados conservan Hoy, Ruta al platino, Guía y Lista de trofeos. Se añade Contenido y la edición de portada/notas. No se muestran porcentajes ni barras de trofeos cuando no hay trofeos registrados. La conexión de PSN está en un desplegable de la biblioteca y no es necesaria para PC u otras plataformas.

## Datos y pruebas

Se reutilizan game.cover, game.notes, play_session y session_objective. La migración 018 añade game_id y capture_key a idea, con clave única de origen. Al aprobar se copia la relación al proyecto. Las 25 tablas siguen incluidas en las copias; la importación admite el esquema 17. El orden de restauración coloca game antes de idea y project para respetar sus relaciones. Los SELECT * de exportación no reutilizan metadatos de columnas previas a una migración.

Prueba opcional de interfaz con SQLite real en memoria: con Vite abierto, ejecutar `python tests/games-browser.py`. Requiere Python, Playwright con Chromium y Pillow. `NEXUS_CHROMIUM` permite elegir el ejecutable y `NEXUS_TEST_URL` la URL. Las capturas ficticias van a `.browser-artifacts`, ignorada por Git. No conecta PSN, OBS ni bases del usuario.
