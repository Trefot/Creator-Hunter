"""Built UI under the production CSP, with disposable data and the bundled overlay scripts."""
from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
import os,json,base64
fixture=Path(__file__).with_name('moments-browser.py');ns={'__file__':str(fixture)}
exec(fixture.read_text().split('with sync_playwright() as p:')[0],ns)
root=fixture.resolve().parents[1];policy=json.loads((root/'src-tauri/tauri.conf.json').read_text())['app']['security']['csp']
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*a,**k):super().__init__(*a,directory=str(root/'dist'),**k)
 def end_headers(self):self.send_header('Content-Security-Policy',policy);super().end_headers()
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);Thread(target=server.serve_forever,daemon=True).start()
try:
 with ns['sync_playwright']() as pw:
  b=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
  page=b.new_page(viewport={'width':1280,'height':960});errors=[];violations=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:violations.append(m.text) if 'Content Security Policy' in m.text else None)
  page.expose_function('studioSql',ns['sql_call']);page.expose_function('studioNative',ns['native']);page.add_init_script(ns['mock']);page.goto('http://127.0.0.1:'+str(server.server_port));page.get_by_role('heading',name='Mira cómo crece lo que creas.',exact=True).wait_for()
  counter=(root/'src-tauri/overlay/counters.html').read_text()
  alerts=(root/'src-tauri/overlay/alerts.html').read_text().replace('<script>','<script>window.NEXUS_ALERT_PREVIEW=true;</script><script>')
  for name,html in [('counter-proof',counter),('alert-proof',alerts)]:
   page.evaluate("([name,html])=>{const frame=document.createElement('iframe');frame.name=name;frame.sandbox='allow-scripts';frame.srcdoc=html;document.body.append(frame)}",[name,html])
  page.wait_for_timeout(300)
  assert page.locator('iframe[name=counter-proof]').element_handle().content_frame().evaluate('typeof render')=='function'
  assert page.locator('iframe[name=alert-proof]').element_handle().content_frame().evaluate('typeof fitName')=='function'
  assert not errors,errors
  assert not violations,violations
  out=Path(os.environ.get('NEXUS_ARTIFACTS',str(root.parent/'artifacts'/'Nexus-Integral-044')));out.mkdir(parents=True,exist_ok=True)
  (out/'production-csp.json').write_text(json.dumps({'built_ui':True,'bundled_counter_script':True,'bundled_alert_script':True,'csp_violations':violations,'page_errors':errors,'native_services':'simulated'},indent=2));b.close();print('Production UI and bundled preview scripts pass the production CSP')
finally:server.shutdown();server.server_close()
