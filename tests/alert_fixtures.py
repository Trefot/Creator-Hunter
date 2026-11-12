"""Estado de prueba generado por el mismo catálogo Rust de producción."""
from pathlib import Path
import subprocess,json,os,base64
ROOT=Path(__file__).resolve().parents[1]
def catalog():
 cargo=os.environ.get('NEXUS_CARGO','cargo')
 return json.loads(subprocess.check_output([cargo,'run','--quiet','--locked','--offline','--manifest-path',str(ROOT/'tests/alerts/Cargo.toml'),'--example','catalog'],cwd=ROOT))
def asset_path(name):
 aliases={'twitch-v2.png':'twitch-approved.png','youtube-v2.png':'youtube-approved.png','tiktok-v2.png':'tiktok-approved.png','twitch-frame-v3.png':'twitch-frame.png','youtube-frame-v3.png':'youtube-frame.png','tiktok-frame-v3.png':'tiktok-frame.png',**{f'pose-{p}-v1.png':f'pose-{p}.png' for p in ['celebrate','gift','support','raid','heart']},'inter-latin.woff2':'inter-latin.woff2'}
 return ROOT/'src/assets/alerts'/aliases[name]
def image_data(name):return 'data:image/png;base64,'+base64.b64encode(asset_path(name).read_bytes()).decode()
def overlay_document():
 return (ROOT/'src-tauri/overlay/alerts.html').read_text().replace('/*NEXUS_ALERT_STYLE*/',(ROOT/'src-tauri/overlay/alerts.css').read_text().replace('__NEXUS_ALERT_FONT__','/assets/alerts/inter-latin.woff2'))
