"""Navegación 0.2.38 con SQLite temporal y servicios simulados. No accede a cuentas ni OBS reales.
Vite en 1438; Python Playwright y Chromium necesarios.
"""
from pathlib import Path
exec(Path(__file__).with_name('moments-browser.py').read_text().split('with sync_playwright() as p:')[0])
from datetime import datetime,timezone
base_native=native
jobs=[{'id':1,'title':'Exportación de prueba','state':'queued','progress':0,'result':None,'error':None}]
music['spotify_connected']=True
recordings=[]
def native(args):
 cmd=args['cmd'];a=args['args']
 if cmd=='shorts_plan' and a['id']=='mark':raise ValueError('Esta marca no tiene una grabación asociada. Tus otros vídeos no se han borrado.')
 if cmd=='media_jobs_status':return {'jobs':jobs,'light':True,'obs_busy':False}
 if cmd=='media_jobs_cancel':calls.append((cmd,a));jobs[0]['state']='cancelled';return
 if cmd=='media_gpu_test':return {'available':False,'detail':'Prueba simulada: usar CPU.'}
 if cmd=='subtitles_recordings':return recordings
 if cmd=='subtitles_import':
  calls.append((cmd,a));recordings[:]=[{'id':'imported','path':a['path'],'observed_at':'2026-11-15T12:00:00Z','game':None,'exists':True,'marks':0,'srt':None}];return 'imported'
 if cmd=='subtitles_generate':calls.append((cmd,a));recordings[0]['srt']='D:/Videos/short.srt';return {'srt':'D:/Videos/short.srt'}
 if cmd=='studio_export_project':return base_native({'cmd':'studio_capture_project','args':{'kind':'clip','id':'clip'}})
 if cmd=='obs_status':return {'enabled':False,'connected':False,'recording':False,'streaming':False}
 if cmd=='shorts_preview':calls.append((cmd,a));return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='
 return base_native(args)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 ctx=b.new_context(viewport={'width':1280,'height':960},timezone_id='America/Bogota',permissions=['clipboard-read','clipboard-write']);page=ctx.new_page();errors=[]
 page.on('pageerror',lambda e:(errors.append(str(e)),print('BROWSER ERROR',str(e),flush=True)));page.expose_function('studioSql',sql_call);page.expose_function('studioNative',native);page.add_init_script(mock)
 ctx.route('http://127.0.0.1:7879/**',lambda route:route.fulfill(content_type='text/html',body='<html></html>'))
 page.goto('http://127.0.0.1:1438');page.locator('.habit-strip [aria-selected=true]').wait_for()
 page.locator('.sidebar .nav-item').filter(has_text='En directo').click();page.get_by_role('button',name='¿Cómo conecto mis servicios?',exact=True).click()
 page.get_by_role('heading',name='Conectar servicios',exact=True).wait_for();page.get_by_role('navigation',name='Servicios').get_by_role('button',name='Spotify',exact=False).click()
 page.get_by_text('Cuenta autorizada, sin reproducción',exact=True).first.wait_for();page.get_by_role('button',name='Abrir conexión de Spotify',exact=True).click();assert page.get_by_role('tab',name='Sonido',exact=True).get_attribute('aria-selected')=='true'
 page.get_by_text('Configurar y revisar',exact=True).click();page.get_by_role('tab',name='Estado',exact=True).click();page.get_by_role('heading',name='Estado de conexiones',exact=True).wait_for();page.wait_for_timeout(150);assert page.get_by_text('Todo en orden.',exact=True).count()==0
 page.get_by_role('tab',name='Momentos',exact=True).click();inbox=page.locator('.studio-requests').filter(has=page.get_by_text('Victoria de Fortnite',exact=True));card=inbox.locator('li').filter(has=page.get_by_text('Victoria de Fortnite',exact=True))
 card.get_by_role('button',name='Crear Short',exact=True).click();assert not card.get_by_text('Procesamiento',exact=True).is_visible();card.get_by_text('Opciones de imagen y audio',exact=True).click();card.get_by_label('Micrófono · 1 canales',exact=False).check();card.get_by_role('radio').last.check();card.get_by_role('button',name='Ver cómo empieza',exact=True).click();card.get_by_alt_text('Primer fotograma del Short').wait_for();card.get_by_role('button',name='Guardar Short',exact=True).click();card.get_by_text('El buffer no contiene todo el tramo solicitado.',exact=True).wait_for()
 assert any(cmd=='shorts_render' and a['audio']==[0,1] and a['format']=='original' and a['encoder']=='cpu' for cmd,a in calls)
 card.get_by_role('button',name='Crear subtítulos de este Short',exact=True).click();subtitle=page.locator('#subtitle-imported');subtitle.wait_for();subtitle.get_by_label('Mezcla OBS · 2 canales',exact=False).uncheck();subtitle.get_by_label('Micrófono · 1 canales',exact=False).check();subtitle.get_by_role('button',name='Transcribir las pistas elegidas',exact=True).click();assert any(cmd=='subtitles_generate' and a['audio']==[1] for cmd,a in calls)
 missing=page.locator('.studio-requests li').filter(has=page.get_by_text('Buena jugada',exact=True));missing.get_by_role('button',name='Crear Short',exact=True).click();missing.get_by_text('Esta marca no tiene una grabación asociada.',exact=False).wait_for();assert missing.get_by_role('button',name='Guardar Short',exact=True).count()==0;assert missing.get_by_role('radio').count()==0
 page.get_by_text('Procesamiento local ·',exact=False).click();page.get_by_role('button',name='Cancelar',exact=True).click();page.clock.run_for(2000);assert jobs[0]['state']=='cancelled'
 card.get_by_role('button',name='Continuar en proyecto y calendario',exact=True).click();page.get_by_text('Proyecto de captura',exact=True).first.wait_for()
 page.locator('.sidebar .nav-item').filter(has_text='Inicio').click();page.locator('.habit-strip [aria-selected=true]').wait_for();page.clock.install(time=datetime(2026,11,16,4,59,50,tzinfo=timezone.utc));page.clock.run_for(31000);assert page.locator('.habit-strip [aria-selected=true]').count()==1
 assert not errors,errors
 out=root.parent/'artifacts'/'Nexus-Integral';out.mkdir(exist_ok=True,parents=True);page.screenshot(path=str(out/'contenido.png'))
 print(json.dumps({'midnight_rollover':True,'guided_setup':True,'spotify_authorized_paused':True,'connection_summary':True,'audio_and_original_export':True,'subtitle_audio_selection':True,'queue_cancel':True,'export_to_project':True,'errors':errors}));b.close()
