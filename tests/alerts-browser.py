# Opcional: Vite en :1420, Playwright/Chromium. Solo datos y RPC ficticios.
from playwright.sync_api import sync_playwright
from pathlib import Path
import sqlite3,json,time,copy
from alert_fixtures import catalog,asset_path,image_data,overlay_document
root=Path(__file__).resolve().parents[1];artifacts=root/'.browser-artifacts';artifacts.mkdir(exist_ok=True)
db=sqlite3.connect(':memory:');db.row_factory=sqlite3.Row
for f in sorted((root/'src-tauri/migrations').glob('*.sql')):db.executescript(f.read_text())
def sql_call(a):
 c=db.execute(a['query'],{str(i+1):v for i,v in enumerate(a.get('values',[]))});
 if a['select']:return [dict(r) for r in c.fetchall()]
 db.commit();return [c.rowcount,c.lastrowid or 0]
state=catalog();queued=[];asset_calls={}
def cfg(title,color):
 c=copy.deepcopy(state['settings']['twitch']);c.update(title=title,color=color);return c
def entry(platform,kind):return next(e for e in state['events'][platform] if e['kind']==kind)
def rpc(cmd,a):
 if cmd=='alerts_status':return state
 if cmd=='alerts_asset':
  asset_calls[a['name']]=asset_calls.get(a['name'],0)+1
  return image_data(a['name'])
 if cmd=='alerts_save_event':
  entry(a['platform'],a['eventKind'])['config']=copy.deepcopy(a['config']);state['settings']['event_templates'][a['platform']+'/'+a['eventKind']]=copy.deepcopy(a['config']);return state
 if cmd=='alerts_audio':state['settings']['coordinate_audio']=a['coordinate'];return state
 if cmd=='alerts_action':
  platform=a['platform'];action=a['action'];c=state['settings'][platform]
  if action=='test':
   event=entry(platform,a.get('eventKind') or state['events'][platform][0]['kind']);assert event['config']['enabled'];state[platform+'_pending']+=1;queued.append((platform,event['kind'],copy.deepcopy(event['config'])))
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
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);context=b.new_context(viewport={'width':1440,'height':1100},permissions=['clipboard-read','clipboard-write']);page=context.new_page();errors=[];preview_requests=[]
 page.on('request',lambda r:preview_requests.append(r.url) if '/api/alerts/' in r.url else None)
 def asset(route):
  file=route.request.url.split('?')[0].split('/')[-1];p=asset_path(file)
  route.fulfill(body=p.read_bytes(),content_type='font/woff2' if file.endswith('woff2') else 'image/png')
 context.route('http://127.0.0.1:1420/assets/alerts/*',asset)
 page.on('pageerror',lambda e:errors.append(str(e)));page.expose_function('studioSql',sql_call);page.expose_function('alertRpc',rpc);page.add_init_script(mock);page.goto('http://127.0.0.1:1420',wait_until='domcontentloaded');page.get_by_role('button',name='Live Studio',exact=True).click()
 page.get_by_role('heading',name='Alertas por plataforma').wait_for();page.get_by_role('button',name='Probar twitch',exact=True).click();page.wait_for_timeout(200)
 assert state['twitch_pending']==1 and state['youtube_pending']==0
 page.get_by_role('button',name='Silenciar youtube',exact=True).click();page.wait_for_timeout(200);assert state['settings']['youtube']['muted'] and not state['settings']['twitch']['muted']
 page.get_by_label('Título de twitch',exact=True).fill('Mi Twitch');page.get_by_role('button',name='Guardar twitch',exact=True).click();page.wait_for_timeout(200);assert entry('twitch','follow')['config']['title']=='Mi Twitch'
 page.get_by_role('button',name='Copiar URL de youtube',exact=True).click();assert page.evaluate('navigator.clipboard.readText()')=='http://127.0.0.1:7879/alerts/youtube?key=local-alert-test-key'
 page.get_by_label('Nombre de prueba de twitch',exact=True).fill('TREFOT')
 page.get_by_label('Mensaje de la plantilla de twitch',exact=True).fill('¡Hola, {usuario}!')
 page.get_by_label('Tipografía de twitch',exact=True).select_option('mono')
 page.get_by_label('Tamaño del nombre de twitch',exact=True).fill('44')
 preview=page.frame_locator('iframe[title="Vista previa de twitch"]')
 preview.locator('#title').get_by_text('TREFOT',exact=True).wait_for()
 assert preview.locator('#message').inner_text()=='¡Hola, TREFOT!'
 assert preview.locator('#title').evaluate('(el)=>getComputedStyle(el).fontSize')=='44px'
 assert 'monospace' in preview.locator('#title').evaluate('(el)=>getComputedStyle(el).fontFamily')
 assert 'lantern' in preview.locator('.lantern-light').evaluate('(el)=>getComputedStyle(el).animationName')
 assert preview.locator('#art').get_attribute('src').startswith('data:image/png;base64,')
 page.get_by_label('Nombre de prueba de twitch',exact=True).fill('$&')
 page.wait_for_timeout(300)
 preview.locator('#message').get_by_text('¡Hola, $&!',exact=True).wait_for()
 page.get_by_label('Nombre de prueba de twitch',exact=True).fill('TREFOT')
 assert preview.locator('body').evaluate('()=>context===null')
 assert not preview_requests,preview_requests
 page.get_by_role('button',name='Guardar twitch',exact=True).click();page.wait_for_timeout(200)
 assert entry('twitch','follow')['config']['name_size']==44 and entry('twitch','follow')['config']['sample_name']=='TREFOT'
 page.get_by_role('button',name='Probar tiktok',exact=True).click();page.wait_for_timeout(200);assert state['tiktok_pending']==1 and state['twitch_pending']==1
 page.get_by_role('button',name='Copiar URL de tiktok',exact=True).click();assert '/alerts/tiktok?' in page.evaluate('navigator.clipboard.readText()')
 # Borradores por evento, guardado aislado y pruebas en una misma cola.
 page.get_by_label('Nombre de prueba de twitch',exact=True).fill('BORRADOR FOLLOW')
 page.get_by_label('Tipo de alerta de twitch',exact=True).select_option('subscribe')
 page.get_by_label('Nombre de prueba de twitch',exact=True).fill('SUBTEST')
 page.get_by_label('Duración de twitch (segundos)',exact=True).fill('10')
 page.get_by_label('Melodía de twitch',exact=True).select_option('heart')
 page.get_by_label('Tipo de alerta de twitch',exact=True).select_option('follow')
 assert page.get_by_label('Nombre de prueba de twitch',exact=True).input_value()=='BORRADOR FOLLOW'
 page.get_by_label('Tipo de alerta de twitch',exact=True).select_option('subscribe')
 assert page.get_by_label('Nombre de prueba de twitch',exact=True).input_value()=='SUBTEST'
 assert page.get_by_role('button',name='Probar twitch',exact=True).is_disabled()
 page.get_by_role('button',name='Guardar twitch',exact=True).click();page.wait_for_timeout(300)
 assert entry('twitch','subscribe')['config']['duration']==10
 assert entry('twitch','follow')['config']['sample_name']=='TREFOT'
 page.get_by_role('button',name='Probar twitch',exact=True).click();page.wait_for_timeout(200)
 assert queued[-1][1]=='subscribe' and queued[-1][2]['tone']=='heart'
 page.get_by_label('Tipo de alerta de twitch',exact=True).select_option('raid')
 preview.locator('#event-mascot').wait_for(state='visible');page.wait_for_timeout(200)
 assert preview.locator('#event-mascot').evaluate('(el)=>el.complete&&el.naturalWidth>0')
 page.get_by_role('button',name='Probar twitch',exact=True).click();page.wait_for_timeout(200);assert queued[-1][1]=='raid'
 page.get_by_text('Controles de twitch para Stream Deck',exact=True).click()
 page.locator('.alerts-channel.twitch').get_by_role('button',name='Copiar Prueba',exact=True).click()
 assert '&event=raid' in page.evaluate('navigator.clipboard.readText()')
 page.get_by_label('Tipo de alerta de youtube',exact=True).select_option('super_chat')
 page.get_by_label('Cantidad de prueba de youtube',exact=True).fill('7 €')
 page.get_by_label('Mensaje recibido de prueba de youtube',exact=True).fill('$& {usuario}')
 page.get_by_label('Mensaje de la plantilla de youtube',exact=True).fill('{usuario} / {cantidad} / {mensaje}')
 youtube_preview=page.frame_locator('iframe[title="Vista previa de youtube"]')
 youtube_preview.locator('#message').get_by_text('MATEO / 7 € / $& {usuario}',exact=True).wait_for()
 page.get_by_label('Tipo de alerta de tiktok',exact=True).select_option('gift')
 page.get_by_label('Activar alerta de regalo',exact=True).uncheck()
 page.get_by_role('button',name='Guardar tiktok',exact=True).click();page.wait_for_timeout(300)
 assert page.get_by_role('button',name='Probar tiktok',exact=True).is_disabled()
 assert not entry('tiktok','gift')['config']['enabled'] and entry('tiktok','follow')['config']['enabled']
 page.get_by_label('Tipo de alerta de twitch',exact=True).select_option('follow')
 assert page.get_by_label('Nombre de prueba de twitch',exact=True).input_value()=='BORRADOR FOLLOW'
 page.get_by_role('button',name='Cargar diseño de la muestra de twitch',exact=True).click()
 preview.locator('#title').get_by_text('LUNA_27',exact=True).wait_for()
 assert preview.locator('#title').evaluate('(el)=>getComputedStyle(el).fontWeight')=='900'
 assert preview.locator('body').evaluate("()=>[...document.fonts].some(f=>f.family.includes('Trefot Inter')&&f.status==='loaded')")
 page.get_by_role('heading',name='Alertas por plataforma').scroll_into_view_if_needed()
 page.screenshot(path=str(artifacts/'alertas-live.png'),full_page=True)
 page.set_viewport_size({'width':960,'height':900});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 # El HTML real trata el título como texto, aísla plataforma y oculta al finalizar.
 overlay=context.new_page();overlay.set_viewport_size({'width':640,'height':300});overlay.on('pageerror',lambda e:errors.append(str(e)))
 now=int(time.time()*1000);packet=dict(config=cfg('YouTube','#ff3355'),event=dict(event=dict(id=1,title='<img src=x onerror=alert(1)>',message='Anuncio de ejemplo',test=True,replay=False),started_at=now,ends_at=now+3000,sound_at=now),pending=0,duplicate=False)
 overlay.route('**/alerts/youtube?*',lambda r:r.fulfill(body=overlay_document(),content_type='text/html'))
 calls=[0]
 def poll_response(r):
  calls[0]+=1
  if calls[0]==2:r.fulfill(status=503,body='Offline')
  else:r.fulfill(json=packet)
 overlay.route('**/api/alerts/youtube/poll?*',poll_response)
 overlay.add_init_script("window.audioStarts=0;window.AudioContext=class {state='running';currentTime=0;destination={};resume(){return Promise.resolve()}createOscillator(){return {frequency:{setValueAtTime(){}},connect(){},start(){window.audioStarts++},stop(){}}}createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}}}}")
 overlay.goto('http://127.0.0.1:1420/alerts/youtube?key=test');overlay.locator('#alert.visible').wait_for();assert overlay.locator('#title').inner_text()=='<img src=x onerror=alert(1)>';assert overlay.locator('#title img').count()==0
 assert overlay.locator('#alert').bounding_box()['height']+32<=300
 overlay.screenshot(path=str(artifacts/'alerta-youtube.png'))
 overlay.wait_for_timeout(1600);assert overlay.evaluate('window.audioStarts')==1
 packet['event']=None;overlay.locator('#alert.visible').wait_for(state='hidden',timeout=5000)
 # Un navegador que bloquea audio debe ofrecer un control, sin esperar para siempre.
 blocked=context.new_page();blocked.set_viewport_size({'width':640,'height':300});blocked.on('pageerror',lambda e:errors.append(str(e)))
 blocked.route('**/alerts/youtube?*',lambda r:r.fulfill(body=overlay_document(),content_type='text/html'))
 now=int(time.time()*1000);packet['event']=dict(event=dict(id=2,title='Prueba de audio',message='',test=True,replay=False),started_at=now,ends_at=now+3000,sound_at=now)
 blocked.route('**/api/alerts/youtube/poll?*',lambda r:r.fulfill(json=packet))
 blocked.add_init_script("window.AudioContext=class {state='suspended';resume(){return new Promise(()=>{})}}")
 blocked.goto('http://127.0.0.1:1420/alerts/youtube?key=test');blocked.get_by_role('button',name='Activar sonido',exact=True).wait_for(timeout=5000)
 # Las fuentes nuevas se recargan al cambiar la versión de Nexus.
 versioned=context.new_page();version_state={'app_version':'0.2.18'};loads=[0]
 def version_document(r):
  loads[0]+=1
  html=overlay_document().replace('__NEXUS_ALERT_VERSION__',version_state['app_version'])
  r.fulfill(body=html,content_type='text/html')
 versioned.route('**/alerts/twitch?*',version_document)
 versioned.route('**/api/alerts/twitch/poll?*',lambda r:r.fulfill(json=dict(config=cfg('Twitch','#9146ff'),event=None,pending=0,duplicate=False,app_version=version_state['app_version'])))
 versioned.goto('http://127.0.0.1:1420/alerts/twitch?key=test');versioned.wait_for_timeout(600);assert loads[0]==1
 version_state['app_version']='0.2.19'
 for _ in range(20):
  if loads[0]>=2:break
  versioned.wait_for_timeout(100)
 assert loads[0]==2
 versioned.wait_for_timeout(600);assert loads[0]==2
 assert all(n==1 for n in asset_calls.values()),asset_calls
 assert not errors,errors
 print(json.dumps(dict(per_event_drafts_and_save=True,shared_queue=True,variables=True,disabled_event=True,assets_loaded_once=True,auto_refresh_on_version_change=True,approved_art=True,reference_preset=True,animated_mascot=True,editable_type_and_text=True,isolated_silent_preview=True,tiktok=True,independent_controls=True,separate_urls=True,save_preferences=True,responsive=True,overlay_safe_text=True,overlay_hides=True,no_audio_repeat_on_reconnect=True,audio_permission_control=True,js_errors=errors)))
 b.close()
