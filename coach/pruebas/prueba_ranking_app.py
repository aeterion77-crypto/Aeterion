# Ranking de Juegos en la app: dos usuarios con sesión, funciones reales en Postgres local.
import subprocess, time, json, os, sys, urllib.request, atexit
from playwright.sync_api import sync_playwright
AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..'))
CAP = os.path.join(AQUI, 'capturas'); os.makedirs(CAP, exist_ok=True)
web = subprocess.Popen(['python3', '-m', 'http.server', '8859'], cwd=RAIZ, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
bd = subprocess.Popen(['node', 'servidor_local.js', '54334'], cwd=AQUI, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
linea = bd.stdout.readline().decode(); atexit.register(lambda: (web.terminate(), bd.terminate()))
if not linea.startswith('listo'): sys.exit('servidor de base no arrancó: ' + linea)
directo = urllib.request.build_opener(urllib.request.ProxyHandler({}))
def bdreq(ruta, cuerpo, tok=''):
    rq = urllib.request.Request('http://127.0.0.1:54334' + ruta, data=json.dumps(cuerpo).encode(), headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok})
    try: r = directo.open(rq); return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()
sql = lambda q, p=None: json.loads(bdreq('/sql', {'sql': q, 'params': p or []})[1])
A, B = '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e2'
for i, n, nom in [(A, 'dylan', 'Dylan'), (B, 'sofi', 'Sofía Ruiz')]:
    sql("insert into auth.users values ($1,$2)", [i, n + '@prueba.mx']); sql("insert into perfiles (id,email,nombre) values ($1,$2,$3)", [i, n + '@prueba.mx', nom])
# otros jugadores ya en el ranking
for k in range(6):
    u = '00000000-0000-0000-0000-00000000f00%d' % k
    sql("insert into auth.users values ($1,$2)", [u, 'b%d@x.mx' % k]); sql("insert into perfiles (id,email,nombre) values ($1,$2,$3)", [u, 'b%d@x.mx' % k, ['Carlos', 'Vale', 'Diego', 'Majo', 'Rulo', 'Fer'][k]])
    sql("insert into juegos_puntajes (user_id, trivia_puntos, trivia_nivel, memo_estrellas, memo_nivel, memo_infinito) values ($1,$2,$3,$4,$5,$6)", [u, 1500 * (k + 1), k + 2, 4 * k, k + 3, 5 * k])
def rest(route):
    n = route.request.url.split('/rest/v1/')[-1].split('?')[0]
    J = lambda o, st=200: route.fulfill(status=st, content_type='application/json', body=o if isinstance(o, str) else json.dumps(o))
    if n.startswith('rpc/'):
        fn = n[4:]
        if fn.startswith('juegos_'):
            st, b = bdreq('/rpc/' + fn, json.loads(route.request.post_data or '{}'), route.request.headers.get('authorization', '').replace('Bearer ', ''))
            return J(b, st)
        if fn == 'estado_acceso': return J({'activo': False, 'bloqueado': False})
        return J({})
    if n.startswith('perfiles'): return J([{'nombre': None}])
    return J([] if route.request.method == 'GET' else {})
bad = []
def chk(c, m):
    print(('  ok ' if c else '  ✗ ') + m)
    if not c: bad.append(m)
foto = lambda pg, n, full=False: pg.screenshot(path=os.path.join(CAP, n + '.png'), full_page=full)
def pagina(b, uid, trivia=None, memo=None):
    ctx = b.new_context(service_workers='block', viewport={'width': 390, 'height': 844}); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route('**/rest/v1/**', rest); pg.route('**/functions/v1/**', lambda r: r.fulfill(status=200, content_type='application/json', body='{}'))
    ini = "localStorage.setItem('aet_inicio',JSON.stringify({estado:'hecho'}));localStorage.setItem('aet_tour_visto','1');localStorage.setItem('aet_tour','1');localStorage.setItem('aet_nombre_pedido','1');"
    if uid:
        auth = {'access_token': 'T-' + uid, 'refresh_token': 'RT', 'expires_at': int(time.time()) + 36000, 'user_id': uid, 'email': 'x@prueba.mx'}
        ini += "localStorage.setItem('aeterion_auth',%s);" % json.dumps(json.dumps(auth))
    if trivia: ini += "localStorage.setItem('aet_trivia',%s);" % json.dumps(json.dumps(trivia))
    if memo: ini += "localStorage.setItem('aet_memo',%s);" % json.dumps(json.dumps(memo))
    pg.add_init_script("if(!sessionStorage.x){sessionStorage.x=1;%s}" % ini)
    pg.goto('http://localhost:8859/index.html?modo=app'); pg.wait_for_timeout(2400); pg.evaluate("try{aetCerrar()}catch(e){}")
    return pg, errs
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium', args=['--no-sandbox'])
    print('1. Sin sesión')
    p0, e0 = pagina(b, None)
    p0.click('.app-nav-btn[data-p=juegos]'); p0.wait_for_timeout(400); p0.click('.jg-rank'); p0.wait_for_timeout(500)
    chk('Inicia sesión para ver el ranking' in p0.inner_text('#juegosApp'), 'pide iniciar sesión')
    print('2. Dylan abre el ranking y sube sus marcas')
    pa, ea = pagina(b, A, {'puntos': 8200, 'nivel': 6, 'estrellas': {'1': 3}, 'mejor': {}, 'rayos': 3, 't': 1},
                    {'v': 2, 'nivel': 12, 'estrellas': {str(L): 2 for L in range(1, 12)}, 'album': {}, 'diario': {}, 'infinito': 31, 'recientes': [], 't': 1})
    pa.click('.app-nav-btn[data-p=juegos]'); pa.wait_for_timeout(400)
    chk(pa.is_visible('.jg-rank'), 'tarjeta Ranking en Juegos')
    pa.click('.jg-rank'); pa.wait_for_timeout(1500)
    t = pa.inner_text('#juegosApp')
    row = sql("select trivia_puntos, memo_estrellas, memo_infinito from juegos_puntajes where user_id=$1", [A])
    chk(row and row[0]['trivia_puntos'] == 8200 and row[0]['memo_estrellas'] == 22 and row[0]['memo_infinito'] == 31, 'marcas subidas a la nube')
    chk('Dylan (tú)' in t and 'Lugar #2 de 7' in t and '🥇' in t and 'Fer' in t, 'trivia: Dylan en 2° lugar con su nombre de la app')
    foto(pa, '90_ranking_trivia', True)
    pa.click('[data-jg=rk-tabla][data-t=memo]'); pa.wait_for_timeout(900)
    chk('22★' in pa.inner_text('#juegosApp') and 'Lugar #1' in pa.inner_text('#juegosApp'), 'memorama por estrellas: Dylan 1°')
    pa.click('[data-jg=rk-tabla][data-t=diario]'); pa.wait_for_timeout(900)
    chk('Nadie ha completado el reto de hoy' in pa.inner_text('#juegosApp'), 'reto de hoy vacío')
    print('3. Ocultarse')
    pa.click('[data-jg=rk-tabla][data-t=trivia]'); pa.wait_for_timeout(900)
    pa.click('.rk-switch'); pa.wait_for_timeout(1200)
    chk(sql("select visible from juegos_puntajes where user_id=$1", [A])[0]['visible'] is False and 'Estás oculto del ranking' in pa.inner_text('#juegosApp'), 'el switch lo oculta')
    pb, eb = pagina(b, B, {'puntos': 300, 'nivel': 2, 'estrellas': {}, 'mejor': {}, 'rayos': 3, 't': 1})
    pb.click('.app-nav-btn[data-p=juegos]'); pb.wait_for_timeout(400); pb.click('.jg-rank'); pb.wait_for_timeout(1500)
    t = pb.inner_text('#juegosApp')
    chk('Sofía Ruiz (tú)' in t and 'Dylan' not in t, 'Sofía no ve a Dylan oculto')
    foto(pb, '91_ranking_sofia', True)
    pa.click('.rk-switch'); pa.wait_for_timeout(1200)
    pb.click('[data-jg=rk-tabla][data-t=trivia]'); pb.wait_for_timeout(1200)
    chk('Dylan' in pb.inner_text('#juegosApp'), 'al reactivarse vuelve a aparecer')
    chk(not (e0 + ea + eb), 'sin errores de JavaScript ' + str((e0 + ea + eb)[:3]))
    b.close()
print('\n%d fallas' % len(bad) if bad else '\nTodo bien'); sys.exit(1 if bad else 0)
