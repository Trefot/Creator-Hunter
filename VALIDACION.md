# Validación de estabilidad · 2026-11-11

Versión actual 0.2.12, preparada desde `1d77f07` (0.2.9). El instalador ya se ha compilado en GitHub Actions para Windows; la instalación y revisión en el equipo del usuario siguen pendientes.

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
