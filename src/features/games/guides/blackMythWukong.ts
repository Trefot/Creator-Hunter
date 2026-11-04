import type { GuideDrafts } from "./types";

const SOURCE = "https://www.powerpyx.com/black-myth-wukong-trophy-guide-roadmap/";

/** Texto común de los jefes: lo comprobado es dónde está y qué trofeo da; la estrategia la pone el usuario. */
const BOSS_BODY =
  "Estrategia: por verificar. Anota aquí lo que te funcione (ataques peligrosos, huecos para golpear, hechizos y transformaciones útiles, build) y enlaza tu clip del combate.";

/**
 * Borradores iniciales de la guía de Black Myth: Wukong, redactados para TrophyHunter.
 * Solo incluyen datos comprobados (capítulo, si es secreto y el trofeo) o datos del propio usuario;
 * las estrategias quedan "por verificar" en lugar de inventarlas.
 */
export const blackMythWukongGuide: GuideDrafts = {
  npCommunicationId: "NPWR34992_00",
  entries: [
    {
      kind: "tip",
      title: "Antes del jefe final: «Continuar el viaje»",
      phase: "Capítulo 6 y jefe final",
      summary: "Al vencer al jefe final, NO elijas «Entrar en un nuevo ciclo».",
      body: "Elige «Continuar el viaje» para seguir con la partida y hacer la limpieza al 100 % (jefes pendientes, diario, coleccionables y final secreto). El nuevo ciclo (NG+) sobrescribe la partida actual: empiézalo solo cuando hayas terminado todo lo demás.",
      trophies: [17],
      source_url: SOURCE,
      verified: true,
    },
    {
      kind: "farm",
      title: "Estanque del Jade Quebrado (XP)",
      phase: "Capítulo 4",
      summary: "Capítulo 4: capullos con Letargo Ceniciento junto al santuario. Unos 51 s por vuelta.",
      body: "Tu punto de farmeo de experiencia (proyecto TrefotWukong). Ruta: desde el santuario del Estanque del Jade Quebrado, recorre los capullos y usa el hechizo de regreso para volver al santuario; repite. Automatizado con TrefotWukong (chiaki-ng): unos 51 s por vuelta, 5 de 5 vueltas sin fallos.",
      verified: true,
    },
    {
      kind: "build",
      title: "Tu build de farmeo",
      summary: "Completa con tu equipo real: bastón, armadura, hechizos y transformación.",
      body: "Anota aquí la build que usas para farmear (pieza a pieza) y por qué funciona. Así la tendrás a mano en cada nuevo ciclo.",
      verified: false,
    },
    { kind: "boss", title: "Jefe final del capítulo 1", phase: "Capítulo 1", summary: "Obligatorio. Cierra el capítulo 1.", body: BOSS_BODY, trophies: [7], source_url: SOURCE, verified: false },
    { kind: "boss", title: "Anciano Jinchi (secreto)", phase: "Capítulo 1", summary: "Jefe secreto del capítulo 1.", body: BOSS_BODY, trophies: [8], source_url: SOURCE, verified: false },
    { kind: "boss", title: "Sabio del Viento Amarillo", phase: "Capítulo 2", summary: "Obligatorio. Jefe final del capítulo 2.", body: BOSS_BODY, trophies: [9], source_url: SOURCE, verified: false },
    { kind: "boss", title: "Fuban (secreto)", phase: "Capítulo 2", summary: "Jefe secreto del capítulo 2.", body: BOSS_BODY, trophies: [10], source_url: SOURCE, verified: false },
    { kind: "boss", title: "Ceja Amarilla", phase: "Capítulo 3", summary: "Obligatorio. Jefe final del capítulo 3 (el trofeo salta en el segundo enfrentamiento).", body: BOSS_BODY, trophies: [11], source_url: SOURCE, verified: false },
    { kind: "boss", title: "Maestro Daoísta de los Cien Ojos", phase: "Capítulo 4", summary: "Obligatorio. Jefe final del capítulo 4.", body: BOSS_BODY, trophies: [12], source_url: SOURCE, verified: false },
    { kind: "boss", title: "Velo Crepuscular (secreto)", phase: "Capítulo 4", summary: "Jefe secreto del capítulo 4. Vence antes al Señor Escorpión (perdible).", body: BOSS_BODY, trophies: [13, 32], source_url: SOURCE, verified: false },
    { kind: "boss", title: "Rey Yaksha", phase: "Capítulo 5", summary: "Obligatorio. Jefe final del capítulo 5.", body: BOSS_BODY, trophies: [14], source_url: SOURCE, verified: false },
    { kind: "boss", title: "Bestia de Ojos Dorados Bishui (secreto)", phase: "Capítulo 5", summary: "Jefe secreto del capítulo 5.", body: BOSS_BODY, trophies: [15], source_url: SOURCE, verified: false },
    { kind: "boss", title: "Jefe final del capítulo 6", phase: "Capítulo 6 y jefe final", summary: "Obligatorio. Después elige «Continuar el viaje».", body: BOSS_BODY, trophies: [17], source_url: SOURCE, verified: false },
    { kind: "boss", title: "Los 6 jefes rana", phase: "Limpieza al 100 %", summary: "Uno por capítulo. Lleva aquí la cuenta de cuáles te faltan.", body: BOSS_BODY, trophies: [18], source_url: SOURCE, verified: false },
    { kind: "boss", title: "Los 4 dragones (Loong) ocultos", phase: "Limpieza al 100 %", summary: "Jefes opcionales escondidos.", body: BOSS_BODY, trophies: [19], source_url: SOURCE, verified: false },
    {
      kind: "route",
      title: "Final secreto",
      phase: "Limpieza al 100 %",
      summary: "Pasos repartidos por varios capítulos.",
      body: "Ruta: por verificar. Apunta aquí cada paso según lo completes y dónde está.",
      trophies: [16],
      source_url: SOURCE,
      verified: false,
    },
  ],
};
