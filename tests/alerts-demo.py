# Muestra reproducible del HTML real con eventos ficticios; requiere Vite en :1420.
from pathlib import Path
from playwright.sync_api import sync_playwright
import time,json
root=Path(__file__).resolve().parents[1];out=root.parent/'artifacts';out.mkdir(exist_ok=True)
html=(root/'src-tauri/overlay/alerts.html').read_text().replace('/*NEXUS_ALERT_STYLE*/',(root/'src-tauri/overlay/alerts.css').read_text())
platforms={'twitch':('Twitch','#9146ff','#ffd166'),'youtube':('YouTube','#ff3355','#ffd166'),'tiktok':('TikTok','#25f4ee','#ff2d86')}
board='''<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at top left,#281537,#0b0911 65%);color:#fff;font:16px system-ui}h1{margin:20px 0 0;text-align:center;letter-spacing:7px;font-size:30px}header p,footer{text-align:center;color:#bcb1cb;font-size:13px;margin:8px}section{display:flex;align-items:center;justify-content:center;gap:15px;height:300px}strong{width:130px;text-align:right;letter-spacing:2px}iframe{width:640px;height:300px;border:0}footer{margin-top:8px}</style><header><h1>TREFOT</h1><p>Una identidad · tres plataformas</p></header>'''
for platform,(name,color,second) in platforms.items():board+=f'<section><strong style="color:{color}">{name.upper()}</strong><iframe src="/alerts/{platform}?key=demostracion" title="{name}"></iframe></section>'
board+='<footer>Muestra real del overlay · eventos simulados · recepción automática pendiente</footer>'
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 context=browser.new_context(viewport={'width':980,'height':1040},record_video_dir=str(out/'trefot-video'),record_video_size={'width':980,'height':1040})
 context.route('**/assets/alert-mascot.png',lambda r:r.fulfill(body=(root/'src/assets/nexus-mark.png').read_bytes(),content_type='image/png'))
 context.route('**/alerts/*?*',lambda r:r.fulfill(body=html,content_type='text/html'))
 start=int(time.time()*1000)
 def poll(route):
  platform=route.request.url.split('/api/alerts/')[1].split('/')[0];name,color,second=platforms[platform]
  cfg=dict(title=name,color=color,secondary_color=second,text_color='#ffffff',message_color='#eee6ff',font_family='sans',name_size=38,message_size=16,event_label='',sample_name='LUNA_27',message_template='¡Bienvenido a la aventura!',sound=False,muted=True,volume=0,duration=6)
  event=dict(event=dict(id=1,title='LUNA_27',message='¡Bienvenido a la aventura!',test=True,replay=False),started_at=start,ends_at=start+6500,sound_at=None) if int(time.time()*1000)<start+6500 else None
  route.fulfill(json=dict(config=cfg,event=event,pending=0,duplicate=False))
 context.route('**/api/alerts/*/poll?*',poll)
 context.route('**/trefot-demo',lambda r:r.fulfill(body=board,content_type='text/html'))
 page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:1420/trefot-demo');page.wait_for_timeout(1800)
 for platform in platforms:
  f=page.frame_locator(f'iframe[title="{platforms[platform][0]}"]');f.locator('#alert.visible').wait_for();assert f.locator('#mascot').evaluate('(el)=>el.complete&&el.naturalWidth>0')
 page.screenshot(path=str(out/'trefot-alertas-animadas.png'));page.wait_for_timeout(6000);assert not errors,errors
 video=page.video;context.close();video.save_as(str(out/'trefot-alertas-animadas.webm'));browser.close();print(json.dumps({'rendered_platforms':list(platforms),'screenshot':str(out/'trefot-alertas-animadas.png'),'video':str(out/'trefot-alertas-animadas.webm')}))
