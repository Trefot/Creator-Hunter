//! Reglas puras de subtítulos y capítulos (D-034): sin red, sin procesos, con tests.

/// Tiempo de capítulo de YouTube: `03:12` o, en vídeos de una hora o más, `1:03:12`.
pub fn clock(ms: i64, long: bool) -> String {
    let total = ms.max(0) / 1000;
    let (h, m, s) = (total / 3600, (total % 3600) / 60, total % 60);
    if long {
        format!("{h}:{m:02}:{s:02}")
    } else {
        format!("{:02}:{s:02}", h * 60 + m)
    }
}

fn clean_title(title: &str, n: usize) -> String {
    let one_line: String = title.split_whitespace().collect::<Vec<_>>().join(" ");
    let short: String = one_line.chars().take(100).collect();
    if short.is_empty() {
        format!("Momento {n}")
    } else {
        short
    }
}

/// Capítulos de YouTube a partir de las marcas de una grabación (ms desde el inicio y título).
/// Reglas de YouTube: el primero en 00:00, al menos 3 capítulos y 10 s como mínimo cada uno.
/// Devuelve el texto para la descripción y un aviso si no cumple las reglas.
pub fn chapters(marks: &[(i64, String)], duration_ms: Option<i64>) -> (String, Option<String>) {
    let mut sorted: Vec<&(i64, String)> = marks
        .iter()
        .filter(|(ms, _)| *ms >= 0 && duration_ms.is_none_or(|d| *ms < d))
        .collect();
    sorted.sort_by_key(|(ms, _)| *ms);
    let mut kept: Vec<(i64, String)> = Vec::new();
    for (i, (ms, title)) in sorted.into_iter().enumerate() {
        let title = clean_title(title, i + 1);
        match kept.last() {
            // Una marca en los primeros 10 s se convierte en el capítulo inicial.
            None if *ms < 10_000 => kept.push((0, title)),
            None => {
                kept.push((0, "Inicio".into()));
                kept.push((*ms, title));
            }
            Some((last, _)) if ms - last < 10_000 => {}
            Some(_) => kept.push((*ms, title)),
        }
    }
    // El último capítulo también necesita 10 s antes del final del vídeo.
    if let (Some(d), Some((last, _))) = (duration_ms, kept.last()) {
        if kept.len() > 1 && d - last < 10_000 {
            kept.pop();
        }
    }
    let long = duration_ms.unwrap_or(0) >= 3_600_000 || kept.last().is_some_and(|(ms, _)| *ms >= 3_600_000);
    let text = kept
        .iter()
        .map(|(ms, title)| format!("{} {title}", clock(*ms, long)))
        .collect::<Vec<_>>()
        .join("\n");
    let warning = (kept.len() < 3).then(|| {
        "YouTube necesita al menos 3 capítulos separados 10 s o más. Marca más momentos al grabar con «¡Clip!».".to_string()
    });
    (text, warning)
}

/// ffmpeg: audio mono a 16 kHz en WAV, el formato que Whisper espera.
pub fn audio_args(input: &str, wav: &str) -> Vec<String> {
    ["-hide_banner", "-loglevel", "error", "-y", "-i", input, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav]
        .iter()
        .map(|s| s.to_string())
        .collect()
}

/// whisper-cli: español, subtítulos SRT junto al vídeo e informe de progreso.
pub fn whisper_args(model: &str, wav: &str, out_base: &str, threads: usize) -> Vec<String> {
    let threads = threads.clamp(1, 16).to_string();
    ["-m", model, "-f", wav, "-l", "es", "-t", &threads, "-osrt", "-of", out_base, "-pp"]
        .iter()
        .map(|s| s.to_string())
        .collect()
}

/// Lee el porcentaje de una línea de progreso de whisper-cli (`... progress =  45%`).
pub fn parse_progress(line: &str) -> Option<u8> {
    let rest = line.split("progress =").nth(1)?;
    rest.trim().trim_end_matches('%').trim().parse::<u8>().ok().filter(|p| *p <= 100)
}

/// Ruta base (sin extensión) para los archivos que acompañan a un vídeo.
pub fn base_path(video: &str) -> String {
    match video.rfind('.') {
        Some(dot) if !video[dot..].contains(['/', '\\']) => video[..dot].to_string(),
        _ => video.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chapters_follow_youtube_rules() {
        let marks = vec![
            (95_000, "Primera granja".to_string()),
            (100_000, "Demasiado cerca".to_string()),
            (300_500, "  El   portal\n del End ".to_string()),
            (-5, "Inválida".to_string()),
            (600_000, "".to_string()),
        ];
        let (text, warning) = chapters(&marks, Some(1_200_000));
        assert_eq!(text, "00:00 Inicio\n01:35 Primera granja\n05:00 El portal del End\n10:00 Momento 4");
        assert!(warning.is_none());
    }

    #[test]
    fn early_mark_becomes_start_and_too_few_warns() {
        let (text, warning) = chapters(&[(4_000, "Intro".into()), (1_195_000, "Final".into())], Some(1_200_000));
        assert_eq!(text, "00:00 Intro");
        assert!(warning.is_some());
        let (long, _) = chapters(&[(3_725_000, "Hora".into())], Some(4_000_000));
        assert_eq!(long, "0:00:00 Inicio\n1:02:05 Hora");
    }

    #[test]
    fn args_progress_and_paths() {
        assert_eq!(audio_args("in.mp4", "a.wav")[5], "in.mp4");
        let w = whisper_args("m.bin", "a.wav", "C:/v/clip", 40);
        assert_eq!(w[7], "16");
        assert!(w.contains(&"-osrt".to_string()) && w.contains(&"es".to_string()));
        assert_eq!(parse_progress("whisper_print_progress_callback: progress =  45%"), Some(45));
        assert_eq!(parse_progress("otra cosa"), None);
        assert_eq!(base_path("C:/Videos/2026-11-12 20-12-27.mp4"), "C:/Videos/2026-11-12 20-12-27");
        assert_eq!(base_path("C:/Vi.deos/sin_extension"), "C:/Vi.deos/sin_extension");
    }
}
