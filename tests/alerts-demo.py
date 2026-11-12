# Graba el renderer real y las 16 plantillas. Requiere Vite, Rust y Playwright.
from pathlib import Path
from playwright.sync_api import sync_playwright
from alert_fixtures import catalog,asset_path,overlay_document
import time,json,copy
root=Path(__file__).resolve().parents[1];out=root.parent/'artifacts';out.mkdir(exist_ok=True)
state=catalog();html=overlay_document();platforms=['twitch','youtube','tiktok'];offsets={'twitch':5,'youtube':3,'tiktok':2};names={'twitch':'TWITCH','youtube':'YOUTUBE','tiktok':'TIKTOK'};colors={'twitch':'#a363ff','youtube':'#ff3355','tiktok':'#25f4ee'}
board='''<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at top left,#281537,#0b0911 65%);color:#fff;font:16px system-ui}h1{margin:20px 0 0;text-align:center;letter-spacing:7px;font-size:30px}header p,footer{text-align:center;color:#bcb1cb;font-size:13px;margin:8px}section{display:flex;align-items:center;justify-content:center;gap:15px;height:300px}strong{width:130px;text-align:right;letter-spacing:2px}iframe{width:640px;height:300px;border:0}footer{margin-top:8px}</style><header><h1>TREFOT</h1><p>16 plantillas · una fuente por plataforma</p></header>'''
for platform in platforms:board+=f'<section><strong style="color:{colors[platform]}">{names[platform]}</strong><iframe src="/alerts/{platform}?key=demostracion" title="{platform}"></iframe></section>'
board+='<footer>Pruebas simuladas · duraciones abreviadas · recepción automática pendiente</footer>'
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 context=browser.new_context(viewport={'width':980,'height':1040},record_video_dir=str(out/'trefot-video'),record_video_size={'width':980,'height':1040})
 def asset(route):
  file=route.request.url.split('?')[0].split('/')[-1];route.fulfill(body=asset_path(file).read_bytes(),content_type='font/woff2' if file.endswith('woff2') else 'image/png')
 context.route('http://127.0.0.1:1420/assets/alerts/*',asset)
 context.route('http://127.0.0.1:1420/alerts/*?*',lambda r:r.fulfill(body=html,content_type='text/html'))
 start=int(time.time()*1000);playing=[False];seen=set()
 def expand(text,c):
  import re
  values={'usuario':c['sample_name'],'cantidad':c['sample_amount'],'mensaje':c['sample_note']}
  return re.sub(r'\{(usuario|cantidad|mensaje)\}',lambda m:values[m[1]],text)
 def poll(route):
  platform=route.request.url.split('/api/alerts/')[1].split('/')[0];elapsed=int(time.time()*1000)-start;phase=elapsed//3500 if playing[0] else 0;rows=state['events'][platform];entry=rows[(phase+offsets[platform])%len(rows)];c=copy.deepcopy(entry['config']);c.update(sound=False,muted=True,volume=0)
  event=dict(event=dict(id=phase+1,title=c['sample_name'],message=expand(c['message_template'],c),test=True,replay=False,kind=entry['kind']),started_at=start+phase*3500,ends_at=start+phase*3500+3200 if playing[0] else start+60000,sound_at=None) if not playing[0] or elapsed%3500<3200 else None
  if event:seen.add((platform,entry['kind']))
  route.fulfill(json=dict(config=c,event=event,pending=0,duplicate=False))
 context.route('**/api/alerts/*/poll?*',poll);context.route('**/trefot-demo',lambda r:r.fulfill(body=board,content_type='text/html'))
 page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:1420/trefot-demo');page.wait_for_timeout(1800)
 for platform in platforms:
  f=page.frame_locator(f'iframe[title="{platform}"]');f.locator('#alert.visible').wait_for();assert f.locator('#art').evaluate('(el)=>el.complete&&el.naturalWidth===2172');assert f.locator('#event-mascot').evaluate('(el)=>el.complete&&el.naturalWidth>0')
  art=f.locator('#art').bounding_box();message=f.locator('#message').bounding_box();assert message['y']+message['height']<=art['y']+art['height']*.88-6
  assert f.locator('#label').evaluate('(el)=>el.scrollWidth<=el.clientWidth')
 page.screenshot(path=str(out/'trefot-alertas-eventos.png'))
 start=int(time.time()*1000);playing[0]=True
 for phase in range(6):
  page.wait_for_timeout(2800 if phase==0 else 3500)
  for platform in platforms:
   f=page.frame_locator(f'iframe[title="{platform}"]');assert f.locator('#label').evaluate('(el)=>el.scrollWidth<=el.clientWidth')
 assert len(seen)==16,seen;assert not errors,errors
 video=page.video;context.close();video.save_as(str(out/'trefot-alertas-eventos.webm'));browser.close();print(json.dumps({'templates_shown':len(seen),'screenshot':str(out/'trefot-alertas-eventos.png'),'video':str(out/'trefot-alertas-eventos.webm')}))
