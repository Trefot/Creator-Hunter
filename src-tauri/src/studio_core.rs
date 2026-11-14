//! Reglas compartidas de interacción y diagnóstico, sin credenciales ni acceso al sistema.
use serde_json::{Value, json};
pub fn speech_text(value: &str, blocked: &str) -> Result<String, String> {
    let clean = value.split_whitespace().collect::<Vec<_>>().join(" ");
    if clean.is_empty() || clean.chars().count() > 180 {
        return Err("El mensaje debe tener entre 1 y 180 caracteres.".into());
    }
    let lower = clean.to_lowercase();
    if lower.contains("http")
        || lower.contains("www.")
        || clean.chars().any(|c| c.is_control())
        || blocked
            .split(',')
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .any(|s| lower.contains(&s.to_lowercase()))
    {
        return Err("Mensaje bloqueado por los filtros de TTS.".into());
    }
    Ok(clean)
}
pub fn spotify_track(input: &str) -> Option<String> {
    let url = url::Url::parse(input).ok()?;
    if url.scheme() != "https"
        || url.host_str() != Some("open.spotify.com")
        || !url.username().is_empty()
        || url.password().is_some()
        || url.port().is_some()
    {
        return None;
    }
    let parts: Vec<_> = url.path_segments()?.collect();
    let id = match parts.as_slice() {
        ["track", id] => *id,
        [lang, "track", id] if lang.starts_with("intl-") => *id,
        _ => return None,
    };
    (id.len() == 22 && id.chars().all(|c| c.is_ascii_alphanumeric()))
        .then(|| format!("spotify:track:{id}"))
}
pub fn diagnostics(stats: &Value, stream: &Value, previous: Option<(&Value, &Value)>) -> Value {
    let ratio = |lost: &str, total: &str| {
        let old = previous
            .map(|(s, _)| s[total].as_u64().unwrap_or(0))
            .unwrap_or(0);
        let old_lost = previous
            .map(|(s, _)| s[lost].as_u64().unwrap_or(0))
            .unwrap_or(0);
        let n = stats[total].as_u64().unwrap_or(0);
        let l = stats[lost].as_u64().unwrap_or(0);
        if n < old || l < old_lost || n == old {
            return None;
        }
        Some(100. * (l - old_lost) as f64 / (n - old) as f64)
    };
    let render = ratio("renderSkippedFrames", "renderTotalFrames");
    let encode = ratio("outputSkippedFrames", "outputTotalFrames");
    let net = {
        let old = previous
            .map(|(_, s)| s["outputTotalFrames"].as_u64().unwrap_or(0))
            .unwrap_or(0);
        let old_lost = previous
            .map(|(_, s)| s["outputSkippedFrames"].as_u64().unwrap_or(0))
            .unwrap_or(0);
        let n = stream["outputTotalFrames"].as_u64().unwrap_or(0);
        let l = stream["outputSkippedFrames"].as_u64().unwrap_or(0);
        if n > old && l >= old_lost {
            Some(100. * (l - old_lost) as f64 / (n - old) as f64)
        } else {
            None
        }
    };
    let mut tips = Vec::new();
    if render.is_some_and(|n| n > 1.) {
        tips.push("GPU/renderizado: limita los FPS del juego y reduce fuentes de navegador o animaciones innecesarias.");
    }
    if encode.is_some_and(|n| n > 1.) {
        tips.push("Codificación: prueba NVENC en tu 3060 Ti; reduce resolución/FPS o complejidad del preset y vuelve a medir.");
    }
    if net.is_some_and(|n| n > 1.) {
        tips.push("Red: revisa cable y subida disponible; prueba un bitrate menor. Bajar gráficos del juego no resuelve pérdidas de red.");
    }
    if tips.is_empty() {
        tips.push("Sin pérdidas superiores al 1 % en la muestra disponible. Repite la medición jugando; una muestra en reposo no garantiza rendimiento.");
    }
    json!({"render_percent":render,"encode_percent":encode,"network_percent":net,"fps":stats["activeFps"],"cpu":stats["cpuUsage"],"tips":tips,"interval":previous.is_some()})
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn filters_and_spotify_urls() {
        assert!(speech_text("hola", "").is_ok());
        assert!(speech_text("visita https://x.com", "").is_err());
        assert!(speech_text("PALABRA", "palabra").is_err());
        assert!(speech_text(&"a".repeat(181), "").is_err());
        assert_eq!(
            spotify_track("https://open.spotify.com/track/1234567890123456789012?si=x").unwrap(),
            "spotify:track:1234567890123456789012"
        );
        for u in [
            "https://open.spotify.com.evil/track/1234567890123456789012",
            "https://open.spotify.com/playlist/1234567890123456789012",
            "http://open.spotify.com/track/1234567890123456789012",
        ] {
            assert!(spotify_track(u).is_none());
        }
    }
    #[test]
    fn diagnoses_deltas_and_resets() {
        let a = json!({"renderTotalFrames":100,"renderSkippedFrames":10,"outputTotalFrames":100,"outputSkippedFrames":0});
        let b = json!({"renderTotalFrames":200,"renderSkippedFrames":10,"outputTotalFrames":200,"outputSkippedFrames":5});
        let d = diagnostics(&b, &json!({}), Some((&a, &json!({}))));
        assert_eq!(d["render_percent"], 0.);
        assert_eq!(d["encode_percent"], 5.);
        let reset = diagnostics(&a, &json!({}), Some((&b, &json!({}))));
        assert!(reset["render_percent"].is_null());
    }
}
