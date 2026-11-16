"""Browser flow with disposable SQLite and simulated native replay reader. No game or personal data."""
from pathlib import Path
exec(Path(__file__).with_name('moments-browser.py').read_text().split('with sync_playwright() as p:')[0])
base_native=native
chests={'config':{'enabled':False,'counter_id':'','directory':'C:/Fortnite/Saved/Demos','activated_ms':0,'player':None},'reader_ready':True,'directory_exists':True,'message':'','recent':[]}
db.execute("INSERT INTO counter(id,workspace_id,name,value) VALUES('chests',?,'Cofres Fortnite',2255)",[W]);db.commit()
def native(args):
 cmd=args['cmd'];a=args['args']
 if cmd=='fortnite_counter_status':return deepcopy(chests)
 if cmd=='fortnite_counter_configure':
  calls.append((cmd,a));chests['config'].update({'enabled':a['enabled'],'counter_id':a['counterId'],'directory':a['directory'],'activated_ms':1800000000000});return
 return base_native(args)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);page=b.new_page(viewport={'width':1280,'height':960});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.expose_function('studioSql',sql_call);page.expose_function('studioNative',native);page.add_init_script(mock)
 page.goto('http://127.0.0.1:1440');page.locator('.sidebar .nav-item').filter(has_text='En directo').click();page.get_by_role('tab',name='Contadores',exact=True).click()
 panel=page.locator('section').filter(has=page.get_by_role('heading',name='Fortnite · contar cofres sin pulsar botones',exact=True)).last
 panel.get_by_role('button',name='Activar conteo automático',exact=True).wait_for();assert not any(c=='fortnite_counter_configure' for c,a in calls)
 assert panel.get_by_label('Tu contador de cofres',exact=True).input_value()=='chests'
 panel.get_by_role('button',name='Activar conteo automático',exact=True).click();panel.get_by_text('Conteo automático activado',exact=True).wait_for();assert panel.get_by_label('Tu contador de cofres',exact=True).is_disabled();assert db.execute("SELECT value FROM counter WHERE id='chests'").fetchone()[0]==2255
 chests['recent']=[{'opened':8,'destroyed':4,'uncertain':2,'vehicle_missing':True,'ended_ms':1800000000000,'applied':12}];page.wait_for_timeout(5200);panel.get_by_text('Últimas partidas contadas',exact=True).click();panel.get_by_text('2 posibles no se sumaron.',exact=False).wait_for();panel.get_by_text('Faltan datos de destrucción desde vehículos.',exact=False).wait_for()
 # A missing helper must never prevent switching an already enabled counter off.
 chests['reader_ready']=False;page.wait_for_timeout(5200);assert panel.get_by_role('button',name='Desactivar conteo automático',exact=True).is_enabled();panel.get_by_role('button',name='Desactivar conteo automático',exact=True).click();panel.get_by_text('Conteo automático desactivado',exact=True).wait_for()
 for width in [1280,960]:
  page.set_viewport_size({'width':width,'height':850});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 assert not errors,errors
 out=root.parent/'artifacts'/'Nexus-Cofres';out.mkdir(exist_ok=True,parents=True);page.screenshot(path=str(out/'panel-conteo.png'))
 print(json.dumps({'opt_in':True,'keeps_existing_total':True,'locks_active_selection':True,'uncertain_and_vehicle_notice':True,'can_disable_if_reader_missing':True,'errors':errors}));b.close()
