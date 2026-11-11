# Revisión inicial · 2026-11-11

> Documento histórico previo a las correcciones. El estado posterior y sus límites están en [VALIDACION.md](VALIDACION.md).

Base revisada: commit `1d77f07`, versión 0.2.9. Revisión inicial del código y de la preparación del desarrollo; no constituye una auditoría completa.

## Qué hay construido

- Interfaz React 19 y TypeScript, compilada con Vite 8.
- Aplicación de escritorio Tauri 2 con núcleo Rust y SQLite local.
- Creator Studio: perfiles, métricas, metas, ingresos, ideas, proyectos, adaptaciones, guiones, calendario y resultados.
- YouTube: conexión OAuth y sincronización de canal y publicaciones.
- Gaming: importación de PSN, trofeos, rutas, guías y seguimiento de partidas.
- Live Studio: contadores, overlay de OBS y acciones para Stream Deck mediante servidor local.
- Exportación/importación y copia previa a migraciones; actualización de Windows desde la rama `releases` o una carpeta local.

`src/db/` concentra el acceso desde la interfaz a SQLite. Los comandos nativos, integraciones y servidor local viven en `src-tauri/src/`. Las decisiones históricas están en ARCHITECTURE.md; no se sustituyen con este informe.

## Comprobaciones realizadas

| Comprobación | Resultado y límite |
|---|---|
| Dependencias | `npm ci --ignore-scripts`, con el lockfile existente y sin añadir dependencias. |
| Tipos y compilación | `npm run build` pasa con Node 24.22.1 y npm 11.9.0. |
| Tamaño de la interfaz | Vite avisa de un archivo JavaScript de unos 514 kB antes de gzip; no bloquea la compilación. |
| Migraciones | Las 15 migraciones se aplican en orden a una base SQLite vacía en memoria, con claves foráneas activas. |
| Integridad | `PRAGMA integrity_check` devuelve `ok` y `PRAGMA foreign_key_check` no devuelve filas tras las migraciones. |
| Cobertura de copias | Las 22 tablas del esquema coinciden con la lista `TABLES` de `backup.rs`. Esto no comprueba una exportación/importación completa. |
| Aplicación nativa | Pendiente: el entorno de revisión es Linux y no dispone de `cargo` ni `rustc`. No se ha ejecutado Tauri ni su batería de tests Rust. |

No se usaron datos personales, credenciales de redes ni la base de la aplicación instalada. Las pruebas de esquema vacío no demuestran que una actualización preserve datos existentes: eso requiere una copia representativa y el procedimiento D-007.

## Hallazgos y orden propuesto

### 1. Impedir migraciones si falla su copia previa

En `src-tauri/src/lib.rs`, el error de `premigrate::backup_if_pending` solo se escribe con `eprintln!` y el arranque continúa. Cuando la interfaz abre SQLite, el plugin puede aplicar las migraciones pendientes aunque no se haya creado la copia.

Propuesta: propagar el error de preparación y mostrar una explicación recuperable al usuario antes de permitir abrir la base. Comprobar el caso con un fallo controlado al guardar la copia y verificar que el esquema queda intacto; comprobar también el arranque normal y la primera instalación. Es la primera tarea recomendada por su impacto en los datos.

### 2. Completar la separación entre pruebas y producción

La base y el puerto del overlay sí se separan: `studio-dev.db`/7879 frente a `studio.db`/7878. Sin embargo, `youtube.rs` y `psn.rs` usan los mismos identificadores del almacén de credenciales en ambos modos. YouTube también utiliza los mismos nombres `google-client.json` y `youtube-connection.json` en la carpeta de configuración de la misma aplicación.

Por tanto, separar las bases no aísla las conexiones externas: conectar o desconectar desde pruebas puede sustituir o revocar la conexión utilizada por la app instalada, si ambas se ejecutan bajo el mismo usuario de Windows.

Propuesta: usar credenciales y archivos distintos en desarrollo, conservando los identificadores actuales en producción. Verificar en Windows que desconectar pruebas no desconecta la app instalada.

### 3. Revisar el actualizador antes de distribuir a más personas

`updater.rs` obtiene el instalador desde GitHub o una carpeta local y lo ejecuta sin verificar una firma de actualización. ARCHITECTURE.md D-021 ya reconoce el riesgo de la carpeta local y propone firmas para una distribución futura.

El repositorio ahora es público, de modo que conviene reevaluar la decisión D-023, que se tomó cuando era privado. Hacerlo público no incorpora verificación criptográfica al actualizador ni equivale a distribuir la aplicación a terceros.

### 4. Alinear documentación y estado actual

El README describía la versión 0.1.0 y un archivo de arranque que no está en el checkout. Se actualizó a 0.2.9 con requisitos y comandos reproducibles. La visión inicial de ARCHITECTURE.md («no hay red») describe Alpha 0.1; las decisiones posteriores documentan las integraciones actuales.

## Próximo paso concreto

Trabajar una sola corrección: detener el arranque cuando falle la copia previa a una migración. Antes de publicarla, ejecutar los tests Rust y probar en la aplicación de PRUEBAS de Windows, incluidos guardado, cierre y reapertura. No se marca ninguna función del roadmap como terminada ni se publica un instalador a partir de estas comprobaciones iniciales.
