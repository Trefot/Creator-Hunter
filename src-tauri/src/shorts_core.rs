//! Clips para Shorts (D-031): cálculos y argumentos de ffmpeg, sin procesos ni base de datos.

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Format {
    /// Igual que la grabación (16:9), recortado en el tiempo.
    Horizontal,
    /// 9:16 recortando el centro de la imagen.
    VerticalCrop,
    /// 9:16 con la imagen completa al centro y un fondo difuminado arriba y abajo.
    VerticalBlur,
}

impl Format {
    pub fn parse(s: &str) -> Result<Self, String> {
        match s {
            "horizontal" => Ok(Self::Horizontal),
            "vertical_crop" => Ok(Self::VerticalCrop),
            "vertical_blur" => Ok(Self::VerticalBlur),
            _ => Err("Formato no válido.".into()),
        }
    }
    pub fn key(self) -> &'static str {
        match self {
            Self::Horizontal => "horizontal",
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

/// Nombre de archivo seguro a partir del título (sin caracteres prohibidos en Windows).
pub fn file_stem(title: &str) -> String {
    let clean: String = title
        .chars()
        .map(|c| if c.is_alphanumeric() || c == ' ' || c == '-' || c == '_' { c } else { ' ' })
        .collect();
    let joined = clean.split_whitespace().collect::<Vec<_>>().join(" ");
    let short: String = joined.chars().take(60).collect();
    if short.trim().is_empty() { "Short".into() } else { short.trim().to_string() }
}

/// Argumentos de ffmpeg. Vuelve a codificar (H.264 + AAC) para que el corte sea exacto.
pub fn args(input: &str, output: &str, cut: Option<(f64, f64)>, format: Format) -> Vec<String> {
    let mut a: Vec<String> = vec!["-hide_banner".into(), "-loglevel".into(), "error".into(), "-y".into()];
    if let Some((start, _)) = cut {
        a.extend(["-ss".into(), format!("{start:.3}")]);
    }
    a.extend(["-i".into(), input.into()]);
    if let Some((_, duration)) = cut {
        a.extend(["-t".into(), format!("{duration:.3}")]);
    }
    match format {
        Format::Horizontal => {}
        Format::VerticalCrop => a.extend(["-vf".into(), "crop=ih*9/16:ih,scale=1080:1920,setsar=1".into()]),
        Format::VerticalBlur => a.extend([
            "-filter_complex".into(),
            "[0:v]split=2[a][b];[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=24:2[bg];[b]scale=1080:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1[v]".into(),
            "-map".into(),
            "[v]".into(),
            "-map".into(),
            "0:a?".into(),
        ]),
    }
    a.extend([
        "-c:v".into(), "libx264".into(), "-preset".into(), "veryfast".into(), "-crf".into(), "20".into(),
        "-pix_fmt".into(), "yuv420p".into(), "-c:a".into(), "aac".into(), "-b:a".into(), "160k".into(),
        "-movflags".into(), "+faststart".into(), output.into(),
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
    fn file_names_are_safe_on_windows() {
        assert_eq!(file_stem("¡Jugadón final! <3 / \"épico\""), "Jugadón final 3 épico");
        assert_eq!(file_stem("***"), "Short");
        assert_eq!(file_stem(&"a".repeat(100)).chars().count(), 60);
    }

    #[test]
    fn ffmpeg_arguments_per_format() {
        let h = args("in.mkv", "out.mp4", Some((70.0, 30.0)), Format::Horizontal);
        let joined = h.join(" ");
        assert!(joined.contains("-ss 70.000 -i in.mkv -t 30.000"));
        assert!(!joined.contains("-vf") && !joined.contains("filter_complex"));
        assert!(joined.ends_with("+faststart out.mp4"));
        let c = args("in.mkv", "out.mp4", None, Format::VerticalCrop).join(" ");
        assert!(c.contains("crop=ih*9/16:ih,scale=1080:1920") && !c.contains("-ss"));
        let b = args("in.mkv", "out.mp4", None, Format::VerticalBlur).join(" ");
        assert!(b.contains("boxblur") && b.contains("-map 0:a?"));
        assert_eq!(Format::parse("vertical_blur").unwrap().key(), "vertical_blur");
        assert!(Format::parse("otro").is_err());
    }
}
