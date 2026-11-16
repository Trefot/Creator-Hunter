import {
  PlugZap,
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
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { useEffect,useState } from "react";
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
  connections: PlugZap,
};

interface Props {
  current: Section;
  onSelect: (section: Section) => void;
  focus:boolean;
  onFocus:()=>void;
}

export function Sidebar({ current, onSelect,focus,onFocus }: Props) {
  const [expanded,setExpanded]=useState(['profiles','goals','income'].includes(current));
  useEffect(()=>{if(['profiles','goals','income'].includes(current))setExpanded(true)},[current]);
  const labels:Partial<Record<Section,[string,string]>>={dashboard:['Inicio','Tu crecimiento en redes'],projects:['Crear contenido','Ideas, proyectos y clips'],live:['En directo','Tu cabina de control'],games:['Juegos','Biblioteca y progreso']};
  function item(section: Section) {
    const Icon = SECTION_ICONS[section];
    return (
      <li key={section}>
        <button className={`nav-item${section === current || (section==="projects"&&current==="ideas") ? " active" : ""}`} aria-current={section === current || (section==="projects"&&current==="ideas") ? "page" : undefined} onClick={() => onSelect(section)}>
          <Icon size={18} strokeWidth={2} />
          <span className="nav-copy">{labels[section]?.[0]??es.sections[section]}{labels[section]&&<small>{labels[section]![1]}</small>}</span>
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
        <div className="nav-group-label">TU ESPACIO</div>
        <ul>{(["dashboard","projects","live","games"] as Section[]).map(item)}</ul>
        <div className="nav-group-label">ORGANIZAR</div>
        <ul>{item("connections")}{item("calendar")}</ul>
        <details className="nav-studio" open={expanded} onToggle={e=>setExpanded(e.currentTarget.open)}><summary><LayoutDashboard size={18}/>Mi estudio<ChevronRight size={14}/></summary><ul>{(["profiles","goals","income"] as Section[]).map(item)}</ul></details>
      </div>
      <button className="focus-toggle ghost" aria-pressed={focus} onClick={onFocus}><Sparkles size={17}/><span>Modo enfoque<small>Reducir detalle en Inicio</small></span><span className={`focus-switch${focus?" on":""}`} aria-hidden="true"/></button>
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
