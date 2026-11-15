# Vite on port 1432. Python Playwright and Chromium required.
# SQLite is disposable; native audio/OBS commands are mocked; no real microphone or account access.
# Run with the Vite dev server on port 1420 and Python Playwright/Chromium installed.
# Uses a disposable SQLite database and mocked native commands, never personal credentials.
from playwright.sync_api import sync_playwright
import sqlite3,pathlib,json
root=pathlib.Path(__file__).resolve().parents[1]; db=sqlite3.connect(':memory:');db.row_factory=sqlite3.Row
db.execute('PRAGMA foreign_keys=ON')
for f in sorted((root/'src-tauri/migrations').glob('*.sql')):db.executescript(f.read_text())
W='00000000-0000-4000-8000-000000000001'
db.execute("INSERT INTO game(id,workspace_id,title,platform) VALUES('pc',?,'Fortnite','pc')",[W])
db.execute("INSERT INTO game(id,workspace_id,title,platform,np_communication_id,np_service_name) VALUES('ps',?,'Black Myth: Wukong','ps5','wukong','trophy2')",[W])
db.execute("INSERT INTO trophy(id,workspace_id,game_id,name,type,position) VALUES('trophy',?,'ps','Primer trofeo','bronze',0)",[W])
db.execute("INSERT INTO obs_session(id,workspace_id,kind,game_id) VALUES('record',?,'recording','pc')",[W])
db.execute("INSERT INTO obs_marker(id,workspace_id,session_id,title,game_id,record_ms) VALUES('mark',?,'record','Buena jugada','pc',123450)",[W])
db.execute("INSERT INTO obs_clip(id,workspace_id,marker_id,title,output_path,game_id) VALUES('clip',?,'mark','Victoria de Fortnite','D:/Videos/clip.mkv','pc')",[W])
db.execute("INSERT INTO obs_clip(id,workspace_id,title,output_path,game_id) VALUES('other',?,'Clip exclusivo de PS5','D:/Videos/ps.mkv','ps')",[W])
db.execute("INSERT INTO project(id,workspace_id,title) VALUES('project',?,'Mi serie de partidas')",[W]);db.commit()
def sql_call(args):
 try:
  cur=db.execute(args['query'],{str(i+1):v for i,v in enumerate(args.get('values',[]))})
  if args['select']:return [dict(r) for r in cur.fetchall()]
  db.commit();return [cur.rowcount,cur.lastrowid or 0]
 except Exception as e:print('SQL ERROR',str(e),args,flush=True);raise

