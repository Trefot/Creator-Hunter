# Platinos, objetos y overlays · 0.2.15

## Portada de Fortnite

La ficha incluye la imagen pública de presentación de Fortnite como fallback, sin sustituir una portada personal. Recurso original, sin modificar, obtenido del `og:image` de https://www.fortnite.com/ el 2026-11-11: https://cms-assets.unrealengine.com/cm6l5gfpm05kr07my04cqgy2x/cmfo4y74z03yw07ohsjgs0qj7. Sus créditos permanecen en la imagen; pertenece a sus titulares y no es una ilustración creada por Nexus.

## Colección de platinados

En Juegos → Platinados aparecen los juegos con un trofeo de platino obtenido o estado manual «Platino». Se cuentan una sola vez por ficha/plataforma. La fecha de un trofeo tiene prioridad sobre la fecha manual. PSN se actualiza con la sincronización existente; no se inventan logros de Steam, Xbox o Fortnite. Para un registro manual elige juego y fecha opcional. Para corregirlo cambia su estado desde la ficha.

## Overlay de OBS/Twitch

1. Abre Juegos → Overlay y objetos, o Directo y objetos dentro de una ficha.
2. Elige un juego y pulsa Mostrar en el overlay.
3. Para Wukong puedes preparar las listas existentes, empezando por Las 36 curiosidades. Se reutilizan las claves de su guía y el progreso de collection_item. Las indicaciones y fuentes siguen siendo las de las guías existentes; sus nombres españoles pueden diferir del idioma del juego.
4. Para Fortnite puedes preparar «Token de la tienda pirata» como objetivo personal; no se afirma una ubicación ni una API para ese token.
5. Pulsa Mostrar en el objeto elegido. Copia la URL del overlay completo, solo platinos o solo objetivo a una Fuente de navegador de OBS (720×280). Sirve para Twitch u otro destino de OBS sin conexión adicional a Twitch.
6. Copia las URLs Conseguido, Deshacer y Siguiente a acciones Sitio web en segundo plano de Stream Deck. Llevan la clave local; no compartirlas. Repetir Conseguido no incrementa dos veces ni avanza solo al siguiente objeto.

El overlay lee el estado aproximadamente cada segundo. Si Nexus se desconecta conserva el último estado e indica que no está actualizado. No se incluyen credenciales, capturas ni calibraciones en la API pública del overlay. Los objetos confirmados por un trofeo no se pueden desmarcar como si se hubiese revocado ese logro.

## Detección visual experimental, sin IA generativa

Cada referencia representa **un aviso concreto de un objeto**, no todos los objetos del juego. No se lee memoria, no se analiza el inventario oculto y no es OCR.

1. Conecta OBS desde Live Studio. Elige en el overlay el objetivo que quieres detectar.
2. En su fila abre Detección visual → Leer fuentes de OBS y selecciona la captura del juego/capturadora. Es compatible con Wukong capturado desde consola y con Fortnite en PC si el aviso aparece en esa fuente.
3. Con el aviso positivo visible (también puedes usar una grabación pausada como fuente para preparar la prueba), pulsa Capturar aviso de referencia.
4. Arrastra una región sobre el nombre o icono único del objeto. Evita fondos grandes, HUD y mensajes genéricos como «Objeto conseguido». Guarda la referencia: comienza en modo Prueba y no cambia el progreso.
5. Comprueba tanto un aviso positivo como pantallas y objetos distintos. El umbral predeterminado es 0,985 de correlación de luminancia; una región sin contraste se rechaza. Si da coincidencias incorrectas, cambia la región o apágalo.
6. Solo tras probarlo, elige Marcar automáticamente. Se requieren dos lecturas coincidentes y haber observado antes la desaparición de la referencia. Puedes corregir con Deshacer; vuelve a apagar la detección si necesitas revisar un falso positivo.

El motor está en Nexus y toma una captura de OBS al terminar cada ciclo, con unos 1,2 s de espera entre ciclos. No hay consultas visuales si no hay un objetivo pendiente con detección activada. La actividad del juego/OBS puede retrasar capturas; avisos cortos pueden perderse. Cambios de resolución, posición, idioma o animación pueden invalidar la referencia. No se promete reconocimiento universal, precisión total ni funcionamiento con Nexus cerrado. Hay que calibrarlo y medirlo en el equipo del usuario antes de confiar en él durante un directo.

La captura se solicita a 1280×720; se guarda únicamente el recorte elegido como referencia en la base. Las capturas de comparación se procesan en memoria y no se envían a servicios externos. Este motor no activa ni detiene grabaciones, ni pulsa teclas del juego. El botón manual siempre sigue disponible.

## Persistencia y validación

Migración 019: fecha manual de platino en game, game_target y game_overlay. Las 27 tablas están en las copias. El estado de objetos vinculados procede de collection_item, evitando duplicar el progreso de las guías; el marcado/desmarcado comparte transacción y comprueba el objetivo fijado al recibir una detección. El overlay excluye las imágenes de referencia para no cargar capturas en cada consulta.

Las pruebas verifican recuentos sin duplicados, distinción manual/trofeos, controles idempotentes, sincronía con la guía, importación del esquema 18 y referencias visuales vacías/no coincidentes. La detección de avisos reales de Wukong y del token de Fortnite requiere las capturas/calibración del usuario.
