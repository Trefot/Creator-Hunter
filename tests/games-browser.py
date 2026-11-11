# Prueba opcional: requiere Vite abierto, Python, Playwright/Chromium y Pillow.
# Solo usa una base SQLite en memoria con datos ficticios.
from playwright.sync_api import sync_playwright
import sqlite3,pathlib,json,os,io
from PIL import Image
root=pathlib.Path(__file__).resolve().parents[1]; artifacts=root/'.browser-artifacts';artifacts.mkdir(exist_ok=True); db=sqlite3.connect(':memory:');db.row_factory=sqlite3.Row
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
mock=r'''(() => {let callback=0;
window.__TAURI_EVENT_PLUGIN_INTERNALS__={unregisterListener(){}};
window.__TAURI_INTERNALS__={transformCallback:()=>++callback,metadata:{currentWindow:{label:'main'},currentWebview:{label:'main'}},invoke:async(cmd,args={})=>{
 if(cmd==='prepare_database'||cmd==='obs_initialize'||cmd==='obs_context')return;
 if(cmd==='plugin:sql|load')return args.db;
 if(cmd==='plugin:sql|select'||cmd==='plugin:sql|execute')return await window.studioSql({...args,select:cmd.endsWith('select')});
 if(cmd==='pc_now_playing')return [];
 if(cmd==='psn_status')return false;
 if(cmd==='youtube_status')return {connected:false};
 if(cmd==='update_check')return null;
 if(cmd.startsWith('plugin:event|'))return ++callback;
 throw Error('Unexpected native command: '+cmd);
}};})()'''
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('NEXUS_CHROMIUM', '/usr/bin/chromium' if pathlib.Path('/usr/bin/chromium').exists() else None),headless=True,args=['--no-sandbox']);context=b.new_context(viewport={'width':1280,'height':900},permissions=['clipboard-read','clipboard-write']);page=context.new_page();errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)));page.expose_function('studioSql',sql_call);page.add_init_script(mock);page.goto(os.environ.get('NEXUS_TEST_URL','http://127.0.0.1:1420'))
 page.get_by_role('button',name='Juegos',exact=True).click()
 page.locator('.gallery-button').filter(has_text='Fortnite').wait_for()
 assert '0/0' not in page.locator('.gallery').inner_text()
 page.screenshot(path=str(artifacts/'nexus-juegos-biblioteca.png'),full_page=True)
 page.locator('.gallery-button').filter(has_text='Fortnite').click()
 assert page.get_by_role('button',name='Ruta al platino',exact=True).count()==0
 page.get_by_label('Nuevo objetivo',exact=True).fill('Conseguir una victoria')
 page.get_by_role('button',name='Añadir',exact=True).click()
 page.locator('.game-objectives').get_by_text('Conseguir una victoria',exact=True).wait_for()
 page.locator('.game-objectives input[type=checkbox]').click()
 page.wait_for_function("document.querySelector('.game-objectives input[type=checkbox]').checked")
 page.get_by_label('Notas de la partida de hoy',exact=True).fill('Probar una ruta y marcar el final')
 page.get_by_role('button',name='Guardar notas de hoy',exact=True).click()
 page.get_by_role('button',name='Portada y notas',exact=True).click()
 page.get_by_role('button',name='Editar',exact=True).click()
 page.get_by_label('Notas del juego',exact=True).fill('Mis retos de Fortnite')
 image=io.BytesIO();Image.new('RGB',(640,360),'#564598').save(image,format='PNG')
 page.get_by_label('Elegir portada',exact=True).set_input_files({'name':'cover.png','mimeType':'image/png','buffer':image.getvalue()})
 page.get_by_role('button',name='Guardar cambios',exact=True).click()
 page.get_by_text('Mis retos de Fortnite',exact=True).wait_for()
 assert db.execute("SELECT cover FROM game WHERE id='pc'").fetchone()[0].startswith('data:image/jpeg')
 page.get_by_role('button',name='Contenido',exact=True).click()
 page.get_by_text('Victoria de Fortnite',exact=True).wait_for()
 assert page.get_by_text('Clip exclusivo de PS5',exact=True).count()==0
 page.locator('.game-media-list').first.get_by_role('button',name='Crear idea',exact=True).click()
 page.locator('.game-media-list').first.get_by_role('button',name='Crear idea',exact=True).click()
 assert db.execute("SELECT COUNT(*) FROM idea WHERE capture_key='clip:clip'").fetchone()[0]==1
 page.get_by_role('combobox',name='Proyecto sin juego asociado',exact=True).select_option('project')
 page.get_by_role('button',name='Asociar proyecto',exact=True).click()
 page.get_by_role('button',name='Mi serie de partidas',exact=True).wait_for()
 page.get_by_label('Nueva idea para este juego',exact=True).fill('Una partida sin construir')
 page.get_by_role('button',name='Guardar idea',exact=True).click()
 page.get_by_text('Una partida sin construir',exact=True).wait_for()
 page.screenshot(path=str(artifacts/'nexus-juegos-contenido.png'),full_page=True)
 page.get_by_role('button',name='Abrir Ideas',exact=True).click()
 page.locator('.gallery-card').filter(has=page.get_by_text('Victoria de Fortnite',exact=True)).get_by_role('button',name='Aprobar',exact=True).click()
 page.locator('.gallery-card').filter(has=page.get_by_text('Victoria de Fortnite',exact=True)).wait_for(state='detached')
 assert db.execute("SELECT game_id FROM project WHERE idea_id=(SELECT id FROM idea WHERE capture_key='clip:clip')").fetchone()[0]=='pc'
 page.reload()
 page.get_by_role('button',name='Juegos',exact=True).click()
 page.locator('.gallery-button').filter(has_text='Fortnite').click()
 page.get_by_role('button',name='Hoy',exact=True).click()
 assert page.locator('.game-objectives input[type=checkbox]').is_checked()
 assert page.get_by_label('Notas de la partida de hoy',exact=True).input_value()=='Probar una ruta y marcar el final'
 page.screenshot(path=str(artifacts/'nexus-juegos-fortnite.png'),full_page=True)
 page.get_by_role('button',name='← Juegos',exact=True).click()
 page.locator('.gallery-button').filter(has_text='Black Myth').click()
 page.get_by_role('button',name='Ruta al platino',exact=True).wait_for()
 page.get_by_role('button',name='Lista de trofeos',exact=True).click()
 page.get_by_text('Primer trofeo',exact=True).wait_for()
 for width in [1280,960]:page.set_viewport_size({'width':width,'height':900});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 assert not errors,errors
 print(json.dumps({'sqlite_real':True,'biblioteca_sin_0_0':True,'objetivos_persistentes':True,'notas_portada':True,'clip_a_idea_sin_duplicados':True,'proyecto_asociado':True,'ediciones_aisladas':True,'psn_trofeos':True,'errores_js':errors}))
 b.close()
