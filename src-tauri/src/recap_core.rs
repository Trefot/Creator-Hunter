//! Cálculos del resumen del directo, sin base de datos ni red (D-029).
use serde_json::{Value, json};
use std::collections::BTreeMap;

#[derive(Debug, Clone, PartialEq)]
pub struct Event {
    pub platform: String,
    pub kind: String,
    pub name: String,
    pub amount: String,
}

/// Orden fijo en el que se muestran los totales.
const ORDER: [&str; 11] = [
    "follow",
    "subscriber",
    "subscribe",
    "resub",
    "gift_subs",
    "member",
    "gift_members",
    "bits",
    "super_chat",
    "super_sticker",
    "raid",
];

/// Cantidad numérica de un evento (bits, regalos, espectadores de un raid); 1 si no la tiene.
pub fn number(amount: &str) -> i64 {
    amount.trim().trim_matches('"').parse::<i64>().unwrap_or(1).max(0)
}

/// Eventos cuya cantidad es una suma con sentido (bits, regalos, espectadores).
fn summable(kind: &str) -> bool {
    matches!(kind, "bits" | "gift_subs" | "gift_members" | "raid")
}

/// Eventos de apoyo que se agradecen por nombre.
fn supportive(kind: &str) -> bool {
    !matches!(kind, "follow" | "subscriber")
}

/// Totales por plataforma y tipo, personas nuevas y apoyos destacados.
pub fn summarize(events: &[Event]) -> Value {
    let mut totals: BTreeMap<(usize, String, String), (i64, i64)> = BTreeMap::new();
    let mut supporters: BTreeMap<(String, String, String), (i64, Vec<String>)> = BTreeMap::new();
    let mut new_people = 0;
    for e in events {
        let rank = ORDER.iter().position(|k| *k == e.kind).unwrap_or(ORDER.len());
        let entry = totals.entry((rank, e.platform.clone(), e.kind.clone())).or_default();
        entry.0 += 1;
        if summable(&e.kind) {
            entry.1 += number(&e.amount);
        }
        if matches!(e.kind.as_str(), "follow" | "subscriber") {
            new_people += 1;
        }
        if supportive(&e.kind) && !e.name.trim().is_empty() {
            let s = supporters
                .entry((e.platform.clone(), e.kind.clone(), e.name.trim().to_string()))
                .or_default();
            if summable(&e.kind) {
                s.0 += number(&e.amount);
            } else {
                s.0 += 1;
                if matches!(e.kind.as_str(), "super_chat" | "super_sticker") && !e.amount.is_empty() {
                    s.1.push(e.amount.clone());
                }
            }
        }
    }
    let totals: Vec<Value> = totals
        .into_iter()
        .map(|((_, platform, kind), (count, sum))| json!({"platform":platform,"kind":kind,"count":count,"sum":sum}))
        .collect();
    let mut list: Vec<_> = supporters.into_iter().collect();
    // Primero lo que más pesa: raids y bits por cantidad, luego el resto por número de apoyos.
    list.sort_by(|a, b| {
        let weight = |k: &str| ORDER.iter().position(|o| *o == k).unwrap_or(0);
        (b.1.0, weight(&b.0.1)).cmp(&(a.1.0, weight(&a.0.1)))
    });
    let supporters: Vec<Value> = list
        .into_iter()
        .take(10)
        .map(|((platform, kind, name), (amount, shown))| {
            json!({"platform":platform,"kind":kind,"name":name,"amount":amount,"detail":shown.join(", ")})
        })
        .collect();
    json!({"totals":totals,"supporters":supporters,"new_people":new_people,"events":events.len()})
}

/// "2 h 05 min", "45 min", "30 s".
pub fn duration_text(ms: i64) -> String {
    let s = ms.max(0) / 1000;
    let (h, m) = (s / 3600, (s % 3600) / 60);
    if h > 0 {
        format!("{h} h {m:02} min")
    } else if m > 0 {
        format!("{m} min")
    } else {
        format!("{s} s")
    }
}

fn label(kind: &str, n: i64) -> String {
    let one = n == 1;
    match kind {
        "follow" => if one { "nuevo seguidor" } else { "nuevos seguidores" }.into(),
        "subscriber" => if one { "nuevo suscriptor" } else { "nuevos suscriptores" }.into(),
        "subscribe" => if one { "suscripción" } else { "suscripciones" }.into(),
        "resub" => if one { "renovación" } else { "renovaciones" }.into(),
        "gift_subs" => if one { "sub regalada" } else { "subs regaladas" }.into(),
        "member" => if one { "miembro" } else { "miembros" }.into(),
        "gift_members" => if one { "membresía regalada" } else { "membresías regaladas" }.into(),
        "bits" => "bits".into(),
        "super_chat" => if one { "Super Chat" } else { "Super Chats" }.into(),
        "super_sticker" => if one { "Super Sticker" } else { "Super Stickers" }.into(),
        "raid" => if one { "raid" } else { "raids" }.into(),
        other => other.into(),
    }
}

