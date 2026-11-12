#[path = "../../../src-tauri/src/discord_core.rs"]
mod core;
use core::*;
#[test]
fn rejects_redirects_credentials_and_foreign_webhook_hosts() {
    for u in [
        "http://discord.com/api/webhooks/123/abcdefghijklmnopqrst",
        "https://discord.com.evil.test/api/webhooks/123/abcdefghijklmnopqrst",
        "https://discord.com@evil.test/api/webhooks/123/abcdefghijklmnopqrst",
        "https://discord.com/api/webhooks/123/abcdefghijklmnopqrst?redirect=x",
        "https://discord.com/api/webhooks/123/abcdefghijklmnopqrst/extra",
        "https://discord.com/api/webhooks/a/abcdefghijklmnopqrst",
    ] {
        assert!(webhook_url(u).is_err(), "{u}");
    }
    assert!(webhook_url(" https://discord.com/api/webhooks/123/abcdefghijklmnopqrst_- ").is_ok());
    assert_eq!(PLATFORMS.len(), 4);
}
#[test]
fn publication_identity_removes_tracking_and_unifies_youtube_short_links() {
    let a = content_url("youtube", "https://youtu.be/abc_123?t=10").unwrap();
    let b = content_url(
        "youtube",
        "https://www.youtube.com/watch?v=abc_123&utm_source=x#foo",
    )
    .unwrap();
    assert_eq!(a, b);
    assert_eq!(
        a,
        content_url(
            "youtube",
            "https://www.youtube.com/shorts/abc_123?feature=share"
        )
        .unwrap()
    );
    assert_eq!(
        content_url(
            "twitch",
            "https://www.twitch.tv/trefotg/clip/Clip123?tt_content=x"
        )
        .unwrap(),
        content_url("twitch", "https://clips.twitch.tv/Clip123").unwrap()
    );

    assert_eq!(
        content_url(
            "instagram",
            "https://www.instagram.com/reel/abc/?igsh=tracking"
        )
        .unwrap(),
        "https://www.instagram.com/reel/abc"
    );
    for u in [
        "https://youtube.com.evil.test/watch?v=x",
        "https://youtube.com@evil.test/watch?v=x",
        "https://www.youtube.com/",
        "https://www.youtube.com/watch?noid=x",
    ] {
        assert!(content_url("youtube", u).is_err());
    }
    assert!(content_url("tiktok", "https://www.instagram.com/reel/abc").is_err());
}
#[test]
fn message_never_allows_mass_or_user_mentions() {
    let body = payload(
        "twitch",
        true,
        "@everyone <@123>",
        &content_url("twitch", "https://www.twitch.tv/trefotg").unwrap(),
        Some("https://cdn.test/image.png"),
    );
    assert_eq!(body["allowed_mentions"]["parse"], serde_json::json!([]));
    assert!(body["content"].is_null());
    assert_eq!(
        body["embeds"][0]["description"],
        "Trefot está en directo · Twitch"
    );
    assert!(
        payload(
            "youtube",
            false,
            "x",
            "https://youtu.be/x",
            Some("http://bad")
        )["embeds"][0]["thumbnail"]
            .is_null()
    );
    assert_eq!(
        payload(
            "youtube",
            false,
            &"ñ".repeat(300),
            "https://youtu.be/x",
            None
        )["embeds"][0]["title"]
            .as_str()
            .unwrap()
            .chars()
            .count(),
        200
    );
}
