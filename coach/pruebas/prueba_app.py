# Prueba de punta a punta: la app real (rama coaches) + funciones reales en Postgres local.
# Uso: python3 prueba_app.py   (levanta su propio servidor web y el servidor de base de datos)
import subprocess, time, json, os, sys, urllib.request
from playwright.sync_api import sync_playwright

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
CAP = os.environ.get('CAPTURAS', os.path.join(os.path.dirname(__file__), 'capturas'))
os.makedirs(CAP, exist_ok=True)
web = subprocess.Popen(['python3', '-m', 'http.server', '8851'], cwd=RAIZ, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
bd = subprocess.Popen(['node', 'servidor_local.js', '54329'], cwd=os.path.dirname(os.path.abspath(__file__)), stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
bd.stdout.readline()  # "listo"
directo = urllib.request.build_opener(urllib.request.ProxyHandler({}))

def bdreq(ruta, cuerpo, tok=None):
    rq = urllib.request.Request('http://127.0.0.1:54329' + ruta, data=json.dumps(cuerpo).encode(), headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (tok or '')})
    try:
        r = directo.open(rq); return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()
def sql(q, params=None): return json.loads(bdreq('/sql', {'sql': q, 'params': params or []})[1])
def rpc(uid, fn, args=None):
    st, b = bdreq('/rpc/' + fn, args or {}, 'T-' + uid); return st, json.loads(b)

U = {'admin': '00000000-0000-0000-0000-00000000000a', 'coach': '00000000-0000-0000-0000-0000000000c1',
     'cli': '00000000-0000-0000-0000-0000000000e1', 'otro': '00000000-0000-0000-0000-0000000000e3'}
NOMBRES = {'admin': 'Admin', 'coach': 'Daniela Ruiz', 'cli': 'Ana Torres', 'otro': 'Otro'}
for k, i in U.items():
    sql("insert into auth.users values ($1,$2)", [i, k + '@prueba.mx'])
    sql("insert into perfiles (id,email,nombre) values ($1,$2,$3)", [i, k + '@prueba.mx', NOMBRES[k]])
sql("insert into admins values ($1)", [U['admin']])
rpc(U['admin'], 'admin_coach_config', {'p_clave': 'testers', 'p_valor': [U['coach'], U['cli']]})

COACH_FN = ('coach_', 'vinculo_', 'sesion', 'admin_coach', 'sesiones_')
llamadas = []
def rest(route):
    url = route.request.url
    n = url.split('/rest/v1/')[-1].split('?')[0]
    J = lambda o, st=200: route.fulfill(status=st, content_type='application/json', body=o if isinstance(o, str) else json.dumps(o))
    if n.startswith('rpc/'):
        fn = n[4:]
        if fn.startswith(COACH_FN):
            llamadas.append(fn)
            st, b = bdreq('/rpc/' + fn, json.loads(route.request.post_data or '{}'), route.request.headers.get('authorization', '').replace('Bearer ', ''))
            return J(b, st)
        if fn == 'estado_acceso': return J({'activo': False, 'vence_en': None, 'dias_restantes': 0, 'bloqueado': False, 'soporte_no_leidos': 0})
        return J({})
    return J([] if route.request.method == 'GET' else {})

bad = []
def chk(c, m):
    print(('  ok ' if c else '  ✗ ') + m)
    if not c: bad.append(m)

def pagina(ctx, quien):
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('dialog', lambda d: d.accept())
    pg.route('**/rest/v1/**', rest)
    pg.route('**/storage/v1/object/**', lambda r: r.fulfill(status=200, content_type='application/json', body='{"Key":"ok"}'))
    pg.route('**/functions/v1/**', lambda r: r.fulfill(status=200, content_type='application/json', body='{}'))
    auth = {'access_token': 'T-' + U[quien], 'refresh_token': 'RT', 'expires_at': int(time.time()) + 36000, 'user_id': U[quien], 'email': quien + '@prueba.mx'}
    pg.add_init_script("if(!sessionStorage.x){sessionStorage.x=1;localStorage.setItem('aeterion_auth',%s);localStorage.setItem('aet_inicio',JSON.stringify({estado:'hecho'}));localStorage.setItem('aet_tour_visto','1');localStorage.setItem('aet_tour','1');localStorage.setItem('aet_nombre_pedido','1')}" % json.dumps(json.dumps(auth)))
    pg.goto('http://localhost:8851/index.html?modo=app'); pg.wait_for_timeout(2200)
    return pg, errs

def foto(pg, nombre, alto=None):
    pg.screenshot(path=os.path.join(CAP, nombre + '.png'), full_page=bool(alto))

def entrar_coach(pg):
    pg.evaluate("try{aetCerrar()}catch(e){}; aetIr('cuenta')"); pg.wait_for_timeout(300)
    if pg.is_visible('#appSheet.abierto'): print('   [hoja abierta]', pg.inner_text('#appSheet')[:160].replace('\n',' '))
    pg.click('.coach-entrada'); pg.wait_for_timeout(900)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium', args=['--no-sandbox'])
    nuevo = lambda: b.new_context(service_workers='block', viewport={'width': 390, 'height': 844})

    print('1. Usuario que no es tester: no ve nada')
    pg, errs = pagina(nuevo(), 'otro')
    pg.evaluate("aetIr('cuenta')"); pg.wait_for_timeout(400)
    chk(not pg.is_visible('.coach-entrada'), 'tarjeta Coaches oculta con el interruptor apagado')
    chk(not errs, 'sin errores de JS ' + str(errs))
    pg.context.close()

    print('2. Coach llena su solicitud')
    pg, errs = pagina(nuevo(), 'coach')
    chk(pg.is_visible('.coach-entrada') or (pg.evaluate("aetIr('cuenta')") or True) and pg.is_visible('.coach-entrada'), 'tester ve la tarjeta Coaches')
    entrar_coach(pg)
    chk('Únete a Aeterion Coach' in pg.inner_text('#coachApp'), 'inicio ofrece unirse ' + pg.evaluate("document.getElementById('coachApp').innerHTML")[:600])
    foto(pg, '01_inicio_cliente')
    pg.click('[data-c=solicitud]'); pg.wait_for_timeout(700)
    foto(pg, '02_solicitud_vacia')
    pg.fill('#cfNombre', 'Coach Daniela Ruiz'); pg.fill('#cfBio', 'Entreno fuerza con técnica primero. Te enseño a progresar con cargas medidas.')
    for e in ['Fuerza', 'Hipertrofia', 'Mujeres']: pg.click(f'#cfEsp [data-x="{e}"]')
    pg.click('#cfMod [data-x=presencial]'); pg.click('#cfMod [data-x=linea]')
    pg.fill('#cfZona', 'Coyoacán'); pg.fill('#cfGym', 'Titan Gym'); pg.fill('#cfHorario', 'Mañanas, noches y sábado'); pg.fill('#cfExp', '6')
    pg.fill('#cfPS', '400'); pg.fill('#cfPM', '800'); pg.fill('#cfRfc', 'RUDA900101AB1'); pg.fill('#cfTel', '5512345678')
    pg.click('[data-c=guardar-perfil]'); pg.wait_for_timeout(800)
    chk(pg.evaluate("document.querySelector('.aet-toast') && document.querySelector('.aet-toast').innerText") == 'Ese precio pasa el máximo de tu nivel.', 'precio sobre tope rechazado con mensaje claro')
    pg.fill('#cfPS', '300'); pg.check('#cfTerm')
    pg.click('[data-c=guardar-perfil]'); pg.wait_for_timeout(900)
    est = rpc(U['coach'], 'coach_estado')[1]['coach']
    chk(est and est['estado'] == 'borrador' and est['nombre_publico'] == 'Coach Daniela Ruiz' and est['acepto_terminos_en'], 'perfil guardado en la base')
    # documentos
    for tipo, nom, emi in [('identificacion', 'INE', 'INE'), ('certificacion', 'Entrenador personal certificado', 'NSCA')]:
        pg.select_option('#cdTipo', tipo); pg.fill('#cdNombre', nom); pg.fill('#cdEmisor', emi)
        pg.set_input_files('#cdArchivo', files=[{'name': 'doc.pdf', 'mimeType': 'application/pdf', 'buffer': b'%PDF-1.4 prueba'}])
        pg.click('[data-c=doc-subir]'); pg.wait_for_timeout(900)
    chk(pg.locator('.co-doc').count() == 2, 'dos documentos subidos y listados')
    chk(pg.is_visible('[data-c=pagar][data-x=primer_mes]'), 'pide pagar el primer mes antes de enviar')
    pg.click('[data-c=enviar-revision]'); pg.wait_for_timeout(800)
    chk('Paga tu primer mes' in (pg.evaluate("[...document.querySelectorAll('.aet-toast')].map(t=>t.innerText).join('|')") or ''), 'no deja enviar sin pago')
    # El servidor (webhook de Stripe) registra el pago
    sql("select public.coach_membresia_registrar($1,'primer_mes',349,'cs_prueba',now() + interval '30 days')", [U['coach']])
    pg.evaluate("coachAbrir('solicitud')"); pg.wait_for_timeout(800)
    foto(pg, '03_solicitud_llena', True)
    pg.click('[data-c=enviar-revision]'); pg.wait_for_timeout(900)
    chk('en revisión' in pg.inner_text('#coachApp'), 'solicitud en revisión')
    foto(pg, '04_en_revision')

    print('3. Admin valida y aprueba (por función, el panel se prueba aparte)')
    det = rpc(U['admin'], 'admin_coach_detalle', {'p_coach': U['coach']})[1]
    for d in det['documentos']: rpc(U['admin'], 'admin_coach_documento', {'p_doc': d['id'], 'p_estado': 'valido', 'p_nota': None})
    st, det = rpc(U['admin'], 'admin_coach_decidir', {'p_coach': U['coach'], 'p_accion': 'aprobar'})
    chk(st == 200 and det['estado'] == 'activo', 'aprobado')

    print('4. Cliente busca y se vincula')
    pc, errs2 = pagina(nuevo(), 'cli')
    entrar_coach(pc)
    pc.click('[data-c=directorio]'); pc.wait_for_timeout(900)
    chk('Coach Daniela Ruiz' in pc.inner_text('#coachApp'), 'aparece en el directorio')
    foto(pc, '05_directorio')
    pc.click('.co-item[data-c=perfil]'); pc.wait_for_timeout(900)
    t = pc.inner_text('#coachApp')
    chk('Entrenador personal certificado' in t and 'no es un título oficial' in t and 'RUDA' not in t, 'perfil con credencial, aviso legal y sin RFC')
    foto(pc, '06_perfil', True)
    pc.click('.co-pie [data-c=solicitar]'); pc.wait_for_timeout(700)
    chk(pc.get_attribute('[data-c=sol-perm][data-x=mente]', 'aria-checked') == 'false', 'Mente apagada por defecto')
    pc.click('[data-c=sol-mod][data-x=linea]'); pc.wait_for_timeout(300)
    pc.click('[data-c=sol-perm][data-x=comidas]'); pc.wait_for_timeout(300)
    foto(pc, '07_permisos')
    pc.click('[data-c=enviar-solicitud]'); pc.wait_for_timeout(1000)
    chk('Solicitud enviada' in pc.inner_text('#coachApp'), 'solicitud enviada, inicio la muestra')
    v = sql("select modalidad, permisos from coach_vinculos where cliente_id=$1", [U['cli']])[0]
    chk(v['modalidad'] == 'linea' and v['permisos'] == {'entrenos': True, 'medidas': True, 'comidas': True, 'mente': False}, 'modalidad y permisos guardados ' + json.dumps(v))

    print('5. Coach acepta y propone sesión')
    sql("insert into progreso (user_id, clave, valor) values ($1,'medidas_historial',$2),($1,'aet_log_entreno',$3),($1,'aet_mente',$4)",
        [U['cli'], json.dumps([{'fecha': '2026-09-01', 'peso': 68.4}, {'fecha': '2026-10-20', 'peso': 66.9}]),
         json.dumps([{'id': 1, 'fecha': '2026-10-24', 'ej': 'Sentadilla', 'series': [{'r': 8, 'kg': 50}, {'r': 8, 'kg': 52.5}]}]), json.dumps({'checkins': {'2026-10-25': {'animo': 2, 'nota': 'privado'}}})])
    pg.evaluate("coachAbrir('inicio')"); pg.wait_for_timeout(900)
    chk('Mi panel de coach' in pg.inner_text('#coachApp'), 'coach activo ve su panel')
    pg.click('[data-c=panel]'); pg.wait_for_timeout(900)
    chk('quieren entrenar contigo' in pg.inner_text('#coachApp').lower(), 've la solicitud')
    foto(pg, '08_panel_solicitud', True)
    pg.click('[data-c=responder][data-n="1"]'); pg.wait_for_timeout(900)
    pg.click('.co-item[data-c=cliente]'); pg.wait_for_timeout(900)
    t = pg.inner_text('#coachApp')
    chk('66.9 kg' in t and 'Sentadilla' in t, 've peso y entrenos autorizados')
    chk('privado' not in t and 'Ánimo' not in t, 'no ve Mente (no autorizado)')
    foto(pg, '09_cliente', True)
    pg.evaluate("document.getElementById('csInicio').value = new Date(Date.now()+3*864e5 - new Date().getTimezoneOffset()*6e4).toISOString().slice(0,16)")
    pg.fill('#csNota', 'Pierna y técnica de sentadilla')
    pg.click('[data-c=crear-sesion]'); pg.wait_for_timeout(900)
    chk(sql("select count(*)::int n from coach_sesiones where estado='por_pagar'")[0]['n'] == 1, 'sesión propuesta')

    print('6. Cliente ve la sesión, cambia permisos, cancela')
    pc.evaluate("coachAbrir('mi-coach')"); pc.wait_for_timeout(1000)
    t = pc.inner_text('#coachApp')
    chk('Por pagar' in t and 'Pagar $300' in t, 'cliente ve sesión por pagar')
    pc.click('[data-c=pagar][data-x=sesion]'); pc.wait_for_timeout(700)
    chk('no está disponible' in pc.evaluate("[...document.querySelectorAll('.aet-toast')].map(t=>t.innerText).join('|')"), 'pago aún sin Stripe avisa con calma')
    foto(pc, '10_mi_coach', True)
    pc.click('[data-c=perm-cambiar][data-x=mente]'); pc.wait_for_timeout(800)
    chk(sql("select permisos->>'mente' m from coach_vinculos where cliente_id=$1", [U['cli']])[0]['m'] == 'true', 'activar Mente se guarda')
    sid = sql("select id from coach_sesiones limit 1")[0]['id']
    sql("update coach_sesiones set estado='pagada', pagada_en=now() where id=$1", [sid])
    pc.evaluate("coachAbrir('mi-coach')"); pc.wait_for_timeout(900)
    pc.click('[data-c=cancelar]'); pc.wait_for_timeout(900)
    r = sql("select estado, reembolso from coach_sesiones where id=$1", [sid])[0]
    chk(r == {'estado': 'cancelada_cliente', 'reembolso': 'pendiente'}, 'cancelar con 3 días = reembolso pendiente ' + json.dumps(r))

    print('7. Comisiones del coach')
    sql("select public.coach_comision_registrar($1,'premium_nueva','pi_x',53.06)", [U['cli']])
    pg.evaluate("coachAbrir('comisiones')"); pg.wait_for_timeout(900)
    chk('$15.92' in pg.inner_text('#coachApp'), 'comisión visible en validación')
    foto(pg, '11_comisiones', True)

    print('8. Atrás del teléfono y otras pantallas intactas')
    pg.evaluate("coachAbrir('inicio')"); pg.click('[data-c=panel]'); pg.wait_for_timeout(700)
    chk(pg.evaluate("_atrasCapas().slice(-1)[0]") == 'coach', 'capa de atrás reconoce subvista de coach')
    pg.evaluate("_atrasCerrarCapa()"); pg.wait_for_timeout(700)
    chk('Coaches' in pg.inner_text('#coachApp h2'), 'atrás regresa al inicio de Coaches')
    for s in ['inicio', 'entrenar', 'nutricion', 'perfil', 'mente', 'cuenta']:
        pg.evaluate(f"aetIr('{s}')"); pg.wait_for_timeout(250)
    chk(not errs and not errs2, 'sin errores de JS en todo el recorrido ' + str(errs + errs2))
    b.close()

web.terminate(); bd.terminate()
print('\n%d fallas' % len(bad)); sys.exit(1 if bad else 0)
