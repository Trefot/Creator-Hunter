/**
 * Símbolo de la app: un trofeo sobre un cuadrado redondeado con el degradado de marca.
 * Original; la misma forma está en src-tauri/app-icon.svg para el icono de la ventana.
 */
export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="TrophyHunter">
      <defs>
        <linearGradient id="logo-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#c026d3" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#logo-gradient)" />
      <g fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        {/* Copa */}
        <path d="M22 14h20v12a10 10 0 0 1-20 0z" fill="#fff" fillOpacity="0.18" />
        {/* Asas */}
        <path d="M22 18h-5a5 5 0 0 0 5 9" />
        <path d="M42 18h5a5 5 0 0 1-5 9" />
        {/* Pie y base */}
        <path d="M32 36v8" />
        <path d="M24 50h16" />
      </g>
      {/* Destello */}
      <path d="M32 18l1.8 3.7 4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4-2.9-2.8 4-.6z" fill="#fff" />
    </svg>
  );
}
