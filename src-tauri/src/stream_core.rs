//! Modelos del chat y reglas de estabilidad, independientes de la red y de Tauri.
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::VecDeque;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct ChatMessage {
    pub id: String,
    pub received_ms: u64,
    pub platform: String,
    pub user_id: String,
    pub name: String,
    pub text: String,
    pub moderator: bool,
    pub broadcaster: bool,
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn text(v: &Value, key: &str, max: usize) -> String {
    v[key]
        .as_str()
        .unwrap_or_default()
        .chars()
        .filter(|c| !c.is_control() || *c == '\n')
        .take(max)
        .collect()
}

pub fn twitch_message(v: &Value) -> Option<ChatMessage> {
    let message = ChatMessage {
        id: text(v, "message_id", 200),
        received_ms: now_ms(),
        platform: "twitch".into(),
        user_id: text(v, "chatter_user_id", 100),
        name: text(v, "chatter_user_name", 100),
        text: text(&v["message"], "text", 2000),
        moderator: v["badges"]
            .as_array()
            .is_some_and(|b| b.iter().any(|b| b["set_id"] == "moderator")),
        broadcaster: v["chatter_user_id"] == v["broadcaster_user_id"]
            && v["chatter_user_id"].is_string(),
    };
    (!message.id.is_empty() && !message.text.is_empty()).then_some(message)
}

pub fn youtube_message(v: &Value) -> Option<ChatMessage> {
    let kind = v["snippet"]["type"].as_str()?;
    if ![
        "textMessageEvent",
        "superChatEvent",
        "superStickerEvent",
        "newSponsorEvent",
        "memberMilestoneChatEvent",
        "membershipGiftingEvent",
        "giftMembershipReceivedEvent",
    ]
    .contains(&kind)
    {
        return None;
    }
    let message = ChatMessage {
        id: text(v, "id", 200),
        received_ms: now_ms(),
        platform: "youtube".into(),
        user_id: text(&v["authorDetails"], "channelId", 100),
        name: text(&v["authorDetails"], "displayName", 100),
        text: text(&v["snippet"], "displayMessage", 2000),
        moderator: v["authorDetails"]["isChatModerator"] == true,
        broadcaster: v["authorDetails"]["isChatOwner"] == true,
    };
    (!message.id.is_empty() && !message.text.is_empty()).then_some(message)
}

#[derive(Default)]
pub struct ChatBuffer {
    pub revision: u64,
    pub messages: VecDeque<ChatMessage>,
    // Conservar IDs retirados evita que una entrega repetida reponga un mensaje moderado.
    seen: VecDeque<(String, String)>,
}
impl ChatBuffer {
    pub fn push(&mut self, message: ChatMessage) {
        if self
            .seen
            .iter()
            .any(|(p, id)| p == &message.platform && id == &message.id)
        {
            return;
        }
        self.seen
            .push_back((message.platform.clone(), message.id.clone()));
        while self.seen.len() > 4000 {
            self.seen.pop_front();
        }
        self.messages.push_back(message);
        while self.messages.len() > 200 {
            self.messages.pop_front();
        }
        self.revision += 1;
    }
    pub fn remove(&mut self, platform: &str, id: Option<&str>, user: Option<&str>) {
        self.messages.retain(|m| {
            m.platform != platform
                || id.is_some_and(|id| m.id != id)
                || user.is_some_and(|u| m.user_id != u)
        });
        self.revision += 1;
    }
}

/// No se actualiza una categoría con contexto viejo, ambiguo o todavía inestable.
pub fn category_ready(
    enabled: bool,
    has_game: bool,
    ambiguous: bool,
    stable_seconds: u64,
    age_seconds: u64,
) -> bool {
    enabled && has_game && !ambiguous && stable_seconds >= 30 && age_seconds < 45
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn normalize_chat_and_ignore_non_messages() {
        let m=twitch_message(&json!({"message_id":"1","chatter_user_id":"u","broadcaster_user_id":"u","chatter_user_name":"Trefot","message":{"text":"hola <script>"}})).unwrap();
        assert!(m.broadcaster);
        assert_eq!(m.text, "hola <script>");
        assert!(youtube_message(&json!({"id":"x","snippet":{"type":"messageDeletedEvent","displayMessage":"borrado"}})).is_none());
        assert!(twitch_message(&json!({"message":{"text":"sin ID"}})).is_none());
    }
    fn message(platform: &str, id: &str, user: &str) -> ChatMessage {
        ChatMessage {
            id: id.into(),
            received_ms: 0,
            platform: platform.into(),
            user_id: user.into(),
            name: user.into(),
            text: "hola".into(),
            moderator: false,
            broadcaster: false,
        }
    }
    #[test]
    fn moderation_is_scoped_and_replays_stay_deleted() {
        let mut b = ChatBuffer::default();
        for p in ["twitch", "youtube"] {
            for id in ["a", "b"] {
                b.push(message(p, id, id));
            }
        }
        b.remove("twitch", Some("a"), None);
        b.push(message("twitch", "a", "a"));
        assert_eq!(b.messages.len(), 3);
        b.remove("youtube", None, Some("b"));
        assert_eq!(b.messages.len(), 2);
        b.remove("twitch", None, None);
        assert_eq!(b.messages.len(), 1);
        assert_eq!(b.messages[0].platform, "youtube");
    }
    #[test]
    fn bounded_history_and_stability_guards() {
        let mut b = ChatBuffer::default();
        for i in 0..500 {
            b.push(message("twitch", &i.to_string(), "u"));
        }
        assert_eq!(b.messages.len(), 200);
        assert!(category_ready(true, true, false, 30, 15));
        for args in [
            (false, true, false, 30, 0),
            (true, false, false, 30, 0),
            (true, true, true, 30, 0),
            (true, true, false, 29, 0),
            (true, true, false, 60, 45),
        ] {
            assert!(!category_ready(args.0, args.1, args.2, args.3, args.4));
        }
    }
}
