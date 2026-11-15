# Recuperar una jugada con MOMENTO

Juegas normalmente. Cuando ocurre algo bueno, pulsas MOMENTO.

Al preparar el Short de una marca normal, Nexus recupera 30 segundos anteriores al botón y 5 posteriores, si están en la grabación. Por ejemplo: una marca en 01:10 produce un Short de 00:40 a 01:15.

«Ver cómo empieza» muestra el primer fotograma de ese mismo tramo. La vista previa anterior usaba el fotograma de la marca y podía hacer creer que se perdía la jugada previa. Ahora resumen, vista previa y exportación comparten el cálculo del tramo.

La pantalla básica muestra el tiempo anterior que se recuperará y «Guardar Short». El formato, el audio y NVIDIA quedan dentro de «Opciones de imagen y audio». Las capturas automáticas respetan su ventana configurada; los clips de Replay Buffer sin marca interna se conservan completos.

Si la grabación empezó hace poco y solo existen 5 segundos anteriores al botón, Nexus lo avisa y conserva esos 5 segundos. Si la marca no tiene un archivo asociado, no muestra opciones de recorte que no puede utilizar. Los demás vídeos se conservan.

Verificación: prueba real con FFmpeg y una marca en el segundo 70; se comprueba que tanto la imagen previa como el vídeo exportado empiezan en el segundo 40 y que el resultado dura 35 segundos. Pruebas adicionales cubren falta de vídeo anterior y marcas fuera del archivo. Las pruebas de interfaz usan servicios simulados.
