//! Colas locales independientes. Los eventos de prueba nunca simulan una conexión social.
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, VecDeque};
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(default)]
pub struct Config {
    pub enabled: bool,
    pub design: String,
    pub tone: String,
    pub audio_id: String,
    pub audio_start: f64,
    pub audio_end: f64,
    pub sample_amount: String,
    pub sample_note: String,
    pub title: String,
    pub color: String,
    pub secondary_color: String,
    pub label_color: String,
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
            enabled: true,
            design: "reference".into(),
            tone: "soft".into(),
            audio_id: String::new(), audio_start: 0.0, audio_end: 0.0,
            sample_amount: "1".into(),
            sample_note: "¡Vamos por ese platino!".into(),
            title: "Alertas".into(),
            color: "#9146ff".into(),
            secondary_color: "#ffd166".into(),
            label_color: "#ffd27b".into(),
            text_color: "#ffffff".into(),
            message_color: "#ffffff".into(),
            font_family: "sans".into(),
            name_size: 40,
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
        if !self.audio_id.is_empty() && (self.audio_id.len()!=64 || !self.audio_id.bytes().all(|b|b.is_ascii_hexdigit())) {return Err("Audio no válido.".into());}
        if !self.audio_start.is_finite() || !self.audio_end.is_finite() || self.audio_start<0.0 || self.audio_end<0.0 || self.audio_end>600.0 || (!self.audio_id.is_empty() && (self.audio_end<=self.audio_start || self.audio_end-self.audio_start>self.duration as f64-0.4)) {return Err("El recorte del audio debe caber en la alerta (reserva 0,4 s para la salida).".into());}
        if self.title.trim().is_empty() || self.title.chars().count() > 60 {
            return Err("El título debe tener entre 1 y 60 caracteres.".into());
        }
        for color in [
            &self.color,
            &self.secondary_color,
            &self.label_color,
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
            || self.sample_amount.chars().count() > 24
            || self.sample_note.chars().count() > 120
            || render_text(&self.message_template, self).chars().count() > 240
        {
            return Err(
                "Revisa la etiqueta, el nombre de prueba y el mensaje (hasta 160 caracteres)."
                    .into(),
            );
        }
        if !["reference", "celebrate", "gift", "support", "raid", "heart"]
            .contains(&self.design.as_str())
            || !["soft", "celebrate", "sparkle", "portal", "heart"].contains(&self.tone.as_str())
        {
            return Err("Ilustración o sonido no válido.".into());
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
    #[serde(default)]
    pub event_templates: BTreeMap<String, Config>,
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
            event_templates: BTreeMap::new(),
        }
    }
}
impl Settings {
    pub fn validate(&self) -> Result<(), String> {
        self.twitch.validate()?;
        self.youtube.validate()?;
        self.tiktok.validate()?;
        if self.event_templates.len() > CATALOG.len() {
            return Err("Demasiadas plantillas.".into());
        }
        for (key, cfg) in &self.event_templates {
            if !CATALOG
                .iter()
                .any(|d| key == &format!("{}/{}", d.platform, d.kind))
            {
                return Err("Tipo de evento no válido en las plantillas.".into());
            }
            cfg.validate()?;
        }
        Ok(())
    }
}
/// Catálogo de plantillas, no una promesa de recepción automática de estas redes.
#[derive(Clone, Copy)]
pub struct Definition {
    pub platform: &'static str,
    pub kind: &'static str,
    pub name: &'static str,
    pub label: &'static str,
    pub design: &'static str,
    pub tone: &'static str,
    pub message: &'static str,
    pub amount: &'static str,
    pub duration: u64,
}
macro_rules! event {
    ($p:expr,$k:expr,$n:expr,$l:expr,$d:expr,$t:expr,$m:expr,$a:expr,$s:expr) => {
        Definition {
            platform: $p,
            kind: $k,
            name: $n,
            label: $l,
            design: $d,
            tone: $t,
            message: $m,
            amount: $a,
            duration: $s,
        }
    };
}
pub const CATALOG: [Definition; 16] = [
    event!(
        "twitch",
        "follow",
        "Seguidor",
        "NUEVO SEGUIDOR",
        "reference",
        "soft",
        "¡Bienvenido a la aventura!",
        "1",
        6
    ),
    event!(
        "twitch",
        "subscribe",
        "Suscripción",
        "NUEVA SUSCRIPCIÓN",
        "celebrate",
        "celebrate",
        "¡Gracias por encender el Nexus!",
        "1",
        7
    ),
    event!(
        "twitch",
        "resub",
        "Renovación",
        "SUSCRIPCIÓN RENOVADA",
        "celebrate",
        "celebrate",
        "{cantidad} meses de apoyo",
        "3",
        7
    ),
    event!(
        "twitch",
        "gift_subs",
        "Suscripciones regaladas",
        "SUBS REGALADAS",
        "gift",
        "sparkle",
        "{cantidad} regalos para la comunidad",
        "5",
        8
    ),
    event!(
        "twitch",
        "bits",
        "Bits",
        "GRACIAS POR LOS BITS",
        "support",
        "sparkle",
        "{cantidad} bits · ¡Gracias por el apoyo!",
        "100",
        6
    ),
    event!(
        "twitch",
        "raid",
        "Raid",
        "RAID ENTRANTE",
        "raid",
        "portal",
        "{cantidad} aventureros se unen",
        "42",
        9
    ),
    event!(
        "youtube",
        "subscriber",
        "Suscriptor",
        "NUEVO SUSCRIPTOR",
        "reference",
        "soft",
        "¡Bienvenido a la aventura!",
        "1",
        6
    ),
    event!(
        "youtube",
        "member",
        "Miembro",
        "NUEVO MIEMBRO",
        "celebrate",
        "celebrate",
        "¡Gracias por unirte a la aventura!",
        "1",
        7
    ),
    event!(
        "youtube",
        "gift_members",
        "Membresías regaladas",
        "MIEMBROS REGALADOS",
        "gift",
        "sparkle",
        "{cantidad} membresías para la comunidad",
        "5",
        8
    ),
    event!(
        "youtube",
        "super_chat",
        "Super Chat",
        "SUPER CHAT",
        "support",
        "sparkle",
        "{cantidad} · {mensaje}",
        "5 €",
        8
    ),
    event!(
        "youtube",
        "super_sticker",
        "Super Sticker",
        "SUPER STICKER",
        "support",
        "sparkle",
        "{cantidad} · ¡Gracias por tu sticker!",
        "2 €",
        7
    ),
    event!(
        "tiktok",
        "follow",
        "Seguidor",
        "NUEVO SEGUIDOR",
        "reference",
        "soft",
        "¡Bienvenido a la aventura!",
        "1",
        6
    ),
    event!(
        "tiktok",
        "subscribe",
        "Suscripción",
        "NUEVA SUSCRIPCIÓN",
        "celebrate",
        "celebrate",
        "¡Gracias por encender el Nexus!",
        "1",
        7
    ),
    event!(
        "tiktok",
        "gift",
        "Regalo",
        "NUEVO REGALO",
        "gift",
        "sparkle",
        "{cantidad} regalos · ¡Gracias por el apoyo!",
        "3",
        7
    ),
    event!(
        "tiktok",
        "like",
        "Me gusta",
        "NUEVOS CORAZONES",
        "heart",
        "heart",
        "{cantidad} corazones para la aventura",
        "100",
        6
    ),
    event!(
        "tiktok",
        "share",
        "Compartir",
        "GRACIAS POR COMPARTIR",
        "heart",
        "heart",
        "¡Gracias por llevar la aventura más lejos!",
        "1",
        6
    ),
];
pub fn definition(platform: &str, kind: &str) -> Result<&'static Definition, String> {
    CATALOG
        .iter()
        .find(|d| d.platform == platform && d.kind == kind)
        .ok_or("Ese evento no pertenece a la plataforma.".into())
}
pub fn first_kind(platform: &str) -> Result<&'static str, String> {
    CATALOG
        .iter()
        .find(|d| d.platform == platform)
        .map(|d| d.kind)
        .ok_or("Plataforma no válida.".into())
}
/// Sustitución de una sola pasada: los valores se insertan literalmente.
pub fn render_text(template: &str, cfg: &Config) -> String {
    let mut out = String::new();
    let mut rest = template;
    while let Some(i) = rest.find('{') {
        out.push_str(&rest[..i]);
        rest = &rest[i..];
        let mut found = false;
        for (token, value) in [
            ("{usuario}", cfg.sample_name.as_str()),
            ("{cantidad}", cfg.sample_amount.as_str()),
            ("{mensaje}", cfg.sample_note.as_str()),
        ] {
            if rest.starts_with(token) {
                out.push_str(value);
                rest = &rest[token.len()..];
                found = true;
                break;
            }
        }
        if !found {
            out.push('{');
            rest = &rest[1..];
        }
    }
    out.push_str(rest);
    out
}
impl Settings {
    pub fn channel(&self, platform: &str) -> Result<&Config, String> {
        match platform {
            "twitch" => Ok(&self.twitch),
            "youtube" => Ok(&self.youtube),
            "tiktok" => Ok(&self.tiktok),
            _ => Err("Plataforma no válida.".into()),
        }
    }
    pub fn defaults(&self, platform: &str, kind: &str) -> Result<Config, String> {
        let d = definition(platform, kind)?;
        let base = Settings::default();
        let mut cfg = base.channel(platform)?.clone();
        cfg.title = self.channel(platform)?.title.clone();
        cfg.event_label = d.label.into();
        cfg.design = d.design.into();
        cfg.tone = d.tone.into();
        cfg.message_template = d.message.into();
        cfg.sample_amount = d.amount.into();
        cfg.duration = d.duration;
        cfg.sample_name = match kind {
            "raid" => "PIXELCREW",
            "gift_subs" | "gift_members" | "gift" => "NICO",
            "super_chat" | "super_sticker" => "MATEO",
            "subscribe" | "resub" => "DIEGO_GG",
            _ => "LUNA_27",
        }
        .into();
        Ok(cfg)
    }
    pub fn template(&self, platform: &str, kind: &str) -> Result<Config, String> {
        let d = definition(platform, kind)?;
        let mut cfg = if let Some(c) = self.event_templates.get(&format!("{platform}/{kind}")) {
            c.clone()
        } else if kind == first_kind(platform)? {
            let mut c = self.channel(platform)?.clone();
            if c.event_label.is_empty() {
                c.event_label = d.label.into()
            }
            c
        } else {
            self.defaults(platform, kind)?
        };
        cfg.muted = false;
        cfg.paused = false;
        Ok(cfg)
    }
}
#[derive(Clone, Debug, Serialize)]
pub struct Event {
    pub id: u64,
    pub title: String,
    pub message: String,
    pub test: bool,
    pub replay: bool,
    pub kind: String,
    #[serde(skip_serializing)]
    config: Config,
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
    fn push(
        &mut self,
        platform: &str,
        title: String,
        message: String,
        test: bool,
        kind: &str,
        mut cfg: Config,
    ) -> Result<(), String> {
        let i = index(platform)?;
        if title.trim().is_empty() || title.chars().count() > 80 || message.chars().count() > 240 {
            return Err("Título o mensaje demasiado largo o vacío.".into());
        }
        cfg.validate()?;
        if !cfg.enabled && kind != "manual" {
            return Err("Esta alerta está desactivada.".into());
        }
        if self.channels[i].queue.len() >= 50 {
            return Err("La cola está llena (50 alertas).".into());
        }
        cfg.muted = false;
        cfg.paused = false;
        self.sequence += 1;
        self.channels[i].queue.push_back(Event {
            id: self.sequence,
            title,
            message,
            test,
            replay: false,
            kind: kind.into(),
            config: cfg,
        });
        Ok(())
    }
    pub fn enqueue(
        &mut self,
        platform: &str,
        title: String,
        message: String,
        test: bool,
    ) -> Result<(), String> {
        let cfg = self.settings.channel(platform)?.clone();
        self.push(
            platform,
            title,
            message,
            test,
            if test {
                first_kind(platform)?
            } else {
                "manual"
            },
            cfg,
        )
    }
    pub fn test_event(&mut self, platform: &str, kind: &str) -> Result<(), String> {
        let cfg = self.settings.template(platform, kind)?;
        self.push(
            platform,
            cfg.sample_name.clone(),
            render_text(&cfg.message_template, &cfg),
            true,
            kind,
            cfg,
        )
    }
    pub fn receive(&mut self, platform:&str, kind:&str, name:&str, amount:&str, note:&str)->Result<(),String>{
        let mut cfg=self.settings.template(platform,kind)?;
        if !cfg.enabled {return Ok(());}
        cfg.sample_name=name.chars().take(40).collect();
        if cfg.sample_name.trim().is_empty(){cfg.sample_name="Anónimo".into();}
        cfg.sample_amount=amount.chars().take(24).collect();cfg.sample_note=note.chars().take(120).collect();
        let message=render_text(&cfg.message_template,&cfg).chars().take(240).collect();
        self.push(platform,cfg.sample_name.clone(),message,false,kind,cfg)
    }
    pub fn action(&mut self, platform: &str, action: &str) -> Result<(), String> {
        let i = index(platform)?;
        match action {
            "test" => self.test_event(platform, first_kind(platform)?)?,
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
                let sound_at = if event.config.sound && !cfg.muted && event.config.volume > 0 {
                    let t = if self.settings.coordinate_audio {
                        now.max(self.audio_until)
                    } else {
                        now
                    };
                    let length=if event.config.audio_id.is_empty(){800}else{((event.config.audio_end-event.config.audio_start)*1000.0).ceil() as u64+200};
                    self.audio_until = t + length;
                    Some(t)
                } else {
                    None
                };
                let event_duration = event.config.duration;
                channel.last = Some(event.clone());
                channel.current = Some(Playback {
                    event,
                    started_at: sound_at.unwrap_or(now),
                    ends_at: sound_at.unwrap_or(now) + event_duration * 1000,
                    sound_at,
                });
            }
        }
        let mut display = channel
            .current
            .as_ref()
            .map(|p| p.event.config.clone())
            .unwrap_or_else(|| cfg.clone());
        display.muted = cfg.muted;
        display.paused = cfg.paused;
        Ok(
            serde_json::json!({"config":display,"event":channel.current,"duplicate":false,"pending":channel.queue.len()}),
        )
    }
    pub fn status(&self) -> serde_json::Value {
        let mut events = serde_json::Map::new();
        for platform in ["twitch", "youtube", "tiktok"] {
            let rows:Vec<_>=CATALOG.iter().filter(|d|d.platform==platform).map(|d|serde_json::json!({"kind":d.kind,"name":d.name,"config":self.settings.template(platform,d.kind).unwrap(),"defaults":self.settings.defaults(platform,d.kind).unwrap()})).collect();
            events.insert(platform.into(), serde_json::json!(rows));
        }
        serde_json::json!({"settings":self.settings,"events":events,"twitch_pending":self.channels[0].queue.len(),"youtube_pending":self.channels[1].queue.len(),"tiktok_pending":self.channels[2].queue.len(),"connected":false})
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
        assert_eq!(settings.twitch.name_size, 40);
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
    #[test]
    fn all_sixteen_presets_validate_and_stay_in_their_platform() {
        let mut e = Engine::default();
        assert_eq!(CATALOG.len(), 16);
        for d in CATALOG {
            let c = e.settings.defaults(d.platform, d.kind).unwrap();
            c.validate().unwrap();
            e.test_event(d.platform, d.kind).unwrap();
        }
        let s = e.status();
        assert_eq!(s["twitch_pending"], 6);
        assert_eq!(s["youtube_pending"], 5);
        assert_eq!(s["tiktok_pending"], 5);
        assert!(e.test_event("youtube", "raid").is_err());
        assert!(e.test_event("twitch", "super_chat").is_err());
    }
    #[test]
    fn a_shared_queue_keeps_each_events_snapshot_and_replay() {
        let mut e = Engine::default();
        e.test_event("twitch", "follow").unwrap();
        let mut raid = e.settings.defaults("twitch", "raid").unwrap();
        raid.duration = 9;
        raid.volume = 30;
        e.settings
            .event_templates
            .insert("twitch/raid".into(), raid.clone());
        e.test_event("twitch", "raid").unwrap();
        raid.duration = 3;
        raid.volume = 100;
        e.settings
            .event_templates
            .insert("twitch/raid".into(), raid);
        let first = e.poll("twitch", "viewer-twitch", 10000).unwrap();
        assert_eq!(first["event"]["event"]["kind"], "follow");
        assert_eq!(first["config"]["design"], "reference");
        let second = e.poll("twitch", "viewer-twitch", 16001).unwrap();
        assert_eq!(second["event"]["event"]["kind"], "raid");
        assert_eq!(second["config"]["duration"], 9);
        assert_eq!(second["config"]["volume"], 30);
        assert_eq!(second["event"]["ends_at"], 25001);
        assert!(second["event"]["event"].get("config").is_none());
        e.settings.twitch.muted = true;
        assert_eq!(
            e.poll("twitch", "viewer-twitch", 17000).unwrap()["config"]["muted"],
            true
        );
        e.action("twitch", "replay").unwrap();
        let replay = e.poll("twitch", "viewer-twitch", 26000).unwrap();
        assert_eq!(replay["event"]["event"]["kind"], "raid");
        assert_eq!(replay["event"]["event"]["replay"], true);
        assert_eq!(replay["config"]["volume"], 30);
    }
    #[test]
    fn disabled_event_does_not_consume_queue_and_other_events_work() {
        let mut e = Engine::default();
        let mut cfg = e.settings.defaults("youtube", "super_chat").unwrap();
        cfg.enabled = false;
        e.settings
            .event_templates
            .insert("youtube/super_chat".into(), cfg);
        assert!(e.test_event("youtube", "super_chat").is_err());
        assert_eq!(e.status()["youtube_pending"], 0);
        e.test_event("youtube", "member").unwrap();
        assert_eq!(e.status()["youtube_pending"], 1);
    }
    #[test]
    fn event_preferences_roundtrip_without_touching_legacy_follower() {
        let mut e = Engine::default();
        e.settings.twitch.sample_name = "Mi seguidor".into();
        let mut cfg = e.settings.defaults("twitch", "subscribe").unwrap();
        cfg.duration = 12;
        cfg.design = "gift".into();
        e.settings
            .event_templates
            .insert("twitch/subscribe".into(), cfg);
        let restored: Settings =
            serde_json::from_str(&serde_json::to_string(&e.settings).unwrap()).unwrap();
        restored.validate().unwrap();
        assert_eq!(
            restored.template("twitch", "follow").unwrap().sample_name,
            "Mi seguidor"
        );
        assert_eq!(
            restored.template("twitch", "subscribe").unwrap().duration,
            12
        );
        assert_eq!(
            restored.template("twitch", "subscribe").unwrap().design,
            "gift"
        );
        assert_eq!(
            restored.template("youtube", "member").unwrap().design,
            "celebrate"
        );
    }
    #[test]
    fn placeholder_values_are_literal_and_expansions_are_bounded() {
        let mut c = Config::default();
        c.sample_name = "$& {cantidad}".into();
        c.sample_amount = "5 €".into();
        c.sample_note = "{usuario}".into();
        assert_eq!(
            render_text("{usuario} / {cantidad} / {mensaje} / {otro}", &c),
            "$& {cantidad} / 5 € / {usuario} / {otro}"
        );
        c.message_template = "{mensaje}{mensaje}{mensaje}".into();
        c.sample_note = "x".repeat(120);
        assert!(c.validate().is_err());
    }
    #[test]
    fn invalid_kind_design_and_tone_are_rejected() {
        let mut s = Settings::default();
        s.event_templates
            .insert("youtube/raid".into(), Config::default());
        assert!(s.validate().is_err());
        let mut c = Config::default();
        c.design = "../file".into();
        assert!(c.validate().is_err());
        c.design = "reference".into();
        c.tone = "external".into();
        assert!(c.validate().is_err());
    }
}
