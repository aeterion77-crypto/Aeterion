# Promoción Paquete Aeterion ($849 los 3) en la web y en la Tienda de la app.
import subprocess, os, sys, time, atexit, json
from playwright.sync_api import sync_playwright
AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..'))
CAP = os.path.join(AQUI, 'capturas'); os.makedirs(CAP, exist_ok=True)
web = subprocess.Popen(['python3', '-m', 'http.server', '8864'], cwd=RAIZ, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); atexit.register(web.terminate)
time.sleep(1)
bad = []
def chk(c, m):
    print(('  ok ' if c else '  ✗ ') + m)
    if not c: bad.append(m)
PROMO = {'activa': True, 'nombre': 'Paquete Aeterion', 'precio': 849, 'fin': '2026-12-12', 'ids': ['creatina', 'magnesio', 'vitd']}
CAT = [{'id': 'creatina', 'precio': 399, 'activo': True, 'disponible': True}, {'id': 'magnesio', 'precio': 260, 'activo': True, 'disponible': True}, {'id': 'vitd', 'precio': 399, 'activo': True, 'disponible': True}]
def ruta(promo, enviados):
    def f(r):
        n = r.request.url.split('/rest/v1/')[-1].split('?')[0]
        J = lambda o: r.fulfill(status=200, content_type='application/json', body=json.dumps(o))
        if n == 'ajustes_publicos': return J([{'clave': 'tienda', 'valor': {'abierta': True}}] + ([{'clave': 'promo_paquete', 'valor': promo}] if promo else []))
        if n == 'rpc/catalogo_publico': return J(CAT)
        if n == 'rpc/validar_carrito_publico':
            enviados.append(json.loads(r.request.post_data)); return J({'ok': True, 'subtotal': 1058, 'descuento': 209, 'cupon': None, 'promo': 'Paquete Aeterion'})
        return J([] if r.request.method == 'GET' else {})
    return f
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium', args=['--no-sandbox'])
    for W, H, n in [(1366, 860, 'pc'), (390, 844, 'movil')]:
        print('== web ' + n)
        ctx = b.new_context(service_workers='block', viewport={'width': W, 'height': H}); pg = ctx.new_page(); errs = []; env = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.route('**/rest/v1/**', ruta(PROMO, env))
        pg.goto('http://localhost:8864/index.html'); pg.wait_for_timeout(2200)
        chk(pg.locator('#webInicio .pq').count() == 1 and '$849' in pg.inner_text('#webInicio .pq') and '$1,058' in pg.inner_text('#webInicio .pq'), 'inicio: tarjeta del paquete $849 (antes $1,058)')
        chk('Paquete Aeterion' in pg.inner_text('.wb-anuncio') and '12 de diciembre' in pg.inner_text('.wb-anuncio'), 'barra de aviso con la promo y la fecha')
        pg.locator('#webInicio .pq').scroll_into_view_if_needed(); pg.wait_for_timeout(200)
        pg.screenshot(path=os.path.join(CAP, '107_promo_inicio_' + n + '.png'))
        pg.click('#webInicio .pq-btn'); pg.wait_for_timeout(500)
        q = pg.evaluate("Object.fromEntries(Object.entries(carrito).map(([k,v])=>[k,v.cantidad]))")
        chk(q == {'creatina': 1, 'magnesio': 1, 'vitd': 1} and pg.is_visible('#carrito-panel.abierto'), 'Comprar paquete: mete los 3 al carrito y lo abre')
        chk(pg.inner_text('#t-total') == '$849' and 'Promo Paquete Aeterion' in pg.inner_text('#t-dto-fila'), 'carrito: total $849 con la promo')
        pg.screenshot(path=os.path.join(CAP, '108_promo_carrito_' + n + '.png'))
        pg.evaluate("cambiarCantidad('magnesio', -1)"); pg.wait_for_timeout(300)
        chk(pg.inner_text('#t-total') == '$798' and pg.is_visible('#pqPista'), 'si falta uno: precio normal y aviso para completar')
        pg.click('#pqPista button'); pg.wait_for_timeout(300)
        chk(pg.inner_text('#t-total') == '$849', 'Completar paquete vuelve a $849')
        pg.click('#webInicio .pq-btn', force=True) if False else pg.evaluate("aetComprarPaquete()"); pg.wait_for_timeout(300)
        chk(pg.inner_text('#t-total') == '$1,698', 'dos paquetes: $1,698')
        pg.evaluate("cerrarCarrito(); abrirCheckout()"); pg.wait_for_timeout(300)
        t = pg.inner_text('#checkout-resumen')
        chk('Promo Paquete Aeterion' in t and '$1,698' in t, 'resumen de pago con la promo')
        pg.evaluate("cerrarCheckout()")
        pg.evaluate("location.hash='#/productos'"); pg.wait_for_timeout(500)
        chk(pg.locator('#productos .pq').count() == 1 and pg.is_visible('#productos .pq'), 'Productos: tarjeta del paquete arriba de la lista')
        if n == 'pc': pg.screenshot(path=os.path.join(CAP, '109_promo_productos_pc.png'))
        chk(not errs, 'sin errores de JavaScript ' + str(errs[:3]))
        ctx.close()
    print('== promo vencida')
    ctx = b.new_context(service_workers='block'); pg = ctx.new_page(); env = []
    pg.route('**/rest/v1/**', ruta(dict(PROMO, fin='2026-11-01'), env))
    pg.goto('http://localhost:8864/index.html'); pg.wait_for_timeout(2000)
    chk(pg.locator('.pq').count() == 0 and 'Paquete' not in pg.inner_text('.wb-anuncio'), 'al pasar la fecha desaparece sola')
    pg.evaluate("agregarAlCarrito('creatina');agregarAlCarrito('magnesio');agregarAlCarrito('vitd')"); pg.wait_for_timeout(300)
    chk(pg.inner_text('#t-total') == '$1,058', 'y el carrito cobra precio normal')
    ctx.close()
    print('== app (Tienda)')
    ctx = b.new_context(service_workers='block', viewport={'width': 390, 'height': 844}); pa = ctx.new_page(); ea = []; env = []
    pa.on('pageerror', lambda e: ea.append(str(e)))
    pa.route('**/rest/v1/**', ruta(PROMO, env))
    pa.add_init_script("if(!sessionStorage.x){sessionStorage.x=1;localStorage.setItem('aet_inicio',JSON.stringify({estado:'hecho'}));localStorage.setItem('aet_tour_visto','1');localStorage.setItem('aet_tour','1');localStorage.setItem('aet_nombre_pedido','1')}")
    pa.goto('http://localhost:8864/index.html?modo=app'); pa.wait_for_timeout(2400); pa.evaluate("try{aetCerrar()}catch(e){}")
    pa.evaluate("abrirContenidoApp('productos','Tienda')"); pa.wait_for_timeout(600)
    chk(pa.locator('#appVisorContenido .pq').count() >= 1 or pa.is_visible('#productos .pq'), 'la Tienda de la app muestra el paquete')
    pa.screenshot(path=os.path.join(CAP, '110_promo_app.png'))
    chk(not ea, 'app sin errores ' + str(ea[:3]))
    b.close()
print('\n%d fallas' % len(bad) if bad else '\nTodo bien'); sys.exit(1 if bad else 0)
