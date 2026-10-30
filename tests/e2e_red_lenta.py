"""Arranque con mala señal: con la app ya instalada (service worker activo) y una red que tarda 8 s en responder,
la app debe abrir desde la caché en pocos segundos. Uso: python3 -I tests/e2e_red_lenta.py [carpeta_de_la_app]"""
import sys, os, time, threading, functools
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..'))
DELAY = {'s': 0}

class H(SimpleHTTPRequestHandler):
    def do_GET(self):
        if DELAY['s']: time.sleep(DELAY['s'])
        super().do_GET()
    def log_message(self, *a): pass

srv = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(H, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{srv.server_port}/'
results = []
def ok(name, cond):
    results.append(bool(cond)); print(('OK   ' if cond else 'FAIL ') + name)

with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 360, 'height': 760}); page = ctx.new_page()
    page.goto(URL); page.wait_for_selector('text=Bienvenido')
    page.evaluate('navigator.serviceWorker.ready'); page.reload(); page.wait_for_selector('text=Bienvenido')
    ok('service worker activo', page.evaluate('!!navigator.serviceWorker.controller'))
    DELAY['s'] = 8
    t0 = time.time(); page.reload(wait_until='commit'); page.wait_for_selector('text=Bienvenido', timeout=40000); el = time.time() - t0
    ok(f'con la red a 8 s abre en {el:.1f} s (límite 6 s)', el < 6)
    DELAY['s'] = 0
    t0 = time.time(); page.reload(); page.wait_for_selector('text=Bienvenido'); el = time.time() - t0
    ok(f'con la red normal abre en {el:.1f} s', el < 3)
    b.close()
srv.shutdown()
print(f'{sum(results)}/{len(results)} comprobaciones superadas')
sys.exit(0 if all(results) else 1)
