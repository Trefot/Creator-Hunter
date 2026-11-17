use serde::{Deserialize, Serialize};
#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
pub struct Camera {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}
#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
pub struct Layout {
    pub focus: f64,
    pub camera: Option<Camera>,
}
pub fn apply(args: &mut Vec<String>, layout: Option<Layout>) -> Result<(), String> {
    let Some(l) = layout else { return Ok(()) };
    if !l.focus.is_finite() || !(0.0..=1.0).contains(&l.focus) {
        return Err("Encuadre no válido.".into());
    }
    if let Some(c) = l.camera {
        if [c.x, c.y, c.w, c.h].iter().any(|n| !n.is_finite())
            || c.x < 0.
            || c.y < 0.
            || c.w < 0.03
            || c.h < 0.03
            || c.x + c.w > 1.001
            || c.y + c.h > 1.001
        {
            return Err("Selecciona una región de cámara dentro de la imagen.".into());
        }
        let video = format!(
            "[0:v:0]split=2[cam][play];[cam]crop=iw*{:.6}:ih*{:.6}:iw*{:.6}:ih*{:.6},scale=1080:480:force_original_aspect_ratio=increase:force_divisible_by=2,crop=1080:480,setsar=1[top];[play]scale=1080:1440:force_original_aspect_ratio=increase:force_divisible_by=2,crop=1080:1440:(iw-ow)*{:.6}:(ih-oh)/2,setsar=1[bottom];[top][bottom]vstack=inputs=2[v]",
            c.w, c.h, c.x, c.y, l.focus
        );
        if let Some(i) = args.iter().position(|s| s == "-filter_complex") {
            let old = &args[i + 1];
            let rest = old
                .find("[v]")
                .map(|i| old[i + 3..].trim_start_matches(';'))
                .unwrap_or(old);
            args[i + 1] = if rest.is_empty() {
                video
            } else {
                format!("{video};{rest}")
            };
        } else {
            let at = args
                .iter()
                .position(|s| s == "-map")
                .ok_or("No se pudo preparar el vídeo.")?;
            args.splice(at..at, ["-filter_complex".into(), video]);
        }
        for i in 0..args.len().saturating_sub(1) {
            if args[i] == "-map" && args[i + 1] == "0:v:0" {
                args[i + 1] = "[v]".into();
            }
        }
    } else if let Some(i) = args.iter().position(|s| s == "-filter_complex") {
        args[i + 1] = args[i + 1].replace(
            "crop=1080:1920,",
            &format!("crop=1080:1920:(iw-ow)*{:.6}:(ih-oh)/2,", l.focus),
        );
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_outside_source() {
        let mut args = vec![];
        assert!(
            apply(
                &mut args,
                Some(Layout {
                    focus: 0.5,
                    camera: Some(Camera {
                        x: 0.8,
                        y: 0.,
                        w: 0.5,
                        h: 0.3
                    })
                })
            )
            .is_err()
        )
    }
}

#[cfg(test)]
mod execution_tests {
    use super::*;
    #[test]
    fn camera_layout_produces_a_real_vertical_video() {
        use std::process::Command;
        if Command::new("ffmpeg").arg("-version").output().is_err() {
            return;
        }
        let dir = std::env::temp_dir().join(format!("nexus-layout-{:016x}", rand::random::<u64>()));
        std::fs::create_dir(&dir).unwrap();
        let input = dir.join("input.mp4");
        let output = dir.join("output.mp4");
        let source = Command::new("ffmpeg")
            .args([
                "-hide_banner",
                "-loglevel",
                "error",
                "-f",
                "lavfi",
                "-i",
                "color=c=blue:s=640x360:d=0.5",
                "-c:v",
                "libx264",
                "-threads",
                "2",
            ])
            .arg(&input)
            .output()
            .unwrap();
        assert!(source.status.success());
        let mut args = crate::shorts_core::args_audio(
            &input.to_string_lossy(),
            &output.to_string_lossy(),
            None,
            crate::shorts_core::Format::VerticalCrop,
            &[],
            2,
        );
        apply(
            &mut args,
            Some(Layout {
                focus: 0.7,
                camera: Some(Camera {
                    x: 0.,
                    y: 0.,
                    w: 0.25,
                    h: 0.3,
                }),
            }),
        )
        .unwrap();
        let result = Command::new("ffmpeg").args(args).output().unwrap();
        assert!(
            result.status.success(),
            "{}",
            String::from_utf8_lossy(&result.stderr)
        );
        let probe = Command::new("ffprobe")
            .args([
                "-v",
                "error",
                "-select_streams",
                "v:0",
                "-show_entries",
                "stream=width,height",
                "-of",
                "csv=p=0",
            ])
            .arg(&output)
            .output()
            .unwrap();
        assert_eq!(String::from_utf8_lossy(&probe.stdout).trim(), "1080,1920");
        let _ = std::fs::remove_dir_all(dir);
    }
}
