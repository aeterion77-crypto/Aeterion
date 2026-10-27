# Prueba del panel de admin (pestaña Premium › Coaches) contra las funciones reales en Postgres local.
import subprocess, time, json, os, sys, urllib.request, atexit
from playwright.sync_api import sync_playwright

AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..'))
CAP = os.environ.get('CAPTURAS', os.path.join(AQUI, 'capturas')); os.makedirs(CAP, exist_ok=True)
web = subprocess.Popen(['python3', '-m', 'http.server', '8852'], cwd=RAIZ, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
bd = subprocess.Popen(['node', 'servidor_local.js', '54330'], cwd=AQUI, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
linea = bd.stdout.readline().decode()
atexit.register(lambda: (web.terminate(), bd.terminate()))
if not linea.startswith('listo'): sys.exit('servidor de base no arrancó: ' + linea)
directo = urllib.request.build_opener(urllib.request.ProxyHandler({}))
def bdreq(ruta, cuerpo, tok=''):
    rq = urllib.request.Request('http://127.0.0.1:54330' + ruta, data=json.dumps(cuerpo).encode(), headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok})
    try: r = directo.open(rq); return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()
sql = lambda q, p=None: json.loads(bdreq('/sql', {'sql': q, 'params': p or []})[1])
rpc = lambda uid, fn, a=None: json.loads(bdreq('/rpc/' + fn, a or {}, 'T-' + uid)[1])

A, C, X = '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000e1'
for i, n in [(A, 'admin'), (C, 'coach'), (X, 'cliente')]:
    sql("insert into auth.users values ($1,$2)", [i, n + '@prueba.mx']); sql("insert into perfiles (id,email,nombre) values ($1,$2,$3)", [i, n + '@prueba.mx', n])
sql("insert into admins values ($1)", [A])
rpc(A, 'admin_coach_config', {'p_clave': 'testers', 'p_valor': [C]})
rpc(C, 'coach_guardar', {'p': {'nombre_publico': 'Coach Daniela Ruiz', 'bio': 'Fuerza con técnica.', 'especialidades': ['Fuerza'], 'modalidades': ['presencial'], 'zona': 'Coyoacán', 'precio_sesion': 300, 'rfc': 'RUDA900101AB1', 'acepto_terminos': True}})
rpc(C, 'coach_documento_agregar', {'p_tipo': 'identificacion', 'p_nombre': 'INE', 'p_emisor': 'INE', 'p_archivo': C + '/ine.pdf', 'p_vence': None})
rpc(C, 'coach_documento_agregar', {'p_tipo': 'certificacion', 'p_nombre': 'Entrenador personal certificado', 'p_emisor': 'NSCA', 'p_archivo': C + '/nsca.pdf', 'p_vence': '2027-03-01'})
sql("select public.coach_membresia_registrar($1,'primer_mes',349,'cs_1',now() + interval '30 days')", [C])
rpc(C, 'coach_enviar_revision')

firmados = []
def rest(route):
    n = route.request.url.split('/rpc/')[1].split('?')[0]
    J = lambda o, st=200: route.fulfill(status=st, content_type='application/json', body=o if isinstance(o, str) else json.dumps(o))
    if n.startswith(('admin_coach', 'admin_sesion')):
        st, b = bdreq('/rpc/' + n, json.loads(route.request.post_data or '{}'), 'T-' + A); return J(b, st)
    if n == 'admin_estado': return J({'miembro': True, 'configurado': True, 'dispositivo_ok': True, 'desbloqueado': False})
    if n == 'panel_pedidos_v5': return J([])
    if n == 'panel_pendientes': return J({'pedidos_sin_enviar': 0, 'pedidos_urgentes': 0, 'stock': [], 'codigos_pocos': [], 'gimnasios_por_acabar': [], 'premium_por_vencer': []})
    return J({'ok': True} if n not in ('panel_listar',) else [])
bad = []
def chk(c, m):
    print(('  ok ' if c else '  ✗ ') + m)
    if not c: bad.append(m)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, service_workers='block'); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept(d.default_value or 'Falta la constancia fiscal' if d.type == 'prompt' else None))
    pg.route('**/rest/v1/rpc/**', rest); pg.route('**/auth/**', lambda r: r.fulfill(status=200, content_type='application/json', body='{}'))
    pg.route('**/storage/v1/object/sign/**', lambda r: (firmados.append(r.request.url), r.fulfill(status=200, content_type='application/json', body='{"signedURL":"/object/sign/coach-docs/x?token=t"}')))
    pg.add_init_script("localStorage.setItem('aet_admin', JSON.stringify({access_token:'T-%s',refresh_token:'y',user:{email:'admin@prueba.mx'}}));" % A)
    pg.goto('http://localhost:8852/admin/index.html'); pg.wait_for_timeout(600)
    pg.fill('#peEnt', 'entrada123'); pg.click('#btnPuertaEntrar'); pg.wait_for_timeout(1200)
    pg.click('#navAdm [data-g=premium]'); pg.wait_for_timeout(400)
    pg.click('#subtabs [data-t=coaches]'); pg.wait_for_timeout(900)
    t = pg.inner_text('#coachAdm')
    chk('Coach Daniela Ruiz' in t and 'solo testers (1)' in t.lower(), 'lista la solicitud y muestra el modo testers')
    chk('2 docs por revisar' in t, 'avisa documentos por revisar')
    pg.click('[data-ca=abrir]'); pg.wait_for_timeout(900)
    chk('RUDA900101AB1' in pg.inner_text('#coachAdm'), 'detalle con RFC (solo admin)')
    pg.screenshot(path=os.path.join(CAP, '12_admin_revision.png'), full_page=True)
    pg.click('[data-ca=ver-doc] >> nth=0'); pg.wait_for_timeout(500)
    chk(len(firmados) == 1 and C + '/ine.pdf' in firmados[0], 'ver documento pide enlace firmado temporal')
    pg.click('[data-ca=decidir][data-e=aprobar]'); pg.wait_for_timeout(900)
    chk('Primero marca como válidos' in pg.inner_text('#msg'), 'no aprueba con documentos sin validar')
    for _ in range(2):
        pg.click('[data-ca=doc][data-e=valido] >> nth=0'); pg.wait_for_timeout(700)
    pg.click('[data-ca=decidir][data-e=aprobar]'); pg.wait_for_timeout(900)
    est = sql("select estado, codigo from coaches where user_id=$1", [C])[0]
    chk(est['estado'] == 'activo' and est['codigo'], 'aprobado desde el panel ' + json.dumps(est))
    chk(sql("select count(*)::int n from accesos where user_id=$1 and origen='coach'", [C])[0]['n'] == 1, 'Premium personal creado')
    pg.click('[data-ca=filtro][data-v=activo]'); pg.wait_for_timeout(700)
    pg.click('[data-ca=abrir]'); pg.wait_for_timeout(800)
    pg.select_option('#caNivel', '2'); pg.click('[data-ca=nivel]'); pg.wait_for_timeout(800)
    chk(sql("select nivel from coaches where user_id=$1", [C])[0]['nivel'] == 2, 'cambia nivel')
    pg.fill('#caTester', X); pg.click('[data-ca=tester]'); pg.wait_for_timeout(800)
    chk('solo testers (2)' in pg.inner_text('#coachAdm').lower(), 'agrega tester')
    pg.click('[data-ca=flag]'); pg.wait_for_timeout(800)
    chk(sql("select valor from coach_config where clave='activo'")[0]['valor'] is True, 'interruptor encendido')
    # comisiones por pagar
    sql("insert into coach_liquidaciones (coach_id, periodo, monto) values ($1,'2026-11',350)", [C])
    pg.click('[data-ca=liq]'); pg.wait_for_timeout(800)
    pg.click('[data-ca=liq-pagar]'); pg.wait_for_timeout(800)
    chk(sql("select estado from coach_liquidaciones")[0]['estado'] == 'pagada', 'marca comisión pagada')
    pg.screenshot(path=os.path.join(CAP, '13_admin_activo.png'), full_page=True)
    # Otras pestañas siguen funcionando
    pg.click('#subtabs [data-t=promo]'); pg.wait_for_timeout(500)
    chk(not errs, 'sin errores de JS ' + str(errs))
    b.close()
print('\n%d fallas' % len(bad)); sys.exit(1 if bad else 0)
