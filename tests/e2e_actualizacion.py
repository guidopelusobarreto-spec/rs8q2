"""Actualización: con la app instalada y el servidor enviando «Cache-Control: max-age=600» (como GitHub Pages),
una versión nueva debe verse al volver a abrir la app, sin borrar nada a mano. Uso: python3 -I tests/e2e_actualizacion.py [carpeta]"""
import sys, os, re, shutil, tempfile, threading, functools
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright

SRC = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..'))
tmp = tempfile.mkdtemp(); A, B = os.path.join(tmp, 'a'), os.path.join(tmp, 'b')
ign = shutil.ignore_patterns('.git', 'node_modules', 'tests')
shutil.copytree(SRC, A, ignore=ign); shutil.copytree(SRC, B, ignore=ign)
for f, pat, rep in [('js/app.js', r"APP_VERSION = '[^']*'", "APP_VERSION = 'vPRUEBA-NUEVA'"), ('sw.js', r"const CACHE = '[^']*'", "const CACHE = 'registro-prueba-nueva'")]:
    p = os.path.join(B, f); s = open(p, encoding='utf-8').read(); open(p, 'w', encoding='utf-8').write(re.sub(pat, rep, s, count=1))
ROOT = {'d': A}

class H(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        self.directory = ROOT['d']; return super().translate_path(path)
    def end_headers(self):
        self.send_header('Cache-Control', 'max-age=600'); super().end_headers()
    def log_message(self, *a): pass

srv = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(H, directory=A))
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{srv.server_port}/'
res = []
def ok(n, c): res.append(bool(c)); print(('OK   ' if c else 'FAIL ') + n)
ver = lambda pg: (pg.evaluate("location.hash = '#/mas'"), pg.wait_for_timeout(500), pg.inner_text('#ver'))[2]

with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page()
    pg.goto(URL); pg.wait_for_selector('text=Bienvenido'); pg.evaluate('navigator.serviceWorker.ready'); pg.reload(); pg.wait_for_selector('text=Bienvenido')
    v1 = ver(pg); ok(f'versión instalada: {v1}', 'PRUEBA' not in v1)
    ROOT['d'] = B
    for i in range(2):  # el usuario vuelve a abrir la app (como mucho dos veces)
        pg.goto(URL); pg.wait_for_timeout(2500)
        if 'PRUEBA-NUEVA' in ver(pg): break
    ok(f'tras volver a abrir ({i + 1} vez/veces): {ver(pg)}', 'PRUEBA-NUEVA' in ver(pg))
    b.close()
srv.shutdown(); shutil.rmtree(tmp)
print(f'{sum(res)}/{len(res)} comprobaciones superadas'); sys.exit(0 if all(res) else 1)
