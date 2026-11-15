import { invoke } from "@tauri-apps/api/core";

/** Subtítulos y capítulos (src-tauri/src/subtitles.rs, D-034). */
export interface SubtitleStatus {
  whisper: boolean;
  model: boolean;
  ffmpeg: boolean;
}

export interface Recording {
  id: string;
  observed_at: string;
  path: string;
  exists: boolean;
  game: string | null;
  marks: number;
  srt: string | null;
}

export const subtitlesStatus = () => invoke<SubtitleStatus>("subtitles_status");
export const subtitlesInstall = () => invoke<void>("subtitles_install");
export const subtitlesRecordings = (offset=0) => invoke<Recording[]>("subtitles_recordings",{offset});
export const subtitlesChapters = (sessionId: string) =>
  invoke<{ text: string; warning: string | null }>("subtitles_chapters", { sessionId });
export const subtitlesGenerate = (sessionId: string,audio?:number[]) => invoke<{ srt: string }>("subtitles_generate", { sessionId,audio });

export const subtitlesImport=(path:string)=>invoke<string>("subtitles_import",{path});
