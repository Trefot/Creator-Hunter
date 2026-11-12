# Opcional: Vite en :1420, Playwright/Chromium. Solo datos y RPC ficticios.
from playwright.sync_api import sync_playwright
from pathlib import Path
import sqlite3,json,time,copy,base64,hashlib,io,wave,struct,math
from alert_fixtures import catalog,asset_path,image_data,overlay_document
root=Path(__file__).resolve().parents[1];artifacts=root/'.browser-artifacts';artifacts.mkdir(exist_ok=True)
db=sqlite3.connect(':memory:');db.row_factory=sqlite3.Row
for f in sorted((root/'src-tauri/migrations').glob('*.sql')):db.executescript(f.read_text())
def sql_call(a):
 c=db.execute(a['query'],{str(i+1):v for i,v in enumerate(a.get('values',[]))});
 if a['select']:return [dict(r) for r in c.fetchall()]
 db.commit();return [c.rowcount,c.lastrowid or 0]
state=catalog();queued=[];asset_calls={};audio_files={}
def cfg(title,color):
 c=copy.deepcopy(state['settings']['twitch']);c.update(title=title,color=color);return c
def entry(platform,kind):return next(e for e in state['events'][platform] if e['kind']==kind)
def rpc(cmd,a):
 if cmd=='alerts_status':return state
 if cmd=='alerts_import_audio':
  raw=base64.b64decode(a['content']);key=hashlib.sha256(raw).hexdigest();audio_files[key]='data:'+a['mime']+';base64,'+a['content'];return key
 if cmd=='alerts_audio_data':return audio_files[a['id']]
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
if(cmd==='social_status')return {settings:{},platforms:{}};
if(cmd.startsWith('discord_'))return await window.discordRpc(cmd,args);
if(cmd.startsWith('alerts_'))return await window.alertRpc(cmd,args);
if(cmd==='live_status')return {running:true,port:7879,key:'local-alert-test-key'};
if(cmd==='obs_status')return {enabled:false,connected:false,port:4455};
if(cmd==='obs_markers'||cmd==='obs_clips'||cmd==='pc_now_playing')return [];
if(cmd==='youtube_status')return {connected:false};if(cmd==='psn_status')return false;
if(cmd==='update_check')return null;if(cmd.startsWith('plugin:event|'))return ++callback;
throw Error('Unexpected native command: '+cmd);
}};})()'''

calls=[]
settings=dict(enabled=False,twitch_live=False,youtube_live=False,twitch_videos=False,youtube_videos=False)
discord=dict(settings=settings,live_configured=False,videos_configured=False,activity=None)
seen=set()
def discord_rpc(cmd,a):
 calls.append((cmd,copy.deepcopy(a)))
 if cmd=='discord_status':return discord
 if cmd=='discord_configure':
  discord['settings']=a['settings']
  for field,flag in [('liveWebhook','live_configured'),('videosWebhook','videos_configured')]:
   if a.get(field):discord[flag]=True
  return None
 if cmd=='discord_test':return None
 if cmd=='discord_remove':discord[a['kind']+'_configured']=False;return None
 if cmd=='discord_publish':
  if a['url'] in seen:return False
  seen.add(a['url']);return True
 raise Exception(cmd)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1440,'height':1100});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.expose_function('studioSql',sql_call);page.expose_function('alertRpc',rpc);page.expose_function('discordRpc',discord_rpc);page.add_init_script(mock)
 page.goto('http://127.0.0.1:1420');page.get_by_role('button',name='Live Studio',exact=True).click()
 panel=page.get_by_role('region',name='Avisos de Discord');panel.wait_for()
 assert not any(c[0]=='discord_test' or c[0]=='discord_publish' for c in calls)
 panel.get_by_text('Conectar canales y elegir avisos',exact=True).click()
 panel.get_by_label('Webhook de directos',exact=False).fill('https://discord.com/api/webhooks/123/ficticio_solo_prueba_123456')
 panel.get_by_label('Webhook de vídeos',exact=False).fill('https://discord.com/api/webhooks/456/ficticio_solo_prueba_654321')
 panel.get_by_label('Activar avisos automáticos',exact=True).check()
 panel.get_by_label('Directos de Twitch',exact=True).check()
 panel.get_by_label('Vídeos públicos de YouTube, incluidos Shorts',exact=True).check()
 panel.get_by_role('button',name='Guardar configuración',exact=True).click()
 panel.get_by_text('Webhook de directos · guardado',exact=True).wait_for()
 assert discord['settings']['twitch_live'] and discord['settings']['youtube_videos']
 assert panel.get_by_label('Webhook de directos',exact=False).input_value()==''
 assert not any(c[0]=='discord_test' for c in calls)
 panel.get_by_role('button',name='Enviar prueba a directos',exact=True).click()
 panel.get_by_text('Mensaje de prueba enviado a Discord.',exact=True).wait_for()
 panel.get_by_text('Compartir una publicación',exact=True).click()
 panel.get_by_role('combobox').select_option('instagram')
 panel.get_by_label('Título',exact=True).fill('Mi nuevo reel')
 panel.get_by_label('Enlace de la publicación',exact=True).fill('https://www.instagram.com/reel/prueba/')
 panel.get_by_role('button',name='Publicar aviso en vídeos',exact=True).click()
 panel.get_by_text('Publicación enviada a vídeos.',exact=True).wait_for()
 panel.get_by_label('Título',exact=True).fill('Mi nuevo reel')
 panel.get_by_label('Enlace de la publicación',exact=True).fill('https://www.instagram.com/reel/prueba/')
 panel.get_by_role('button',name='Publicar aviso en vídeos',exact=True).click()
 panel.get_by_text('Este contenido ya se envió o su entrega necesita comprobarse en Discord.',exact=True).wait_for()
 panel.screenshot(path='/workspace/artifacts/Nexus-Discord-panel.png')
 panel.get_by_role('button',name='Desconectar vídeos',exact=True).click()
 panel.get_by_text('Webhook de vídeos · sin configurar',exact=True).wait_for()
 assert panel.get_by_role('button',name='Publicar aviso en vídeos',exact=True).is_disabled()
 assert not errors,errors
 b.close()
print(json.dumps({'configured_separate_destinations':True,'no_implicit_messages':True,'secrets_cleared_after_save':True,'test_and_manual_publish_mocked':True,'duplicate_feedback':True,'disconnect_disables_publish':True,'js_errors':errors}))
