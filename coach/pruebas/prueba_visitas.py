# Contador de visitas: la web manda vistas y clics; el panel de admin los muestra.
import subprocess, os, sys, time, atexit, json
from playwright.sync_api import sync_playwright
AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..'))
CAP = os.path.join(AQUI, 'capturas'); os.makedirs(CAP, exist_ok=True)
web = subprocess.Popen(['python3', '-m', 'http.server', '8863'], cwd=RAIZ, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); atexit.register(web.terminate)
time.sleep(1)
bad = []
def chk(c, m):
    print(('  ok ' if c else '  ✗ ') + m)
    if not c: bad.append(m)
def ir(pg, h): pg.evaluate("(h)=>location.hash=h", h); pg.wait_for_timeout(400)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium', args=['--no-sandbox'])
    print('1. Página web')
    pg = b.new_page(viewport={'width': 390, 'height': 844}); errs = []; env = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    def rest(r):
        if r.request.url.endswith('/rpc/web_registrar'): env.append(json.loads(r.request.post_data)['p'])
        r.fulfill(status=200, content_type='application/json', body='{}')
    pg.route('**/rest/v1/**', rest)
    pg.route('https://wa.me/**', lambda r: r.fulfill(status=200, body='wa'))
    pg.add_init_script("window.AET_VIS_PRUEBA = true")
    pg.goto('http://localhost:8863/index.html?utm_source=instagram'); pg.wait_for_timeout(1800)
    v = [e for e in env if e['t'] == 'vista']
    chk(len(v) == 1 and v[0]['r'] == 'inicio' and v[0]['o'] == 'Instagram' and v[0]['d'] == 'movil' and v[0]['n'] is True, 'primera vista: inicio, desde Instagram, celular, visitante nuevo')
    chk(len(v[0]['v']) >= 8 and v[0]['v'].isalnum(), 'id anónimo del navegador')
    ir(pg, '#/productos/mayoreo'); ir(pg, '#/educacion/salud-ayuno'); ir(pg, '#/productos')
    rutas = [e['r'] for e in env if e['t'] == 'vista']
    chk(rutas == ['inicio', 'productos/mayoreo', 'educacion/salud-ayuno', 'productos'], 'cada sección cuenta una vista: %s' % rutas)
    chk(all(e['n'] is False for e in env[1:]) and len({e['v'] for e in env}) == 1, 'mismo visitante, ya no es nuevo')
    ir(pg, '#/productos/mayoreo')
    with pg.expect_popup() as pop: pg.click('#mayoreo a.my-wa >> nth=0')
    pop.value.close(); pg.wait_for_timeout(300)
    chk(any(e['t'] == 'wa_mayoreo' and e['r'] == 'productos/mayoreo' for e in env), 'clic en WhatsApp de mayoreo registrado')
    ir(pg, '#/inicio'); pg.click('.wb-prod .btn-agregar >> nth=0'); pg.wait_for_timeout(300)
    chk(any(e['t'] == 'carrito' for e in env), 'clic en Agregar al carrito registrado')
    pg.reload(); pg.wait_for_timeout(1500)
    ult = [e for e in env if e['t'] == 'vista'][-1]
    chk(ult['n'] is False and ult['v'] == env[0]['v'] and ult['o'] == 'Instagram', 'al recargar: mismo visitante y mismo origen en la sesión')
    chk(not errs, 'sin errores de JavaScript ' + str(errs[:3]))
    print('2. La app no cuenta visitas web')
    pa = b.new_page(viewport={'width': 390, 'height': 844}); env2 = []
    pa.route('**/rest/v1/**', lambda r: (env2.append(1) if r.request.url.endswith('/rpc/web_registrar') else None, r.fulfill(status=200, content_type='application/json', body='{}')))
    pa.add_init_script("window.AET_VIS_PRUEBA = true")
    pa.goto('http://localhost:8863/index.html?modo=app'); pa.wait_for_timeout(1800)
    chk(not env2, 'modo app: cero registros')
    print('3. Panel de admin')
    hoy = time.strftime('%Y-%m-%d')
    datos = {'dias': 30, 'resumen': {'visitantes': 412, 'vistas': 1290, 'nuevos': 350, 'hoy': 37, 'en_linea': 3, 'wa_mayoreo': 9, 'wa': 4, 'carrito': 61, 'app': 88},
             'por_dia': [{'d': time.strftime('%Y-%m-%d', time.localtime(time.time() - 86400 * (29 - i))), 'visitantes': [5, 9, 14, 8, 22, 30, 12][i % 7] + i, 'vistas': 30 + i} for i in range(30)],
             'secciones': [{'ruta': 'inicio', 'vistas': 600, 'visitantes': 400}, {'ruta': 'productos', 'vistas': 300, 'visitantes': 200}, {'ruta': 'productos/mayoreo', 'vistas': 80, 'visitantes': 50}, {'ruta': 'educacion/salud-ayuno', 'vistas': 40, 'visitantes': 30}],
             'origenes': [{'origen': 'Instagram', 'visitantes': 190}, {'origen': 'Directo', 'visitantes': 120}, {'origen': 'Google', 'visitantes': 60}, {'origen': 'WhatsApp', 'visitantes': 42}],
             'dispositivos': [{'disp': 'movil', 'visitantes': 330}, {'disp': 'pc', 'visitantes': 82}]}
    pd = b.new_page(viewport={'width': 1280, 'height': 900}); ed = []; pedidos = []
    pd.on('pageerror', lambda e: ed.append(str(e)))
    def radm(r):
        n = r.request.url.split('/rest/v1/')[-1].split('?')[0]
        if n == 'rpc/admin_web_visitas': pedidos.append(json.loads(r.request.post_data)); return r.fulfill(status=200, content_type='application/json', body=json.dumps(datos))
        r.fulfill(status=200, content_type='application/json', body='[]' if r.request.method == 'GET' else '{}')
    pd.route('**/rest/v1/**', radm); pd.route('**/functions/v1/**', lambda r: r.fulfill(status=200, content_type='application/json', body='{}'))
    pd.goto('http://localhost:8863/admin/index.html'); pd.wait_for_timeout(1200)
    pd.evaluate("sesion={access_token:'x',refresh_token:'y',expires_at:Date.now()/1000+9999}; vista(true); abrirTab('visitas')"); pd.wait_for_timeout(800)
    t = pd.inner_text('#visitasAdm')
    chk('412' in t and 'En la página ahora' in t and 'Clic WhatsApp mayoreo' in t, 'resumen con visitantes, en línea y clics')
    chk('Mayoreo' in t and 'Educación › ayuno' in t and 'Instagram' in t and 'Celular' in t, 'secciones con nombre, orígenes y dispositivos')
    chk(pd.locator('.vw-col').count() == 30 and 'Visitas web' in pd.inner_text('#subtabs'), 'gráfica de 30 días y pestaña en Inicio')
    pd.screenshot(path=os.path.join(CAP, '106_admin_visitas.png'), full_page=True)
    pd.click('[data-vw=dias][data-v="7"]'); pd.wait_for_timeout(500)
    chk(pedidos[-1] == {'p_dias': 7}, 'botón 7 días pide 7 días')
    chk(not ed, 'panel sin errores de JavaScript ' + str(ed[:3]))
    b.close()
print('\n%d fallas' % len(bad) if bad else '\nTodo bien'); sys.exit(1 if bad else 0)
