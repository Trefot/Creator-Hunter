import { ScriptSection } from "../../db/scriptSections";

/** Velocidad media de habla en un vídeo: unas 150 palabras por minuto. */
const WORDS_PER_SECOND = 2.5;

export function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/** Segundos estimados al leer el texto en voz alta. */
export function readingSeconds(text: string): number {
  return Math.round(wordCount(text) / WORDS_PER_SECOND);
}

/** Duración de una sección: la que indicaste, o la estimada por las palabras si no indicaste ninguna. */
export function sectionSeconds(section: Pick<ScriptSection, "content" | "est_seconds">): number {
  return section.est_seconds ?? readingSeconds(section.content);
}

export function totalSeconds(sections: ScriptSection[]): number {
  return sections.reduce((sum, s) => sum + sectionSeconds(s), 0);
}

/** 75 → "1:15". */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
