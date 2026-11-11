# Propuestas para el uso personal de TrophyHunter

Investigación: 2026-11-11. Son propuestas, no funciones implementadas. Se basan en el código actual, la documentación oficial enlazada y una hipótesis que habrá que contrastar con el uso real: preparar → emitir → rescatar contenido → revisar debería ser un ciclo breve dentro de la misma app.

No se ha accedido a las métricas privadas del canal. No se promete crecimiento de audiencia ni se atribuyen resultados a funciones que todavía no existen.

## Prioridades

| Orden | Mejora | Para qué te sirve | Primera versión y esfuerzo relativo |
|---|---|---|---|
| 1 | Inicio «Hoy» para contenido | Abrir la app y saber qué hacer sin recorrer módulos | Hasta tres acciones elegidas por ti, próximo directo, pendientes del calendario y siguiente paso de proyectos; pequeño/medio. No sustituye el plan manual de trofeos. |
| 2 | Preparación del directo | Evitar empezar con algo importante sin comprobar | Lista reutilizable: objetivo, título, categoría, micrófono/Wave Link, grabación, overlay y una pregunta para el chat; pequeño. Al principio, comprobaciones manuales. |
| 3 | Botón «Marcar momento» en Stream Deck | Encontrar después una jugada, reacción o explicación útil | Marca local con hora y desplazamiento respecto al inicio elegido del directo, tipo y nota; medio. Sin OBS no debe presentar ese desplazamiento como tiempo exacto de la grabación. |
| 4 | Cierre del directo en dos minutos | Convertir lo ocurrido en material para publicar | Revisar marcas, elegir una o dos y enlazarlas con ideas/proyectos existentes; una nota de qué repetir y qué mejorar; medio. |
| 5 | Bandeja de clips por preparar | Evitar perder buenos momentos en una lista enorme de ideas | Estados «revisar → editar → listo → publicado» derivados de los pasos existentes, enlace al archivo original y adaptación vertical; medio. No duplicar ideas ni proyectos. |
| 6 | Revisión semanal de diez minutos | Elegir una mejora concreta para la próxima semana | Resumen de publicaciones, clips pendientes y una comparación justa entre formatos/antigüedad; pequeño/medio. |
| 7 | Conexión local con OBS | Automatizar lo que hoy habría que recordar o anotar | Primero lectura de emisión/grabación, duración, estado y guardado del Replay Buffer; medio/alto. Cambios de escena o iniciar emisiones, solo mediante una acción explícita. |
| 8 | Análisis accionable de YouTube | Entender qué merece repetirse, no solo acumular vistas | Revisiones de vídeos a edades comparables, duración media y notas sobre el gancho; medio. Validar consulta/API por métrica y usar entrada manual o enlace a Studio cuando no esté disponible. |
| 9 | Captura rápida de ideas y preguntas | Guardar una idea sin abandonar el directo o el editor | Acción corta que añada a Ideas con juego/proyecto y marca temporal opcional; pequeño/medio. Un atajo global requeriría estudiar integración adicional. |
| 10 | Objetivos en el overlay | Dar contexto a quien llega al directo | Objetivo actual elegido por ti y progreso del juego ya guardado; medio. Mostrar cuándo se actualizó y conservar datos si PSN falla. |

El esfuerzo es relativo, no una estimación de días. El orden busca utilidad observable antes de automatización compleja. Un bot, IA para detectar jugadas y conexión a muchas redes quedan por detrás de este ciclo básico.

## Directos: rescatar momentos sin distraerte

OBS permite iniciar, detener y guardar su Replay Buffer mediante atajos. Su WebSocket está integrado desde OBS 28. La app podría utilizar `GetStreamStatus`, `GetRecordStatus`, `GetReplayBufferStatus`, `SaveReplayBuffer` y el evento de guardado para relacionar una marca con un archivo real. Hace falta configurar y activar el buffer; no puede recuperar una grabación que nunca existió.

