# Automatizar para crear contenido

Decisión del usuario: uso exclusivamente personal, aprovechar Stream Deck y reducir al máximo la gestión manual. Se mantiene React + Tauri + SQLite. El objetivo de producto es tiempo de creación y material publicado, no tiempo dentro de la aplicación.

## Entregas

| Orden | Resultado | Qué hará automáticamente | Interacción que queda | Estado |
|---|---|---|---|---|
| 1 | Datos actualizados | Sincronizar YouTube con la app abierta, compartir consultas simultáneas y reintentar fallos | Conectar la cuenta; el botón manual sigue disponible | Implementado localmente; pruebas de servicio simulado pasan, Windows real pendiente |
| 2 | Sesiones de directo | Leer eventos de OBS, detectar inicio/fin de emisión y grabación, duración y archivos | Configurar OBS una vez y elegir objetivo/juego cuando no sea inequívoco | Pendiente |
| 3 | Momentos aprovechables | Asociar marcas de Stream Deck a sesión y archivo; guardar Replay Buffer si está activo | Pulsar «Marcar momento» o «Guardar clip» | Pendiente |
| 4 | Manager de contenido con IA | Leer el contexto permitido, proponer prioridades, títulos, ganchos, guiones y borradores | Elegir dirección creativa y revisar qué se publica | Pendiente: proveedor/modelo y presupuesto sin decidir |
| 5 | Cierre y aprovechamiento | Preparar resumen de sesión y convertir momentos seleccionados en borradores enlazados | Corregir o descartar lo que no sirve | Pendiente |
| 6 | Revisión de resultados | Recoger métricas disponibles, comparar formatos/antigüedad y sugerir un experimento | Elegir qué probar la próxima semana | Parcial: ya existe recogida de métricas; el análisis asistido sigue pendiente |

La nueva sincronización comprueba cada diez minutos si corresponde consultar YouTube; mantiene el límite de tres horas desde el último éxito. No funciona con la app cerrada y no equivale a métricas en directo. Se han quitado los remontajes de interfaz que podían descartar borradores al recibir datos nuevos.

## Stream Deck, OBS y app

Stream Deck será el acceso rápido a las acciones deliberadas. OBS aportará los hechos técnicos: emitir, grabar, guardar un replay, cambiar de estado. La app relacionará sesión, juego, proyecto, marca y archivo. No conviene obligarte a pulsar un botón para registrar algo que OBS ya puede notificar.

Primera propuesta de acciones, compatible con los contadores existentes:

- Preparar directo: abrir las herramientas configuradas y mostrar comprobaciones pendientes.
- Marcar momento: guardar una marca, sin robar el foco ni interrumpir el juego.
- Guardar clip: solicitar el Replay Buffer y asociar el archivo confirmado; si no está disponible, conservar la marca e informar del motivo.
- Guardar idea: captura breve ligada a la sesión, sin crear proyectos duplicados.
- Objetivo actual: elegir entre objetivos preparados; no decidir por ti qué jugar.
- Revisar sesión: acceder al resumen y momentos al terminar.

OBS requiere configuración local y sus credenciales se guardarían en el almacén del sistema. Su estado técnico no demuestra que el sonido sea correcto para quien escucha: la primera comprobación de audio seguirá necesitando escucha. La documentación y capacidades verificadas de OBS/Twitch están enlazadas en RECOMENDACIONES.md. La plataforma principal de emisión aún está por confirmar; la primera conexión se puede diseñar alrededor de OBS sin asumir YouTube o Twitch.

## Manager de IA

Primera versión orientada a tres resultados: «qué hago hoy», «preparar este directo» y «convertir esta idea o marca en contenido». Su contexto procederá de preferencias que puedas editar, ideas, proyectos, calendario, datos de publicaciones y sesiones seleccionadas.

La app organizará y ejecutará las acciones sobre sus datos. La IA propondrá contenido y prioridades; no sustituirá SQLite ni inventará resultados de plataformas. Las ideas generadas quedarán como borradores identificados como propuestas, sin aprobarse ni publicarse por sí solas.

Antes de activar llamadas reales hay que elegir modelo local o API, definir qué contexto puede enviarse y, para API, un límite de consumo. Hasta entonces no hay llamadas de pago ni IA implementada. No se presupone que la suscripción de ChatGPT cubra una API. Voz, escucha continua, transcripción y análisis de vídeo son decisiones posteriores; no se activan implícitamente.

## Reglas de funcionamiento

- Una configuración inicial para lo repetitivo y controles rápidos para las decisiones del directo.
- Acciones repetidas no crean sesiones, clips o proyectos duplicados.
- Los fallos conservan marcas y borradores, muestran qué quedó pendiente y permiten reintentar.
- Sin cambios automáticos de pantalla por la IA ni tareas pesadas de vídeo durante la emisión.
- Publicar, borrar material, gastar dinero o iniciar/detener la emisión requiere una acción explícita. No supone aprobar cada consulta de métricas ni cada guardado rutinario.
- Respetar los datos y credenciales separados de pruebas. Entregar solo tras validación en Windows; el ZIP de código no es un instalador.

## Criterios para comprobar utilidad

En sesiones reales, observar tiempo de preparación, facilidad para encontrar momentos y proporción de momentos elegidos que llegan a una adaptación publicada. Cada automatización debe reducir una tarea concreta. Si pide más pasos de los que elimina, se simplifica o se descarta.
