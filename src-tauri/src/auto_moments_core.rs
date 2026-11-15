//! Reglas de captura y recorte; sin micrófono, procesos ni red.
use serde::{Deserialize, Serialize};
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(default)]
pub struct Config {
    pub phrase: String,
    pub culture: String,
    pub confidence: f64,
    pub before: u32,
    pub after: u32,
    pub buffer_seconds: u32,
    pub buffer_confirmed: bool,
}
impl Default for Config {
    fn default() -> Self {
        Self {
            phrase: "Nexus guarda esto".into(),
            culture: "es-ES".into(),
            confidence: 0.80,
            before: 30,
            after: 15,
            buffer_seconds: 60,
            buffer_confirmed: false,
        }
    }
}
impl Config {
    pub fn validate(&self) -> Result<(), String> {
        if !(2..=8).contains(&self.phrase.split_whitespace().count())
            || self.phrase.chars().count() > 80
            || self.phrase.chars().any(char::is_control)
        {
            return Err(
                "Usa una frase de 2 a 8 palabras, sin saltos de línea, de hasta 80 caracteres."
                    .into(),
            );
        }
        if self.culture.len() > 20
            || self.culture.is_empty()
            || !self
                .culture
                .chars()
                .all(|c| c.is_ascii_alphabetic() || c == '-')
        {
            return Err("Elige un idioma de reconocimiento válido.".into());
        }
        if !self.confidence.is_finite()
            || !(0.65..=0.99).contains(&self.confidence)
            || !(5..=120).contains(&self.before)
            || self.after > 30
            || self.buffer_seconds > 600
        {
            return Err(
                "Ajustes fuera de rango: 5–120 s antes, 0–30 s después y confianza 0,65–0,99."
                    .into(),
            );
        }
        if self.buffer_seconds < self.before + self.after + 5 {
            return Err("Configura el Replay Buffer con al menos los segundos de antes + después + 5 de margen.".into());
        }
        Ok(())
    }
}
pub fn normalized(s: &str) -> String {
    s.chars()
        .filter(|c| c.is_alphanumeric() || c.is_whitespace())
        .flat_map(char::to_lowercase)
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}
pub fn accepted(config: &Config, text: &str, confidence: f64) -> bool {
    confidence.is_finite()
        && confidence >= config.confidence
        && confidence <= 1.0
        && normalized(text) == normalized(&config.phrase)
}
/// La marca está `tail_ms` antes del final confirmado del clip. Nunca inventa vídeo ausente.
pub fn clip_window(
    duration: f64,
    tail_ms: u64,
    before: u32,
    after: u32,
) -> Result<((f64, f64), Option<String>), String> {
    if !duration.is_finite() || duration <= 0.0 {
        return Err("No se pudo medir la duración del clip.".into());
    }
    let mark = duration - tail_ms as f64 / 1000.0;
    if mark < -0.5 {
        return Err("La marca quedó fuera del Replay Buffer. Puede haberse reiniciado antes del guardado; revisa el clip original.".into());
    }
    let mark = mark.max(0.0);
    let start = (mark - before.min(120) as f64).max(0.0);
    let end = (mark + after.min(30) as f64).min(duration);
    if end - start < 1.0 {
        return Err("No hay suficiente vídeo alrededor de esta marca.".into());
    }
    let warning = if mark < before as f64 || duration - mark + 0.1 < after as f64 {
        Some("El buffer no contiene todo el tramo solicitado. Se exportó únicamente el vídeo disponible.".into())
    } else {
        None
    };
    Ok(((start, end - start), warning))
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn exact_phrase_and_confidence() {
        let c = Config::default();
        assert!(accepted(&c, "Nexus, guarda esto!", 0.85));
        assert!(!accepted(&c, "guarda esto", 0.95));
        assert!(!accepted(&c, "Nexus guarda esto", 0.4));
        assert!(!accepted(&c, "Nexus guarda esto", f64::NAN));
    }
    #[test]
    fn validation_and_buffer_margin() {
        let mut c = Config::default();
        assert!(c.validate().is_ok());
        c.buffer_seconds = 45;
        assert!(c.validate().is_err());
        c.buffer_seconds = 60;
        c.phrase = "clip".into();
        assert!(c.validate().is_err());
    }
    #[test]
    fn window_preserves_mark_and_clamps_missing_history() {
        assert_eq!(
            clip_window(60.0, 15000, 30, 15).unwrap(),
            ((15.0, 45.0), None)
        );
        let (w, n) = clip_window(25.0, 15000, 30, 15).unwrap();
        assert_eq!(w, (0.0, 25.0));
        assert!(n.is_some());
        assert!(clip_window(5.0, 15000, 30, 15).is_err());
        assert_eq!(clip_window(60.0, 17000, 30, 15).unwrap().0, (13.0, 45.0));
    }
}
