# Auditoría de Nexus Studio 0.2.43

Fecha: 16 de noviembre de 2026. Base: commit 19f8687d3cc4a75dd81185641ab661086e50b346, revisión separada en /workspace/Nexus-Audit-043. No se han modificado ni publicado fuentes.

## Alcance y comprobaciones

Revisión de código y flujos: Inicio, métricas, metas, conexiones, creación de contenido, calendario, capturas/Shorts/subtítulos, directo/OBS/sonido/alertas/chat/Discord, juegos, hábitos, ingresos, copias y actualización. Compilación frontend correcta; 31 pruebas frontend y 7 de publicación correctas; 39 pruebas del arnés Rust de capturas, métricas y autorización correctas. No equivale a probar físicamente Windows, OBS, PS5 o las cuentas del usuario. La comprobación de navegador utiliza SQLite temporal y comandos nativos simulados.

Prioridades: P1 = corregir antes de ampliar funciones; P2 = siguiente mejora de uso/fiabilidad; P3 = ampliación o mantenimiento.

## Hallazgos con evidencia de código

1. **P1. Selección incorrecta de cifra actual al mezclar registros manuales y API. Reproducido.** `src/db/accountSnapshots.ts:39` ordena por fecha y creación; `src/features/dashboard/socialProgress.ts` toma el último registro sin actualización; `src-tauri/src/metrics_core.rs:95` actualiza la cifra API y updated_at sin cambiar created_at. Caso: API creada 10:00, manual 11:00, API actualizada 12:00. Se muestra el manual anterior. Evidencia: snapshot-order.json, ejecutando la función real transpilada. Definir prioridad y hora efectiva de observación; no eliminar el historial manual.

2. **P1. Calendario equipara ausencia de paso pendiente con publicación. Confirmado por código.** `src/features/calendar/CalendarPage.tsx:49` usa `published_at !== null || step === null`. Tener los pasos terminados/desactivados no acredita que el contenido se haya publicado. Usar estados separados: listo y publicado; requerir confirmación o prueba externa para este último.

3. **P1. Autoinstalación al abrir sin comprobar trabajo activo. Confirmado por código.** `src/features/update/UpdateLayer.tsx` llama apply automáticamente al detectar versión nueva y espera 3500 ms. `src-tauri/src/updater.rs:266` cierra Nexus. No comprueba trabajos multimedia, borradores ni actividad OBS. La comprobación periódica con la app abierta solo avisa: ese caso sí está protegido por diseño. Proteger también arranque e instalación manual; aplazar y guardar antes de salir.

4. **P2. Reconectar Twitch puede conservar la actualización automática desactivada. Confirmado por código.** `src-tauri/src/social_metrics.rs:434` deja auto=false al desconectar; línea 300 reutiliza ese booleano al reconectar. Ofrecer una decisión explícita o restaurar la preferencia de conexión activa.

5. **P2. Autorización de TikTok y primera sincronización dependen de permanecer en su pantalla. Confirmado por flujo.** El callback nativo guarda credenciales y configuración y emite metrics-changed; `src/features/setup/ConnectionsHub.tsx` solo sincroniza en el sondeo de la tarjeta TikTok pendiente. Al salir se cancela ese sondeo. `socialSync.ts` no consume ese evento nativo y comprueba conexiones cada diez minutos. Centralizar fin de autorización/primera consulta y notificación. No se ha reproducido contra una cuenta real.

6. **P2. Fallos automáticos de métricas poco visibles. Confirmado por código.** `src/features/profiles/socialSync.ts` conserva los datos válidos, pero captura los fallos sin aviso global. Mantener las cifras es correcto; añadir hora de última consulta correcta, aviso discreto de antigüedad y acción de recuperación por plataforma.

7. **P2. Subtítulos seleccionados dentro de un desplegable cerrado. Confirmado por composición.** `src/features/projects/ContentHub.tsx:17` aloja SubtitlesPanel en details cerrado; `src/features/live/SubtitlesPanel.tsx:45` recibe nexus-select-recording y desplaza hacia el elemento sin abrir su contenedor. `MediaTools.tsx:31` emite ese evento. Abrir el desplegable al continuar desde un Short.

8. **P2. Paneles ocultos siguen consultando servicios. Confirmado por código.** LivePage usa hidden para Sonido/OBS; MusicPanel consulta cada 3000 ms; TtsPanel (StudioModules) cada 2500 ms; ObsPanel cada 2000 ms. Ocultar no desmonta ni pausa esos efectos. No se atribuye una caída concreta de FPS sin medirla en el equipo. Suscripciones compartidas y consultas según pantalla/actividad.

