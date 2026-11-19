//! Episodio para YouTube a partir de una grabación completa: reglas puras, sin procesos ni base de datos.

/// Comprueba el tramo elegido. Un episodio debe durar al menos 1 minuto y caber en el vídeo.
pub fn validate(start: f64, end: f64, duration: f64) -> Result<(f64, f64), String> {
    if !(start.is_finite() && end.is_finite() && duration.is_finite()) || duration <= 0. {
        return Err("No se pudo leer la duración de la grabación.".into());
    }
    let start = start.max(0.);
    let end = end.min(duration);
    if end - start < 60. {
        return Err("El episodio debe durar al menos 1 minuto. Revisa el inicio y el final.".into());
    }
    Ok((start, end))
}

/// Las marcas de la grabación pasan a contar desde el nuevo inicio; las de fuera del tramo se quitan.
pub fn shifted_marks(marks: &[(i64, String)], start: f64, end: f64) -> Vec<(i64, String)> {
    let (from, to) = ((start * 1000.) as i64, (end * 1000.) as i64);
    marks
        .iter()
        .filter(|(ms, _)| *ms >= from && *ms < to)
        .map(|(ms, title)| (ms - from, title.clone()))
        .collect()
}

/// Descripción lista para pegar en YouTube: título y, si cumplen las reglas, capítulos.
pub fn description(title: &str, chapters: &str, valid_chapters: bool) -> String {
    let mut text = title.trim().to_string();
    if valid_chapters {
        text.push_str("\n\nCapítulos:\n");
        text.push_str(chapters);
    }
    text
}

/// ffmpeg: copia la imagen sin recodificar (rápido incluso en directos de horas) y solo
/// convierte el audio elegido. El corte empieza en el fotograma clave anterior al inicio.
pub fn args(input: &str, output: &str, start: f64, length: f64, tracks: &[usize]) -> Result<Vec<String>, String> {
    let (filter, mapping) = crate::shorts_core::audio_filter(tracks)?;
    let mut a: Vec<String> = ["-hide_banner", "-loglevel", "error", "-y", "-ss"]
        .iter()
        .map(|s| s.to_string())
        .collect();
    a.extend([format!("{start:.3}"), "-i".into(), input.into(), "-t".into(), format!("{length:.3}")]);
    if !filter.is_empty() {
        a.extend(["-filter_complex".into(), filter]);
    }
    a.extend(["-map".into(), "0:v:0".into()]);
    if mapping.is_empty() {
        a.push("-an".into());
    } else {
        a.extend(["-map".into(), mapping, "-c:a".into(), "aac".into(), "-b:a".into(), "192k".into()]);
    }
    a.extend(
        ["-c:v", "copy", "-avoid_negative_ts", "make_zero", "-movflags", "+faststart", "-progress", "pipe:1"]
            .iter()
            .map(|s| s.to_string()),
    );
    a.push(output.into());
    Ok(a)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn range_is_clamped_and_needs_a_minute() {
        assert_eq!(validate(-5., 9999., 3600.).unwrap(), (0., 3600.));
        assert!(validate(100., 130., 3600.).is_err());
        assert!(validate(0., 100., 0.).is_err());
    }

    #[test]
    fn marks_follow_the_new_start() {
        let marks = vec![(30_000, "Antes".to_string()), (120_000, "Dentro".into()), (900_000, "Fuera".into())];
        assert_eq!(shifted_marks(&marks, 60., 600.), vec![(60_000, "Dentro".to_string())]);
    }

    #[test]
    fn description_only_lists_valid_chapters() {
        let with = description(" Episodio 1 ", "00:00 Inicio\n01:00 Jefe", true);
        assert!(with.starts_with("Episodio 1\n\nCapítulos:\n00:00 Inicio"));
        assert!(!description("Ep", "00:00 Inicio", false).contains("Capítulos"));
    }

    #[test]
    fn video_is_copied_and_only_chosen_audio_is_kept() {
        let one = args("in.mkv", "out.mp4", 75., 3000., &[1]).unwrap().join(" ");
        assert!(one.contains("-ss 75.000 -i in.mkv -t 3000.000"));
        assert!(one.contains("-map 0:v:0 -map 0:a:1 -c:a aac"));
        assert!(one.contains("-c:v copy") && one.ends_with("out.mp4"));
        let mix = args("in.mkv", "out.mp4", 0., 100., &[0, 2]).unwrap().join(" ");
        assert!(mix.contains("amix=inputs=2") && mix.contains("-map [aout]"));
        assert!(args("in.mkv", "out.mp4", 0., 100., &[]).unwrap().contains(&"-an".to_string()));
    }
}
