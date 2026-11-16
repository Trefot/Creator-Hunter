//! TikTok Desktop Login Kit: PKCE uses hex SHA-256 (provider specification).
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
pub struct Attempt {
    pub state: String,
    pub verifier: String,
    pub key: String,
    pub secret: String,
    pub profile: String,
    pub started: u64,
}
pub fn nonce() -> String {
    (0..32)
        .map(|_| format!("{:02x}", rand::random::<u8>()))
        .collect()
}
pub fn take_attempt(
    pending: &mut Option<Attempt>,
    state: &str,
    now: u64,
) -> Result<Attempt, String> {
    let valid = pending.as_ref().is_some_and(|p| {
        !state.is_empty() && p.state == state && now >= p.started && now - p.started < 600_000
    });
    if !valid {
        return Err("La autorización no corresponde a esta sesión o caducó. Vuelve a autorizar desde Nexus.".into());
    }
    pending
        .take()
        .ok_or("No hay una autorización pendiente.".into())
}
pub fn authorize_url(
    key: &str,
    state: &str,
    verifier: &str,
    redirect: &str,
) -> Result<String, String> {
    if key.is_empty()
        || key.len() > 256
        || !key
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || c == b'_' || c == b'-')
    {
        return Err("Introduce el Client key de tu aplicación de TikTok.".into());
    }
    let challenge = format!("{:x}", Sha256::digest(verifier.as_bytes()));
    let mut url = reqwest::Url::parse("https://www.tiktok.com/v2/auth/authorize/")
        .map_err(|_| "No se pudo preparar TikTok.")?;
    url.query_pairs_mut().extend_pairs([
        ("client_key", key),
        ("response_type", "code"),
        ("scope", "user.info.basic,user.info.stats"),
        ("redirect_uri", redirect),
        ("state", state),
        ("code_challenge_method", "S256"),
        ("code_challenge", challenge.as_str()),
    ]);
    Ok(url.into())
}
pub fn credentials(
    body: &Value,
    key: &str,
    secret: &str,
    now: u64,
    expected: Option<&str>,
) -> Result<Value, String> {
    let get = |name: &str| {
        body[name]
            .as_str()
            .filter(|s| crate::metrics_core::token_ok(s))
            .ok_or_else(|| {
                "TikTok no devolvió una autorización completa. Vuelve a conectar.".to_string()
            })
    };
    let token = get("access_token")?;
    let refresh = get("refresh_token")?;
    let id = get("open_id")?;
    if !crate::metrics_core::safe_id(id) || expected.is_some_and(|x| x != id) {
        return Err("TikTok devolvió otra cuenta. Vuelve a conectar la cuenta correcta.".into());
    }
    let scope = body["scope"]
        .as_str()
        .ok_or("TikTok no devolvió los permisos concedidos.")?;
    if !["user.info.basic", "user.info.stats"]
        .iter()
        .all(|s| scope.split(',').any(|v| v.trim() == *s))
    {
        return Err(
            "Autoriza la información básica y las estadísticas de tu cuenta en TikTok.".into(),
        );
    }
    let expiry = |name: &str| -> Result<u64, String> {
        let seconds = body[name]
            .as_u64()
            .filter(|n| *n > 0 && *n <= 10 * 366 * 86400)
            .ok_or("TikTok no devolvió una duración válida de la autorización.")?;
        now.checked_add(seconds * 1000)
            .ok_or("Duración no válida.".into())
    };
    Ok(
        json!({"token":token,"refresh_token":refresh,"account_id":id,"client_key":key,"client_secret":secret,"expires_ms":expiry("expires_in")?,"refresh_expires_ms":expiry("refresh_expires_in")?,"scope":scope}),
    )
}
/// Never return provider descriptions: they may contain sensitive request details.
pub fn oauth_error(body: &Value) -> Option<&'static str> {
    match body["error"].as_str()? {
        "invalid_client" => Some(
            "TikTok no reconoce las credenciales. Revisa el Client key y Client secret del mismo Sandbox.",
        ),
        "invalid_grant" => Some(
            "El código o la renovación de TikTok caducó o ya se utilizó. Autoriza de nuevo y comprueba la dirección de retorno.",
        ),
        "invalid_scope" => Some(
            "Activa user.info.basic y user.info.stats en tu Sandbox, guarda con Apply changes y vuelve a autorizar.",
        ),
        "invalid_request" => Some(
            "TikTok rechazó la solicitud. Comprueba la dirección de retorno y la configuración Desktop del mismo Sandbox.",
        ),
        _ => None,
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    fn attempt() -> Attempt {
        Attempt {
            state: "session".into(),
            verifier: nonce(),
            key: "client".into(),
            secret: "private".into(),
            profile: "profile".into(),
            started: 1000,
        }
    }
    #[test]
    fn callback_rejects_forgery_expiry_and_replay() {
        let mut p = Some(attempt());
        assert!(take_attempt(&mut p, "wrong", 1100).is_err());
        assert!(p.is_some());
        assert!(take_attempt(&mut p, "session", 601000).is_err());
        assert!(take_attempt(&mut p, "session", 900).is_err());
        assert!(take_attempt(&mut p, "session", 1100).is_ok());
        assert!(take_attempt(&mut p, "session", 1101).is_err());
    }
    #[test]
    fn authorization_uses_hex_pkce_and_no_client_secret() {
        let verifier = "a".repeat(64);
        let u = authorize_url(
            "client",
            "state",
            &verifier,
            "http://127.0.0.1:7878/tiktok/callback",
        )
        .unwrap();
        let url = reqwest::Url::parse(&u).unwrap();
        let q: std::collections::HashMap<_, _> = url.query_pairs().into_owned().collect();
        assert_eq!(
            q["code_challenge"],
            format!("{:x}", Sha256::digest(verifier.as_bytes()))
        );
        assert_eq!(q["redirect_uri"], "http://127.0.0.1:7878/tiktok/callback");
        assert!(!q.contains_key("client_secret"));
        assert!(!q.contains_key("code_verifier"));
        assert_ne!(nonce(), nonce());
    }
    #[test]
    fn rotation_requires_identity_permissions_new_refresh_and_real_expiry() {
        let mut v = json!({"access_token":"access","refresh_token":"rotated","open_id":"user","scope":"user.info.basic,user.info.stats","expires_in":7200,"refresh_expires_in":15552000});
        let c = credentials(&v, "client", "private", 1000, Some("user")).unwrap();
        assert_eq!(c["refresh_token"], "rotated");
        assert_eq!(c["expires_ms"], 7201000u64);
        assert!(credentials(&v, "client", "private", 1000, Some("other")).is_err());
        v["scope"] = json!("user.info.basic");
        assert!(credentials(&v, "client", "private", 1000, None).is_err());
        v["scope"] = json!("user.info.basic,user.info.stats");
        v["expires_in"] = json!(0);
        assert!(credentials(&v, "client", "private", 1000, None).is_err());
        v["expires_in"] = json!(7200);
        v["refresh_token"] = Value::Null;
        assert!(credentials(&v, "client", "private", 1000, None).is_err());
    }
    #[test]
    fn oauth_errors_explain_setup_without_echoing_secrets() {
        let e = json!({"error":"invalid_client","error_description":"private-secret-code"});
        let message = oauth_error(&e).unwrap();
        assert!(message.contains("Client key"));
        assert!(!message.contains("private-secret-code"));
        assert!(oauth_error(&json!({"error":"untrusted-secret-code"})).is_none());
    }
}
