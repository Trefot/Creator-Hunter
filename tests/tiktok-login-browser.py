"""OAuth UI with temporary SQLite and mocked native commands. No real credentials or TikTok access."""
from pathlib import Path
exec(Path(__file__).with_name('moments-browser.py').read_text().split('with sync_playwright() as p:')[0])
base_native=native
from datetime import date
from copy import deepcopy
account={'configured':False,'auto':False,'pending':False,'redirect_uri':'http://127.0.0.1:7878/tiktok/callback','last_auth_ms':0}
db.execute("INSERT INTO profile(id,workspace_id,platform,handle) VALUES('tt',?,'tiktok','testaccount')",[W]);db.commit()
def native(args):
 cmd=args['cmd'];a=args['args']
 if cmd=='metrics_status':return {'meta':{'configured':False,'auto':False},'twitch':{'configured':False,'auto':False},'tiktok':deepcopy(account)}
 if cmd=='metrics_tiktok_begin':
  calls.append((cmd,a));assert a=={'clientKey':'test-client','clientSecret':'test-secret-not-a-real-key','profileId':'tt'};account['pending']=True;return
 if cmd=='metrics_tiktok_cancel':calls.append((cmd,a));account['pending']=False;return
 if cmd=='metrics_sync':
  calls.append((cmd,a));assert a['platform']=='tiktok';account['last_sync_ms']=123456789
  db.execute("INSERT OR REPLACE INTO account_snapshot(id,workspace_id,profile_id,recorded_on,followers,source) VALUES('api-tt',?,'tt',?,17,'api')",[W,str(date.today())]);db.commit();return {'rows':[{'followers':17}]}
 return base_native(args)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);ctx=b.new_context(viewport={'width':1280,'height':960});page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.expose_function('studioSql',sql_call);page.expose_function('studioNative',native);page.add_init_script(mock)
 page.goto('http://127.0.0.1:1442');page.locator('.sidebar .nav-item').filter(has_text='Conexiones').click();page.get_by_role('navigation',name='Conexiones').get_by_role('button',name='TikTok',exact=False).click()
 uri=page.get_by_label('Dirección de retorno de TikTok',exact=True);uri.wait_for();page.wait_for_function("document.querySelector('[aria-label=\"Dirección de retorno de TikTok\"]').value.includes('7878')");assert uri.input_value()=='http://127.0.0.1:7878/tiktok/callback';assert not any(c=='metrics_tiktok_begin' for c,a in calls)
 page.get_by_label('Perfil para autorizar TikTok',exact=True).select_option('tt');page.get_by_label('Client key de TikTok',exact=True).fill('test-client');secret=page.get_by_label('Client secret de TikTok',exact=True);assert secret.get_attribute('type')=='password';secret.fill('test-secret-not-a-real-key');page.get_by_role('button',name='Autorizar TikTok',exact=True).click();page.get_by_text('Esperando autorización en el navegador…',exact=True).wait_for();assert secret.input_value()=='';assert page.get_by_label('Client key de TikTok',exact=True).input_value()==''
 account.update({'pending':False,'configured':True,'last_auth_ms':1234,'name':'Cuenta de prueba'});page.get_by_text('TikTok conectado y cifras actualizadas.',exact=True).wait_for(timeout=10000);assert len([c for c,a in calls if c=='metrics_sync'])==1
 out=root.parent/'artifacts/Nexus-TikTok-043';out.mkdir(parents=True,exist_ok=True);page.screenshot(path=str(out/'conexion.png'))
 page.get_by_label('Client key de TikTok',exact=True).fill('test-client');secret.fill('test-secret-not-a-real-key');page.get_by_role('button',name='Autorizar TikTok',exact=True).click();page.get_by_role('button',name='Cancelar autorización de TikTok',exact=True).click();page.get_by_text('Esperando autorización en el navegador…',exact=True).wait_for(state='hidden');assert not account['pending'];assert len([c for c,a in calls if c=='metrics_sync'])==1
 assert 'test-secret-not-a-real-key' not in page.evaluate('JSON.stringify({...localStorage,...sessionStorage})');assert not errors,errors
 print(json.dumps({'explicit_authorization':True,'private_secret_cleared':True,'local_redirect':True,'callback_triggers_one_sync':True,'cancel_does_not_sync':True,'no_web_storage_credentials':True,'errors':errors}));b.close()
