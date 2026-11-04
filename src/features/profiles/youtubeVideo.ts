/**
 * ID del vídeo (11 caracteres) a partir del enlace publicado, o null si no es de YouTube.
 * Admite youtube.com/watch?v=, youtu.be/, /shorts/, /live/ y /embed/ (también m. y music.).
 */
export function extractVideoId(link: string | null): string | null {
  if (!link) return null;
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, "");
  let candidate: string | null = null;
  if (host === "youtu.be") {
    candidate = url.pathname.split("/")[1] ?? null;
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const [, first, second] = url.pathname.split("/");
    candidate = first === "watch" ? url.searchParams.get("v") : ["shorts", "live", "embed"].includes(first) ? second : null;
  }
  return candidate && /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : null;
}
