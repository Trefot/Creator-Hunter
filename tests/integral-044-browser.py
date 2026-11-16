"""Current UI regression: disposable SQLite, mocked native services, no real accounts or media.
Run Vite on NEXUS_TEST_URL (default http://127.0.0.1:1444), then this file with Python Playwright.
"""
from pathlib import Path
from collections import Counter
import json,os
fixture=Path(__file__).with_name('moments-browser.py')
ns={'__file__':str(fixture)}
exec(fixture.read_text().split('with sync_playwright() as p:')[0],ns)
db=ns['db'];W=ns['W'];original=ns['native']
db.execute("INSERT INTO profile(id,workspace_id,platform,handle) VALUES('yt',?,'youtube','ejemplo-pruebas')",[W])
db.execute("INSERT INTO content_series(id,workspace_id,title) VALUES('series',?,'Serie de prueba')",[W])
for i in range(8):
 db.execute("INSERT INTO content_post(id,workspace_id,profile_id,remote_id,platform,title,url,published_at,last_seen_at,format,series_id) VALUES(?,?,'yt',?,'youtube',?,'https://www.youtube.com/watch?v=abcdefghijk','2026-11-01T00:00:00Z','2026-11-02T00:00:00Z','short',?)",[str(i),W,'video'+str(i),'Publicación de prueba '+str(i),'series' if i<3 else None])
 db.execute("INSERT INTO content_observation(id,post_id,observed_at,views,likes,comments) VALUES(?,?,'2026-11-02T00:00:00Z',?,?,?)",['o'+str(i),str(i),200 if i<3 else 100,10,2])
db.commit()
def native(args):
 if args['cmd']=='metrics_status':return {p:{'configured':False,'auto':False} for p in ['twitch','meta','tiktok']}
 if args['cmd']=='content_sync':return {'count':8}
 return original(args)
with ns['sync_playwright']() as pw:
 b=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1280,'height':960});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.expose_function('studioSql',ns['sql_call']);page.expose_function('studioNative',native);page.add_init_script(ns['mock'])
 page.goto(os.environ.get('NEXUS_TEST_URL','http://127.0.0.1:1444'))
 page.get_by_role('button',name='Ver qué contenido funciona',exact=True).click()
 page.get_by_role('heading',name='Qué contenido está funcionando',exact=True).wait_for()
 page.get_by_label('Filtrar publicaciones por serie',exact=True).select_option('series')
 page.get_by_text('YouTube · Repetir el enfoque',exact=True).wait_for()
 assert page.get_by_role('heading',name='Publicación de prueba',exact=False).count()==3
 page.get_by_role('button',name='En directo',exact=False).first.click();page.wait_for_timeout(500)
 ns['calls'].clear();page.wait_for_timeout(7800)
 counts=dict(Counter(c for c,a in ns['calls']))
 assert counts.get('studio_tts_status',0)==0,counts
 assert counts.get('music_status',0)==0,counts
 assert counts.get('obs_markers',0)==0,counts
 page.get_by_role('tab',name='Sonido',exact=True).click();page.wait_for_timeout(400)
 assert any(c=='studio_tts_status' for c,a in ns['calls'])
 page.get_by_role('button',name='Buscar en Nexus',exact=False).click();page.get_by_label('Buscar secciones',exact=True).fill('clips');page.get_by_role('button',name='Momentos y Shorts',exact=False).click();page.wait_for_timeout(300)
 page.evaluate("window.dispatchEvent(new CustomEvent('nexus-select-recording',{detail:'audit'}))");page.wait_for_timeout(200)
 assert page.locator('details').evaluate_all("els=>els.some(e=>e.open&&e.querySelector('summary')?.textContent.includes('Grabaciones y subtítulos'))")
 page.get_by_role('button',name='Nueva idea',exact=True).click()
 page.get_by_label('Título',exact=True).fill('Borrador recuperable de prueba')
 page.get_by_role('button',name='En directo',exact=False).first.click()
 page.get_by_role('button',name='Buscar en Nexus',exact=False).click();page.get_by_label('Buscar secciones',exact=True).fill('clips');page.get_by_role('button',name='Momentos y Shorts',exact=False).click()
 page.get_by_role('button',name='Nueva idea',exact=True).click()
 assert page.get_by_label('Título',exact=True).input_value()=='Borrador recuperable de prueba'
 assert not errors,errors
 out=Path(os.environ.get('NEXUS_ARTIFACTS',str(Path(__file__).resolve().parents[2]/'artifacts'/'Nexus-Integral-044')));out.mkdir(parents=True,exist_ok=True)
 (out/'browser-results.json').write_text(json.dumps({'native_services':'simulated','hidden_panel_calls':counts,'page_errors':errors,'checks':['publication library','same-age series advice','hidden polling paused','sound polling resumes','subtitle details opens','draft survives navigation']},indent=2))
 page.screenshot(path=str(out/'borrador.png'));b.close();print('UI regressions passed: library, comparisons, hidden polling, subtitles and drafts')
