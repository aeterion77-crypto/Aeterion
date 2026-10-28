# Prueba de punta a punta de Aeterion Gym v2: punto de venta, inventario, abonos, foto,
# reportes con Excel, ajustes de ticket, panel con gráficas y membresía del socio.
import subprocess, time, json, os, sys, urllib.request, atexit
from playwright.sync_api import sync_playwright

AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..'))
CAP = os.environ.get('CAPTURAS', os.path.join(AQUI, 'capturas')); os.makedirs(CAP, exist_ok=True)
web = subprocess.Popen(['python3', '-m', 'http.server', '8855'], cwd=RAIZ, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
bd = subprocess.Popen(['node', 'servidor_local.js', '54333'], cwd=AQUI, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
linea = bd.stdout.readline().decode()
atexit.register(lambda: (web.terminate(), bd.terminate()))
if not linea.startswith('listo'): sys.exit('servidor de base no arrancó: ' + linea)
directo = urllib.request.build_opener(urllib.request.ProxyHandler({}))
def bdreq(ruta, cuerpo, tok=''):
    rq = urllib.request.Request('http://127.0.0.1:54333' + ruta, data=json.dumps(cuerpo).encode(), headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok})
    try: r = directo.open(rq); return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()
sql = lambda q, p=None: json.loads(bdreq('/sql', {'sql': q, 'params': p or []})[1])

D, R, S = '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b3'
for i, n, nom in [(D, 'dueno', 'Luis Pérez'), (R, 'recepcion', 'Karla Gómez'), (S, 'socio', 'Mario Silva')]:
    sql("insert into auth.users values ($1,$2)", [i, n + '@prueba.mx']); sql("insert into perfiles (id,email,nombre) values ($1,$2,$3)", [i, n + '@prueba.mx', nom])
G = sql("insert into gyms (nombre, ciudad, plan, sedes_max, estado) values ('Iron Box','CDMX','piloto',1,'prueba') returning id")[0]['id']
sql("insert into gym_sedes (gym_id, nombre) values ($1,'Principal')", [G])
sql("insert into gym_staff (gym_id, user_id, rol) values ($1,$2,'dueno')", [G, D])

def rest(route):
    n = route.request.url.split('/rest/v1/')[-1].split('?')[0]
    J = lambda o, st=200: route.fulfill(status=st, content_type='application/json', body=o if isinstance(o, str) else json.dumps(o))
    if n.startswith('rpc/'):
        fn = n[4:]
        if fn.startswith(('gym_', 'socio_', 'admin_gym', 'coach_', 'caso')):
            st, b = bdreq('/rpc/' + fn, json.loads(route.request.post_data or '{}'), route.request.headers.get('authorization', '').replace('Bearer ', ''))
            return J(b, st)
        if fn == 'estado_acceso': return J({'activo': True, 'vence_en': '2027-01-01T00:00:00Z', 'dias_restantes': 60, 'bloqueado': False})
        return J({})
    return J([] if route.request.method == 'GET' else {})
bad = []
def responder(d):
    m = d.message
    if d.type != 'prompt': return d.accept()
    if 'abona' in m: return d.accept('200')
    if 'Cómo pagó' in m: return d.accept('efectivo')
    if 'piezas entraron' in m: return d.accept('5')
    return d.accept('error de captura')
def chk(c, m):
    print(('  ok ' if c else '  ✗ ') + m)
    if not c: bad.append(m)
def pagina(b, uid, url='index.html?modo=app', ancho=390, alto=844):
    ctx = b.new_context(service_workers='block', viewport={'width': ancho, 'height': alto}); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', responder)
    pg.route('**/rest/v1/**', rest); pg.route('**/functions/v1/**', lambda r: r.fulfill(status=200, content_type='application/json', body='{}'))
    auth = {'access_token': 'T-' + uid, 'refresh_token': 'RT', 'expires_at': int(time.time()) + 36000, 'user_id': uid, 'email': 'x@prueba.mx'}
    pg.add_init_script("if(!sessionStorage.x){sessionStorage.x=1;localStorage.setItem('aeterion_auth',%s);localStorage.setItem('aet_gym_recepcion',%s);localStorage.setItem('aet_inicio',JSON.stringify({estado:'hecho'}));localStorage.setItem('aet_tour_visto','1');localStorage.setItem('aet_tour','1');localStorage.setItem('aet_nombre_pedido','1')}" % (json.dumps(json.dumps(auth)), json.dumps(json.dumps(auth))))
    pg.goto('http://localhost:8855/' + url); pg.wait_for_timeout(2400); pg.evaluate("try{aetCerrar()}catch(e){}")
    return pg, errs
foto = lambda pg, n: pg.screenshot(path=os.path.join(CAP, n + '.png'), full_page=False)
txt = lambda pg: pg.inner_text('#gymApp')

import base64
PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFWEXHbQSACj/P8Fu7N9hAAAAAElFTkSuQmCC')
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium', args=['--no-sandbox'])
    print('1. Inventario y punto de venta en la computadora')
    pd, e1 = pagina(b, D, 'gym/index.html', 1280, 860)
    pd.wait_for_timeout(600)
    chk(pd.query_selector('.gy-graf') is not None and pd.query_selector('.gy-dona, .gy-graficas') is not None, 'panel con gráficas')
    pd.click('[data-g=tab][data-x=g-inventario]'); pd.wait_for_timeout(600)
    for nom, cod, pre, cos, ex in [('Agua 1L', '7501', '15', '7', '10'), ('Proteína scoop', '', '40', '18', '2')]:
        pd.click('[data-g=ir][data-x=g-producto]'); pd.wait_for_timeout(500)
        pd.fill('#gpNomP', nom); pd.fill('#gpCod', cod); pd.fill('#gpPre', pre); pd.fill('#gpCos', cos); pd.fill('#gpEx', ex); pd.fill('#gpMin', '3')
        pd.click('[data-g=guardar-prod]'); pd.wait_for_timeout(800)
    chk(len(sql("select 1 from gym_productos")) == 2 and 'Agua 1L' in txt(pd), 'productos dados de alta')
    chk('Por agotarse' in txt(pd), 'aviso de producto por agotarse')
    pd.click('[data-g=inv-entrada]'); pd.wait_for_timeout(800)
    chk(sql("select existencia from gym_productos where nombre='Agua 1L'")[0]['existencia'] == 15, 'entrada de mercancía')
    foto(pd, '40_gym_inventario')
    pd.click('[data-g=tab][data-x=g-vender]'); pd.wait_for_timeout(800)
    pd.fill('#gvBusca', '7501'); pd.press('#gvBusca', 'Enter'); pd.wait_for_timeout(200)
    pd.click('.gy-prod:has-text("Proteína")'); pd.click('[data-g=pos-mas][data-x="0"]')
    pd.fill('#gvDesc', '5'); pd.fill('#gvCon', '100'); pd.wait_for_timeout(200)
    chk('Cobrar $65' in pd.inner_text('#gvCobrar') and 'Cambio' in pd.inner_text('#gyTotales'), 'carrito con descuento y cambio')
    foto(pd, '41_gym_pos')
    with pd.expect_popup() as pop: pd.click('#gvCobrar')
    tk = pop.value; tk.wait_for_timeout(300)
    chk('TOTAL' in tk.inner_text('body') and 'Iron Box' in tk.inner_text('body'), 'ticket impreso')
    tk.close(); pd.wait_for_timeout(700)
    v = sql("select folio, total from gym_ventas")
    chk(len(v) == 1 and float(v[0]['total']) == 65, 'venta registrada')
    chk('Venta #1 registrada' in txt(pd), 'confirmación de venta')
    pd.click('[data-g=ir][data-x=g-ventas]'); pd.wait_for_timeout(600)
    pd.click('[data-g=venta]'); pd.wait_for_timeout(600)
    pd.click('[data-g=cancelar-venta]'); pd.wait_for_timeout(800)
    chk(sql("select cancelada_en is not null c from gym_ventas")[0]['c'] and sql("select existencia from gym_productos where nombre='Agua 1L'")[0]['existencia'] == 15, 'venta cancelada y existencia devuelta')

    print('2. Socio con foto, pago parcial y abono')
    pd.click('[data-g=tab][data-x=g-socios]'); pd.wait_for_timeout(500)
    pd.click('[data-g=ir][data-x=g-nuevo]'); pd.wait_for_timeout(400)
    pd.fill('#gsNom', 'Mario Silva'); pd.fill('#gsTel', '5512345678'); pd.click('[data-g=guardar-socio]'); pd.wait_for_timeout(900)
    chk('Primero configura tus planes' in txt(pd), 'sin planes pide configurarlos')
    sql("insert into gym_planes (gym_id, nombre, precio, dias) values ($1,'Mensual',650,30)", [G]); pd.evaluate("window.__aetGym.INFO = null"); 
    pd.goto('http://localhost:8855/gym/index.html'); pd.wait_for_timeout(1500)
    pd.click('[data-g=tab][data-x=g-socios]'); pd.wait_for_timeout(500); pd.click('[data-g=socio]'); pd.wait_for_timeout(800)
    pd.set_input_files('#gyFoto', files=[{'name': 'f.png', 'mimeType': 'image/png', 'buffer': PNG}]); pd.wait_for_timeout(1200)
    chk(pd.query_selector('.gy-foto-g') is not None and sql("select foto is not null f from gym_socios")[0]['f'], 'foto del socio')
    pd.fill('#gpMonto', '300'); pd.wait_for_timeout(100)
    chk('quedará debiendo $350' in txt(pd), 'aviso de pago parcial')
    pd.click('[data-g=cobrar]'); pd.wait_for_timeout(900)
    chk('Debe $350' in txt(pd), 'saldo pendiente en la ficha')
    pd.click('[data-g=abonar]'); pd.wait_for_timeout(900)
    chk('Debe $150' in txt(pd), 'abono registrado')
    foto(pd, '42_gym_ficha_saldo')

    print('3. Reportes, Excel, ajustes y mayoreo')
    pd.click('[data-g=tab][data-x=g-reportes]'); pd.wait_for_timeout(900)
    t = txt(pd)
    chk('ingresos totales' in t.lower() and '$500' in t and 'productos más vendidos' in t.lower(), 'reporte del periodo')
    foto(pd, '43_gym_reportes')
    with pd.expect_download() as dl: pd.click('[data-g=rep-excel]')
    chk(dl.value.suggested_filename.endswith('.xlsx'), 'descarga Excel')
    with pd.expect_download() as dl2: pd.click('[data-g=respaldo]')
    ruta = dl2.value.path(); chk(os.path.getsize(ruta) > 3000, 'respaldo completo')
    pd.click('[data-g=tab][data-x=g-mas]'); pd.wait_for_timeout(500); pd.click('[data-g=ir][data-x=g-ajustes]'); pd.wait_for_timeout(500)
    pd.click('#gaAncho [data-x="58"]'); pd.fill('#gaRfc', 'abc010101xyz'); pd.click('#gaPol [data-x=bloquear]'); pd.click('[data-g=guardar-ajustes]'); pd.wait_for_timeout(700)
    aj = sql("select ajustes from gyms")[0]['ajustes']
    chk(aj['ticket_ancho'] == 58 and aj['rfc'] == 'ABC010101XYZ' and aj['politica_vencidos'] == 'bloquear', 'ajustes de ticket')
    pd.click('[data-g=tab][data-x=g-mas]'); pd.wait_for_timeout(500); pd.click('[data-g=ir][data-x=g-aeterion]'); pd.wait_for_timeout(500)
    pd.fill('#gaMay', 'Proteína y creatina, 20 piezas'); pd.click('[data-g=pedir-mayoreo]'); pd.wait_for_timeout(800)
    chk(len(sql("select 1 from aet_casos where tipo='mayoreo'")) == 1, 'solicitud de mayoreo enviada a Aeterion')
    sql("insert into gym_socios (gym_id, numero, nombre, token, codigo_vincular, vence_en) values ($1, 9, 'Laura Vencida', 'tokvencido000000000a', 'VENC01', current_date - 5)", [G])
    pd.click('[data-g=tab][data-x=g-entrada]'); pd.wait_for_timeout(500); pd.fill('#gyNum', '9'); pd.press('#gyNum', 'Enter'); pd.wait_for_timeout(800)
    chk('PIDE QUE RENUEVE' in txt(pd), 'política: pedir renovación a vencidos')

    print('4. El socio ve su membresía')
    cod = sql("select codigo_vincular c from gym_socios where nombre='Mario Silva'")[0]['c']
    ps, e2 = pagina(b, S, 'index.html?modo=app&socio=' + cod)
    ps.wait_for_timeout(1500)
    t = txt(ps)
    chk(ps.query_selector('.gy-mem') is not None and 'Próximo pago' in t and 'Saldo pendiente $150' in t and 'Asistencias este mes' in t, 'Mi membresía con próximo pago y saldo')
    foto(ps, '44_socio_membresia')

    print('5. En el teléfono del dueño')
    pm, e3 = pagina(b, D)
    pm.evaluate("aetGymEntrar('g-hoy')"); pm.wait_for_timeout(1300)
    chk(pm.is_visible('[data-g=tab][data-x=g-vender]') and not pm.is_visible('[data-g=tab][data-x=g-caja]'), 'barra móvil: Panel, Entrada, Socios, Vender, Más')
    foto(pm, '45_gym_panel_movil')
    pm.click('[data-g=tab][data-x=g-mas]'); pm.wait_for_timeout(500)
    chk(pm.is_visible('.gy-op:has-text("Reportes")') and pm.is_visible('.gy-op:has-text("Inventario")'), 'Más incluye inventario y reportes en el teléfono')
    errs = e1 + e2 + e3
    chk(not errs, 'sin errores de JavaScript ' + ('' if not errs else str(errs[:3])))
    b.close()
print('\n%d fallas' % len(bad) if bad else '\nTodo bien')
sys.exit(1 if bad else 0)
