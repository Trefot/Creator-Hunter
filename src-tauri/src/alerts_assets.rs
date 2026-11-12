//! Un único registro de ilustraciones, compartido por OBS y la vista previa.
//! El frontend las solicita por IPC: evita incluir otra copia de los PNG en su bundle.
pub fn get(name: &str) -> Option<(&'static str, &'static [u8])> {
    Some(match name {
        "twitch-v2.png" => (
            "image/png",
            include_bytes!("../../src/assets/alerts/twitch-approved.png"),
        ),
        "youtube-v2.png" => (
            "image/png",
            include_bytes!("../../src/assets/alerts/youtube-approved.png"),
        ),
        "tiktok-v2.png" => (
            "image/png",
            include_bytes!("../../src/assets/alerts/tiktok-approved.png"),
        ),
        "twitch-frame-v3.png" => (
            "image/png",
            include_bytes!("../../src/assets/alerts/twitch-frame.png"),
        ),
        "youtube-frame-v3.png" => (
            "image/png",
            include_bytes!("../../src/assets/alerts/youtube-frame.png"),
        ),
        "tiktok-frame-v3.png" => (
            "image/png",
            include_bytes!("../../src/assets/alerts/tiktok-frame.png"),
        ),
        "pose-celebrate-v1.png" => (
            "image/png",
            include_bytes!("../../src/assets/alerts/pose-celebrate.png"),
        ),
        "pose-gift-v1.png" => (
            "image/png",
            include_bytes!("../../src/assets/alerts/pose-gift.png"),
        ),
        "pose-support-v1.png" => (
            "image/png",
            include_bytes!("../../src/assets/alerts/pose-support.png"),
        ),
        "pose-raid-v1.png" => (
            "image/png",
            include_bytes!("../../src/assets/alerts/pose-raid.png"),
        ),
        "pose-heart-v1.png" => (
            "image/png",
            include_bytes!("../../src/assets/alerts/pose-heart.png"),
        ),
        "inter-latin.woff2" => (
            "font/woff2",
            include_bytes!("../../src/assets/alerts/inter-latin.woff2"),
        ),
        "Inter-LICENSE.txt" => (
            "text/plain; charset=utf-8",
            include_bytes!("../../src/assets/alerts/Inter-LICENSE.txt"),
        ),
        _ => return None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn every_presentation_has_loadable_pngs() {
        for platform in ["twitch", "youtube", "tiktok"] {
            for suffix in ["v2", "frame-v3"] {
                let (mime, data) = get(&format!("{platform}-{suffix}.png")).unwrap();
                assert_eq!(mime, "image/png");
                assert_eq!(&data[..8], b"\x89PNG\r\n\x1a\n");
                assert!(data.len() > 1000);
            }
        }
        for pose in ["celebrate", "gift", "support", "raid", "heart"] {
            let (mime, data) = get(&format!("pose-{pose}-v1.png")).unwrap();
            assert_eq!(mime, "image/png");
            assert_eq!(&data[..8], b"\x89PNG\r\n\x1a\n");
        }
    }
    #[test]
    fn assets_are_allowlisted_and_include_font_license() {
        assert!(get("../../studio.db").is_none());
        assert!(get("pose-other-v1.png").is_none());
        assert_eq!(get("inter-latin.woff2").unwrap().0, "font/woff2");
        assert!(
            std::str::from_utf8(get("Inter-LICENSE.txt").unwrap().1)
                .unwrap()
                .contains("OPEN FONT LICENSE")
        );
    }
}