from copy import deepcopy
speech={'config':{'enabled':False,'voice':'','rate':0,'volume':70,'blocked':'','reward':''},'queue':[],'current':None,'paused':False,'message':''}
music={'library':[{'id':'music-test','title':'Aventura Nexus'}],'queue':[],'requests_enabled':False,'requests':[{'id':'r','user':'Comunidad','platform':'twitch','title':'Aventura Nexus','source':'local'}],'track':None,'playing':False,'audio_connected':False,'volume':70,'message':'','spotify':None}
notes={};calls=[];pc_games=[]
auto={'config':{'phrase':'Nexus guarda esto','culture':'es-ES','confidence':0.8,'before':30,'after':15,'buffer_seconds':60,'buffer_confirmed':False},'activity':{'armed':False,'listening':False,'starting':False,'pending':None,'message':''},'items':[],'bytes':0,'limit_bytes':2147483648}
def native(args):
 cmd=args['cmd'];a=args['args'];calls.append((cmd,a))
 if cmd=='auto_moments_status':return deepcopy(auto)
 if cmd=='auto_moments_activity':return deepcopy(auto['activity'])
 if cmd=='auto_moments_languages':return [{'culture':'es-ES','name':'Español local'}]
 if cmd=='auto_moments_configure':auto['config']=deepcopy(a['config']);return
 if cmd=='auto_moments_control':
  action=a['action'];act=auto['activity']
  if action=='arm':act['armed']=True
  if action=='listen':act['listening']=True
  if action=='stop_voice':act['listening']=False
  if action=='off':act.update({'armed':False,'listening':False,'starting':False,'pending':None})
  if action=='cancel':act['pending']=None
  if action=='capture':
   import time
   act['pending']={'phase':'waiting','save_at_ms':int(time.time()*1000)+15000}
  return
 if cmd=='auto_moments_review':
  if a['action']!='open':next(c for c in auto['items'] if c['id']==a['id'])['state']=a['action']
  return
 if cmd=='auto_moments_cleanup':return 0
 if cmd=='media_jobs_status':return {'jobs':[],'light':True,'obs_busy':False}
 if cmd=='media_inspect':return {'audio':[{'index':0,'channels':2,'title':'Mezcla OBS'},{'index':1,'channels':1,'title':'Micrófono'}]}
 if cmd=='subtitles_status':return {'whisper':True,'model':True,'ffmpeg':True}
 if cmd=='subtitles_recordings':return []
 if cmd=='shorts_status':return {'ffmpeg':'C:/tools/ffmpeg.exe'}
 if cmd=='shorts_list':return []
 if cmd=='shorts_render':return {'id':'export-fixture','path':'D:/Videos/Nexus Shorts/short.mp4','warning':'El buffer no contiene todo el tramo solicitado.'}
 if cmd=='chat_commands_get':return {'config':{'enabled':False,'commands':[]},'status':{}}
 if cmd=='stream_recaps':return []
 if cmd=='studio_tts_status':return speech
 if cmd=='studio_tts_configure':speech['config'].update(a);return
 if cmd=='studio_voices':return ['Microsoft Helena']
 if cmd=='studio_reward_create':speech['config']['reward']='reward';return
 if cmd=='studio_tts_control':speech['paused']=True if a['action']=='stop' else not speech['paused'];return
 if cmd=='studio_tts_test':speech['message']='Prueba solicitada';return
 if cmd=='music_status':return music
 if cmd=='music_requests_enable':music['requests_enabled']=a['enabled'];return
 if cmd=='music_request_resolve':music['requests']=[];music['queue']=['music-test'] if a['accept'] else [];return
 if cmd=='music_play':music['track']=a['id'];music['playing']=bool(a['id']);return
 if cmd=='music_volume':music['volume']=a['volume'];return
 if cmd=='studio_resume':
  if a['note'] is not None:notes[a['gameId']]={'note':a['note'],'updated_ms':1800000000000}
  return notes.get(a['gameId'])
 if cmd=='studio_capture_project':
  identity='capture-project-'+a['kind']+'-'+a['id'];db.execute('INSERT OR IGNORE INTO project(id,workspace_id,title,summary,game_id) VALUES(?,?,?,?,?)',[identity,W,'Proyecto de captura','Marca conservada','pc']);db.commit();return identity
 if cmd=='studio_obs_measure':return {'report':{'render_percent':2.5,'encode_percent':0,'network_percent':0,'fps':60,'tips':['Limita los FPS del juego.'],'interval':False},'profiles':{'currentProfileName':'Principal','profiles':['Principal','Gameplay']},'scenes':{'scenes':[{'sceneName':'GAMEPLAY'},{'sceneName':'CHARLA'}]},'video':{'outputWidth':1920,'outputHeight':1080}}
 if cmd=='studio_obs_apply':return 'Perfil aplicado con copia previa de ajustes.'
 if cmd=='studio_obs_restore':return 'Últimos ajustes restaurados.'
 if cmd=='stream_settings':return {'chat_enabled':False,'category_enabled':False,'mappings':[],'category_message':'Pausada'}
 if cmd=='stream_chat':return {'messages':[]}
 if cmd=='social_status':return {'settings':{},'platforms':{}}
 if cmd=='discord_status':return {'settings':{},'activity':None}
 if cmd=='obs_status':return {'enabled':True,'connected':True,'recording':True,'paused':False,'streaming':False,'replay_active':True,'record_ms':90000,'stream_ms':None}
 if cmd=='obs_cabina':return {'scene':'CHARLA','scenes':[{'sceneName':'CHARLA'},{'sceneName':'GAMEPLAY'}],'image':None}
 if cmd=='obs_choose_scene':return None
 if cmd=='obs_clips':return [dict(r) for r in db.execute('SELECT * FROM obs_clip')]
 if cmd=='obs_markers':return [dict(r) for r in db.execute('SELECT m.*,s.output_path FROM obs_marker m JOIN obs_session s ON s.id=m.session_id')]
 if cmd=='live_status':return {'running':True,'port':7879,'key':'private-test-key'}
 if cmd=='youtube_status':return {'connected':False}
 if cmd=='psn_status':return False
 if cmd=='pc_now_playing':return pc_games
 return None
