# Prueba de punta a punta de Aeterion Gym: dueño en la app, recepción en la página
# de escritorio y socio en su app, con las funciones reales en Postgres local.
import subprocess, time, json, os, sys, urllib.request, atexit
from playwright.sync_api import sync_playwright

AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..'))
CAP = os.environ.get('CAPTURAS', os.path.join(AQUI, 'capturas')); os.makedirs(CAP, exist_ok=True)
web = subprocess.Popen(['python3', '-m', 'http.server', '8854'], cwd=RAIZ, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
bd = subprocess.Popen(['node', 'servidor_local.js', '54332'], cwd=AQUI, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
linea = bd.stdout.readline().decode()
atexit.register(lambda: (web.terminate(), bd.terminate()))
if not linea.startswith('listo'): sys.exit('servidor de base no arrancó: ' + linea)
directo = urllib.request.build_opener(urllib.request.ProxyHandler({}))
def bdreq(ruta, cuerpo, tok=''):
    rq = urllib.request.Request('http://127.0.0.1:54332' + ruta, data=json.dumps(cuerpo).encode(), headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok})
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
        if fn.startswith(('gym_', 'socio_', 'admin_gym', 'coach_')):
            st, b = bdreq('/rpc/' + fn, json.loads(route.request.post_data or '{}'), route.request.headers.get('authorization', '').replace('Bearer ', ''))
            return J(b, st)
        if fn == 'estado_acceso': return J({'activo': True, 'vence_en': '2027-01-01T00:00:00Z', 'dias_restantes': 60, 'bloqueado': False})
        return J({})
    return J([] if route.request.method == 'GET' else {})
bad = []
def chk(c, m):
    print(('  ok ' if c else '  ✗ ') + m)
    if not c: bad.append(m)
def pagina(b, uid, url='index.html?modo=app', ancho=390, alto=844):
    ctx = b.new_context(service_workers='block', viewport={'width': ancho, 'height': alto}); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept('error de captura') if d.type == 'prompt' else d.accept())
    pg.route('**/rest/v1/**', rest); pg.route('**/functions/v1/**', lambda r: r.fulfill(status=200, content_type='application/json', body='{}'))
    auth = {'access_token': 'T-' + uid, 'refresh_token': 'RT', 'expires_at': int(time.time()) + 36000, 'user_id': uid, 'email': 'x@prueba.mx'}
    pg.add_init_script("if(!sessionStorage.x){sessionStorage.x=1;localStorage.setItem('aeterion_auth',%s);localStorage.setItem('aet_gym_recepcion',%s);localStorage.setItem('aet_inicio',JSON.stringify({estado:'hecho'}));localStorage.setItem('aet_tour_visto','1');localStorage.setItem('aet_tour','1');localStorage.setItem('aet_nombre_pedido','1')}" % (json.dumps(json.dumps(auth)), json.dumps(json.dumps(auth))))
    pg.goto('http://localhost:8854/' + url); pg.wait_for_timeout(2400); pg.evaluate("try{aetCerrar()}catch(e){}")
    return pg, errs
