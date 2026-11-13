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

#[test]
fn branded_attachment_preserves_link_mentions_and_binary_png() {
    let png = include_bytes!("../../../src/assets/nexus-mark.png");
    let original = payload(
        "youtube",
        true,
        "Título del directo",
        "https://www.youtube.com/watch?v=abc",
        Some("https://cdn.test/thumb.png"),
    );
    let boundary = "NexusBoundaryForTests123456";
    let bytes = branded_multipart(original, png, boundary).unwrap();
    let header_end = bytes.windows(4).position(|w| w == b"\r\n\r\n").unwrap() + 4;
    let end = bytes[header_end..]
        .windows(2)
        .position(|w| w == b"\r\n")
        .unwrap()
        + header_end;
    let body: serde_json::Value = serde_json::from_slice(&bytes[header_end..end]).unwrap();
    assert_eq!(
        body["embeds"][0]["image"]["url"],
        "attachment://nexus-directo.png"
    );
    assert_eq!(
        body["embeds"][0]["url"],
        "https://www.youtube.com/watch?v=abc"
    );
    assert_eq!(
        body["embeds"][0]["thumbnail"]["url"],
        "https://cdn.test/thumb.png"
    );
    assert_eq!(body["allowed_mentions"]["parse"], serde_json::json!([]));
    assert!(bytes.windows(png.len()).any(|w| w == png));
    assert!(bytes.ends_with(format!("\r\n--{boundary}--\r\n").as_bytes()));
    assert!(branded_multipart(serde_json::json!({}), png, boundary).is_err());
    assert!(
        branded_multipart(
            payload("youtube", true, "a", "https://youtu.be/a", None),
            png,
            "bad\r\nheader"
        )
        .is_err()
    );
}
#[test]
fn brand_image_rejects_other_files_and_oversized_dimensions() {
    assert!(validate_brand_png(b"not a png").is_err());
    let mut png = include_bytes!("../../../src/assets/nexus-mark.png").to_vec();
    png[16..20].copy_from_slice(&5000u32.to_be_bytes());
    assert!(validate_brand_png(&png).is_err());
    png[16..20].copy_from_slice(&0u32.to_be_bytes());
    assert!(validate_brand_png(&png).is_err());
    assert!(validate_brand_png(&vec![0; 6 * 1024 * 1024 + 1]).is_err());
}
