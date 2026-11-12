# Referencia de alertas de Trefot

`alertas-referencia-aprobada.png` es la muestra visual elegida por el usuario: personaje saludando con poses distintas, marco angular violeta/dorado en Twitch, marco rojo/dorado con ondas en YouTube y marco cian/rosa con trazos en TikTok.

El usuario rechazó expresamente la aproximación simplificada publicada en 0.2.17. La corrección utiliza artes completos en `src/assets/alerts/*-approved.png`, preparados desde esta referencia. El texto interior se compone en el renderer para que siga siendo editable. No sustituir estos artes por el icono original del programa ni por bordes CSS genéricos.

Comparar la grabación del renderer real con esta referencia al cambiar la composición. Se conservan las proporciones, placa de plataforma, posición del personaje, jerarquía tipográfica y paleta de cada variante. Los recursos preparados para producción no contienen los textos interiores del montaje original.
