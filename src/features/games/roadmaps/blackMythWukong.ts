import type { Roadmap } from "./types";

/**
 * Ruta al platino sugerida para Black Myth: Wukong (PS5, 36 trofeos).
 * Redactada para TrophyHunter a partir de datos públicos; no copia el texto de ninguna guía.
 * La correspondencia es por psn_trophy_id (orden de la lista de PSN), verificada nombre a nombre.
 */
export const blackMythWukong: Roadmap = {
  npCommunicationId: "NPWR34992_00",
  sources: [{ label: "PowerPyx: guía de trofeos y roadmap", url: "https://www.powerpyx.com/black-myth-wukong-trophy-guide-roadmap/" }],
  phases: [
    {
      name: "Capítulo 1",
      note: "Habla con el Viejo y con el Caballo en todas sus apariciones antes de avanzar. Derrota al Espectro Errante antes que al Anciano Jinchi para no perder su espíritu.",
      trophies: [1, 2, 3, 7, 8],
    },
    { name: "Capítulo 2", note: "Mata al Rey de las Arenas Movedizas antes de buscar el espíritu del Segundo Príncipe Rata.", trophies: [4, 9, 10] },
    {
      name: "Capítulo 3",
      note: "En la aldea del Zodiaco: cosecha semillas y mejora una pieza de armadura. Vence a los Guardianes de Linterna antes que al Capitán Voz Sabia (curiosidad perdible).",
      trophies: [5, 6, 11],
    },
    {
      name: "Capítulo 4",
      note: "Rompe los brazos del Daoísta del Veneno antes de matarlo (pieza de armadura perdible). Derrota al Señor Escorpión antes que a Velo Crepuscular. El diario de Daoísta Mi y del Inmortal Grulla es perdible.",
      trophies: [12, 13],
    },
    { name: "Capítulo 5", note: "Consigue la Calabaza Suprema. Tras este capítulo, tira de la cuerda del carro (misión del Caballo).", trophies: [14, 15] },
    {
      name: "Capítulo 6 y jefe final",
      note: "Al vencer al jefe final elige «Continuar el viaje», NO «Entrar en un nuevo ciclo»: el NG+ sobrescribe la partida.",
      trophies: [17],
    },
    {
      name: "Limpieza al 100 %",
      note: "Tras el jefe final puedes volver a todos los capítulos: jefes que falten, diario completo, misiones, áreas secretas, final secreto y coleccionables.",
      trophies: [16, 18, 19, 20, 21, 23, 24, 26, 27, 28, 31, 32, 33, 34, 35],
    },
    {
      name: "NG+ (Nuevo ciclo)",
      note: "Empieza el nuevo ciclo solo cuando hayas terminado la limpieza. Aquí se crean el resto de armas y armaduras y saltan los trofeos exclusivos de NG+.",
      trophies: [22, 25, 29, 30],
    },
    { name: "Platino", note: "Salta solo al conseguir los otros 35.", trophies: [0] },
  ],
  trophies: {
    1: { note: "Historia: tras el jefe del prólogo." },
    2: { note: "Compra tu primera habilidad." },
    3: { note: "Cap. 1: con el Mono Shen, añade una infusión a tu bebida." },
    4: { note: "Cap. 2: tras el jefe rana, fabrica cualquier medicina." },
    5: { note: "Cap. 3, aldea del Zodiaco: cosecha semillas con Chen Loong." },
    6: { note: "Cap. 3, aldea del Zodiaco: mejora una pieza de armadura." },
    7: { note: "Jefe final del capítulo 1." },
    8: { note: "Jefe secreto del capítulo 1: el Anciano Jinchi." },
    9: { note: "Jefe final del capítulo 2: el Sabio del Viento Amarillo." },
    10: { note: "Jefe secreto del capítulo 2: Fuban." },
    11: { note: "Jefe final del capítulo 3 (Ceja Amarilla), segundo enfrentamiento." },
    12: { note: "Jefe final del capítulo 4: el Maestro Daoísta de los Cien Ojos." },
    13: { note: "Jefe secreto del capítulo 4: Velo Crepuscular." },
    14: { note: "Jefe final del capítulo 5: el Rey Yaksha." },
    15: { note: "Jefe secreto del capítulo 5: la Bestia de Ojos Dorados Bishui." },
    16: { note: "Final secreto. Requiere completar los pasos previos en todos los capítulos (por verificar el detalle en la guía)." },
    17: { note: "Jefe final del capítulo 6." },
    18: { note: "Derrota a los 6 jefes rana (uno por capítulo)." },
    19: { note: "Derrota a los 4 dragones (Loong) ocultos." },
    20: { missable: true, note: "PERDIBLE: agota el diálogo del Viejo en cada capítulo antes de avanzar y consigue la Calabaza Suprema (cap. 5)." },
    21: { missable: true, note: "PERDIBLE: agota el diálogo del Caballo en los capítulos 1–5 antes de avanzar; tras el cap. 5, tira de la cuerda del carro." },
    22: { note: "Solo NG+: salta al empezar el nuevo ciclo con las 6 reliquias." },
    23: { missable: true, note: "El más difícil: diario al 100 % (un enemigo de cada tipo y todos los jefes). PERDIBLES: Murciélago Apramana (cap. 3), Daoísta Mi e Inmortal Grulla (cap. 4)." },
    24: { note: "Consigue los 4 recipientes (capítulos 1–6)." },
    25: { note: "Solo NG+: salta al empezar el nuevo ciclo con todos los hechizos." },
    26: { note: "Relacionado con el equipamiento (por verificar el requisito exacto en la guía)." },
    27: { missable: true, note: "Todas las curiosidades (cap. 1–6). PERDIBLE: los Guardianes de Linterna del cap. 3 antes del Capitán Voz Sabia." },
    28: { note: "Recoge 5 de cada píldora celestial (algunas cuentan en NG+)." },
    29: { note: "Todas las armas; la mayoría se fabrican en NG+." },
    30: { missable: true, note: "Todas las armaduras, sobre todo en NG+. PERDIBLE: el brazal del Daoísta del Veneno (cap. 4) solo cae si le rompes los brazos." },
    31: { missable: true, note: "Todos los espíritus y transformaciones. PERDIBLES: Espectro Errante (cap. 1), Segundo Príncipe Rata (cap. 2) y Daoísta Mi (cap. 4)." },
    32: { missable: true, note: "Todas las calabazas, bebidas e infusiones (una infusión es solo de NG+). PERDIBLE: el Señor Escorpión (cap. 4) antes que Velo Crepuscular." },
    33: { note: "Todas las fórmulas de medicina (una es solo de NG+)." },
    34: { note: "Todas las semillas (capítulos 1–6)." },
    35: { note: "Todos los puntos de meditación (capítulos 1–6)." },
  },
};