9. **P1/P2. Borradores sin protección uniforme. Confirmado por arquitectura.** App.tsx desmonta páginas al cambiar de sección. Los formularios locales no tienen recuperación general. ScriptEditor guarda al salir del campo, no periódicamente mientras se escribe. Una salida abrupta puede perder el campo actual. Autoguardado diferido, estado Guardado y recuperación; conservar Guardar donde sea una acción explícita útil.

10. **P2. El instalador encontrado en carpeta evita la verificación usada por GitHub. Confirmado por código.** `updater.rs:226`, rama Found::Folder, utiliza directamente el ejecutable. La descarga de GitHub sí valida integridad y formato. Aplicar garantías coherentes a la ruta local; no es una demostración de explotación remota.

11. **P2. La copia de la base de datos no incluye toda la configuración local ni los medios. Límite confirmado.** `src/db/pcGames.ts` guarda asociaciones de procesos en localStorage; no entran en las tablas exportadas. Vídeos se referencian mediante rutas. Las credenciales del almacén del sistema no deben exportarse como texto. Los sonidos propios guardados en alert_audio sí forman parte de la copia: no se consideran perdidos. Mostrar inventario y asistente de traslado/reconexión.

12. **P2. Cola multimedia sin persistencia completa. Límite confirmado.** `src-tauri/src/media_jobs.rs:36` usa cola en memoria OnceLock. Añadir recuperación de pendientes/interrumpidos tras reiniciar, sin prometer recuperación de un proceso externo en cualquier estado.

13. **P2. Vista previa del Short es un fotograma. Límite actual.** Sirve para encuadre inicial, no para verificar movimiento, final y mezcla de audio. Añadir reproducción del tramo y escucha antes de exportar.

14. **P2. Reconocimiento PC integrado limitado a tres ejecutables conocidos. Límite confirmado.** `src-tauri/src/pc_games.rs:45-47`: Fortnite, 7DS y Wukong. Otros juegos requieren asociación manual. Conservar asociación y facilitar reparación tras cambios del ejecutable; importación de biblioteca instalada como ampliación.

15. **P2. Formatos monetarios locales limitados. Reproducible por función.** `src/features/income/money.ts` acepta 1200,50 o 1200.50, pero rechaza 1.200,50. Aceptar formato regional sin ambigüedad y mostrar ejemplo; separar USD/COP sin suma ni conversión implícita.

16. **P2/P3. Cobertura de interfaz fuera de las comprobaciones automáticas principales. Confirmado por workflows.** Los workflows ejecutan npm y Rust, pero no los guiones Python/Playwright de interfaz. Automatizar los recorridos actuales y actualizar selectores tras cambios de navegación. Añadir regresiones para los casos 1, 2, 4, 5 y 7.

17. **P3. Endurecimiento de contenido web pendiente.** tauri.conf.json declara csp=null. Propuesta preventiva: restringir fuentes permitidas y revisar renderizado de contenido externo. No se ha demostrado XSS ni robo de datos.

## Mejoras de uso y ampliaciones recomendadas

### Inicio y métricas
- Estado de frescura por red, fecha y hora de consulta y fuente; distinguir fallo de conexión de ausencia de registros.
- Selector de periodo y gráfica de evolución con registros reales, sin inventar crecimiento previo.
- Explicar cuándo estará disponible la primera comparación.
- Metas de YouTube de seguidores, vistas y horas con procedencia y ventana; no equiparar estimación con elegibilidad oficial de monetización.
- Varias metas activas con selección y próximos hitos; avisar si al cambiar la métrica una meta deja de aparecer en Inicio.
- Celebración discreta de hitos reales e historial de logros.
- No presentar suma de seguidores entre redes como personas únicas.

### Conexiones
- Un centro de configuración completo, con identidad de cuenta, capacidades y último resultado.
- Mantener separado conectado de permiso suficiente y primera consulta correcta.
- Diagnóstico con acción concreta por permiso, vencimiento, cuenta o perfil equivocados.
- Reconectar reutilizando configuración segura; no obligar a registrar la app otra vez.
- Meta requiere resolver renovación del token/manualidad actual; TikTok 0.2.43 ya implementa OAuth y refresh.
- Distinguir desconexión local de revocación del permiso en el proveedor; informar si falla borrar credencial local.
- Guía de TikTok Sandbox con pasos exactos y verificación final; la aprobación de producción no se sustituye con un botón.

