//! Validación y mensajes de Discord sin credenciales ni acceso a red.
use serde_json::{Value, json};

pub const PLATFORMS: [&str; 4] = ["twitch", "youtube", "tiktok", "instagram"];
pub fn webhook_url(raw: &str) -> Result<String, String> {
    let raw = raw.trim();
    let rest = raw
        .strip_prefix("https://discord.com/api/webhooks/")
        .ok_or("Usa un webhook HTTPS de discord.com/api/webhooks/.")?;
    let parts: Vec<_> = rest.split('/').collect();
    if parts.len() != 2
        || parts[0].is_empty()
        || !parts[0].bytes().all(|c| c.is_ascii_digit())
        || parts[1].len() < 20
        || parts[1].len() > 200
        || !parts[1]
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || c == b'_' || c == b'-')
    {
        return Err("El enlace del webhook no es válido. Cópialo completo desde Discord.".into());
    }
    Ok(raw.into())
}
pub fn content_url(platform: &str, raw: &str) -> Result<String, String> {
    let raw = raw.trim();
    let rest = raw
        .strip_prefix("https://")
        .ok_or("El enlace debe usar HTTPS.")?;
    if raw.len() > 1500 || raw.chars().any(|c| c.is_control() || c.is_whitespace()) {
        return Err("Enlace no válido.".into());
    }
    let (host, path) = rest
        .split_once('/')
        .ok_or("Falta el contenido del enlace.")?;
    let hosts: &[&str] = match platform {
        "youtube" => &["youtube.com", "www.youtube.com", "youtu.be"],
        "twitch" => &["twitch.tv", "www.twitch.tv", "clips.twitch.tv"],
        "tiktok" => &[
            "tiktok.com",
            "www.tiktok.com",
            "vm.tiktok.com",
            "vt.tiktok.com",
        ],
        "instagram" => &["instagram.com", "www.instagram.com"],
        _ => return Err("Plataforma no disponible.".into()),
    };
    if !hosts.contains(&host) || path.is_empty() || path.contains('\\') {
        return Err("El enlace no corresponde a la plataforma seleccionada.".into());
    }
    // Ignore tracking parameters when identifying the same publication.
    let clean = raw.split('#').next().unwrap_or(raw);
    if platform == "youtube" && (path.starts_with("shorts/") || path.starts_with("live/")) {
        let id = path
            .split('/')
            .nth(1)
            .unwrap_or("")
            .split(['?', '#'])
            .next()
            .unwrap_or("");
        return content_url("youtube", &format!("https://www.youtube.com/watch?v={id}"));
    }
    if platform == "twitch" {
        let clean_path = path
            .split(['?', '#'])
            .next()
            .unwrap_or(path)
            .trim_end_matches('/');
        let clip = if host == "clips.twitch.tv" {
            Some(clean_path)
        } else {
            clean_path.split_once("/clip/").map(|(_, id)| id)
        };
        if let Some(id) = clip.filter(|id| {
            !id.is_empty()
                && id
                    .bytes()
                    .all(|c| c.is_ascii_alphanumeric() || c == b'_' || c == b'-')
        }) {
            return Ok(format!("https://clips.twitch.tv/{id}"));
        }
    }

    if platform == "youtube" && host != "youtu.be" && path.starts_with("watch?") {
        let id = path
            .split_once('?')
            .unwrap()
            .1
            .split('&')
            .find_map(|q| q.strip_prefix("v="))
            .filter(|id| {
                !id.is_empty()
                    && id
                        .bytes()
                        .all(|c| c.is_ascii_alphanumeric() || c == b'_' || c == b'-')
            })
            .ok_or("Falta el identificador del vídeo de YouTube.")?;
        return Ok(format!("https://www.youtube.com/watch?v={id}"));
    }
    if platform == "youtube" && host == "youtu.be" {
        let id = path.split(['?', '#', '/']).next().unwrap();
        return content_url("youtube", &format!("https://www.youtube.com/watch?v={id}"));
    }
    let canonical = clean
        .split('?')
        .next()
        .unwrap_or(clean)
        .trim_end_matches('/');
    Ok(
        if host == "twitch.tv" || host == "instagram.com" || host == "tiktok.com" {
            canonical.replacen(
                &format!("https://{host}/"),
                &format!("https://www.{host}/"),
                1,
            )
        } else {
            canonical.into()
        },
    )
}
pub fn payload(
    platform: &str,
    live: bool,
    title: &str,
    url: &str,
    thumbnail: Option<&str>,
) -> Value {
    let label = match platform {
        "twitch" => "Twitch",
        "youtube" => "YouTube",
        "tiktok" => "TikTok",
        _ => "Instagram",
    };
    let mut embed = json!({"title": title.chars().take(200).collect::<String>(), "url":url,
        "description":format!("{} · {label}", if live {"Trefot está en directo"} else {"Nuevo contenido de Trefot"}),
        "color": match platform {"twitch"=>0x9146ff,"youtube"=>0xff0033,"tiktok"=>0x25f4ee,_=>0xe1306c},
        "footer":{"text":"Nexus Studio · Trefot"}});
    if let Some(image) = thumbnail.filter(|s| s.starts_with("https://") && s.len() < 2000) {
        embed["thumbnail"] = json!({"url":image});
    }
    json!({"username":"Nexus · Trefot", "allowed_mentions":{"parse":[]}, "embeds":[embed]})
}

/// Header validation before persisting user-selected PNGs (the UI also decodes them).
pub fn validate_brand_png(bytes: &[u8]) -> Result<(), String> {
    if bytes.len() > 6 * 1024 * 1024
        || bytes.len() < 33
        || bytes[..8] != [137, 80, 78, 71, 13, 10, 26, 10]
        || bytes[8..12] != [0, 0, 0, 13]
        || &bytes[12..16] != b"IHDR"
    {
        return Err("Elige una imagen PNG válida de hasta 6 MB.".into());
    }
    let w = u32::from_be_bytes(bytes[16..20].try_into().unwrap());
    let h = u32::from_be_bytes(bytes[20..24].try_into().unwrap());
    if w == 0 || h == 0 || w > 4096 || h > 4096 {
        return Err("La imagen debe medir entre 1 y 4096 píxeles por lado.".into());
    }
    Ok(())
}
/// Discord accepts payload_json + files[0]; no public image hosting is required.
pub fn branded_multipart(
    mut message: Value,
    png: &[u8],
    boundary: &str,
) -> Result<Vec<u8>, String> {
    validate_brand_png(png)?;
    if boundary.len() < 16
        || !boundary
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-')
    {
        return Err("No se pudo preparar el adjunto.".into());
    }
    if png
        .windows(boundary.len())
        .any(|w| w == boundary.as_bytes())
    {
        return Err("Vuelve a intentar el envío de la imagen.".into());
    }
    if !message["embeds"].is_array() || message["embeds"].as_array().unwrap().is_empty() {
        return Err("El aviso no tiene una tarjeta válida.".into());
    }
    message["embeds"][0]["image"] = json!({"url":"attachment://nexus-directo.png"});
    message["attachments"] = json!([{"id":0,"filename":"nexus-directo.png"}]);
    let mut data=format!("--{boundary}\r\nContent-Disposition: form-data; name=\"payload_json\"\r\nContent-Type: application/json\r\n\r\n{}\r\n--{boundary}\r\nContent-Disposition: form-data; name=\"files[0]\"; filename=\"nexus-directo.png\"\r\nContent-Type: image/png\r\n\r\n",message).into_bytes();
    data.extend_from_slice(png);
    data.extend_from_slice(format!("\r\n--{boundary}--\r\n").as_bytes());
    Ok(data)
}
