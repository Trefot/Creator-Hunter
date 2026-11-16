"""Nexus polish: temporary SQLite and mocked services; no personal accounts or OBS."""
from pathlib import Path
exec(Path(__file__).with_name('moments-browser.py').read_text().split('with sync_playwright() as p:')[0])
base_native=native
from datetime import date,timedelta
today=date.today()
for platform,count in [('youtube',347),('twitch',402),('tiktok',620),('instagram',155),('facebook',90)]:
 db.execute('INSERT INTO profile(id,workspace_id,platform,handle,display_name) VALUES(?,?,?,?,?)',[platform,W,platform,'trefotg',platform.title()])
 for age,value in [(30,count-15),(0,count)]:db.execute("INSERT INTO account_snapshot(id,workspace_id,profile_id,recorded_on,followers,source) VALUES(?,?,?,?,?,'manual')",[platform+str(age),W,platform,str(today-timedelta(days=age)),value])
db.commit()
def native(args):
 if args['cmd']=='metrics_status':return {p:{'configured':False,'auto':False} for p in ['twitch','meta','tiktok']}
 return base_native(args)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);ctx=b.new_context(viewport={'width':1280,'height':960});page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.expose_function('studioSql',sql_call);page.expose_function('studioNative',native);page.add_init_script(mock)
 ctx.route('http://127.0.0.1:7879/**',lambda r:r.fulfill(content_type='text/html',body='<html></html>'))
 page.goto('http://127.0.0.1:1442');page.locator('.social-network').first.wait_for();assert page.locator('.social-network').count()==5;page.locator('.social-number').filter(has_text='347').wait_for();assert page.get_by_text('+15 desde',exact=False).count()==5
 out=root.parent/'artifacts/Nexus-Simplificacion/pruebas';out.mkdir(parents=True,exist_ok=True);page.screenshot(path=str(out/'inicio.png'))
 page.get_by_role('button',name='Crear mi meta',exact=True).click();page.get_by_role('dialog').wait_for();assert page.get_by_role('dialog').get_by_label('Red',exact=True).input_value()=='youtube';page.get_by_role('button',name='Cerrar registros o meta',exact=True).click()
 page.locator('.sidebar .nav-item').filter(has_text='Conexiones').click();page.get_by_role('navigation',name='Conexiones').get_by_role('button',name='Instagram + Facebook',exact=False).click();page.get_by_label('Perfil de tu página',exact=True).wait_for();assert page.get_by_label('Perfil de tu página',exact=True).input_value()=='facebook';assert page.get_by_label('Perfil de Instagram vinculado',exact=True).input_value()=='instagram';assert page.get_by_label('Token autorizado',exact=True).get_attribute('type')=='password';assert page.get_by_role('button',name='Autorizar y traer mis cifras',exact=True).is_disabled();page.screenshot(path=str(out/'conexiones.png'))
 page.locator('.sidebar .nav-item').filter(has_text='Crear contenido').click();page.get_by_role('tab',name='Capturas y Shorts',exact=True).click();page.get_by_role('region',name='Captura automática de momentos',exact=True).wait_for();assert not any(c=='auto_moments_control' for c,a in calls)
 page.locator('.sidebar .nav-item').filter(has_text='En directo').click();page.get_by_role('tab',name='Cabina',exact=True).wait_for();page.get_by_role('tab',name='Momentos',exact=True).click();page.get_by_role('button',name='Abrir mis capturas y Shorts',exact=True).click();page.get_by_role('tab',name='Capturas y Shorts',exact=True).wait_for();assert page.get_by_role('tab',name='Capturas y Shorts',exact=True).get_attribute('aria-selected')=='true'
 for width in [1280,960]:
  page.set_viewport_size({'width':width,'height':960})
  for section in ['Inicio','Conexiones','Crear contenido','Juegos']:
   page.locator('.sidebar .nav-item').filter(has_text=section).first.click();page.wait_for_timeout(180);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(section,width);assert page.locator('.content').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1'),(section,width)
 assert not errors,errors
 print(json.dumps({'social_cards':5,'real_record_growth':True,'goal_profile':True,'linked_meta_profiles':True,'private_token_input':True,'one_capture_workflow':True,'no_automatic_capture':True,'responsive':True,'errors':errors}));b.close()
