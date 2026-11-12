# Video del inventario real dentro de la página (inicio, Productos y Tienda de la app).
import subprocess, os, sys, time, atexit, json
from playwright.sync_api import sync_playwright
AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..'))
CAP = os.path.join(AQUI, 'capturas'); os.makedirs(CAP, exist_ok=True)
web = subprocess.Popen(['python3', '-m', 'http.server', '8865'], cwd=RAIZ, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); atexit.register(web.terminate)
time.sleep(1)
bad = []
def chk(c, m):
    print(('  ok ' if c else '  ✗ ') + m)
    if not c: bad.append(m)
PROMO = {'activa': True, 'nombre': 'Paquete Aeterion', 'precio': 849, 'fin': '2026-12-12', 'ids': ['creatina', 'magnesio', 'vitd']}
def rest(r):
    n = r.request.url.split('/rest/v1/')[-1].split('?')[0]
    J = lambda o: r.fulfill(status=200, content_type='application/json', body=json.dumps(o))
    if n == 'ajustes_publicos': return J([{'clave': 'promo_paquete', 'valor': PROMO}])
    return J([] if r.request.method == 'GET' else {})
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium', args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required'])
    for W, H, n in [(1366, 860, 'pc'), (390, 844, 'movil')]:
        print('== ' + n)
        ctx = b.new_context(service_workers='block', viewport={'width': W, 'height': H}); pg = ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.route('**/rest/v1/**', rest)
        pg.goto('http://localhost:8865/index.html'); pg.wait_for_timeout(2500)
        orden = pg.evaluate("[...document.querySelector('#webInicio .contenedor').children].map(e=>e.className.split(' ')[0]).slice(0,4)")
        chk(orden[:3] == ['wb-confianza', 'pq', 'vr'], 'inicio: sellos → promo → video %s' % orden)
        v = pg.locator('#vrInicio video')
        chk(v.count() == 1 and not pg.locator('#vrInicio a[href*="facebook"]').count(), 'video dentro de la página, sin enlace a Facebook')
        pg.locator('#vrInicio').scroll_into_view_if_needed(); pg.wait_for_timeout(1500)
        st = pg.evaluate("(()=>{const v=document.querySelector('#vrInicio video');return {d:v.duration,t:v.currentTime,p:v.paused,m:v.muted,w:v.videoWidth}})()")
        chk(st['d'] > 29 and st['w'] == 720 and st['m'], 'el video carga (30 s, 720p) y empieza sin sonido %s' % st)
        chk(not st['p'] and st['t'] > 0, 'se reproduce solo al estar a la vista')
        pg.screenshot(path=os.path.join(CAP, '111_video_inicio_' + n + '.png'))
        pg.click('#vrInicio .vr-son'); pg.wait_for_timeout(300)
        chk(pg.evaluate("document.querySelector('#vrInicio video').muted") is False and 'Silenciar' in pg.inner_text('#vrInicio .vr-son'), 'botón para activar el sonido')
        pg.evaluate("location.hash='#/productos'"); pg.wait_for_timeout(800)
        chk(pg.is_visible('#vrProductos video'), 'también en Productos')
        chk(pg.evaluate("document.querySelector('#vrInicio video').paused"), 'el video del inicio se pausa al salir de la vista')
        chk(not errs, 'sin errores ' + str(errs[:3]))
        ctx.close()
    print('== app')
    ctx = b.new_context(service_workers='block', viewport={'width': 390, 'height': 844}); pa = ctx.new_page(); ea = []
    pa.on('pageerror', lambda e: ea.append(str(e))); pa.route('**/rest/v1/**', rest)
    pa.add_init_script("if(!sessionStorage.x){sessionStorage.x=1;localStorage.setItem('aet_inicio',JSON.stringify({estado:'hecho'}));localStorage.setItem('aet_tour_visto','1');localStorage.setItem('aet_tour','1');localStorage.setItem('aet_nombre_pedido','1')}")
    pa.goto('http://localhost:8865/index.html?modo=app'); pa.wait_for_timeout(2500); pa.evaluate("try{aetCerrar()}catch(e){}")
    pa.evaluate("abrirContenidoApp('productos','Tienda')"); pa.wait_for_timeout(700)
    chk(pa.locator('#vrProductos video').count() == 1, 'la Tienda de la app tiene el video')
    pa.locator('#vrProductos').scroll_into_view_if_needed(); pa.wait_for_timeout(800); pa.screenshot(path=os.path.join(CAP, '112_video_app.png'))
    chk(not ea, 'app sin errores ' + str(ea[:3]))
    b.close()
print('\n%d fallas' % len(bad) if bad else '\nTodo bien'); sys.exit(1 if bad else 0)
