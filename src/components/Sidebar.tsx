import {
  CalendarDays,
  DatabaseBackup,
  FolderKanban,
  Gamepad2,
  LayoutDashboard,
  Lightbulb,
  LucideIcon,
  Radio,
  Target,
  UsersRound,
  Wallet,
} from "lucide-react";
import { es } from "../i18n/es";
import { READY_SECTIONS, Section } from "../sections";
import { Logo } from "./Logo";

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
        <button className={`nav-item${section === current ? " active" : ""}`} onClick={() => onSelect(section)}>
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
        <Logo size={36} />
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
      <p className="sidebar-footer">
        {es.version}
        {import.meta.env.DEV && <span className="dev-badge">{es.devBadge}</span>}
      </p>
    </nav>
  );
}