### Crear contenido
- Un solo buzón de candidatos, clips, revisados y exportados con filtros por sesión/juego.
- Reproducción y escucha del tramo antes de exportar; selección de audio recordada.
- Recorte visual y plantillas con cámara/juego para vertical.
- Subtítulos integrados opcionales, edición y estilos; mantener SRT separado para quien lo necesite.
- Flujo sencillo captura → Short/proyecto → fecha → registro de publicación, con opciones avanzadas plegadas.
- Diferenciar claramente programar en calendario de subir/publicar en la red.
- Reparar rutas de grabaciones movidas y seleccionar archivos mediante explorador.
- Gestión de espacio con tamaño por archivo y limpieza elegida; descartar un candidato no significa borrar su vídeo.
- Recuperación de trabajos y errores con acción concreta, sin reexportar por desconocer dónde quedó el archivo.
- Claridad en captura por voz/botón: no prometer identificación semántica de las mejores jugadas.

### Directo y comunidad
- Cabina centrada en escena, micrófono, grabación, directo, Replay Buffer y Momento.
- Retirar rutas de configuración duplicadas hacia un mismo servicio.
- Asistente OBS ya mide rendimiento y aplica actividades; ampliar recomendaciones de encoder/bitrate solo con medición y confirmación fuera de emisión.
- Catálogo de acciones Stream Deck con prueba y resultado esperado.
- Diagnóstico de alertas recibidas/renderizadas/descartadas; separar evento simulado de evento real disponible por API.
- Prueba de voz y ruta de audio TTS; atenuación de música durante voz/alerta.
- Peticiones musicales con límites y controles de moderación comprensibles.
- Discord: explicar que los avisos locales requieren Nexus abierto; revisar entregas dudosas antes de duplicar mensajes.
- Resumen del directo con enlace a momentos, tareas pendientes y siguiente contenido aprovechable.

### Juegos y organización personal
- Reanudar partida desde una sola ficha con última nota, objetivos siguientes y guardado visible.
- Priorizar próximos platinos según preferencia, horas y dificultad, no solo porcentaje.
- Objetivos de trofeos y guías con control de spoilers; distinguir confirmación PSN de anotación manual.
- Resumen de Fortnite por partida terminada con procedencia y ajuste manual trazable; mantener contadores secundarios.
- Biblioteca PC importable y asociaciones respaldadas; PS5 depende de presencia PSN, no de identificar visualmente HDMI.
- Objetivos de producción semanales ajustables al tiempo disponible y descansos, sin penalizar días sin crear.
- Calendario con atrasados, carga semanal y reprogramación rápida.
- Ingresos devengados frente a cobrados, comprobantes y balance por moneda; no presentarlo como saldo oficial de plataformas.

### Fiabilidad y mantenimiento
- Copias automáticas con rotación e inventario claro de qué se conserva.
- Diagnóstico exportable sin tokens ni mensajes privados.
- Reducir duplicación de pantallas y centralizar estado de servicios.
- Pruebas de interfaz del recorrido inicial y de interrupciones/desconexión/caducidad.
- Progreso de descarga/instalación y aplazamiento seguro; conservar las comprobaciones de publicación existentes.

## Orden recomendado

1. Corregir selección de cifras, falso Publicado, protección de borradores e instalación con trabajo activo.
2. Cerrar ciclo conectar → verificar → primera cifra → renovación → aviso de fallo.
3. Completar captura → vista previa real → subtítulos → calendario y persistir cola.
4. Simplificar Cabina/Conexiones y disminuir consultas ocultas; mejorar diagnóstico de alertas.
5. Ampliar gráficos/metas/juegos/organización según uso real, manteniendo Inicio centrado en métricas.

## Evidencia adicional de interfaz

En Chromium, con SQLite temporal y servicios simulados, durante 8,2 segundos en Cabina se observaron 3 consultas studio_tts_status y 2 music_status con Sonido oculto; además de 5 obs_status, 4 obs_markers y 4 obs_clips. Esto demuestra actividad innecesaria de paneles ocultos, no una medición del consumo o FPS en el PC del usuario. Datos: hidden-polling.json. Al emitir nexus-select-recording, el details Grabaciones y subtítulos permaneció open=false. La prueba no utiliza vídeos, cuentas o credenciales reales.
