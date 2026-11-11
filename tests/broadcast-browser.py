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
 if(cmd==='game_broadcast_state'||cmd==='game_targets'||cmd==='game_target_change'||cmd==='game_broadcast_action')return await window.broadcastRpc(cmd,args);
 if(cmd==='live_status')return {running:true,port:7879,key:'testing-broadcast-key'};
 if(cmd==='obs_sources')return {inputs:[{inputName:'Captura Wukong',inputKind:'game_capture'}]};
 if(cmd==='obs_capture'){const c=document.createElement('canvas');c.width=1280;c.height=720;const ctx=c.getContext('2d');ctx.fillStyle='#141523';ctx.fillRect(0,0,1280,720);if(window.testNotice!==false){ctx.fillStyle='#fff';ctx.font='bold 28px Arial';ctx.fillText('CUENTAS OJO DE GATO',500,320);}return c.toDataURL('image/png');}
 throw Error('Unexpected native command: '+cmd);
}};})()'''

def targets(game):
 result=[]
 for row in db.execute('SELECT * FROM game_target WHERE game_id=? ORDER BY position,rowid',[game]):
  t=dict(row);t['done']=bool(t['done']) or bool(db.execute('SELECT 1 FROM collection_item WHERE game_id=? AND item_key=?',[game,t['collection_key']]).fetchone());t['psn_achieved']=False;result.append(t)
 return result

def broadcast_state():
 cfg=db.execute('SELECT * FROM game_overlay').fetchone();game=db.execute('SELECT id,title FROM game WHERE id=?',[cfg['game_id']]).fetchone() if cfg else None
 ts=targets(cfg['game_id']) if game else []
 target=next((t for t in ts if t['id']==cfg['target_id']),None) if cfg else None
 manual=db.execute("SELECT COUNT(*) FROM game WHERE status='platinum'").fetchone()[0]
 return {'platinos':manual,'verified':0,'manual':manual,'game':dict(game) if game else None,'target':target,'done':sum(t['done'] for t in ts),'total':len(ts)}

def rpc(cmd,args):
 if cmd=='game_broadcast_state':return broadcast_state()
 if cmd=='game_targets':return targets(args['gameId'])
 if cmd=='game_broadcast_action':
  cfg=db.execute('SELECT * FROM game_overlay').fetchone();args={'targetId':cfg['target_id'],'done':args['action']=='complete'}
 row=db.execute('SELECT * FROM game_target WHERE id=?',[args['targetId']]).fetchone();done=args['done']
 db.execute('UPDATE game_target SET done=? WHERE id=?',[0 if row['collection_key'] else int(done),row['id']])
 if row['collection_key']:
  if done:db.execute('INSERT OR IGNORE INTO collection_item(id,workspace_id,game_id,item_key) VALUES(?,?,?,?)',['target-'+row['id'],W,row['game_id'],row['collection_key']])
  else:db.execute('DELETE FROM collection_item WHERE game_id=? AND item_key=?',[row['game_id'],row['collection_key']])
 db.commit();return {'id':row['id'],'game_id':row['game_id'],'done':done}

with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);context=b.new_context(viewport={'width':1280,'height':1000},permissions=['clipboard-read','clipboard-write']);page=context.new_page();errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)));page.expose_function('studioSql',sql_call);page.expose_function('broadcastRpc',rpc);page.add_init_script(mock);page.goto('http://127.0.0.1:1420')
 page.get_by_role('button',name='Juegos',exact=True).click()
 page.get_by_role('button',name='Platinados',exact=True).click()
 page.get_by_text('Registrar o fechar un platino manual',exact=True).click()
 page.get_by_label('Juego platinado',exact=True).select_option('pc')
 page.get_by_label('Fecha del platino',exact=True).fill('2026-11-11')
 page.get_by_role('button',name='Guardar registro manual',exact=True).click()
 page.get_by_text('1 juegos · 0 confirmados por trofeos · 1 manuales',exact=True).wait_for()
 page.get_by_role('button',name='Overlay y objetos',exact=True).click()
 page.get_by_label('Juego del overlay',exact=True).select_option('ps')
 page.get_by_role('button',name='Preparar lista de Wukong',exact=True).click()
 page.locator('.game-target-list > li').first.wait_for()
 assert db.execute("SELECT COUNT(*) FROM game_target WHERE game_id='ps'").fetchone()[0]==36
 page.get_by_role('button',name='Preparar lista de Wukong',exact=True).click()
 assert db.execute("SELECT COUNT(*) FROM game_target WHERE game_id='ps'").fetchone()[0]==36
 first=page.locator('.game-target-list > li').first
 first.get_by_role('button',name='Mostrar',exact=True).click()
 page.get_by_text('URLs para OBS y Stream Deck',exact=True).click()
 page.get_by_role('button',name='Copiar overlay completo',exact=True).click()
 assert page.evaluate('navigator.clipboard.readText()')=='http://127.0.0.1:7879/game-overlay'
 first.get_by_role('button',name='Detección visual',exact=True).click()
 first.get_by_role('button',name='Leer fuentes de OBS',exact=True).click()
 first.get_by_label('Captura del juego en OBS',exact=True).select_option('Captura Wukong')
 first.get_by_role('button',name='Capturar aviso de referencia',exact=True).click()
 canvas=first.locator('canvas');canvas.wait_for();page.wait_for_timeout(300);canvas.scroll_into_view_if_needed();box=canvas.bounding_box()
 page.mouse.move(box['x']+480*box['width']/1280,box['y']+275*box['height']/720);page.mouse.down();page.mouse.move(box['x']+900*box['width']/1280,box['y']+345*box['height']/720,steps=8);page.mouse.up()
 first.get_by_role('button',name='Guardar referencia y probar',exact=True).click()
 first.get_by_label('Modo de detección',exact=True).wait_for()
 first.get_by_role('button',name='Confirmar objeto conseguido',exact=True).wait_for(timeout=15000)
 assert db.execute("SELECT COUNT(*) FROM collection_item WHERE game_id='ps'").fetchone()[0]==0
 page.evaluate('window.testNotice=false')
 first.get_by_label('Modo de detección',exact=True).select_option('auto')
 page.wait_for_timeout(3500)
 page.evaluate('window.testNotice=true')
 for _ in range(60):
  if db.execute("SELECT COUNT(*) FROM collection_item WHERE game_id='ps'").fetchone()[0]==1:break
  page.wait_for_timeout(250)
 assert db.execute("SELECT COUNT(*) FROM collection_item WHERE game_id='ps'").fetchone()[0]==1
 page.get_by_role('button',name='Actualizar biblioteca',exact=True).click()
 # El overlay HTML usa texto seguro y el mismo estado de progreso.
 overlay=context.new_page();overlay.set_viewport_size({'width':720,'height':420});overlay.route('**/game-overlay-test',lambda route:route.fulfill(body=(root/'src-tauri/overlay/game.html').read_text(),content_type='text/html'))
 overlay.route('**/api/game/state',lambda route:route.fulfill(json=broadcast_state()))
 overlay.goto('http://127.0.0.1:1420/game-overlay-test');overlay.get_by_text('🏆 1 platinos',exact=True).wait_for();assert overlay.locator('#count').inner_text()=='1/36 objetivos conseguidos'
 assert overlay.locator('#panel').bounding_box()['height']+24 <=420
 overlay.screenshot(path=str(artifacts/'overlay-wukong.png'))
 page.screenshot(path=str(artifacts/'objetos-deteccion.png'),full_page=True)
 assert not errors,errors
 print(json.dumps({'manual_platinum':True,'wukong_36_no_duplicates':True,'overlay_url':True,'reference_test_no_mark':True,'auto_two_frames':True,'overlay_progress':True,'js_errors':errors}))
 b.close()
