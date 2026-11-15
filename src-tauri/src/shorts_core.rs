//! Clips para Shorts (D-031): cálculos y argumentos de ffmpeg, sin procesos ni base de datos.

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Format {
    /// Lienzo horizontal 16:9, sin cortar la imagen.
    Horizontal,
    /// Proporción y resolución originales.
    Original,
    /// 9:16 recortando el centro de la imagen.
    VerticalCrop,
    /// 9:16 con la imagen completa al centro y un fondo difuminado arriba y abajo.
    VerticalBlur,
}

impl Format {
    pub fn parse(s: &str) -> Result<Self, String> {
        match s {
            "horizontal" => Ok(Self::Horizontal),
            "original" => Ok(Self::Original),
            "vertical_crop" => Ok(Self::VerticalCrop),
            "vertical_blur" => Ok(Self::VerticalBlur),
            _ => Err("Formato no válido.".into()),
        }
    }
    pub fn key(self) -> &'static str {
        match self {
            Self::Horizontal => "horizontal",
            Self::Original => "original",
            Self::VerticalCrop => "vertical_crop",
            Self::VerticalBlur => "vertical_blur",
        }
    }
}

/// Tramo a recortar alrededor de la marca: (inicio, duración) en segundos.
/// Antes y después van de 0 a 180 s; la duración mínima es 3 s.
pub fn window(mark_ms: i64, before_s: i64, after_s: i64) -> (f64, f64) {
    let before = before_s.clamp(0, 180) as f64;
    let after = after_s.clamp(0, 180) as f64;
    let mark = mark_ms.max(0) as f64 / 1000.0;
    let start = (mark - before).max(0.0);
    let duration = (mark + after - start).max(3.0);
    (start, duration)
}

pub const DEFAULT_BEFORE: i64 = 30;
pub const DEFAULT_AFTER: i64 = 5;

/// El botón se pulsa después de la jugada. Nunca inventa vídeo anterior al inicio del archivo.
pub fn recording_window(
    mark_ms: i64,
    duration: f64,
    before: i64,
    after: i64,
) -> Result<((f64, f64), Option<String>), String> {
    if !duration.is_finite() || duration <= 0.0 {
        return Err("No se pudo leer la duración de la grabación.".into());
    }
    let mark = mark_ms.max(0) as f64 / 1000.;
    if mark > duration + 0.5 {
        return Err("La marca no coincide con la duración de este vídeo. No se recortó para evitar guardar otra jugada.".into());
    }
    let mark = mark.min(duration);
    let before = before.clamp(0, 180) as f64;
    let after = after.clamp(0, 180) as f64;
    let start = (mark - before).max(0.);
    let end = (mark + after).min(duration);
    if end - start < 0.5 {
        return Err("No hay suficiente vídeo alrededor de esta marca.".into());
    }
    let warning = if mark + 0.1 < before {
        Some(format!(
            "La grabación solo conserva {:.0} segundos antes del botón. Se guardará todo lo disponible.",
            mark
        ))
    } else if duration - mark + 0.1 < after {
        Some("La grabación terminó antes del final solicitado. Se guardará hasta donde llegue el vídeo.".into())
    } else {
        None
    };
    Ok(((start, end - start), warning))
}

/// Nombre de archivo seguro a partir del título (sin caracteres prohibidos en Windows).
pub fn file_stem(title: &str) -> String {
    let clean: String = title
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == ' ' || c == '-' || c == '_' {
                c
            } else {
                ' '
            }
        })
        .collect();
    let joined = clean.split_whitespace().collect::<Vec<_>>().join(" ");
    let short: String = joined.chars().take(60).collect();
    if short.trim().is_empty() {
        "Short".into()
    } else {
        short.trim().to_string()
    }
}

/// Argumentos de ffmpeg. Vuelve a codificar (H.264 + AAC) para que el corte sea exacto.
pub fn args(input: &str, output: &str, cut: Option<(f64, f64)>, format: Format) -> Vec<String> {
    args_audio(input, output, cut, format, &[0], 4)
}

/// Pistas de audio relativas (0:a:N); ninguna = sin audio. Mezclar es una elección explícita.
pub fn audio_filter(tracks: &[usize]) -> Result<(String, String), String> {
    if tracks.len() > 16 || tracks.iter().any(|n| *n > 63) {
        return Err("Selecciona como máximo 16 pistas de audio válidas.".into());
    }
    let mut unique = tracks.to_vec();
    unique.sort_unstable();
    unique.dedup();
    if unique.len() != tracks.len() {
        return Err("No selecciones la misma pista dos veces.".into());
    }
    Ok(match tracks {
        [] => (String::new(), String::new()),
        [n] => (String::new(), format!("0:a:{n}")),
        many => (
            format!(
                "{}amix=inputs={}:duration=longest:dropout_transition=0:normalize=0,alimiter=limit=0.95[aout]",
                many.iter()
                    .map(|n| format!("[0:a:{n}]"))
                    .collect::<String>(),
                many.len()
            ),
            "[aout]".into(),
        ),
    })
}

