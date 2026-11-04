import type { CollectionItem, TrophyCollection } from "./types";

const PPX_GOURDS = "https://www.powerpyx.com/black-myth-wukong-all-gourd-locations/";
const PPX_DRINKS = "https://www.powerpyx.com/black-myth-wukong-all-drinks-locations/";
const PPX_SOAKS = "https://www.powerpyx.com/black-myth-wukong-all-soaks-locations/";

const GOURDS = "Calabazas (11)";
const DRINKS = "Bebidas (9)";
const SOAKS = "Infusiones (27)";
const SHEN = "Mono Shen (Cap. 1 · Bosque de Bambú › Pantano de la Niebla Blanca)";
const RESPAWN = "Aleatorio al recoger la planta. Si no sale, espera 30 min en otro capítulo para que reaparezca (recargar no sirve).";

/** Un objeto (nombre en español traducido por nosotros; entre paréntesis, el inglés del juego). */
const i = (
  key: string,
  group: string,
  name: string,
  nameEn: string,
  where: string,
  source: CollectionItem["source"],
  how: string,
  extra: Partial<CollectionItem> = {},
): CollectionItem => ({ key, group, name, nameEn, where, source, how, verified: true, ...extra });

/** «Refrescante abundancia»: todas las calabazas, bebidas e infusiones. */
export const blackMythWukongBrews: TrophyCollection = {
  trophy: 32,
  title: "Calabazas, bebidas e infusiones",
  steps: [
    "Visita al Mono Shen al empezar los capítulos 3, 4, 5 y 6: vende varias calabazas, bebidas e infusiones nuevas.",
    "Recoge las fijas mientras avanzas: cofres, jefes y altares.",
    "Las infusiones aleatorias salen de plantas y enemigos: déjalas para la limpieza.",
    "Al llevarle las 15 semillas a Chen Loong te da la Orquídea Grácil.",
    "Dos objetos son solo de NG+ (la Calabaza Qing-Tian y la Hoja de Sauce de Guanyin).",
  ],
  items: [
    // Calabazas
    i("gourd-scarlet", GOURDS, "Calabaza Escarlata del Pionero", "Trailblazer's Scarlet Gourd", "Cap. 1 · cualquier santuario", "fixed", "Bonus de reserva. Sin reserva, te la da el caballo en el Nuevo Templo del Trueno (cap. 3).", {
      missable: "Si no la reservaste, depende del caballo del cap. 3.",
    }),
    i("gourd-old", GOURDS, "Calabaza Vieja", "Old Gourd", "Cap. 1 · inventario inicial", "fixed", "La tienes desde el principio; cambia de nombre al mejorarla con el Mono Shen."),
    i("gourd-plaguebane", GOURDS, "Calabaza Antiplaga", "Plaguebane Gourd", "Cap. 2 · Formación del Viento Amarillo / Aldea de Sandgate", "fixed", "Cofre tras vencer al jefe secreto Tigre Loco (misión del Tambor Viejo)."),
    i("gourd-jade-lotus", GOURDS, "Calabaza de Loto de Jade", "Jade Lotus Gourd", SHEN, "fixed", "Se compra desde el inicio del cap. 3."),
    i("gourd-fiery", GOURDS, "Calabaza Ígnea", "Fiery Gourd", "Cap. 3 · Valle del Éxtasis › Acantilado de la Atención", "fixed", "Cofre de madera pasadas las tablas."),
    i("gourd-xiang-river", GOURDS, "Calabaza de la Diosa del Río Xiang", "Xiang River Goddess Gourd", "Cap. 4 · Hondonada de las Telarañas › Puente Verde", "fixed", "En la sala de los cinco cofres dorados."),
    i("gourd-stained-jade", GOURDS, "Calabaza de Jade Manchado", "Stained Jade Gourd", "Cap. 4 · Montaña de la Nube Púrpura (secreta)", "fixed", "Recompensa por vencer al Señor Escorpión.", {
      missable: "Hay que vencerlo antes que a Velo Crepuscular; si no, queda para NG+.",
    }),
    i("gourd-immortal-blessing", GOURDS, "Calabaza de la Bendición Inmortal", "Immortal Blessing Gourd", SHEN, "fixed", "Se compra (cap. 5, quizá ya en el 4) tras vencer a la Mano Izquierda y la Mano Derecha de Buda.", { verified: false }),
    i("gourd-supreme", GOURDS, "Calabaza Suprema", "Supreme Gourd", "Cap. 5 · Valle del Horno › Palacio Rakshasa", "fixed", "Mejora la calabaza en el fuego de la sala del Viejo. Necesitas antes 9 cargas de curación.", { doneWithTrophy: 20 }),
    i("gourd-multi-glazed", GOURDS, "Calabaza Multividriada", "Multi-Glazed Gourd", SHEN, "fixed", "Se compra desde el inicio del cap. 6."),
    i("gourd-qing-tian", GOURDS, "Calabaza Qing-Tian", "Qing-Tian Gourd", SHEN, "fixed", "Solo en NG+: se compra al Mono Shen (puede que exija el diario completo).", { group: "Nuevo ciclo (NG+)", verified: false }),
    // Bebidas
    i("drink-coconut", DRINKS, "Vino de Coco", "Coconut Wine", "Cap. 1 · inventario inicial", "fixed", "La tienes desde el principio."),
    i("drink-lambbrew", DRINKS, "Brebaje de Cordero", "Lambbrew", "Cap. 2 · Aldea de Sandgate › entrada", "fixed", "En un altar pequeño al final del camino de la colina de la derecha, pasados los arqueros rata."),
    i("drink-bluebridge", DRINKS, "Romance del Puente Azul", "Bluebridge Romance", "Cap. 3 · Lago Amargo › Orilla Norte", "fixed", "Sigue la costa pasado el templo: jarrón dorado en el lago, a la izquierda."),
    i("drink-jade-essence", DRINKS, "Esencia de Jade", "Jade Essence", "Cap. 3 · Valle del Éxtasis › Torres del Karma", "fixed", "En una esquina detrás de un pilar de piedra (puerta del Bosque de la Felicidad y bajada a la izquierda)."),
    i("drink-pinebrew", DRINKS, "Brebaje de Pino", "Pinebrew", SHEN, "fixed", "Se compra desde el inicio del cap. 4."),
    i("drink-worryfree", DRINKS, "Brebaje Sin Penas", "Worryfree Brew", "Cap. 4 · Hondonada de las Telarañas › Puente Verde", "fixed", "Tetera en la casa a la izquierda del altar morado, tras romper los capullos."),
    i("drink-nine-skies", DRINKS, "Ocaso de los Nueve Cielos", "Sunset of the Nine Skies", "Cap. 4 · Templo de las Flores Amarillas › Patio de la Iluminación", "fixed", "Frente a una choza al final del camino de la derecha."),
    i("drink-loong-balm", DRINKS, "Bálsamo de Loong", "Loong Balm", "Cap. 5 · Valle del Horno › Salón Esmeralda", "fixed", "Bebida dorada junto al trono tras vencer al Pez Yin-Yang (historia)."),
    i("drink-thousand-days", DRINKS, "Embriaguez de Mil Días", "A Thousand Days Inebriation", SHEN, "fixed", "Se compra desde el inicio del cap. 6."),
    // Infusiones
    i("soak-gall-gem", SOAKS, "Gema de Bilis", "Gall Gem", "Cap. 1 · Bosque de Bambú › Pantano de la Niebla Blanca", "fixed", "Te la da el Mono Shen tras vencer a la serpiente pasado el santuario."),
    i("soak-tender-jade-lotus", SOAKS, "Loto de Jade Tierno", "Tender Jade Lotus", "Cap. 1 · Cueva del Viento Negro › interior", "random", RESPAWN),
    i("soak-laurel-buds", SOAKS, "Brotes de Laurel", "Laurel Buds", "Cap. 2 · Aldea de Sandgate › entrada", "fixed", "Contenedor vigilado por una rata chamán, a la derecha tras el jefe de la puerta."),
    i("soak-steel-ginseng", SOAKS, "Ginseng de Acero", "Steel Ginseng", "Cap. 2 · Risco del Espanto › Escondite de la Borrasca", "random", RESPAWN),
    i("soak-iron-pellet", SOAKS, "Píldora de Hierro", "Iron Pellet", "Cap. 2 · Risco del Espanto › Escondite de la Borrasca", "fixed", "Se compra al Hombre de Piedra por 6.480 de Voluntad tras su misión."),
    i("soak-tiger-relic", SOAKS, "Reliquia del Tigre", "Tiger Relic", "Cap. 2 · Templo del Tigre Agazapado › entrada", "fixed", "Contenedor escondido: vence a la Vanguardia Tigre y a la de Piedra, baja al sótano, tobogán de arena y ataque fuerte en el aire."),
    i("soak-copper-pill", SOAKS, "Píldora de Cobre", "Copper Pill", "Cap. 2 · Templo del Tigre Agazapado › entrada", "fixed", "Contenedor dorado pequeño en el camino recto tras la Vanguardia Tigre, junto a un escudero y un arquero."),
    i("soak-goat-skull", SOAKS, "Cráneo de Cabra", "Goat Skull", "Cap. 2 · Reino de Sahali (secreto) › Linde de Sandgate", "random", `Planta de regaliz junto a la estatua de dragón rota. ${RESPAWN}`),
    i("soak-celestial-lotus-seeds", SOAKS, "Semillas de Loto Celestial", "Celestial Lotus Seeds", SHEN, "fixed", "Se compra desde el inicio del cap. 3."),
    i("soak-thunderbolt-horn", SOAKS, "Cuerno de Rayo", "Thunderbolt Horn", SHEN, "fixed", "Se compra desde el inicio del cap. 3."),
    i("soak-loong-whisker", SOAKS, "Bigote de Loong Varado", "Stranded Loong's Whisker", "Cap. 3 · Sendero de la Colina Nevada › Lago Espejo", "fixed", "Contenedor dorado en una isla escondida, al fondo a la derecha del lago."),
    i("soak-breath-of-fire", SOAKS, "Aliento de Fuego", "Breath of Fire", "Cap. 3 · Lago Amargo › Isla Tortuga", "fixed", "Lo suelta el Loong Cian (necesitas las Escamas de Loong).", { doneWithTrophy: 19 }),
    i("soak-turtle-tear", SOAKS, "Lágrima de Tortuga", "Turtle Tear", "Cap. 3 · Lago Amargo › Orilla Norte", "fixed", "Vence al Murciélago Apramana, toca el esqueleto y recoge el objeto verde junto a la cabeza de la tortuga."),
    i("soak-sweet-ice", SOAKS, "Hielo Dulce", "Sweet Ice", "Cap. 3 · Nuevo Templo del Trueno › entrada", "fixed", "Contenedor dorado pequeño arriba, sobre la zona del monstruo que escupe fuego."),
    i("soak-goji-shoots", SOAKS, "Brotes de Goji", "Goji Shoots", "Cap. 4 · Hondonada de las Telarañas › Hondonada superior", "fixed", "Contenedor dorado en el último edificio de arriba, en la esquina."),
    i("soak-peach-pit", SOAKS, "Hueso de Melocotón de Vetas Púrpura", "Purple-Veined Peach Pit", "Cap. 4 · Hondonada de las Telarañas › Puente Verde", "fixed", "Uno de los cinco cofres dorados de la sala (tras la escena de la mujer que lanza cuchillos)."),
    i("soak-deathstinger", SOAKS, "Aguijón Mortal", "Deathstinger", "Cap. 4 · Hondonada de las Telarañas › Puente Verde", "enemy", "Aleatorio: lo suelta el escorpión de la entrada de la aldea. Descansa para que reaparezca."),
    i("soak-bee-mountain-stone", SOAKS, "Piedra de la Montaña de las Abejas", "Bee Mountain Stone", "Cap. 4 · Templo de las Flores Amarillas › Sendero de montaña", "fixed", "Contenedor tortuga dorado antes del templo con dos guardias de túnica amarilla."),
    i("soak-fruit-of-dao", SOAKS, "Fruto del Dao", "Fruit of Dao", "Cap. 4 · Templo de las Flores Amarillas › Patio de la Iluminación", "enemy", "Aleatorio: lo sueltan los dos monjes al bajar las escaleras. Descansa para que reaparezcan."),
    i("soak-undying-vine", SOAKS, "Enredadera Imperecedera", "Undying Vine", "Cap. 4 · Montaña de la Nube Púrpura (secreta) › Valle de las Flores", "enemy", "Aleatorio: la sueltan los enemigos Resplandor Verde (árboles). Descansa para que reaparezcan."),
    i("soak-rooster-blood", SOAKS, "Sangre de Gallo de Doble Cresta", "Double-Combed Rooster Blood", "Cap. 4 · Montaña de la Nube Púrpura (secreta)", "fixed", "La suelta Velo Crepuscular al final del camino central.", { doneWithTrophy: 13 }),
    i("soak-lingtai-seedlings", SOAKS, "Plántulas del Monte Lingtai", "Mount Lingtai Seedlings", "Cap. 5 · Bosque de Brasas › Campamento de las Estaciones", "fixed", "Contenedor tortuga dorado en el camino principal, a la derecha."),
    i("soak-beetle-husk", SOAKS, "Caparazón de Escarabajo Dormido", "Slumbering Beetle Husk", "Cap. 5 · Valle del Horno › Salón Esmeralda", "fixed", "Contenedor tortuga dorado a la izquierda tras el Pez Yin-Yang."),
    i("soak-flame-mediator", SOAKS, "Mediador de Llamas", "Flame Mediator", "Cap. 5 · Campo de Fuego", "enemy", "Aleatorio: lo sueltan los enemigos de Fuego Abrasador (también al matarlos con la bola rodante)."),
    i("soak-flower-primes", SOAKS, "Flores Primas", "Flower Primes", SHEN, "fixed", "Se compra desde el inicio del cap. 6."),
    i("soak-graceful-orchid", SOAKS, "Orquídea Grácil", "Graceful Orchid", "Aldea del Zodiaco · Chen Loong", "fixed", "Te la da Chen Loong al llevarle las 15 semillas.", { doneWithTrophy: 34 }),
    i("soak-guanyin-willow", SOAKS, "Hoja de Sauce de Guanyin", "Guanyin's Willow Leaf", SHEN, "fixed", "Solo en NG+: se compra al Mono Shen. Las guías no confirman si cuenta para el trofeo.", { group: "Nuevo ciclo (NG+)", verified: false }),
  ],
  tips: [
    "Las de planta (Loto de Jade Tierno, Ginseng de Acero, Cráneo de Cabra) no se repiten recargando: cambia de capítulo y espera 30 minutos.",
    "Las de enemigo reaparecen al descansar en el santuario: la build de botín ayuda.",
    "La Orquídea Grácil depende del trofeo de las semillas: hazlos juntos.",
  ],
  sources: [
    { label: "PowerPyx · calabazas", url: PPX_GOURDS },
    { label: "PowerPyx · bebidas", url: PPX_DRINKS },
    { label: "PowerPyx · infusiones", url: PPX_SOAKS },
  ],
};
