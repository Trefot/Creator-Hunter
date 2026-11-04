import { ReactNode } from "react";
import { Section } from "../sections";
import { SECTION_ICONS } from "./Sidebar";

/**
 * Pantalla vacía ilustrada: tarjetas flotantes y destellos alrededor del icono de la sección.
 * Ilustración original en SVG, con los colores del tema.
 */
export function EmptyState({ section, text, children }: { section: Section; text: string; children?: ReactNode }) {
  const Icon = SECTION_ICONS[section];
  return (
    <div className="empty-state">
      <svg className="empty-illustration" width="200" height="130" viewBox="0 0 200 130" aria-hidden>
        <defs>
          <linearGradient id="empty-glow" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8b5cf6" stopOpacity="0.45" />
            <stop offset="1" stopColor="#c026d3" stopOpacity="0.15" />
          </linearGradient>
        </defs>
        <ellipse cx="100" cy="70" rx="78" ry="48" fill="url(#empty-glow)" opacity="0.5" />
        {/* Tarjetas de fondo, ligeramente giradas */}
        <rect x="34" y="34" width="62" height="78" rx="10" fill="#221d30" stroke="#3d3459" transform="rotate(-10 65 73)" />
        <rect x="104" y="34" width="62" height="78" rx="10" fill="#221d30" stroke="#3d3459" transform="rotate(10 135 73)" />
        <rect x="68" y="22" width="64" height="86" rx="12" fill="#1a1625" stroke="#8b5cf6" strokeWidth="1.5" />
        {/* Líneas de contenido */}
        <rect x="80" y="84" width="40" height="5" rx="2.5" fill="#3d3459" />
        <rect x="86" y="94" width="28" height="5" rx="2.5" fill="#2b2540" />
        {/* Destellos */}
        <path d="M30 22l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#c026d3" opacity="0.8" />
        <path d="M172 18l1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5-1.5-3.5-3.5-1.5 3.5-1.5z" fill="#8b5cf6" />
        <circle cx="176" cy="96" r="3" fill="#8b5cf6" opacity="0.6" />
        <circle cx="24" cy="100" r="2" fill="#c026d3" opacity="0.6" />
      </svg>
      <span className="empty-icon">
        <Icon size={26} />
      </span>
      <p>{text}</p>
      {children}
    </div>
  );
}