pub fn args_audio(
    input: &str,
    output: &str,
    cut: Option<(f64, f64)>,
    format: Format,
    tracks: &[usize],
    threads: usize,
) -> Vec<String> {
    let mut a: Vec<String> = ["-hide_banner", "-loglevel", "error", "-n"]
        .iter()
        .map(|s| s.to_string())
        .collect();
    if let Some((start, _)) = cut {
        a.extend(["-ss".into(), format!("{start:.3}")]);
    }
    a.extend(["-i".into(), input.into()]);
    if let Some((_, duration)) = cut {
        a.extend(["-t".into(), format!("{duration:.3}")]);
    }
    let video = match format {
        Format::Original => String::new(),
        Format::Horizontal => "[0:v:0]scale=1920:1080:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1[v]".into(),
        Format::VerticalCrop => "[0:v:0]scale=1080:1920:force_original_aspect_ratio=increase:force_divisible_by=2,crop=1080:1920,setsar=1[v]".into(),
        Format::VerticalBlur => "[0:v:0]split=2[a][b];[a]scale=1080:1920:force_original_aspect_ratio=increase:force_divisible_by=2,crop=1080:1920,boxblur=24:2[bg];[b]scale=1080:1920:force_original_aspect_ratio=decrease:force_divisible_by=2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1[v]".into(),
    };
    let (audio, mapping) = audio_filter(tracks).expect("validated audio tracks");
    let filter = [video.as_str(), audio.as_str()]
        .into_iter()
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join(";");
    if !filter.is_empty() {
        a.extend([
            "-filter_complex".into(),
            filter,
            "-filter_complex_threads".into(),
            threads.clamp(1, 8).to_string(),
        ]);
    }
    a.extend([
        "-map".into(),
        if video.is_empty() {
            "0:v:0".into()
        } else {
            "[v]".into()
        },
    ]);
    if mapping.is_empty() {
        a.push("-an".into());
    } else {
        a.extend(["-map".into(), mapping]);
    }
    a.extend([
        "-c:v".into(),
        "libx264".into(),
        "-threads".into(),
        threads.clamp(1, 8).to_string(),
        "-preset".into(),
        "veryfast".into(),
        "-crf".into(),
        "20".into(),
        "-pix_fmt".into(),
        "yuv420p".into(),
        "-c:a".into(),
        "aac".into(),
        "-b:a".into(),
        "160k".into(),
        "-progress".into(),
        "pipe:1".into(),
        "-movflags".into(),
        "+faststart".into(),
        output.into(),
    ]);
    a
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn window_clamps_to_start_and_limits() {
        assert_eq!(window(90_000, 20, 10), (70.0, 30.0));
        // Una marca a los 5 s no puede empezar antes del principio.
        assert_eq!(window(5_000, 20, 10), (0.0, 15.0));
        assert_eq!(window(60_000, 9999, 9999), (0.0, 240.0));
        assert_eq!(window(10_000, 0, 0), (10.0, 3.0));
    }

    #[test]
    fn recording_window_is_retroactive_and_does_not_invent_history() {
        assert_eq!(
            recording_window(70000, 80., DEFAULT_BEFORE, DEFAULT_AFTER)
                .unwrap()
                .0,
            (40., 35.)
        );
        let (cut, warning) = recording_window(5000, 80., 30, 5).unwrap();
        assert_eq!(cut, (0., 10.));
        assert!(warning.unwrap().contains("5 segundos"));
        assert!(recording_window(90000, 80., 30, 5).is_err());
    }

    #[test]
    fn file_names_are_safe_on_windows() {
        assert_eq!(
            file_stem("¡Jugadón final! <3 / \"épico\""),
            "Jugadón final 3 épico"
        );
        assert_eq!(file_stem("***"), "Short");
        assert_eq!(file_stem(&"a".repeat(100)).chars().count(), 60);
    }

    #[test]
    fn ffmpeg_arguments_per_format() {
        let h = args("in.mkv", "out.mp4", Some((70.0, 30.0)), Format::Horizontal);
        let joined = h.join(" ");
        assert!(joined.contains("-ss 70.000 -i in.mkv -t 30.000"));
        assert!(joined.contains("pad=1920:1080"));
        assert!(joined.ends_with("+faststart out.mp4"));
        let c = args("in.mkv", "out.mp4", None, Format::VerticalCrop).join(" ");
        assert!(c.contains("crop=1080:1920") && !c.contains("-ss"));
        let b = args("in.mkv", "out.mp4", None, Format::VerticalBlur).join(" ");
        assert!(b.contains("boxblur") && b.contains("-map 0:a:0"));
        assert_eq!(
            Format::parse("vertical_blur").unwrap().key(),
            "vertical_blur"
        );
        assert!(Format::parse("otro").is_err());
    }
}
