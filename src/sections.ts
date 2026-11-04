/** Secciones del menú lateral, en orden. */
export const SECTIONS = [
  "dashboard",
  "profiles",
  "goals",
  "ideas",
  "projects",
  "calendar",
  "income",
  "backups",
] as const;
export type Section = (typeof SECTIONS)[number];

/** Secciones ya construidas; el resto muestra "Próximamente". */
export const READY_SECTIONS: readonly Section[] = [
  "dashboard",
  "profiles",
  "goals",
  "ideas",
  "projects",
  "calendar",
  "income",
  "backups",
];
