import { es } from "../i18n/es";
import { READY_SECTIONS, Section, SECTIONS } from "../sections";

interface Props {
  current: Section;
  onSelect: (section: Section) => void;
}

export function Sidebar({ current, onSelect }: Props) {
  return (
    <nav className="sidebar">
      <div className="brand">
        <span className="brand-name">{es.appName}</span>
        <span className="brand-tagline">{es.appTagline}</span>
      </div>
      <ul>
        {SECTIONS.map((section) => (
          <li key={section}>
            <button
              className={`nav-item${section === current ? " active" : ""}`}
              onClick={() => onSelect(section)}
            >
              {es.sections[section]}
              {!READY_SECTIONS.includes(section) && <span className="nav-soon" aria-hidden>·</span>}
            </button>
          </li>
        ))}
      </ul>
      <p className="sidebar-footer">{es.version}</p>
    </nav>
  );
}
