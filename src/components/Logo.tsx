import emblem from "../assets/nexus-mark.png";
import { es } from "../i18n/es";

/** Emblema elegido: el compañero violeta sosteniendo el farol. */
export function Logo({ size = 36 }: { size?: number }) {
  return <img className="app-logo" src={emblem} width={size} height={size} alt={es.appName} />;
}
