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
notes={};calls=[]
def native(args):
 cmd=args['cmd'];a=args['args'];calls.append((cmd,a))
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
 if cmd=='pc_now_playing':return []
 return None
mock=r'''(()=>{let cb=0;window.__TAURI_EVENT_PLUGIN_INTERNALS__={unregisterListener(){}};window.__TAURI_INTERNALS__={transformCallback:()=>++cb,metadata:{currentWindow:{label:'main'},currentWebview:{label:'main'}},invoke:async(cmd,args={})=>{if(cmd==='plugin:sql|load')return args.db;if(cmd==='plugin:sql|select'||cmd==='plugin:sql|execute')return window.studioSql({...args,select:cmd.endsWith('select')});if(cmd.startsWith('plugin:event|'))return ++cb;return window.studioNative({cmd,args})}}})()'''
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);ctx=b.new_context(viewport={'width':1280,'height':960},permissions=['clipboard-read','clipboard-write']);page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.expose_function('studioSql',sql_call);page.expose_function('studioNative',native);page.add_init_script(mock)
 ctx.route('http://127.0.0.1:7879/**',lambda r:r.fulfill(content_type='text/html',body='<html></html>'))
 out=root.parent/'artifacts'/'Nexus-Visual-Implementado';out.mkdir(parents=True,exist_ok=True)
 page.goto('http://127.0.0.1:1420');page.get_by_role('heading',name='La próxima historia empieza contigo.').wait_for();page.wait_for_timeout(250);page.screenshot(path=str(out/'01-Inicio.png'))
 page.get_by_role('button',name='Modo enfoque',exact=False).click();assert page.locator('.dashboard-secondary').is_hidden();page.reload();assert page.locator('.dashboard-secondary').is_hidden();page.get_by_role('button',name='Modo enfoque',exact=False).click()
 page.keyboard.press('Control+k');page.get_by_label('Buscar secciones',exact=True).fill('musica');page.get_by_role('button',name='Voz y música',exact=False).click();page.get_by_role('tab',name='Sonido',exact=True).wait_for();assert page.get_by_role('tab',name='Sonido',exact=True).get_attribute('aria-selected')=='true'
 tts=page.locator('.studio-module').filter(has=page.get_by_text('🔊 TTS · mensajes con puntos de Twitch',exact=True));tts.get_by_role('button',name='Buscar voces instaladas',exact=True).click();tts.get_by_label('Voz TTS',exact=True).select_option('Microsoft Helena');tts.get_by_label('Habilitar voz para canjes',exact=True).check();tts.get_by_role('button',name='Guardar voz y filtros',exact=True).click();page.wait_for_timeout(200);assert speech['config']['voice']=='Microsoft Helena'
 tts.get_by_label('Mensaje de prueba',exact=True).fill('Borrador conservado');page.get_by_role('tab',name='Chat',exact=True).click();page.get_by_role('tab',name='Sonido',exact=True).click();assert tts.get_by_label('Mensaje de prueba',exact=True).input_value()=='Borrador conservado'
 page.get_by_role('tab',name='Cabina',exact=True).click();page.keyboard.press('Control+k');page.get_by_label('Buscar secciones',exact=True).fill('musica');page.get_by_role('button',name='Voz y música',exact=False).click();assert page.get_by_role('tab',name='Sonido',exact=True).get_attribute('aria-selected')=='true';page.get_by_role('tab',name='Cabina',exact=True).click();page.get_by_role('button',name='GAMEPLAY',exact=True).wait_for();assert not any(c=='obs_cabina' and a.get('capture') for c,a in calls);page.wait_for_timeout(250);page.screenshot(path=str(out/'03-Cabina.png'));page.get_by_role('button',name='Actualizar vista',exact=True).click();page.wait_for_timeout(200);assert len([c for c,a in calls if c=='obs_cabina' and a.get('capture')])==1;page.get_by_role('button',name='GAMEPLAY',exact=True).click();page.wait_for_timeout(200);assert any(c=='obs_choose_scene' and a['scene']=='GAMEPLAY' for c,a in calls)
 page.get_by_role('tab',name='Categoría',exact=True).click();page.get_by_label('Juego de tu biblioteca',exact=True).select_option('pc');page.get_by_placeholder('Por ejemplo: Fortnite').fill('Fortnite');page.get_by_role('tab',name='Chat',exact=True).click();page.get_by_role('tab',name='Categoría',exact=True).click();assert page.get_by_placeholder('Por ejemplo: Fortnite').input_value()=='Fortnite'
 page.get_by_role('tab',name='Contadores',exact=True).click();page.get_by_role('button',name='Nuevo contador',exact=True).click();page.get_by_role('tab',name='Chat',exact=True).click();page.get_by_role('tab',name='Contadores',exact=True).click();assert page.locator('form.counter-form').is_visible()
 page.locator('.sidebar .nav-item').filter(has_text='Crear contenido').click();page.get_by_text('Mi serie de partidas',exact=True).wait_for();page.wait_for_timeout(250);page.screenshot(path=str(out/'02-Contenido.png'));page.get_by_role('tab',name='Ideas',exact=True).click();page.get_by_role('button',name='Nueva idea',exact=True).first.click();page.get_by_role('tab',name='Mis proyectos',exact=True).click();page.get_by_role('tab',name='Ideas',exact=True).click();assert page.locator('form').is_visible()
 page.locator('.sidebar .nav-item').filter(has_text='Juegos').click();page.locator('summary').filter(has_text='Añadir juegos').click();page.get_by_text('Añade un juego para abrir su ficha',exact=False).wait_for(state='attached');page.wait_for_timeout(250);page.screenshot(path=str(out/'04-Juegos.png'))
 for section in ['Inicio','Crear contenido','En directo','Juegos']:
  page.locator('.sidebar .nav-item').filter(has_text=section).click()
  for width in [1280,960]:
   page.set_viewport_size({'width':width,'height':960});page.wait_for_timeout(100);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),section
   assert page.locator('.content').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1'),(section,width)
 assert not errors,errors
 print(json.dumps({'navigation':True,'search_without_accents':True,'focus_persists':True,'drafts_survive_tabs':True,'manual_capture_only':True,'explicit_scene_change':True,'responsive_960_1280':True,'errors':errors}));b.close()
