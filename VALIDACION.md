# Validación de estabilidad · 2026-11-11

Rama de trabajo: `fix/personal-app-reliability`, basada en `1d77f07` (0.2.9). Cambios sin publicar; no se ha generado ni instalado una versión nueva en el equipo del usuario.

## Preparación de la actualización 0.2.10

La versión preparada pasa la comprobación de versiones y novedades, 13 tests de frontend y 6 del helper de publicación. Los 8 tests de datos también pasan. Compilación frontend, sintaxis del script Bash y análisis YAML correctos. Los tests nuevos comprueban orden numérico de versiones, novedades por sección, rechazo de retrocesos/reemplazos, cabecera de ejecutable y metadatos del ZIP sin .git. No se usa un archivo de ejemplo como instalador real.

Bloqueo confirmado en esta entrega: git push devuelve «Permission ... denied» (403) y create_branch de la integración devuelve «Resource not accessible by integration» (403). No hay ejecución del workflow, artefacto Windows ni publicación nueva en el canal remoto. El archivo BAT, el workflow y la compatibilidad de actualización requieren ejecución en Windows; no se presentan como pruebas ya superadas.

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

El título nativo y los iconos están preparados en el código; su apariencia en Windows y la actualización desde TrophyHunter siguen pendientes. No se cambió `productName` del paquete ni se publicó instalador. Se conservaron identificador, archivos de datos, credenciales y protocolo de copias.

## Interfaz híbrida

Se comprobó el dashboard con adaptaciones, perfiles y registros simulados, y también sin datos. Navegación a Ideas y Live Studio, edición de un formulario y renderizado del overlay dentro del iframe. Ventanas 1440×1040, 1280×800 y 960×640 sin desbordamiento horizontal del contenido ni errores JavaScript. Las cifras y títulos de las capturas son ejemplos de prueba, no métricas privadas del usuario. La compilación del frontend y las 13 pruebas pasan después del cambio visual; no se modificaron migraciones ni operaciones SQLite.

La comprobación nativa en Windows continúa pendiente; no hay instalador publicado de este diseño.

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

El workflow `.github/workflows/checks.yml` prepara comprobaciones de frontend y datos en Linux, y tests nativos/debug más comprobación release en Windows. Su existencia no significa que se haya ejecutado ni pasado.

Antes de publicar una versión, comprobar en Windows:

- `npm ci`, `npm test`, `npm run build`, `cargo test --locked --manifest-path src-tauri/Cargo.toml` y `cargo check --locked --release --manifest-path src-tauri/Cargo.toml`.
- Abrir `npm run tauri dev`: confirmar título PRUEBAS, base `studio-dev.db` y puerto 7879.
- Crear y editar datos ficticios, cerrar y reabrir; exportar y restaurar una copia desde la interfaz.
- Confirmar que las copias de pruebas se guardan en `Copias/Pruebas` y que producción conserva sus conexiones existentes. Las conexiones de pruebas inicialmente estarán sin configurar.
- Probar conectar y desconectar en desarrollo. YouTube no revoca remotamente desde pruebas; usar un proyecto OAuth distinto si se necesita aislar también las autorizaciones en Google.
- Reproducir animación y sonido en la vista previa de WebView2 y en OBS. El sonido real y Stream Deck no se han probado aquí.
- En una base temporal de pruebas con migración pendiente, bloquear su destino de copia y confirmar que no se abre SQLite hasta resolverlo. Nunca hacer esta comprobación con `studio.db`.
- Comprobar búsqueda de actualizaciones sin conexión; no ejecutar el instalador sobre los datos reales como prueba.

## Pendientes deliberados

No se cambiaron las migraciones existentes ni el identificador de la aplicación. No se ha implementado firma de actualizaciones, ni una CSP completa, ni cambios de rendimiento en la carga de secciones. Tampoco se ha cambiado la publicación automática desde `releases`: hace falta validar Windows antes de publicar un instalador que afecte a la app diaria.