/// Mensaje de agradecimiento para el canal de directos de Discord.
pub fn discord_body(recap: &Value) -> Value {
    let game = recap["game"].as_str().filter(|g| !g.is_empty());
    let duration = duration_text(recap["duration_ms"].as_i64().unwrap_or(0));
    let mut lines = Vec::new();
    for t in recap["summary"]["totals"].as_array().into_iter().flatten() {
        let kind = t["kind"].as_str().unwrap_or("");
        let n = if summable(kind) && kind != "raid" { t["sum"].as_i64().unwrap_or(0) } else { t["count"].as_i64().unwrap_or(0) };
        if n > 0 {
            lines.push(format!("• **{n}** {}", label(kind, n)));
        }
    }
    for c in recap["counters"].as_array().into_iter().flatten() {
        let delta = c["delta"].as_i64().unwrap_or(0);
        if delta > 0 {
            lines.push(format!("• {} {} **+{delta}**", c["icon"].as_str().unwrap_or(""), c["name"].as_str().unwrap_or("")));
        }
    }
    let trophies = recap["trophies"].as_array().map_or(0, |t| t.len());
    if trophies > 0 {
        lines.push(format!("• 🏆 **{trophies}** {}", if trophies == 1 { "trofeo conseguido" } else { "trofeos conseguidos" }));
    }
    let mut description = format!(
        "{}{duration} de directo.",
        game.map(|g| format!("**{g}** · ")).unwrap_or_default()
    );
    if !lines.is_empty() {
        description.push_str("\n\n");
        description.push_str(&lines.join("\n"));
    }
    let names: Vec<String> = recap["summary"]["supporters"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|s| s["name"].as_str().map(String::from))
        .take(8)
        .collect();
    if !names.is_empty() {
        description.push_str(&format!("\n\n💜 Gracias especialmente a {}.", names.join(", ")));
    }
    let embed = json!({
        "title": "¡Gracias por el directo!",
        "description": description.chars().take(3900).collect::<String>(),
        "color": 0x8b5cf6,
        "footer": {"text": "Nexus Studio · Trefot"}
    });
    json!({"username":"Nexus · Trefot","allowed_mentions":{"parse":[]},"embeds":[embed]})
}

#[cfg(test)]
mod tests {
    use super::*;
    fn ev(platform: &str, kind: &str, name: &str, amount: &str) -> Event {
        Event { platform: platform.into(), kind: kind.into(), name: name.into(), amount: amount.into() }
    }

    #[test]
    fn sums_amounts_counts_people_and_orders_supporters() {
        let events = vec![
            ev("twitch", "follow", "ana", "1"),
            ev("twitch", "follow", "beto", "1"),
            ev("youtube", "subscriber", "caro", "1"),
            ev("twitch", "bits", "beto", "100"),
            ev("twitch", "bits", "beto", "250"),
            ev("twitch", "raid", "streamer", "37"),
            ev("youtube", "super_chat", "dani", "$5.00"),
            ev("twitch", "gift_subs", "eva", "5"),
        ];
        let s = summarize(&events);
        assert_eq!(s["new_people"], 3);
        assert_eq!(s["events"], 8);
        let total = |kind: &str| s["totals"].as_array().unwrap().iter().find(|t| t["kind"] == kind).cloned().unwrap();
        assert_eq!(total("bits")["sum"], 350);
        assert_eq!(total("bits")["count"], 2);
        assert_eq!(total("raid")["sum"], 37);
        assert_eq!(total("gift_subs")["sum"], 5);
        assert_eq!(total("follow")["count"], 2);
        // Los seguidores no se agradecen por nombre; bits primero por cantidad.
        let names: Vec<_> = s["supporters"].as_array().unwrap().iter().map(|x| x["name"].as_str().unwrap().to_string()).collect();
        assert_eq!(names.first().unwrap(), "beto");
        assert!(!names.contains(&"ana".to_string()));
        assert_eq!(s["supporters"].as_array().unwrap().iter().find(|x| x["name"] == "dani").unwrap()["detail"], "$5.00");
    }

    #[test]
    fn empty_stream_and_amount_parsing() {
        let s = summarize(&[]);
        assert_eq!(s["events"], 0);
        assert!(s["totals"].as_array().unwrap().is_empty());
        assert_eq!(number("\"12\""), 12);
        assert_eq!(number(""), 1);
        assert_eq!(number("-5"), 0);
        assert_eq!(duration_text(45_000), "45 s");
        assert_eq!(duration_text(125 * 60_000), "2 h 05 min");
    }

    #[test]
    fn discord_message_has_no_mentions_and_includes_totals() {
        let recap = json!({
            "game": "Fortnite", "duration_ms": 5_400_000,
            "summary": summarize(&[ev("twitch", "follow", "ana", "1"), ev("twitch", "bits", "@everyone", "100")]),
            "counters": [{"icon":"📦","name":"Cofres","delta":37}],
            "trophies": []
        });
        let body = discord_body(&recap);
        assert_eq!(body["allowed_mentions"]["parse"], json!([]));
        let text = body["embeds"][0]["description"].as_str().unwrap();
        assert!(text.contains("**Fortnite** · 1 h 30 min"));
        assert!(text.contains("**1** nuevo seguidor"));
        assert!(text.contains("**100** bits"));
        assert!(text.contains("Cofres **+37**"));
    }
}
