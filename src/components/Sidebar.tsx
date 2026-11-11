import {
  CalendarDays,
  DatabaseBackup,
  FolderKanban,
  Gamepad2,
  LayoutDashboard,
  Lightbulb,
  LucideIcon,
  RefreshCw,
  Radio,
  Target,
  UsersRound,
  Wallet,
} from "lucide-react";
import { es } from "../i18n/es";
import { READY_SECTIONS, Section } from "../sections";
import { Logo } from "./Logo";
import { CHECK_UPDATES_EVENT } from "../features/update/UpdateLayer";

export const SECTION_ICONS: Record<Section, LucideIcon> = {
  dashboard: LayoutDashboard,
  profiles: UsersRound,
  goals: Target,
  ideas: Lightbulb,
  projects: FolderKanban,
  calendar: CalendarDays,
  income: Wallet,
  games: Gamepad2,
  live: Radio,
  backups: DatabaseBackup,
};

/** Grupos del menú; las copias de seguridad van aparte, al final. */
const GROUPS: { label: string; sections: Section[] }[] = [
  { label: es.nav.studio, sections: ["dashboard", "ideas", "projects", "calendar"] },
  { label: es.nav.growth, sections: ["profiles", "goals", "income"] },
  { label: es.nav.live, sections: ["live"] },
  { label: es.nav.gaming, sections: ["games"] },
];

interface Props {
  current: Section;
  onSelect: (section: Section) => void;
}

export function Sidebar({ current, onSelect }: Props) {
  function item(section: Section) {
    const Icon = SECTION_ICONS[section];
    return (
      <li key={section}>
        <button className={`nav-item${section === current ? " active" : ""}`} aria-current={section === current ? "page" : undefined} onClick={() => onSelect(section)}>
          <Icon size={18} strokeWidth={2} />
          {es.sections[section]}
          {!READY_SECTIONS.includes(section) && <span className="nav-soon" aria-hidden>·</span>}
        </button>
      </li>
    );
  }

  return (
    <nav className="sidebar">
      <div className="brand">
        <Logo size={42} />
        <div className="brand-text">
          <span className="brand-name">{es.appName}</span>
          <span className="brand-tagline">{es.appTagline}</span>
        </div>
      </div>
      <div className="sidebar-main">
        {GROUPS.map((group) => (
          <div key={group.label}>
            <div className="nav-group-label">{group.label}</div>
            <ul>{group.sections.map(item)}</ul>
          </div>
        ))}
      </div>
      <ul>{item("backups")}</ul>
      <div className="sidebar-footer">
        <span>
          {es.version}
          {import.meta.env.DEV && <span className="dev-badge">{es.devBadge}</span>}
        </span>
        <button className="ghost small-button update-check" onClick={() => window.dispatchEvent(new Event(CHECK_UPDATES_EVENT))}>
          <RefreshCw size={13} /> {es.update.check}
        </button>
      </div>
    </nav>
  );
}
