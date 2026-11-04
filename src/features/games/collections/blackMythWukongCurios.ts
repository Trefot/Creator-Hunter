import type { CollectionItem, TrophyCollection } from "./types";

const PPX_CURIOS = "https://www.powerpyx.com/black-myth-wukong-all-curios-locations/";
const GAMERANX_DROPS = "https://gameranx.com/features/id/507067/article/black-myth-wukong-how-to-get-more-item-drops-from-enemies";

/** Una curiosidad (los nombres en español son traducción nuestra; entre paréntesis, el inglés del juego). */
const c = (
  n: number,
  name: string,
  nameEn: string,
  chapter: number,
  where: string,
  source: CollectionItem["source"],
  how: string,
  extra: Partial<CollectionItem> = {},
): CollectionItem => ({ key: `curio-${n}`, name, nameEn, chapter, where, source, how, verified: true, ...extra });

const RANDOM = "Aleatorio: repite con la build de botín.";

/** Las 36 curiosidades del trofeo «Una rara colección» (la n.º 37, de DLC, no cuenta). */
export const blackMythWukongCurios: TrophyCollection = {
  trophy: 27,
  title: "Las 36 curiosidades",
  steps: [
    "Recoge las fijas mientras avanzas: cofres, jefes y misiones (28 de 36).",
    "Las 8 aleatorias caen de enemigos concretos: farméalas al final con la build de botín (casco Cráneo del Tesoro Tortuga + la curiosidad Carpa Dorada).",
    "Ojo con las 2 perdibles: Cuentas de Ojo de Gato (cap. 1) y Linterna Auspiciosa (cap. 3). Si se te pasaron, quedan para NG+.",
    "El trofeo salta al tener las 36.",
  ],
  items: [
    c(1, "Cuentas de Ojo de Gato", "Cat Eye Beads", 1, "Bosque de los Lobos › Colinas delanteras", "fixed", "La suelta el Espectro Errante.", {
      missable: "Véncelo antes que al Anciano Jinchi; si no, queda para NG+.",
    }),
    c(2, "Jarra de Ágata", "Agate Jar", 1, "Cueva del Viento Negro › interior", "fixed", "Cofre a la izquierda de la arena del Rey del Viento Negro."),
    c(3, "Rascador de Espalda", "Back Scratcher", 1, "Cualquier santuario del cap. 1", "fixed", "Se compra en los santuarios del cap. 1 tras terminar el cap. 2."),
    c(4, "Incensario de Boshan", "Boshan Censer", 1, "Bosque de los Lobos › Fuera del bosque", "fixed", "Lo suelta el Loong Rojo (necesitas las Escamas de Loong).", { doneWithTrophy: 19 }),
    c(5, "Relicario Vidriado", "Glazed Reliquary", 2, "Formación del Viento Amarillo › Aldea del Descanso del Viento", "fixed", "Cofre detrás del Acólito del Tigre."),
    c(6, "Horquilla de Flor Dorada", "Goldflora Hairpin", 2, "Risco del Espanto › Escondite de la Borrasca", "fixed", "Tienda de un PNJ por 12.800 de Voluntad, tras la misión del Hombre de Piedra."),
    c(7, "Colgante de Tridacna", "Tricadna Pendant", 2, "Risco del Espanto › Llanura del Descanso", "fixed", "Lo suelta el Loong Negro (necesitas las Escamas de Loong).", { doneWithTrophy: 19 }),
    c(8, "Insignia del Tigre", "Tiger Tally", 2, "Reino de Sahi (área secreta del cap. 2)", "fixed", "La suelta la Vanguardia Tigre del área secreta; necesitas la misión del Jabalí Borracho."),
    c(9, "Cuenta Mani", "Mani Bead", 3, "Sendero de la Colina Nevada › Lago Espejo", "enemy", `La sueltan los Cadáveres Congelados. ${RANDOM}`),
    c(10, "Linterna Auspiciosa", "Auspicious Lantern", 3, "Reino de la Pagoda (prisión)", "fixed", "Recompensa por vencer a los 9 Guardianes de Linterna.", {
      missable: "Hazlo antes del Capitán Voz Sabia; si no, solo en NG+.",
    }),
    c(11, "Cuenco de Porcelana Fina", "Fine China Tea Bowl", 3, "Reino de la Pagoda › Pagoda inferior", "fixed", "Cofre al final del pasillo de la prisión, en el nivel de abajo."),
    c(12, "Ramita de Brote Helado", "Frostsprout Twig", 3, "Reino de la Pagoda › Pagoda superior", "fixed", "La suelta el Capitán Visión de Loto, jefe oculto enfrente del santuario."),
    c(13, "Orbe de Maitreya", "Maitreya's Orb", 3, "Valle del Éxtasis › Acantilado de la Atención", "fixed", "Cofre (desde el parche 1.0.8; antes caía de No-Capaz en el Arroyo de la Dicha)."),
    c(14, "Placa de Púas Dorada", "Gold Spikeplate", 3, "Valle del Éxtasis › Camino de la Longevidad", "fixed", "Botín seguro del gigante de la esquina."),
    c(15, "Colgante de Buda de Bronce", "Bronze Buddha Pendant", 3, "Valle del Éxtasis › Bosque de la Felicidad", "enemy", `Lo sueltan los Guardianes Lobo. ${RANDOM}`),
    c(16, "Pincel de Zorro Nival", "Snow Fox Brush", 3, "Capítulo 3", "fixed", "Recompensa de la misión del Zorro."),
    c(17, "Buda Bestia", "Beast Buddha", 3, "Valle del Éxtasis › Torres del Karma", "enemy", `Lo sueltan los Monjes de Doble Hoja. Probabilidad muy baja: imprescindible la build de botín.`),
    c(18, "Sello de Trueno y Llama", "Thunderflame Seal", 3, "Nuevo Templo del Trueno › entrada", "enemy", `Lo suelta el Maestro Rinoceronte del Trueno. ${RANDOM}`),
    c(19, "Piedra del Trueno", "Thunderstone", 3, "Nuevo Templo del Trueno › entrada", "fixed", "Cofre dentro del edificio del templo."),
    c(20, "Hebilla de Cinturón Cuo Jin-Yin", "Cuo Jin-Yin Belt Hook", 4, "Hondonada de las Telarañas › Hondonada superior", "fixed", "Cofre dorado grande al final del camino, pasado el santuario."),
    c(21, "Espina en el Saco", "Spine in the Sack", 4, "Hondonada de las Telarañas", "random", "Aleatorio: rompe los capullos de araña del suelo. Puede salir repetida."),
    c(22, "Carpa Dorada", "Golden Carp", 4, "Hondonada de las Telarañas › Alivio del Loong Caído", "fixed", "La suelta el Loong Amarillo (tras los otros tres). Es media build de botín: consíguela pronto.", { doneWithTrophy: 19 }),
    c(23, "Conejo Lunar de Jade", "Jade Moon Rabbit", 4, "Hondonada de las Telarañas › Choza de la Inmortalidad", "fixed", "Lo suelta Zhu Bajie al vencerlo dos veces seguidas (historia).", { doneWithTrophy: 12 }),
    c(24, "Grabado de Bambú Virtuoso", "Virtuous Bamboo Engraving", 4, "Templo de las Flores Amarillas › entrada", "enemy", `Lo sueltan los Practicantes Gusano. ${RANDOM}`),
    c(25, "Tablilla de los Tres Supremos", "Tablet of the Three Supreme", 4, "Templo de las Flores Amarillas › Bosque de la Ferocidad", "fixed", "Contenedor detrás del jefe Comandante Escarabajo."),
    c(26, "Cinturón de Tendón de Tigre", "Tiger Tendon Belt", 4, "Templo de las Flores Amarillas › Patio de la Iluminación", "enemy", `Lo suelta el Sheriff Serpiente del estanque. ${RANDOM}`),
    c(27, "Cuervo Solar Dorado", "Gold Sun Crow", 4, "Montaña de la Nube Púrpura (secreta) › Valle de las Flores", "fixed", "Cofre de madera pasado el enemigo árbol y el tronco roto."),
    c(28, "Tablilla del Registro Celestial", "Celestial Registry Tablet", 4, "Montaña de la Nube Púrpura (secreta) › Aldea de los Pétalos", "fixed", "Contenedor en el cenador, a la derecha del santuario."),
    c(29, "Orbe de Preservación", "Preservation Orb", 4, "Templo de las Flores Amarillas › Patio de la Iluminación", "fixed", "Contenedor en el jardín junto a las estatuas, pasada la arena del Daoísta del Veneno."),
    c(30, "Cuentas de Oración de Ámbar", "Amber Prayer Beads", 5, "Bosque de Brasas › Cima de las Brasas", "fixed", "Contenedor dorado tras el Padre de las Piedras (jefe obligatorio)."),
    c(31, "Cadena de Conchas Blancas", "White Seashell Waist Chain", 5, "Valle del Horno › Palacio Rakshasa", "enemy", `La suelta el enemigo de dos mazas detrás de la lava. ${RANDOM}`),
    c(32, "Botón Dorado", "Gold Button", 5, "Valle del Horno › Palacio Rakshasa", "fixed", "Vence a los dos gigantes con escudo del piso de arriba."),
    c(33, "Orbe de Llama", "Flame Orb", 5, "Campo de Fuego › Pendiente Fresca", "fixed", "Lo suelta el Carro de Oro Oxidado, el último de la misión de los Cinco Carros Elementales."),
    c(34, "Cesta Daoísta de Fuego y Agua", "Daoist's Basket of Fire and Water", 5, "Cueva Bishui › Pasillo de Fuego y Hielo", "fixed", "Recompensa por vencer a la Bestia de Ojos Dorados Bishui.", { doneWithTrophy: 15 }),
    c(35, "Orbe Guardaaguas", "Waterward Orb", 6, "Faldas › Camino Verde", "fixed", "Lo suelta el Jiao Loong de las Olas: aparece en el lago cuando ya puedes volar en la nube."),
    c(36, "Fragmento de Piedra Natal Celestial", "Celestial Birthstone Fragment", 6, "Faldas › Camino Verde", "fixed", "Lo suelta Lang-Baw-Baw, en la esquina trasera derecha del lago, cuando ya puedes volar."),
  ],
  farmBuild: {
    summary: "Para las 8 aleatorias: dos piezas que suben la probabilidad de botín de los enemigos. Sus efectos se suman.",
    pieces: [
      {
        slot: "Casco",
        name: "Cráneo del Tesoro Tortuga",
        nameEn: "Skull of Turtle Treasure",
        effect: "Sube moderadamente la probabilidad de botín de los enemigos.",
        howToGet: "Cap. 3: cae (con poca probabilidad) de los enemigos grandes con maza y máscara de calavera, cerca del santuario del Camino de la Longevidad.",
      },
      {
        slot: "Curiosidad",
        name: "Carpa Dorada",
        nameEn: "Golden Carp",
        effect: "Sube moderadamente la probabilidad de botín de los enemigos.",
        howToGet: "Cap. 4: la suelta el Loong Amarillo (punto 22 de esta lista).",
      },
    ],
    helpsWith: "Sirve para las 7 que sueltan enemigos. La Espina en el Saco sale de capullos (no de enemigos): ahí no está confirmado que ayude.",
  },
  tips: [
    "Para farmear un enemigo: véncelo, descansa en el santuario más cercano para que reaparezca y repite.",
    "El Buda Bestia es la más difícil por su probabilidad tan baja: déjala para cuando tengas la build completa.",
    "Lo que ya tengas pasa al NG+: allí solo te faltará lo que no conseguiste.",
  ],
  sources: [
    { label: "PowerPyx · todas las curiosidades", url: PPX_CURIOS },
    { label: "Gameranx · cómo conseguir más botín", url: GAMERANX_DROPS },
  ],
};