mock=r"""(()=>{let cb=0,registration=0;const callbacks={},handlers={};window.__TAURI_EVENT_PLUGIN_INTERNALS__={unregisterListener(){}};window.emitAuto=async()=>{const activity=await window.studioNative({cmd:'auto_moments_activity',args:{}});for(const id of Object.values(handlers['auto-moments-changed']||{})){callbacks[id]?.({event:'auto-moments-changed',id:1,payload:activity})}};window.__TAURI_INTERNALS__={transformCallback:(fn)=>{callbacks[++cb]=fn;return cb},metadata:{currentWindow:{label:'main'},currentWebview:{label:'main'}},invoke:async(cmd,args={})=>{if(cmd==='plugin:sql|load')return args.db;if(cmd==='plugin:sql|select'||cmd==='plugin:sql|execute')return window.studioSql({...args,select:cmd.endsWith('select')});if(cmd==='plugin:event|listen'){handlers[args.event]??={};handlers[args.event][++registration]=args.handler;return registration}if(cmd==='plugin:event|unlisten'){delete handlers[args.event]?.[args.eventId];return}const result=await window.studioNative({cmd,args});if(['auto_moments_configure','auto_moments_control','auto_moments_review','auto_moments_cleanup'].includes(cmd))await window.emitAuto();return result}}})()"""
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);ctx=b.new_context(viewport={'width':1280,'height':960},permissions=['clipboard-read','clipboard-write']);page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.expose_function('studioSql',sql_call);page.expose_function('studioNative',native);page.add_init_script(mock)
 ctx.route('http://127.0.0.1:7879/**',lambda r:r.fulfill(content_type='text/html',body='<html></html>'))
 out=root.parent/'artifacts'/'Nexus-Momentos';out.mkdir(parents=True,exist_ok=True)
 page.goto('http://127.0.0.1:1432');page.get_by_role('button',name='Buscar en Nexus',exact=False).click();page.get_by_label('Buscar secciones',exact=True).fill('clips');page.get_by_role('button',name='Momentos y Shorts',exact=False).click();panel=page.get_by_role('region',name='Captura automática de momentos',exact=True);panel.wait_for();page.wait_for_timeout(250);assert not any(c=='auto_moments_control' for c,a in calls);assert panel.get_by_role('button',name='Activar captura para esta sesión',exact=True).is_disabled();panel.get_by_label('He configurado esta duración en OBS',exact=True).check();panel.get_by_role('button',name='Guardar ajustes de captura',exact=True).click();assert auto['config']['buffer_confirmed'];panel.get_by_role('button',name='Activar captura para esta sesión',exact=True).click();page.get_by_role('complementary',name='Captura de momentos activa').wait_for();assert not auto['activity']['listening'];panel.get_by_role('button',name='Escuchar mi frase',exact=True).click();page.get_by_text('Micrófono activo · escucha local de momentos',exact=True).wait_for();page.screenshot(path=str(out/'01-Captura.png'))
 panel.get_by_role('button',name='Copiar Stream Deck · capturar momento',exact=True).click();page.wait_for_timeout(100);assert page.evaluate('navigator.clipboard.readText()')=='http://127.0.0.1:7879/api/moments/capture?key=private-test-key'
 panel.get_by_role('button',name='Capturar un momento ahora',exact=True).click();panel.get_by_role('button',name='Cancelar espera',exact=True).wait_for();panel.get_by_role('button',name='Cancelar espera',exact=True).click();assert auto['activity']['pending'] is None
 panel.get_by_role('button',name='Capturar un momento ahora',exact=True).click();auto['activity']['pending']=None;auto['activity']['message']='Candidato guardado. Revísalo en Momentos.';auto['items'].append({'id':'auto-clip','marker_id':None,'output_path':'D:/Videos/clip-voz.mkv','source':'voice','reason':'Frase: Nexus guarda esto','state':'pending','created_ms':1800000000000,'before':30,'after':15,'exists':True});db.execute("INSERT INTO obs_clip(id,workspace_id,title,output_path,game_id) VALUES('auto-clip',?,'Momento por voz','D:/Videos/clip-voz.mkv','pc')",[W]);db.commit();page.evaluate('window.emitAuto()');panel.get_by_role('button',name='Conservar candidato',exact=True).wait_for();assert panel.get_by_role('button',name='Crear Short',exact=True).count()==0;panel.get_by_role('button',name='Ver clip original',exact=True).click();assert any(c=='auto_moments_review' and a['action']=='open' for c,a in calls);panel.get_by_role('button',name='Conservar candidato',exact=True).click();panel.get_by_label('Mostrar candidatos',exact=True).select_option('kept');panel.get_by_role('button',name='Crear Short',exact=True).click();panel.get_by_role('radio').first.check();panel.get_by_role('button',name='Crear',exact=True).click();panel.get_by_text('El buffer no contiene todo el tramo solicitado.',exact=True).wait_for();assert any(c=='shorts_render' and a['id']=='auto-clip' and a['before']==30 and a['after']==15 for c,a in calls);panel.locator('.auto-candidate').scroll_into_view_if_needed();page.screenshot(path=str(out/'02-Candidato.png'))
 panel.get_by_role('button',name='Descartar de la lista',exact=True).click();panel.get_by_label('Mostrar candidatos',exact=True).select_option('discarded');panel.locator('.auto-candidate').filter(has_text='Descartado').wait_for();assert auto['items'][0]['state']=='discarded'
 page.locator('.sidebar .nav-item').filter(has_text='Crear contenido').click();page.get_by_role('button',name='Nueva idea',exact=True).first.click();page.locator('form input').first.fill('Borrador protegido al detectar un juego');pc_games.append({'name':'Fortnite','process':'FortniteClient-Win64-Shipping.exe'});page.evaluate("window.dispatchEvent(new Event('nexus-game-mode-changed'))");page.wait_for_timeout(500);assert page.locator('form input').first.input_value()=='Borrador protegido al detectar un juego';page.get_by_role('complementary',name='Captura de momentos activa').get_by_role('button',name='Desactivar captura y escucha',exact=True).click();assert not auto['activity']['armed'] and not auto['activity']['listening'];page.get_by_role('complementary',name='Captura de momentos activa').wait_for(state='hidden')
 page.get_by_role('tab',name='Momentos y clips',exact=True).click();page.get_by_role('region',name='Captura automática de momentos',exact=True).wait_for()
 for width in [1280,960]:
  page.set_viewport_size({'width':width,'height':750});page.wait_for_timeout(100);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert page.locator('.content').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
 assert not errors,errors
 print(json.dumps({'explicit_arming':True,'global_mic_indicator':True,'cancellation':True,'review_before_export':True,'short_warning':True,'private_deck_link':True,'game_detection_preserves_draft':True,'content_hub_candidates':True,'responsive':True,'errors':errors}));b.close()
