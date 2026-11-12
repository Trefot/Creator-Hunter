//! Colas locales independientes. Los eventos de prueba nunca simulan una conexión social.
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(default)]
pub struct Config {
    pub title: String,
    pub color: String,
    pub secondary_color: String,
    pub text_color: String,
    pub message_color: String,
    pub font_family: String,
    pub name_size: u8,
    pub message_size: u8,
    pub event_label: String,
    pub sample_name: String,
    pub message_template: String,
    pub duration: u64,
    pub volume: u8,
    pub muted: bool,
    pub paused: bool,
    pub sound: bool,
}
impl Default for Config {
    fn default() -> Self {
        Self {
            title: "Alertas".into(),
            color: "#9146ff".into(),
            secondary_color: "#ffd166".into(),
            text_color: "#ffffff".into(),
            message_color: "#eee6ff".into(),
            font_family: "sans".into(),
            name_size: 38,
            message_size: 16,
            event_label: String::new(),
            sample_name: "LUNA_27".into(),
            message_template: "¡Bienvenido a la aventura!".into(),
            duration: 6,
            volume: 50,
            muted: false,
            paused: false,
            sound: true,
        }
    }
}
impl Config {
    pub fn validate(&self) -> Result<(), String> {
        if self.title.trim().is_empty() || self.title.chars().count() > 60 {
            return Err("El título debe tener entre 1 y 60 caracteres.".into());
        }
        for color in [
            &self.color,
            &self.secondary_color,
            &self.text_color,
            &self.message_color,
        ] {
            if color.len() != 7
                || !color.starts_with('#')
                || !color[1..].bytes().all(|b| b.is_ascii_hexdigit())
            {
                return Err("Color no válido.".into());
            }
        }
        if !["sans", "serif", "mono"].contains(&self.font_family.as_str())
            || !(24..=48).contains(&self.name_size)
            || !(12..=22).contains(&self.message_size)
        {
            return Err("Tipografía o tamaño fuera de rango.".into());
        }
        if self.event_label.chars().count() > 50
            || self.sample_name.trim().is_empty()
            || self.sample_name.chars().count() > 40
            || self.message_template.chars().count() > 160
            || self
                .message_template
                .replace("{usuario}", &self.sample_name)
                .chars()
                .count()
                > 240
        {
            return Err(
                "Revisa la etiqueta, el nombre de prueba y el mensaje (hasta 160 caracteres)."
                    .into(),
            );
        }
        if !(3..=15).contains(&self.duration) || self.volume > 100 {
            return Err("Duración o volumen fuera de rango.".into());
        }
        Ok(())
    }
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Settings {
    pub twitch: Config,
    pub youtube: Config,
    #[serde(default = "tiktok_defaults")]
    pub tiktok: Config,
    pub coordinate_audio: bool,
}
fn tiktok_defaults() -> Config {
    Config {
        title: "TikTok".into(),
        color: "#25f4ee".into(),
        secondary_color: "#ff2d86".into(),
        ..Config::default()
    }
}
impl Default for Settings {
    fn default() -> Self {
        let mut youtube = Config::default();
        youtube.color = "#ff3355".into();
        youtube.title = "YouTube".into();
        let mut twitch = Config::default();
        twitch.title = "Twitch".into();
        Self {
            twitch,
            youtube,
            tiktok: tiktok_defaults(),
            coordinate_audio: true,
        }
    }
}
impl Settings {
    pub fn validate(&self) -> Result<(), String> {
        self.twitch.validate()?;
        self.youtube.validate()?;
        self.tiktok.validate()
    }
}
#[derive(Clone, Debug, Serialize)]
pub struct Event {
    pub id: u64,
    pub title: String,
    pub message: String,
    pub test: bool,
    pub replay: bool,
}
#[derive(Clone, Debug, Serialize)]
pub struct Playback {
    pub event: Event,
    pub started_at: u64,
    pub ends_at: u64,
    pub sound_at: Option<u64>,
}
#[derive(Default)]
struct Channel {
    queue: VecDeque<Event>,
    current: Option<Playback>,
    last: Option<Event>,
    viewer: String,
    seen: u64,
}
#[derive(Default)]
pub struct Engine {
    pub settings: Settings,
    channels: [Channel; 3],
    sequence: u64,
    audio_until: u64,
}
fn index(platform: &str) -> Result<usize, String> {
    match platform {
        "twitch" => Ok(0),
        "youtube" => Ok(1),
        "tiktok" => Ok(2),
        _ => Err("Plataforma no válida.".into()),
    }
}
impl Engine {
    fn config(&self, i: usize) -> Config {
        if i == 0 {
            self.settings.twitch.clone()
        } else if i == 1 {
            self.settings.youtube.clone()
        } else {
            self.settings.tiktok.clone()
        }
    }
    pub fn enqueue(
        &mut self,
        platform: &str,
        title: String,
        message: String,
        test: bool,
    ) -> Result<(), String> {
        let i = index(platform)?;
        if title.trim().is_empty() || title.chars().count() > 80 || message.chars().count() > 240 {
            return Err("Título o mensaje demasiado largo o vacío.".into());
        }
        if self.channels[i].queue.len() >= 50 {
            return Err("La cola está llena (50 alertas).".into());
        }
        self.sequence += 1;
        self.channels[i].queue.push_back(Event {
            id: self.sequence,
            title,
            message,
            test,
            replay: false,
        });
        Ok(())
    }
    pub fn action(&mut self, platform: &str, action: &str) -> Result<(), String> {
        let i = index(platform)?;
        match action {
            "test" => {
                let cfg = self.config(i);
                self.enqueue(
                    platform,
                    cfg.sample_name.clone(),
                    cfg.message_template.replace("{usuario}", &cfg.sample_name),
                    true,
                )?;
            }
            "replay" => {
                let mut event = self.channels[i]
                    .last
                    .clone()
                    .ok_or("Todavía no hay una alerta para repetir.")?;
                if self.channels[i].queue.len() >= 50 {
                    return Err("La cola está llena.".into());
                }
                self.sequence += 1;
                event.id = self.sequence;
                event.replay = true;
                self.channels[i].queue.push_back(event);
            }
            "clear" => {
                self.channels[i].queue.clear();
            }
            _ => return Err("Acción no válida.".into()),
        };
        Ok(())
    }
    pub fn poll(
        &mut self,
        platform: &str,
        viewer: &str,
        now: u64,
    ) -> Result<serde_json::Value, String> {
        let i = index(platform)?;
        if viewer.len() < 8
            || viewer.len() > 80
            || !viewer
                .bytes()
                .all(|c| c.is_ascii_alphanumeric() || c == b'-')
        {
            return Err("Identificador de fuente no válido.".into());
        }
        let cfg = self.config(i);
        let channel = &mut self.channels[i];
        // Una segunda fuente no consume ni reproduce la misma cola. La titularidad caduca.
        if channel.viewer != viewer && channel.seen.saturating_add(3000) > now {
            return Ok(
                serde_json::json!({"config":cfg,"event":null,"duplicate":true,"pending":channel.queue.len()}),
            );
        }
        channel.viewer = viewer.into();
        channel.seen = now;
        if channel.current.as_ref().is_some_and(|p| p.ends_at <= now) {
            channel.current = None;
        }
        if channel.current.is_none() && !cfg.paused {
            if let Some(event) = channel.queue.pop_front() {
                let sound_at = if cfg.sound && !cfg.muted && cfg.volume > 0 {
                    let t = if self.settings.coordinate_audio {
                        now.max(self.audio_until)
                    } else {
                        now
                    };
                    self.audio_until = t + 800;
                    Some(t)
                } else {
                    None
                };
                channel.last = Some(event.clone());
                channel.current = Some(Playback {
                    event,
                    started_at: now,
                    ends_at: now + cfg.duration * 1000,
                    sound_at,
                });
            }
        }
        Ok(
            serde_json::json!({"config":cfg,"event":channel.current,"duplicate":false,"pending":channel.queue.len()}),
        )
    }
    pub fn status(&self) -> serde_json::Value {
        serde_json::json!({"settings":self.settings,"twitch_pending":self.channels[0].queue.len(),"youtube_pending":self.channels[1].queue.len(),"tiktok_pending":self.channels[2].queue.len(),"connected":false})
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn separate_queues_and_audio() {
        let mut e = Engine::default();
        e.action("twitch", "test").unwrap();
        e.action("youtube", "test").unwrap();
        let a = e.poll("twitch", "viewer-twitch", 10000).unwrap();
        let b = e.poll("youtube", "viewer-youtube", 10000).unwrap();
        assert_eq!(a["event"]["sound_at"], 10000);
        assert_eq!(b["event"]["sound_at"], 10800);
        assert_ne!(a["event"]["event"]["id"], b["event"]["event"]["id"]);
        assert_eq!(a["event"]["event"]["test"], true);
    }
    #[test]
    fn pause_mute_and_repeat() {
        let mut e = Engine::default();
        e.settings.twitch.paused = true;
        e.action("twitch", "test").unwrap();
        assert!(e.poll("twitch", "viewer-twitch", 10000).unwrap()["event"].is_null());
        e.settings.twitch.paused = false;
        e.settings.twitch.muted = true;
        let a = e.poll("twitch", "viewer-twitch", 11000).unwrap();
        assert!(a["event"]["sound_at"].is_null());
        e.action("twitch", "replay").unwrap();
        let b = e.poll("twitch", "viewer-twitch", 18000).unwrap();
        assert_eq!(b["event"]["event"]["replay"], true);
        assert_ne!(a["event"]["event"]["id"], b["event"]["event"]["id"]);
    }
    #[test]
    fn only_one_viewer_and_no_old_sound() {
        let mut e = Engine::default();
        e.action("twitch", "test").unwrap();
        e.poll("twitch", "viewer-first", 10000).unwrap();
        assert_eq!(
            e.poll("twitch", "viewer-other", 11000).unwrap()["duplicate"],
            true
        );
        let p = e.poll("twitch", "viewer-other", 14000).unwrap();
        assert_eq!(p["event"]["started_at"], 10000);
        assert_eq!(p["event"]["sound_at"], 10000);
        assert!(e.poll("twitch", "viewer-other", 17000).unwrap()["event"].is_null());
    }
    #[test]
    fn validation_and_bounds() {
        let mut e = Engine::default();
        assert!(e.action("other", "test").is_err());
        assert!(e.action("twitch", "replay").is_err());
        for _ in 0..50 {
            e.action("twitch", "test").unwrap()
        }
        assert!(e.action("twitch", "test").is_err());
        e.action("twitch", "clear").unwrap();
        e.action("twitch", "test").unwrap();
        let mut c = Config::default();
        c.color = "red".into();
        assert!(c.validate().is_err());
        c.color = "#123456".into();
        c.duration = 100;
        assert!(c.validate().is_err());
    }
    #[test]
    fn old_settings_gain_style_defaults_and_tiktok() {
        let old = r##"{"twitch":{"title":"Mis alertas","color":"#123456","muted":true},"youtube":{"title":"YouTube","color":"#ff3355"},"coordinate_audio":false}"##;
        let settings: Settings = serde_json::from_str(old).unwrap();
        settings.validate().unwrap();
        assert_eq!(settings.twitch.color, "#123456");
        assert!(settings.twitch.muted);
        assert_eq!(settings.twitch.name_size, 38);
        assert_eq!(settings.tiktok.color, "#25f4ee");
        assert!(!settings.coordinate_audio);
        let restored: Settings =
            serde_json::from_str(&serde_json::to_string(&settings).unwrap()).unwrap();
        assert_eq!(restored.tiktok.secondary_color, "#ff2d86");
    }
    #[test]
    fn tiktok_is_independent_and_test_uses_editable_text() {
        let mut e = Engine::default();
        e.settings.tiktok.sample_name = "Trefot".into();
        e.settings.tiktok.message_template = "¡Hola, {usuario}!".into();
        e.action("tiktok", "test").unwrap();
        let p = e.poll("tiktok", "viewer-tiktok", 10000).unwrap();
        assert_eq!(p["event"]["event"]["title"], "Trefot");
        assert_eq!(p["event"]["event"]["message"], "¡Hola, Trefot!");
        assert!(e.poll("twitch", "viewer-twitch", 10000).unwrap()["event"].is_null());
    }
    #[test]
    fn rejects_unsafe_styles() {
        let mut c = Config::default();
        c.font_family = "url(https://example.com)".into();
        assert!(c.validate().is_err());
        c.font_family = "sans".into();
        c.name_size = 100;
        assert!(c.validate().is_err());
        c.name_size = 38;
        c.secondary_color = "invalid".into();
        assert!(c.validate().is_err());
    }
}
