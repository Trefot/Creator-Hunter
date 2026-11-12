# Opcional: Vite en :1420, Playwright/Chromium. Solo datos y RPC ficticios.
from playwright.sync_api import sync_playwright
from pathlib import Path
import sqlite3,json,time
root=Path(__file__).resolve().parents[1];artifacts=root/'.browser-artifacts';artifacts.mkdir(exist_ok=True)
db=sqlite3.connect(':memory:');db.row_factory=sqlite3.Row
for f in sorted((root/'src-tauri/migrations').glob('*.sql')):db.executescript(f.read_text())
def sql_call(a):
 c=db.execute(a['query'],{str(i+1):v for i,v in enumerate(a.get('values',[]))});
 if a['select']:return [dict(r) for r in c.fetchall()]
 db.commit();return [c.rowcount,c.lastrowid or 0]
def cfg(title,color):return dict(title=title,color=color,duration=6,volume=50,muted=False,paused=False,sound=True)
state=dict(settings=dict(twitch=cfg('Twitch','#9146ff'),youtube=cfg('YouTube','#ff3355'),coordinate_audio=True),twitch_pending=0,youtube_pending=0,connected=False)
def rpc(cmd,a):
 if cmd=='alerts_status':return state
 if cmd=='alerts_save':state['settings'][a['platform']]=a['config'];return state
 if cmd=='alerts_audio':state['settings']['coordinate_audio']=a['coordinate'];return state
 if cmd=='alerts_action':
  platform=a['platform'];action=a['action'];c=state['settings'][platform]
  if action=='test':state[platform+'_pending']+=1
  if action in ['mute','pause']:k='muted' if action=='mute' else 'paused';c[k]=not c[k]
  return state
 if cmd=='alerts_announce':return dict(queued=True)
 raise Exception(cmd)
mock=r'''(()=>{let callback=0;window.__TAURI_EVENT_PLUGIN_INTERNALS__={unregisterListener(){}};
window.__TAURI_INTERNALS__={transformCallback:()=>++callback,metadata:{currentWindow:{label:'main'},currentWebview:{label:'main'}},invoke:async(cmd,args={})=>{
if(cmd==='prepare_database'||cmd==='obs_initialize'||cmd==='obs_context')return;
if(cmd==='plugin:sql|load')return args.db;
if(cmd==='plugin:sql|select'||cmd==='plugin:sql|execute')return await window.studioSql({...args,select:cmd.endsWith('select')});
if(cmd.startsWith('alerts_'))return await window.alertRpc(cmd,args);
if(cmd==='live_status')return {running:true,port:7879,key:'local-alert-test-key'};
if(cmd==='obs_status')return {enabled:false,connected:false,port:4455};
if(cmd==='obs_markers'||cmd==='obs_clips'||cmd==='pc_now_playing')return [];
if(cmd==='youtube_status')return {connected:false};if(cmd==='psn_status')return false;
if(cmd==='update_check')return null;if(cmd.startsWith('plugin:event|'))return ++callback;
throw Error('Unexpected native command: '+cmd);
}};})()'''
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);context=b.new_context(viewport={'width':1440,'height':1100},permissions=['clipboard-read','clipboard-write']);page=context.new_page();errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)));page.expose_function('studioSql',sql_call);page.expose_function('alertRpc',rpc);page.add_init_script(mock);page.goto('http://127.0.0.1:1420');page.get_by_role('button',name='Live Studio',exact=True).click()
 page.get_by_role('heading',name='Alertas por plataforma').wait_for();page.get_by_role('button',name='Probar twitch',exact=True).click();page.wait_for_timeout(200)
 assert state['twitch_pending']==1 and state['youtube_pending']==0
 page.get_by_role('button',name='Silenciar youtube',exact=True).click();page.wait_for_timeout(200);assert state['settings']['youtube']['muted'] and not state['settings']['twitch']['muted']
 page.get_by_label('Título de twitch',exact=True).fill('Mi Twitch');page.get_by_role('button',name='Guardar twitch',exact=True).click();page.wait_for_timeout(200);assert state['settings']['twitch']['title']=='Mi Twitch'
 page.get_by_role('button',name='Copiar URL de youtube',exact=True).click();assert page.evaluate('navigator.clipboard.readText()')=='http://127.0.0.1:7879/alerts/youtube?key=local-alert-test-key'
 page.screenshot(path=str(artifacts/'alertas-live.png'),full_page=True)
 page.set_viewport_size({'width':960,'height':900});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 # El HTML real trata el título como texto, aísla plataforma y oculta al finalizar.
 overlay=context.new_page();overlay.set_viewport_size({'width':640,'height':300});overlay.on('pageerror',lambda e:errors.append(str(e)))
 now=int(time.time()*1000);packet=dict(config=cfg('YouTube','#ff3355'),event=dict(event=dict(id=1,title='<img src=x onerror=alert(1)>',message='Anuncio de ejemplo',test=True,replay=False),started_at=now,ends_at=now+3000,sound_at=None),pending=0,duplicate=False)
 overlay.route('**/alerts/youtube?*',lambda r:r.fulfill(body=(root/'src-tauri/overlay/alerts.html').read_text(),content_type='text/html'))
 overlay.route('**/api/alerts/youtube/poll?*',lambda r:r.fulfill(json=packet))
 overlay.goto('http://127.0.0.1:1420/alerts/youtube?key=test');overlay.locator('#alert.visible').wait_for();assert overlay.locator('#title').inner_text()=='<img src=x onerror=alert(1)>';assert overlay.locator('#alert img').count()==0
 assert overlay.locator('#alert').bounding_box()['height']+32<=300
 overlay.screenshot(path=str(artifacts/'alerta-youtube.png'))
 packet['event']=None;overlay.locator('#alert.visible').wait_for(state='hidden',timeout=5000)
 assert not errors,errors
 print(json.dumps(dict(independent_controls=True,separate_urls=True,save_preferences=True,responsive=True,overlay_safe_text=True,overlay_hides=True,js_errors=errors)))
 b.close()