Fuentes: [guía de OBS](https://obsproject.com/kb/obs-studio-overview), [control remoto](https://obsproject.com/kb/remote-control-guide), [protocolo oficial](https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md).

La versión inicial útil no necesita esta conexión: un botón de Stream Deck puede guardar una marca local y enseñarla en el cierre. Posteriormente se le añade el clip real. El botón no debería cambiar contadores ni detener tu emisión.

Twitch ofrece marcadores oficiales, pero requieren emisión en directo, almacenamiento de VOD habilitado y autorización `channel:manage:broadcast`. Son una ampliación posible si emites allí; no un requisito para trabajar con YouTube o grabaciones locales. Fuente: [marcadores de Twitch](https://dev.twitch.tv/docs/api/markers/).

## Contenido: convertir la revisión en una decisión

YouTube distingue métricas de directo y de archivo posterior. Para tus sesiones, sería útil guardar objetivo, duración, espectadores medios/pico cuando estén disponibles y momentos elegidos. Conviene conservar la procedencia y fecha de cada valor, porque las cifras de Live Control Room y Analytics pueden diferir después del procesamiento. Fuente: [métricas de directos](https://support.google.com/youtube/answer/2853833).

Para vídeos editados, propondría que cada revisión termine con una nota: «qué cambio en el siguiente». YouTube explica cómo interpretar el inicio, los picos y las caídas de retención, pero los picos también pueden indicar que una explicación fue confusa. No deben convertirse automáticamente en «este es el mejor momento». La retención suele tardar uno o dos días y algunos resaltados necesitan volumen suficiente. Fuente: [retención de audiencia](https://support.google.com/youtube/answer/9314415).

La API documenta `averageViewDuration` y `averageViewPercentage`, con restricciones según el informe. No todas las pantallas de Studio pueden reproducirse mediante el conector actual. Para datos todavía no integrados, comenzar con un enlace al vídeo en Studio y una nota manual es preferible a inventar cifras. Fuentes: [métricas de Analytics](https://developers.google.com/youtube/analytics/metrics), [informes de canal](https://developers.google.com/youtube/analytics/channel_reports).

Compararía vídeos largos con vídeos largos, Shorts con Shorts y directos con directos, usando ventanas similares desde la publicación. No usaría un ranking único de vistas ni un contador de seguidores como única medida de progreso.

## Hábito: que abrirla te quite trabajo

Propuesta de rutina, para probar y ajustar:

- Antes de abrir OBS: abrir «Hoy», elegir el objetivo del directo y completar una preparación de unos dos minutos.
- Durante el directo: usar únicamente el botón de marcar momentos y los controles que ya necesitas. La app no debe pedir formularios ni robar el foco.
- Después de cerrar OBS: elegir un momento, dejar una idea de contenido y anotar el siguiente paso. Si no hubo nada aprovechable, cerrar la sesión también cuenta como revisión.
- Una vez por semana: revisar qué se publicó, qué quedó bloqueado y elegir una sola mejora para la siguiente semana.

Son duraciones de diseño, no resultados garantizados. La evidencia de formación de hábitos apoya la repetición en un contexto estable y muestra variación entre personas; faltar una vez no implica perder el proceso. Ese estudio no evaluó esta aplicación ni creadores de contenido: usar «antes/después de OBS» como señal es una propuesta nuestra. Fuente: [Lally y colaboradores, formación de hábitos](https://onlinelibrary.wiley.com/doi/abs/10.1002/ejsp.674).

No pondría una racha que se pierde al faltar un día. Mostraría «última revisión», «siguiente acción» y un resumen semanal sencillo, sin medir éxito por minutos dentro de la app. Recordatorios discretos y configurables solo si los necesitas; ninguna notificación encima de un directo.

## Cómo decidir si funciona

Probar primero «Hoy + preparación + marcas + cierre» durante dos semanas de uso real, sin desarrollar todos los módulos a la vez. Anotar una línea al terminar cada sesión:

- ¿Se completó la preparación o se olvidó algo importante?
- ¿Las marcas facilitaron encontrar material?
- ¿Cuántos momentos elegidos acabaron en una adaptación publicada?
- ¿Cuánto trabajo manual añadió o quitó la app?
- ¿Se completó el cierre y quedó claro el siguiente paso?

El objetivo inicial es ahorrar trabajo y dar continuidad al contenido. La audiencia y la retención son señales posteriores, no una prueba automática de que una función causó crecimiento.
