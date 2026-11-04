/** Secciones del menú lateral, en orden. */
export const SECTIONS = ["dashboard", "profiles", "ideas", "projects", "calendar", "income"] as const;
export type Section = (typeof SECTIONS)[number];

/** Secciones ya construidas; el resto muestra "Próximamente". */
export const READY_SECTIONS: readonly Section[] = ["profiles"];
