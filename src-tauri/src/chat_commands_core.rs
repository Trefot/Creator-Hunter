//! Comandos de chat (D-030): reglas sin red ni base de datos, con tests.
use serde_json::{Value, json};

pub const MAX_COMMANDS: usize = 30;

/// Comandos iniciales. `!redes` y `!discord` llevan un texto que el usuario debe editar.
pub fn defaults() -> Value {
    json!({
        "enabled": false,
        "commands": [
            {"trigger":"!platino","response":"🏆 Llevo {platinos} platinos. Ahora mismo: {juego} ({progreso}).","cooldown":30,"enabled":true},
            {"trigger":"!juego","response":"🎮 Estoy jugando {juego}. Objetivo de hoy: {objetivo}.","cooldown":30,"enabled":true},
            {"trigger":"!redes","response":"📲 Escribe aquí tus redes (edítalo en Nexus → En directo → Comandos).","cooldown":60,"enabled":false},
            {"trigger":"!discord","response":"💜 Únete a la comunidad: pega aquí el enlace de tu Discord.","cooldown":60,"enabled":false}
        ]
    })
}

fn valid_trigger(t: &str) -> bool {
    let rest = t.strip_prefix('!').unwrap_or("");
    (1..=24).contains(&rest.chars().count())
        && rest.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '-')
}

/// Normaliza y comprueba la configuración antes de guardarla.
pub fn validate(cfg: &Value) -> Result<Value, String> {
    let list = cfg["commands"].as_array().ok_or("Faltan los comandos.")?;
    if list.len() > MAX_COMMANDS {
        return Err(format!("Como máximo {MAX_COMMANDS} comandos."));
    }
    let mut seen = std::collections::HashSet::new();
    let mut out = Vec::new();
    for c in list {
        let trigger = c["trigger"].as_str().unwrap_or("").trim().to_lowercase();
        if !valid_trigger(&trigger) {
            return Err(format!("«{trigger}» no es válido: empieza por ! y usa solo letras, números, _ o - (máx. 24)."));
        }
        if !seen.insert(trigger.clone()) {
            return Err(format!("El comando {trigger} está repetido."));
        }
        let response = c["response"].as_str().unwrap_or("").trim().to_string();
        if response.is_empty() || response.chars().count() > 400 {
            return Err(format!("La respuesta de {trigger} debe tener entre 1 y 400 caracteres."));
        }
        // Una respuesta que empieza por ! o / podría disparar otro comando o una orden del chat.
        if response.starts_with('!') || response.starts_with('/') {
            return Err(format!("La respuesta de {trigger} no puede empezar por ! ni por /."));
        }
        let cooldown = c["cooldown"].as_i64().unwrap_or(30).clamp(0, 3600);
        out.push(json!({"trigger":trigger,"response":response,"cooldown":cooldown,"enabled":c["enabled"] != false}));
    }
    Ok(json!({"enabled": cfg["enabled"] == true, "commands": out}))
}

/// El comando que corresponde a un mensaje: su primera palabra, sin distinguir mayúsculas.
pub fn find<'a>(cfg: &'a Value, text: &str) -> Option<&'a Value> {
    let word = text.split_whitespace().next()?.to_lowercase();
    if !word.starts_with('!') {
        return None;
    }
    cfg["commands"].as_array()?.iter().find(|c| c["enabled"] != false && c["trigger"].as_str() == Some(word.as_str()))
}

/// Datos que pueden aparecer en las respuestas.
#[derive(Default, Debug, Clone)]
pub struct Vars {
    pub user: String,
    pub game: Option<String>,
    pub platinos: i64,
    pub earned: i64,
    pub total: i64,
    pub target: Option<String>,
    pub counters: Vec<(String, i64)>,
}

/// Rellena {usuario}, {juego}, {platinos}, {progreso}, {objetivo} y {contador:Nombre}.
pub fn render(template: &str, v: &Vars) -> String {
    let progress = if v.total > 0 {
        format!("{} % de trofeos", (v.earned * 100) / v.total)
    } else {
        "sin trofeos registrados".into()
    };
    let mut out = template
        .replace("{usuario}", &v.user)
        .replace("{juego}", v.game.as_deref().unwrap_or("un juego sin elegir"))
        .replace("{platinos}", &v.platinos.to_string())
        .replace("{progreso}", &progress)
        .replace("{objetivo}", v.target.as_deref().unwrap_or("sin objetivo marcado"));
    // {contador:Nombre} sin distinguir mayúsculas; si no existe, se indica.
    while let Some(start) = out.find("{contador:") {
        let Some(len) = out[start..].find('}') else { break };
        let name = out[start + 10..start + len].trim().to_string();
        let value = v
            .counters
            .iter()
            .find(|(n, _)| n.eq_ignore_ascii_case(&name))
            .map(|(_, value)| value.to_string())
            .unwrap_or_else(|| "?".into());
        out.replace_range(start..start + len + 1, &value);
    }
    out
}

/// Recorta al límite del chat de cada plataforma (Twitch 500, YouTube 200).
pub fn fit(text: &str, platform: &str) -> String {
    let max = if platform == "youtube" { 200 } else { 500 };
    if text.chars().count() <= max {
        text.to_string()
    } else {
        text.chars().take(max - 1).collect::<String>() + "…"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_are_valid_and_finds_commands_case_insensitive() {
        let cfg = validate(&defaults()).unwrap();
        assert_eq!(cfg["enabled"], false);
        assert_eq!(find(&cfg, "!PLATINO por favor").unwrap()["trigger"], "!platino");
        assert!(find(&cfg, "hola !platino").is_none());
        // Los desactivados no responden.
        assert!(find(&cfg, "!redes").is_none());
        assert!(find(&cfg, "!nada").is_none());
    }

    #[test]
    fn rejects_unsafe_or_bad_commands() {
        let bad = |trigger: &str, response: &str| validate(&json!({"commands":[{"trigger":trigger,"response":response}]})).is_err();
        assert!(bad("platino", "hola"));
        assert!(bad("!con espacio", "hola"));
        assert!(bad("!ok", "!otro comando"));
        assert!(bad("!ok", "/ban alguien"));
        assert!(bad("!ok", ""));
        assert!(validate(&json!({"commands":[{"trigger":"!a","response":"x"},{"trigger":"!A","response":"y"}]})).is_err());
        let ok = validate(&json!({"commands":[{"trigger":" !Cofres ","response":"📦 {contador:cofres abiertos}","cooldown":99999}]})).unwrap();
        assert_eq!(ok["commands"][0]["trigger"], "!cofres");
        assert_eq!(ok["commands"][0]["cooldown"], 3600);
    }

    #[test]
    fn renders_variables_and_fits_platform_limits() {
        let v = Vars {
            user: "ana".into(),
            game: Some("Black Myth: Wukong".into()),
            platinos: 12,
            earned: 26,
            total: 36,
            target: None,
            counters: vec![("Cofres abiertos".into(), 11471)],
        };
        assert_eq!(
            render("Hola {usuario}: {platinos} platinos, {juego} al {progreso}. {objetivo}. Cofres {contador:cofres abiertos} {contador:no existe}", &v),
            "Hola ana: 12 platinos, Black Myth: Wukong al 72 % de trofeos. sin objetivo marcado. Cofres 11471 ?"
        );
        let long = "a".repeat(450);
        assert_eq!(fit(&long, "twitch").chars().count(), 450);
        assert_eq!(fit(&long, "youtube").chars().count(), 200);
    }
}