foto = lambda pg, n: pg.screenshot(path=os.path.join(CAP, n + '.png'), full_page=False)
txt = lambda pg: pg.inner_text('#gymApp')

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium', args=['--no-sandbox'])
    print('1. El dueño entra desde la app y configura')
    pd, e1 = pagina(b, D)
    pd.evaluate("aetIr('cuenta')"); pd.wait_for_timeout(500)
    chk(pd.is_visible('.gym-entrada') and 'Iron Box' in pd.inner_text('.gym-entrada'), 'tarjeta Aeterion Gym visible con el nombre')
    chk(not pd.is_visible('.socio-entrada'), 'sin tarjeta Mi gimnasio (no es socio ni hay gimnasios activos)')
    pd.click('.gym-entrada'); pd.wait_for_timeout(1200)
    t = txt(pd)
    chk('Primer paso: tus precios' in t and 'Registrar entrada' in t, 'Hoy: guía de primer paso')
    chk(pd.evaluate("getComputedStyle(document.querySelector('.app-bottomnav')).display") == 'none' and pd.is_visible('.gy-nav'), 'barra propia del gimnasio')
    foto(pd, '30_gym_hoy_vacio')
    pd.click('[data-g=ir][data-x=g-planes]'); pd.wait_for_timeout(700)
    pd.fill('#gpNom', 'Mensual'); pd.fill('#gpPrecio', '650'); pd.fill('#gpDias', '30'); pd.click('[data-g=guardar-plan]'); pd.wait_for_timeout(800)
    pd.fill('#gpNom', 'Visita'); pd.fill('#gpPrecio', '80'); pd.fill('#gpDias', '1'); pd.click('[data-g=guardar-plan]'); pd.wait_for_timeout(800)
    chk(len(sql("select 1 from gym_planes where gym_id=$1", [G])) == 2, 'dos planes creados')
    pd.click('[data-g=tab][data-x=g-mas]'); pd.wait_for_timeout(600)
    pd.click('[data-g=ir][data-x=g-equipo]'); pd.wait_for_timeout(700)
    pd.fill('#geMail', 'nadie@prueba.mx'); pd.click('[data-g=agregar-staff]'); pd.wait_for_timeout(700)
    pd.fill('#geMail', 'recepcion@prueba.mx'); pd.select_option('#geRol', 'recepcion'); pd.click('[data-g=agregar-staff]'); pd.wait_for_timeout(800)
    chk('Karla Gómez' in txt(pd) and 'Recepción' in txt(pd), 'recepción agregada al equipo')
    foto(pd, '31_gym_equipo')
    pd.click('[data-g=tab][data-x=g-mas]'); pd.wait_for_timeout(500); pd.click('[data-g=ir][data-x=g-material]'); pd.wait_for_timeout(500)
    pd.click('[data-g=doc][data-x=retencion]'); pd.wait_for_timeout(500)
    chk('reducir bajas' in txt(pd), 'material útil abre')
    pd.click('[data-g=volver]'); pd.wait_for_timeout(400)

    print('2. Recepción trabaja en la computadora')
    pr, e2 = pagina(b, R, 'gym/index.html', 1280, 820)
    pr.wait_for_timeout(800)
    chk(pr.is_visible('#gymApp') and 'Recepción' in txt(pr), 'la página de recepción abre con su rol')
    chk(pr.query_selector('[data-g=tab][data-x=g-caja]') is not None, 'recepción ve Caja')
    pr.click('[data-g=tab][data-x=g-socios]'); pr.wait_for_timeout(600)
    pr.click('[data-g=ir][data-x=g-nuevo]'); pr.wait_for_timeout(500)
    pr.fill('#gsNom', 'Mario Silva'); pr.fill('#gsTel', '55 1234 5678'); pr.click('[data-g=guardar-socio]'); pr.wait_for_timeout(1000)
    t = txt(pr)
    chk('Mario Silva' in t and 'Registrar pago' in t and 'Sin pago' in t, 'alta y ficha con cobro')
    chk(pr.input_value('#gpMonto') in ('650', '650.00'), 'monto prellenado con el plan')
    pr.click('#gpMet [data-x=tarjeta]'); pr.click('[data-g=cobrar]'); pr.wait_for_timeout(1000)
    pg_ = sql("select monto, metodo, hasta from gym_pagos")
    chk(len(pg_) == 1 and pg_[0]['metodo'] == 'tarjeta', 'pago registrado con tarjeta')
    chk('Al corriente' in txt(pr) and 'Vence en' in txt(pr), 'socio al corriente')
    cod = sql("select codigo_vincular c, numero from gym_socios where nombre='Mario Silva'")[0]
    chk(cod['c'] in txt(pr) and 'WhatsApp' in txt(pr), 'código para la app y botón de WhatsApp')
    foto(pr, '32_gym_ficha_escritorio')
    chk(pr.query_selector('[data-g=anular]') is None and pr.query_selector('[data-g=baja]') is None, 'recepción no puede anular ni dar de baja')
    # un socio vencido
    sql("insert into gym_socios (gym_id, sede_id, numero, nombre, token, codigo_vincular, vence_en) select $1, min(id), 2, 'Laura Vencida', 'tokvencido000000000a', 'VENC01', current_date - 5 from gym_sedes where gym_id=$1", [G])
    pr.click('[data-g=tab][data-x=g-entrada]'); pr.wait_for_timeout(600)
    pr.fill('#gyNum', str(cod['numero'])); pr.press('#gyNum', 'Enter'); pr.wait_for_timeout(900)
    chk(pr.is_visible('.gy-res.ok') and 'Mario Silva' in pr.inner_text('.gy-res'), 'entrada verde para socio al corriente')
    foto(pr, '33_gym_entrada_ok')
    pr.fill('#gyNum', '2'); pr.press('#gyNum', 'Enter'); pr.wait_for_timeout(900)
    chk(pr.is_visible('.gy-res.mal') and 'Venció hace' in pr.inner_text('.gy-res') and pr.is_visible('.gy-res [data-c="1"]'), 'entrada roja con botón Cobrar para vencido')
    foto(pr, '34_gym_entrada_vencido')
    pr.fill('#gyNum', '999'); pr.press('#gyNum', 'Enter'); pr.wait_for_timeout(700)
    chk(len(sql("select 1 from gym_asistencias")) == 2, 'dos entradas registradas (la inexistente no)')
    pr.click('[data-g=tab][data-x=g-caja]'); pr.wait_for_timeout(700)
    t = txt(pr)
    chk('$650' in t and 'Tarjeta' in t, 'caja del día con el total')
    chk(pr.query_selector('[data-g=rango][data-x=mes]') is None, 'recepción no ve la caja del mes')
    pr.click('[data-g=tab][data-x=g-hoy]'); pr.wait_for_timeout(800)
    foto(pr, '35_gym_hoy_escritorio')
    chk('Laura Vencida' in txt(pr), 'Hoy muestra a la vencida')

    print('3. El socio abre su enlace y ve su QR')
    ps, e3 = pagina(b, S, 'index.html?modo=app&socio=' + cod['c'])
    ps.wait_for_timeout(1500)
    t = txt(ps)
    chk('Iron Box' in t and 'Muéstralo en recepción' in t and ps.query_selector('#gymApp .gy-qr svg') is not None, 'membresía vinculada y QR visible')
    chk(sql("select user_id from gym_socios where nombre='Mario Silva'")[0]['user_id'] == S, 'socio vinculado a su cuenta')
    foto(ps, '36_socio_qr')
    ps.evaluate("aetIr('cuenta')"); ps.wait_for_timeout(500)
    chk(ps.is_visible('.socio-entrada') and 'Al corriente' in ps.inner_text('.socio-entrada'), 'tarjeta Mi gimnasio con su estado')
    tok = sql("select token from gym_socios where nombre='Mario Silva'")[0]['token']

    print('4. El dueño ve todo y escanea el QR (por token)')
    pd.click('[data-g=tab][data-x=g-hoy]'); pd.wait_for_timeout(900)
    t = txt(pd)
    chk('$650' in t and 'Mario Silva' in t, 'dueño ve cobrado y entradas')
    st, bdy = bdreq('/rpc/gym_checkin', {'p_gym': G, 'p_sede': None, 'p_dato': 'AET-GYM:' + tok}, 'T-' + D)
    chk(st == 200 and json.loads(bdy).get('repetido') is True, 'QR del socio reconocido (entrada repetida)')
    pd.click('[data-g=tab][data-x=g-socios]'); pd.wait_for_timeout(600); pd.click('[data-g=socio]:has-text("Mario Silva")'); pd.wait_for_timeout(800)
    chk(pd.query_selector('[data-g=anular]') is not None, 'dueño puede anular pagos')
    pd.click('[data-g=anular]'); pd.wait_for_timeout(900)
    chk(sql("select anulado_en is not null a from gym_pagos")[0]['a'] and 'Sin pago' in txt(pd), 'pago anulado y vencimiento recalculado')
    pd.click('[data-g=salir]'); pd.wait_for_timeout(600)
    chk(pd.is_visible('.app-bottomnav'), 'Mi entreno regresa a la app normal')

    errs = [e for e in e1 + e2 + e3]
    chk(not errs, 'sin errores de JavaScript ' + ('' if not errs else str(errs[:3])))
    b.close()
print('\n%d fallas' % len(bad) if bad else '\nTodo bien')
sys.exit(1 if bad else 0)
