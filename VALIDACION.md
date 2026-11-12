# Validación de estabilidad · 2026-11-12

Versión publicada 0.2.19, preparada desde `1d77f07` (0.2.9). El instalador ya se ha compilado en GitHub Actions para Windows; la instalación y revisión en el equipo del usuario siguen pendientes.

## 0.2.19 · Plantillas por evento y fuentes compartidas

- 13 pruebas del motor y 2 de recursos pasan: las 16 configuraciones predeterminadas, eventos válidos por plataforma, instantánea de configuración en cola/repetición, desactivación sin bloquear otros tipos, serialización y variables literales sin expansión recursiva. Imágenes/fuente/licencia verificadas en el registro nativo real.
- 17 pruebas de datos pasan; copia/restauración incluye plantillas de Twitch/YouTube/TikTok, cantidad, texto y activación. Sin nueva migración; esquema 20 y 27 tablas.
- 20 pruebas frontend y 6 de publicación; TypeScript/Vite correctos, sin cambios de dependencias npm.
- Chromium con catálogo generado por la biblioteca Rust de producción y RPC simulados: borradores por evento, guardado aislado, bloqueo de pruebas sin guardar/desactivadas, variables, URLs estables y prueba de Stream Deck con event=raid. Cambio de evento conserva borradores, tipografía y vista previa sin audio/lecturas de cola; ilustraciones cargadas una vez por archivo. Texto seguro, control de sonido y recarga por versión pasan sin errores JS.
- Grabación del HTML real recorriendo las 16 plantillas con eventos simulados y duración abreviada; revisión de etiquetas dentro del marco. Artefactos locales: artifacts/trefot-alertas-eventos.png y .webm, fuera del repositorio.
- El registro de imágenes se comparte por IPC/HTTP sin incluir otra copia de los PNG en el bundle de frontend. Se conservan las URLs y las preferencias anteriores como evento inicial de cada red.
- La ejecución [43149295294](https://github.com/Trefot/Creator-Hunter/actions/runs/43149295294) pasó pruebas, compilación NSIS, actualización desde 0.2.18 y publicación. Descarga y canal verificados: instaladores idénticos, 18.180.233 bytes, SHA-256 `a96b9cbbdfa4832082f33e603fe144509b4bfdb767c3f0aabbcd12c375f427ef`, origen `ab59887e24771cb8357044fcd42176ea01cd6240`. Recepción automática y prueba física en OBS siguen pendientes.

## 0.2.18 · Corrección del arte de referencia

- Reemplaza la aproximación gráfica de 0.2.17 por tres artes completos preparados desde la muestra elegida: poses de saludo, placas y marcos detallados. Referencia conservada en design/alertas-referencia-aprobada.png.
- Siete pruebas del motor y 17 de datos pasan, incluidas preferencias de color de etiqueta, tipografía y compatibilidad con copias anteriores. Sin nueva migración; esquema 20 y 27 tablas.
- 20 pruebas frontend y 6 de publicación; TypeScript/Vite y versiones coherentes. No se cambian dependencias npm.
- Chromium: carga de la fuente Inter integrada dentro de la vista previa aislada, arte por plataforma, preset de referencia, texto editable/seguro y controles de colas/audio pasan. Recarga automática ante cambio de versión sin bucle. Sin errores JavaScript.
- Grabación del HTML real con eventos ficticios: artifacts/trefot-alertas-corregidas.png y .webm fuera del repositorio. Se comprueba que el texto no toque el borde inferior.
- Las fuentes antiguas de 0.2.17 necesitan refrescarse una vez en OBS. Los artes conservan su paleta; el texto sigue siendo editable. La animación consiste en entrada/salida y luz del farol, no en movimiento articulado de las poses.
- La ejecución [43140822089](https://github.com/Trefot/Creator-Hunter/actions/runs/43140822089) pasó pruebas, compilación NSIS, actualización desde 0.2.17 y publicación. Descarga y canal verificados: instaladores idénticos, 12.405.941 bytes, SHA-256 `d5e0774dd950cf4b0ca8ff987d6197270a0e5a25254f1bc8f2b571b76d71032d`, origen `a98597149fce53b68f64c6d9de5608c6c2c2c35b`. Recepción automática de eventos y prueba física de OBS pendientes.

## 0.2.17 · Primera alerta animada de Trefot

- Motor: 7 pruebas pasan; incluyen compatibilidad con preferencias de 0.2.16, valores predeterminados de estilo/TikTok, texto de prueba editable e invalidación de tipografías o tamaños fuera de rango.
- Datos: 17 pruebas pasan, incluidas exportación/restauración de tipografía y ajustes de las tres plataformas. Sin migración nueva: se mantiene esquema 20 y 27 tablas.
- Frontend: 20 pruebas y 6 de publicación; TypeScript/Vite y coherencia de versiones correctos.
- Chromium con SQLite en memoria y RPC simulados: texto, tipografía y tamaño reflejados en el mismo HTML de la vista previa, nombres insertados literalmente (incluido $&), animación del personaje, vista previa sin audio ni lecturas de cola, controles y URLs de TikTok, aislamiento de plataformas, texto seguro y recuperación de audio/conexión. Sin errores JavaScript ni desbordamiento a 960 px.
- Grabación reproducible con tests/alerts-demo.py del HTML real y personaje original: Twitch, YouTube y TikTok, eventos simulados, entrada/movimiento/salida. Captura y vídeo en artifacts/trefot-alertas-animadas.png y .webm fuera del repositorio.
- Recepción automática, plantillas múltiples por tipo de evento, medios/fuentes tipográficas importados y poses articuladas pendientes. Audio físico y fuentes en el OBS del usuario pendientes de prueba.
- La ejecución [43135451689](https://github.com/Trefot/Creator-Hunter/actions/runs/43135451689) pasó pruebas, compilación NSIS, actualización desde 0.2.16 y publicación. Descarga y canal verificados: instaladores idénticos, 3.893.894 bytes, SHA-256 `b9809589749e28385f58e76b1347f1dd3788d30770f4700c1dd76599e281de4f`, origen `68080beb8af7c6dd0a2a588327a665244be0494a`.

## 0.2.16 · Fuentes de alertas independientes

- Motor: 4 pruebas verifican aislamiento de colas, coordinación de audio, pausa/silencio, repetición, titularidad de una fuente y límites de entrada/cola.
- Datos: 17 pruebas con 20 migraciones; importación de una copia real del esquema 19 y exportación/restauración de preferencias de Twitch/YouTube. Las 27 tablas siguen incluidas.
- Frontend: 20 pruebas y 6 de publicación; TypeScript/Vite y versiones coherentes.
- Chromium con SQLite real en memoria y RPC simulados: controles y URLs separados, guardado, adaptación a 960 px, texto seguro en el HTML real del overlay, ocultación al terminar y recuperación de un error 503 sin repetir audio y control para activar sonido cuando el navegador bloquea el audio. Prueba reproducible opcional: tests/alerts-browser.py.
- No hay recepción automática de eventos de Twitch/YouTube ni bot de Discord en esta entrega. El audio físico y las fuentes en el OBS del usuario requieren prueba real.
- La ejecución [43126432738](https://github.com/Trefot/Creator-Hunter/actions/runs/43126432738) terminó correctamente: pruebas, compilación NSIS, actualización desde 0.2.15, verificación de integridad y publicación. Release y canal verificados: instaladores idénticos, 3.881.253 bytes, SHA-256 `9ac8693e5fd0089e5f3b4bd9e0c273647edd59d90a4eae2ee991d5e8cba374da`, origen `45b3112fdc002766138295e779f0e8a5261a3538`.

## 0.2.15 · Platinos, objetos y detección visual

- 20 pruebas frontend y 6 de publicación; TypeScript/Vite correctos.
- 16 pruebas de datos con 19 migraciones y 27 tablas: importación del esquema 18, calibraciones y selección en copias, platinos sin duplicados con prioridad del trofeo real, marcado idempotente y progreso compartido con collection_item.
- 5 pruebas del protocolo OBS con servidor simulado; lecturas de fuentes y capturas permitidas sin iniciar ni detener salidas.
- Chromium con SQLite real en memoria y RPC nativo simulado: registro de platino manual, preparación repetida de 36 curiosidades sin duplicados, selección del objetivo, URL del overlay y calibración. Modo Prueba detecta sin escribir progreso; modo automático espera la ausencia previa y dos coincidencias, escribe un objeto y el overlay muestra 1/36. Sin errores JavaScript. Fuente de navegador 720×420 sin recorte del panel en el caso probado.
- Prueba reproducible opcional: tests/broadcast-browser.py con Vite abierto, Playwright/Chromium y Pillow. La referencia es texto sintético; no acredita detección real de Wukong o del token de Fortnite. Ambas requieren calibración y prueba en el OBS del usuario.
- La ejecución [43099483059](https://github.com/Trefot/Creator-Hunter/actions/runs/43099483059) terminó correctamente: pruebas, compilación NSIS, comprobación de actualización desde 0.2.14 y publicación directa autorizada. Release y canal verificados: instaladores idénticos, 3.848.811 bytes, SHA-256 `68d2bbee5b318456027b5763172c41f2a10c515b6b1530aec489d93a19bddb43`, origen `d876c2dfc2d46fa0ca00f196282c711051ecb688`. La calibración de avisos reales y la revisión en el PC del usuario siguen pendientes.
- Los intentos anteriores se retrasaron por una incidencia de GitHub Actions y un fallo de transferencia de artefactos. La entrega directa conserva las pruebas y los controles de integridad y versión.

## 0.2.14 · Biblioteca y fichas de juego

- 19 pruebas frontend y 6 de publicación pasan; TypeScript/Vite y versiones coherentes.
- 13 pruebas de datos con 18 migraciones y 25 tablas: importación del esquema 17, nuevas relaciones idea→game y clave de captura, roundtrip y rechazo de duplicados. Se corrigió la reutilización de metadatos de SELECT * tras ALTER TABLE en una misma conexión.
- Chromium con SQLite real en memoria y servicios nativos simulados: biblioteca sin 0/0, plan diario guardado, check manual, notas y portada JPEG, clips por ID de juego, conversión repetida sin duplicados, asociación de proyecto y aprobación de idea conservando game_id. Recarga completa con objetivos/notas conservados; navegación PSN a ruta/lista y trofeo real de prueba. Sin errores JS ni desbordamiento a 1280/960 píxeles.
- Prueba reproducible opcional en tests/games-browser.py; todas las filas son ficticias y no se conecta al OBS/PSN del usuario.
- La primera ejecución 43079969316 falló creando una base temporal por bloqueo; se reforzó la unicidad de rutas de prueba con un contador atómico. La ejecución [43080516190](https://github.com/Trefot/Creator-Hunter/actions/runs/43080516190) pasó 19 pruebas frontend, 6 de publicación, 13 de datos y 21 del núcleo nativo, build NSIS y actualización desde 0.2.13. Release y canal verificados: instaladores idénticos, 3.363.815 bytes, SHA-256 `e5cce87928afca54f6317ff61bc46e591c6ae8c9782dd814d3908fa5d1c694a6`, origen `2f93606581aeb6ccd5e732691f504ab89b13de08`. Uso real de las nuevas fichas pendiente de revisión del usuario.

## 0.2.13 · Clips del Replay Buffer

- Protocolo: 5 tests con servidor WebSocket local simulado. Incluyen ACK/evento en ambos órdenes, búfer apagado sin iniciarlo, rechazo de OBS y ACK sin ruta nueva que no reutiliza un archivo anterior.
- Datos: 12 pruebas con 17 migraciones y 25 tablas. Clip+marca en transacción, rollback ante ruta duplicada, clip sin sesión, rechazo de ruta vacía, roundtrip e importación de copia del esquema 16.
- Frontend: 19 tests y 6 del empaquetado, TypeScript y Vite correctos.
- Chromium con IPC simulado: botón desactivado sin búfer, guardado con búfer solo, estado pendiente sin éxito anticipado, ruta confirmada, URL del Deck y fallo sin inventar un clip; sin errores JS ni desbordamiento a 1280/960 píxeles.
- La ejecución [43074073595](https://github.com/Trefot/Creator-Hunter/actions/runs/43074073595) pasó 19 pruebas frontend, 6 de publicación, 12 de datos y 21 del núcleo nativo, build NSIS y actualización desde 0.2.12. Release y canal verificados: instaladores idénticos, 3.359.643 bytes, SHA-256 `f3ddaf12b9e29103c231b4da37ee51d8f83570deb5b3cd54d1ac7e83808e384b`, origen `99dd7ed169dd2a4c4dd7e25130ed1fa8aba44a99`. Replay Buffer y guardado físico en el PC del usuario pendientes. El usuario confirmó previamente que las marcas con OBS/Stream Deck de 0.2.12 funcionan.

## 0.2.12 · OBS y momentos

- 19 pruebas frontend y 6 de publicación pasan; TypeScript/Vite y versiones coherentes.
- 10 pruebas de datos pasan con las 16 migraciones y las 24 tablas: incluyen importación de copia real del esquema 15, marcas con ambos tiempos, archivo Unicode, roundtrip y rechazo de marcas sin tiempo o con sesión terminada.
- 2 pruebas del protocolo OBS pasan contra un servidor WebSocket local simulado: autenticación, estado, evento de archivo, rechazo de comandos de control y fallo de autenticación/conexión.
- Chromium con IPC simulado: conectar, marcar en 00:02:03, copiar la URL de Stream Deck, fallo sin duplicar la marca y bloqueo de grabación pausada. Sin errores JavaScript ni desbordamiento a 1280/960 píxeles. Captura de prueba con datos ficticios en nexus-obs-momentos.png.
- La ejecución [43068021591](https://github.com/Trefot/Creator-Hunter/actions/runs/43068021591) pasó 19 pruebas frontend, 6 de publicación, 10 de datos y 18 del núcleo nativo, compiló NSIS y verificó la actualización desde 0.2.11. Release y canal publicados y comprobados: instaladores idénticos, 3.349.295 bytes; SHA-256 `0f18621a516fa0d7ccaa2bb2e5ef7089c34e57bea8c8a9721455fd249140c480`, origen `89b524a94c5cd56032b19bbe75be0144b375fc6e`. La conexión al OBS y la pulsación física del Stream Deck del usuario siguen pendientes de configuración y revisión en su equipo.

## 0.2.11 · PC e identidad de Windows

- `npm test`: 18 pruebas frontend y 6 de publicación pasan. Las cinco nuevas cubren PC sin PSN, aislamiento de plataformas, prioridad y salida manual, modo desactivado, fallo local con recuperación a PSN y limpieza sin peticiones solapadas ni navegación tardía.
- `npm run build` y `npm run release:check`: correctos.
- Chromium con IPC y datos simulados: Fortnite detectado sin PSN, alta en PC, apertura de su ficha, selección manual y vuelta a automática. Sin errores JavaScript ni desbordamiento horizontal a 1280 y 960 píxeles. No ejecuta Fortnite real ni conecta OBS.
- La ejecución [43061149568](https://github.com/Trefot/Creator-Hunter/actions/runs/43061149568) terminó correctamente: 18 tests frontend, 6 de publicación, 8 de datos y 16 del núcleo nativo, compilación NSIS y prueba de actualización silenciosa desde 0.2.10. Se verificaron ejecutable, accesos de escritorio/Inicio, icono dedicado, DisplayName y versión. La release v0.2.11 y el canal `releases` están publicados; sus instaladores descargados son idénticos (3.271.804 bytes; SHA-256 `8cd4fbe894ad0af09aa8bef94d8a5f736ea34369e8e5d72cf45515d4305893e7`).
- El proceso real de Fortnite, los anclajes de la barra de tareas y la grabación con OBS en el PC del usuario siguen pendientes de comprobación de uso. La app no incorpora conexión WebSocket a OBS en esta entrega.

## Preparación de la actualización 0.2.10

La versión preparada pasa la comprobación de versiones y novedades, 13 tests de frontend y 6 del helper de publicación. Los 8 tests de datos también pasan. Compilación frontend, sintaxis del script Bash y análisis YAML correctos. Los tests nuevos comprueban orden numérico de versiones, novedades por sección, rechazo de retrocesos/reemplazos, cabecera de ejecutable y metadatos del ZIP sin .git. No se usa un archivo de ejemplo como instalador real.

El bloqueo inicial HTTP 403 quedó resuelto al instalar ChatGPT Codex Connector en GitHub. La ejecución [43044969968](https://github.com/Trefot/Creator-Hunter/actions/runs/43044969968) pasó 13 pruebas de frontend, 6 de publicación, 8 de datos y 14 del núcleo nativo en Windows. Compiló la aplicación optimizada y el instalador NSIS. Falló después, al recoger la carpeta oculta `.release`; se corrigió `include-hidden-files` y se inició la ejecución [43046894264](https://github.com/Trefot/Creator-Hunter/actions/runs/43046894264). La segunda ejecución terminó correctamente y publicó tanto la release `v0.2.10` como el canal `releases`. Se descargaron ambos instaladores y se comprobó que son idénticos al del canal, con cabecera PE válida, tamaño de 3.156.785 bytes y SHA-256 `0bbd99c5f37c7684db5b5e4685358ba841b4ef2f43dd0712ef23080020c4e615`. La ejecución del archivo BAT local no se ha probado aquí.

## Resultado local

- `npm test`: 13 pruebas pasan. Incluyen las cuatro de protección de apertura/copias y nueve de sincronización: peticiones compartidas, intervalo de tres horas, reintento tras fallo, ciclo periódico, limpieza, avisos de error sin repetición, fechas inválidas/futuras, desconexión y un vídeo enlazado a varias adaptaciones.
- `npm run build`: TypeScript y Vite pasan. Se mantiene el aviso de tamaño del JavaScript; no es un fallo de compilación.
- `cargo test --locked --manifest-path tests/data-safety/Cargo.toml`: 8 pruebas pasan sobre el código Rust/SQLx que usa la aplicación. Incluyen las 15 migraciones y bases temporales.
- Chromium con comandos Tauri simulados: pantalla de error de copia, ausencia de apertura SQLite mientras falla, reintento correcto, montaje del dashboard, contador dentro del iframe aislado y animación al probarlo. La búsqueda manual informa de un fallo simulado de GitHub sin mostrar «última versión». Sin errores JavaScript tras completar la simulación de los eventos nativos.
- `git diff --check`: sin errores de espacios.

La comprobación adicional en Chromium con YouTube simulado confirmó una sola sincronización durante StrictMode y la conservación del formulario de Ideas y su texto sin guardar al finalizar la actualización. No se ha probado el servicio real de YouTube en este entorno.

## Identidad Nexus Studio

Se generó el emblema elegido B con fondo transparente y se verificó RGBA y rango alfa 0–255 en el original y las derivaciones de interfaz. Los iconos de escritorio y de Stream Deck se generaron con la CLI existente de Tauri. La interfaz carga la versión de 256 píxeles; el original completo no se incorpora al bundle por el componente Logo.

Pasan de nuevo las 13 pruebas de frontend, las 8 de datos y la compilación frontend. En Chromium se comprobó el título Nexus Studio, la carga del logo con texto alternativo, estados con y sin datos, navegación, formulario y overlay a 1440/1280/960 píxeles. Las capturas contienen datos de ejemplo.

El título nativo y los iconos están incluidos en el instalador compilado; su apariencia en el equipo del usuario y la actualización desde TrophyHunter siguen pendientes de revisión de uso. Se conservaron `productName`, identificador, archivos de datos, credenciales y protocolo de copias.

## Interfaz híbrida

Se comprobó el dashboard con adaptaciones, perfiles y registros simulados, y también sin datos. Navegación a Ideas y Live Studio, edición de un formulario y renderizado del overlay dentro del iframe. Ventanas 1440×1040, 1280×800 y 960×640 sin desbordamiento horizontal del contenido ni errores JavaScript. Las cifras y títulos de las capturas son ejemplos de prueba, no métricas privadas del usuario. La compilación del frontend y las 13 pruebas pasan después del cambio visual; no se modificaron migraciones ni operaciones SQLite.

La compilación nativa en Windows pasó; la revisión visual y de interacción en WebView2 continúa pendiente.

## Qué prueban los tests de datos

1. Exportación y restauración de datos relacionados en las 22 tablas, incluyendo texto Unicode, importes, valores opcionales, imagen y sonido. Igualdad del documento exportado después de cerrar y reabrir la base.
2. Un error de clave foránea durante la importación deshace borrados e inserciones: los datos anteriores siguen iguales.
3. Rechazo de workspace ausente, tablas obligatorias omitidas, tablas inválidas, filas vacías, columnas desconocidas y versiones futuras.
4. Compatibilidad con una copia generada realmente sobre el esquema 001.
5. Copia previa válida sobre una base con datos en versión 014; una ruta de destino bloqueada produce error sin cambiar el origen.
6. Primera instalación y esquema actualizado sin crear copias innecesarias.
7. Respaldo de una base existente sin historial de migraciones.
8. Actualización del esquema 001 con datos hasta el 015, conservando sus valores originales y sus relaciones. Coincidencia entre las tablas del esquema y las incluidas en las copias.

## Límites y comprobación en Windows

Se instaló Rust en el espacio de trabajo y se intentó `cargo check --locked --manifest-path src-tauri/Cargo.toml`. La compilación completa de escritorio se detuvo en `glib-sys`: faltan los archivos de desarrollo de GLib/GTK (`glib-2.0.pc`) del entorno Linux. Esto no valida el adaptador Tauri ni el instalador de Windows.

El workflow `.github/workflows/checks.yml` prepara comprobaciones de frontend y datos en Linux, y tests nativos/debug más comprobación release en Windows. El workflow de publicación ejecutó las pruebas de datos y núcleo nativo, compilación frontend y build release NSIS en Windows, como se detalla arriba.

Comprobaciones técnicas y revisión de uso en Windows:

- `npm ci`, `npm test`, `npm run build`, `cargo test --locked --manifest-path src-tauri/Cargo.toml` y `cargo check --locked --release --manifest-path src-tauri/Cargo.toml`.
- Abrir `npm run tauri dev`: confirmar título PRUEBAS, base `studio-dev.db` y puerto 7879.
- Crear y editar datos ficticios, cerrar y reabrir; exportar y restaurar una copia desde la interfaz.
- Confirmar que las copias de pruebas se guardan en `Copias/Pruebas` y que producción conserva sus conexiones existentes. Las conexiones de pruebas inicialmente estarán sin configurar.
- Probar conectar y desconectar en desarrollo. YouTube no revoca remotamente desde pruebas; usar un proyecto OAuth distinto si se necesita aislar también las autorizaciones en Google.
- Reproducir animación y sonido en la vista previa de WebView2 y en OBS. El sonido real y Stream Deck no se han probado aquí.
- En una base temporal de pruebas con migración pendiente, bloquear su destino de copia y confirmar que no se abre SQLite hasta resolverlo. Nunca hacer esta comprobación con `studio.db`.
- Comprobar búsqueda de actualizaciones sin conexión; no ejecutar el instalador sobre los datos reales como prueba.

## Pendientes deliberados

No se cambiaron las migraciones existentes ni el identificador de la aplicación. No se ha implementado firma de actualizaciones, ni una CSP completa, ni cambios de rendimiento en la carga de secciones. Se conserva el canal `releases`; el nuevo workflow automatiza su publicación después de las pruebas y compilación de Windows. Las comprobaciones en CI no acreditan audio, OBS, Stream Deck ni instalación sobre el equipo real del usuario.
