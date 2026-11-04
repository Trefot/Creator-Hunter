import { es } from "../i18n/es";
import { Section } from "../sections";
import { SECTION_ICONS } from "./Sidebar";

/** Título de sección: icono en un bloque con el degradado de marca, nombre y subtítulo. */
export function PageTitle({ section, subtitle }: { section: Section; subtitle: string }) {
  const Icon = SECTION_ICONS[section];
  return (
    <div className="page-title">
      <span className="page-title-icon">
        <Icon size={24} strokeWidth={2} />
      </span>
      <div>
        <h1>{es.sections[section]}</h1>
        <p className="muted">{subtitle}</p>
      </div>
    </div>
  );
}
