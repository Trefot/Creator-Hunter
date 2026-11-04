import { siFacebook, siInstagram, siTiktok, siTwitch, siYoutube } from "simple-icons";
import { Platform } from "../db/profiles";
import { es } from "../i18n/es";

/** Logos oficiales de Simple Icons (CC0). Se usan solo para identificar cada red. */
const ICONS: Record<Platform, { path: string; bg: string }> = {
  youtube: { path: siYoutube.path, bg: "#ff0000" },
  twitch: { path: siTwitch.path, bg: "#9146ff" },
  // El negro de TikTok desaparece sobre el fondo oscuro: se aclara un poco y lleva borde.
  tiktok: { path: siTiktok.path, bg: "#16141c" },
  instagram: { path: siInstagram.path, bg: "linear-gradient(45deg, #f9ce34 0%, #ee2a7b 50%, #6228d7 100%)" },
  facebook: { path: siFacebook.path, bg: "#0866ff" },
};

interface Props {
  platform: Platform;
  /** Tamaño del bloque en píxeles. */
  size?: number;
  /** Muestra también el nombre de la red al lado. */
  withName?: boolean;
}

export function PlatformLogo({ platform, size = 22 }: { platform: Platform; size?: number }) {
  const icon = ICONS[platform];
  return (
    <span
      className={`platform-logo platform-logo-${platform}`}
      style={{ width: size, height: size, background: icon.bg, borderRadius: size * 0.28 }}
      title={es.platforms[platform]}
    >
      <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} aria-hidden>
        <path d={icon.path} fill="#fff" />
      </svg>
    </span>
  );
}

/** Logo de la red, con su nombre opcional al lado. */
export function PlatformBadge({ platform, size = 22, withName = false }: Props) {
  return (
    <span className="platform-chip">
      <PlatformLogo platform={platform} size={size} />
      {withName && <span className="platform-chip-name">{es.platforms[platform]}</span>}
    </span>
  );
}
