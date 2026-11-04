/** Degradados de portada dentro de la familia de la marca (violetas, magentas, índigos). */
const COVERS = [
  "linear-gradient(135deg, #7c3aed 0%, #c026d3 100%)",
  "linear-gradient(135deg, #4f46e5 0%, #8b5cf6 100%)",
  "linear-gradient(135deg, #a21caf 0%, #f472b6 100%)",
  "linear-gradient(135deg, #312e81 0%, #7c3aed 100%)",
  "linear-gradient(135deg, #6d28d9 0%, #ec4899 100%)",
  "linear-gradient(135deg, #1e1b4b 0%, #a855f7 100%)",
];

/** Portada estable para un texto: la misma idea o proyecto siempre recibe el mismo degradado. */
export function coverFor(seed: string): string {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return COVERS[Math.abs(hash) % COVERS.length];
}
