/** Textos de la interfaz en español. Todo texto visible sale de aquí para poder traducir después. */
export const es = {
  appName: "TrophyHunter",
  dbTest: {
    title: "Prueba de base de datos",
    intro: "Crea un perfil, cierra la app y vuelve a abrirla: el perfil debe seguir aquí.",
    platform: "Red",
    handle: "@usuario",
    add: "Añadir perfil",
    empty: "Todavía no hay perfiles.",
    remove: "Eliminar",
    loading: "Abriendo base de datos…",
    duplicate: "Ese perfil ya existe.",
    error: "Error:",
    foreignKeys: "Integridad de relaciones",
    on: "activa",
    off: "INACTIVA",
  },
  platforms: {
    youtube: "YouTube",
    twitch: "Twitch",
    tiktok: "TikTok",
    instagram: "Instagram",
    facebook: "Facebook",
  },
} as const;
