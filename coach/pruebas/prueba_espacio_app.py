# Prueba de punta a punta del espacio «Aeterion Coach» y del lado del cliente,
# con la app real y las funciones reales en Postgres local.
import subprocess, time, json, os, sys, urllib.request, atexit
from playwright.sync_api import sync_playwright

AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..'))
CAP = os.environ.get('CAPTURAS', os.path.join(AQUI, 'capturas')); os.makedirs(CAP, exist_ok=True)
web = subprocess.Popen(['python3', '-m', 'http.server', '8853'], cwd=RAIZ, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
bd = subprocess.Popen(['node', 'servidor_local.js', '54331'], cwd=AQUI, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
linea = bd.stdout.readline().decode()
atexit.register(lambda: (web.terminate(), bd.terminate()))
if not linea.startswith('listo'): sys.exit('servidor de base no arrancó: ' + linea)
directo = urllib.request.build_opener(urllib.request.ProxyHandler({}))
def bdreq(ruta, cuerpo, tok=''):
    rq = urllib.request.Request('http://127.0.0.1:54331' + ruta, data=json.dumps(cuerpo).encode(), headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok})
    try: r = directo.open(rq); return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()
sql = lambda q, p=None: json.loads(bdreq('/sql', {'sql': q, 'params': p or []})[1])

C, X = '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000e1'
for i, n, nom in [(C, 'coach', 'Daniela Ruiz'), (X, 'cliente', 'Ana Torres')]:
    sql("insert into auth.users values ($1,$2)", [i, n + '@prueba.mx']); sql("insert into perfiles (id,email,nombre) values ($1,$2,$3)", [i, n + '@prueba.mx', nom])
sql("update coach_config set valor=$1 where clave='testers'", [json.dumps([C, X])])
sql("insert into coaches (user_id, estado, nombre_publico, especialidades, modalidades, zona, precio_sesion, codigo, membresia_hasta, aprobado_en) values ($1,'activo','Coach Daniela Ruiz','{Fuerza,Hipertrofia}','{presencial,linea}','Coyoacán',300,'DANI123', now()+interval '30 days', now())", [C])

RUTINA = "window.RUTINA_H5 = {lunes:{titulo:'Pierna y glúteo',ejercicios:[{nombre:'Sentadilla trasera',series:'4',reps:'6–8',descanso:'3 min'},{nombre:'Peso muerto rumano',series:'3',reps:'8–10',descanso:'2 min'}]},martes:{titulo:'Empuje',ejercicios:[{nombre:'Press banca',series:'4',reps:'6–8',descanso:'3 min'}]}};"
def rest(route):
    n = route.request.url.split('/rest/v1/')[-1].split('?')[0]
    J = lambda o, st=200: route.fulfill(status=st, content_type='application/json', body=o if isinstance(o, str) else json.dumps(o))
    if n.startswith('rpc/'):
        fn = n[4:]
        if fn.startswith(('coach_', 'vinculo_', 'sesion', 'admin_coach', 'sesiones_', 'programa_', 'mensaje')):
            st, b = bdreq('/rpc/' + fn, json.loads(route.request.post_data or '{}'), route.request.headers.get('authorization', '').replace('Bearer ', ''))
            return J(b, st)
        if fn == 'estado_acceso': return J({'activo': True, 'vence_en': '2027-01-01T00:00:00Z', 'dias_restantes': 60, 'bloqueado': False})
        return J({})
    return J([] if route.request.method == 'GET' else {})
bad = []
def chk(c, m):
    print(('  ok ' if c else '  ✗ ') + m)
    if not c: bad.append(m)
def pagina(b, uid, url='index.html?modo=app'):
    ctx = b.new_context(service_workers='block', viewport={'width': 390, 'height': 844}); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.route('**/rest/v1/**', rest); pg.route('**/functions/v1/**', lambda r: r.fulfill(status=200, content_type='application/json', body='{}'))
    auth = {'access_token': 'T-' + uid, 'refresh_token': 'RT', 'expires_at': int(time.time()) + 36000, 'user_id': uid, 'email': 'x@prueba.mx'}
    pg.add_init_script(RUTINA + "if(!sessionStorage.x){sessionStorage.x=1;localStorage.setItem('aeterion_auth',%s);localStorage.setItem('aet_inicio',JSON.stringify({estado:'hecho'}));localStorage.setItem('aet_tour_visto','1');localStorage.setItem('aet_tour','1');localStorage.setItem('aet_nombre_pedido','1')}" % json.dumps(json.dumps(auth)))
    pg.goto('http://localhost:8853/' + url); pg.wait_for_timeout(2400); pg.evaluate("try{aetCerrar()}catch(e){}")
    return pg, errs
foto = lambda pg, n: pg.screenshot(path=os.path.join(CAP, n + '.png'))
txt = lambda pg: pg.inner_text('#coachApp')

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium', args=['--no-sandbox'])
    print('1. El coach entra a su espacio')
    pc, e1 = pagina(b, C)
    pc.evaluate("aetIr('cuenta')"); pc.wait_for_timeout(400)
    chk('Aeterion Coach' in pc.inner_text('.coach-entrada'), 'la tarjeta de Cuenta dice Aeterion Coach')
    pc.click('.coach-entrada'); pc.wait_for_timeout(1200)
    t = txt(pc)
    chk('Hola, Daniela' in t and 'CLIENTES' in t.upper() and 'Invita a tu primer cliente' in t, 'Hoy: saludo, cifras y estado vacío')
    chk(pc.evaluate("getComputedStyle(document.querySelector('.app-bottomnav')).display") == 'none' and pc.is_visible('.cx-nav'), 'barra propia del coach en lugar de la de la app')
    foto(pc, '20_coach_hoy_vacio')
    pc.click('.cx-rapidos [data-x=c-invitar]'); pc.wait_for_timeout(700)
    t = txt(pc); chk('DANI123' in t and 'coach=DANI123' in t, 'invitar: código y enlace')
    foto(pc, '21_coach_invitar')

    print('2. El cliente abre el enlace de invitación')
    px, e2 = pagina(b, X, 'index.html?modo=app&coach=DANI123')
    px.wait_for_timeout(1200)
    t = txt(px)
    chk('Te invitó tu coach' in t and 'Coach Daniela Ruiz' in t, 'la invitación se abre sola')
    chk(px.get_attribute('[data-c=inv-perm][data-x=mente]', 'aria-checked') == 'false', 'Mente apagada por defecto')
    foto(px, '22_cliente_invitacion')
    px.click('[data-c=aceptar-invitacion]'); px.wait_for_timeout(1200)
    v = sql("select estado, modalidad from coach_vinculos where cliente_id=$1", [X])
    chk(v and v[0]['estado'] == 'activo', 'vínculo activo de inmediato')

    print('3. El coach arma y asigna un programa desde la base')
    hoy = sql("select to_char(now() at time zone 'America/Mexico_City','YYYY-MM-DD') d")[0]['d']
    sql("insert into progreso (user_id,clave,valor) values ($1,'aet_log_entreno',$2),($1,'aet_actividad',$3),($1,'medidas_historial',$4)",
        [X, json.dumps([{'id': 1, 'fecha': hoy, 'ej': 'Sentadilla trasera', 'series': [{'r': 5, 'kg': 80}]}, {'id': 2, 'fecha': hoy, 'ej': 'Press banca', 'series': [{'r': 8, 'kg': 50}]}]),
         json.dumps({hoy: ['e']}), json.dumps([{'fecha': '2026-09-01', 'peso': 68.4}, {'fecha': hoy, 'peso': 66.9}])])
    pc.click('.cx-nav [data-x=c-hoy]'); pc.wait_for_timeout(1200)
    t = txt(pc); chk('Ana Torres no tiene programa' in t, 'alerta: cliente sin programa')
    foto(pc, '23_coach_hoy_alertas')
    pc.click('.cx-al-sin_programa'); pc.wait_for_timeout(1200)
    t = txt(pc); chk('Ana Torres' in t and 'CONSTANCIA' in t.upper() and 'Asignar programa' in t, 'ficha del cliente: resumen')
    chk('-1.5 kg' in t, 'cambio de peso calculado')
    foto(pc, '24_coach_ficha')
    pc.click('[data-c=cx-prog-cliente]'); pc.wait_for_timeout(900)
    pc.click('[data-c=cx-desde-base][data-x=entrenamiento]'); pc.wait_for_timeout(1200)
    t = txt(pc); chk('Nuevo programa' in t and 'Día 1' in t, 'editor desde la base GYM Hombre 5 días')
    chk(pc.eval_on_selector('#cxPPara', 'e => e.value') == X, 'el editor ya viene para Ana')
    pc.click('[data-c=cx-motor]'); pc.wait_for_timeout(1000)
    kg = pc.eval_on_selector('.cx-ej .cx-kg', 'e => e.value')
    chk(kg == '72.5', 'motor: sentadilla 80×5 → 1RM 93.3 → 72.5 kg para 7 reps con 2 en reserva (obtenido %s)' % kg)
    pc.fill('#cxPNom', 'Fuerza Ana'); pc.fill('.cx-ej:nth-of-type(2) .cx-nota', 'Controla la bajada')
    pc.click('[data-c=cx-ej-mas]'); pc.wait_for_timeout(500)
    pc.fill('.cx-ej:last-of-type .cx-n', 'Plancha'); pc.fill('.cx-ej:last-of-type .cx-r', '40 s')
    foto(pc, '25_coach_editor')
    pc.click('[data-c=cx-guardar-prog][data-x=asignar]'); pc.wait_for_timeout(1200)
    pr = sql("select nombre, dias from coach_programas where cliente_id=$1 and activo", [X])
    chk(pr and pr[0]['nombre'] == 'Fuerza Ana' and len(pr[0]['dias']) == 2 and len(pr[0]['dias'][0]['ejercicios']) == 3, 'programa guardado y asignado')
    chk(pr[0]['dias'][0]['ejercicios'][0]['kg'] == 72.5 and pr[0]['dias'][0]['ejercicios'][2]['n'] == 'Plancha', 'cargas y ejercicio nuevo guardados')

    print('4. El cliente usa su programa y escribe a su coach')
    px.evaluate("coachAbrir('mi-coach')"); px.wait_for_timeout(1200)
    t = txt(px); chk('Fuerza Ana' in t and 'Sentadilla trasera' in t and '72.5 kg' in t and 'Controla la bajada' in t, 'el cliente ve su programa con cargas y notas')
    px.click('[data-c=registrar-ej] >> nth=0'); px.wait_for_timeout(600)
    chk(px.is_visible('#aetEj') and px.eval_on_selector('#aetEj', 'e => e.value') == 'Sentadilla trasera', 'Registrar abre el registro de la app con el ejercicio')
    px.evaluate("aetCerrar()"); px.wait_for_timeout(300)
    px.fill('#coMsgIn', 'Hola coach, ¿subo peso la próxima?'); px.click('[data-c=msg-enviar]'); px.wait_for_timeout(1000)
    chk('subo peso' in txt(px), 'mensaje enviado')
    foto(px, '26_cliente_programa')

    print('5. El coach ve el mensaje, responde y anota')
    pc.click('.cx-nav [data-x=c-hoy]'); pc.wait_for_timeout(1200)
    chk('Ana Torres te escribió' in txt(pc), 'alerta de mensaje nuevo')
    pc.click('.cx-al-mensaje'); pc.wait_for_timeout(1200)
    chk('subo peso' in txt(pc), 'la alerta abre la conversación')
    pc.fill('#coMsgIn', 'Sí, sube 2.5 kg si completas las 8 con 2 en reserva.'); pc.click('[data-c=msg-enviar]'); pc.wait_for_timeout(900)
    foto(pc, '27_coach_mensajes')
    pc.click('[data-c=cx-tabficha][data-x=notas]'); pc.wait_for_timeout(800)
    pc.fill('#cxNota', 'Molestia leve en rodilla izquierda'); pc.click('[data-c=cx-nota]'); pc.wait_for_timeout(800)
    chk('Molestia leve' in txt(pc), 'nota privada guardada')
    pc.click('[data-c=cx-tabficha][data-x=entrenos]'); pc.wait_for_timeout(800)
    chk('5×80' in txt(pc), 'entrenos del cliente visibles')
    px.evaluate("coachAbrir('mi-coach')"); px.wait_for_timeout(1000)
    chk('sube 2.5 kg' in txt(px) and 'Molestia' not in txt(px), 'el cliente lee la respuesta, no la nota privada')

    print('6. Inactividad, clientes, academia, ganancias, agenda y cuenta')
    sql("update progreso set valor=$2 where user_id=$1 and clave='aet_actividad'", [X, json.dumps({'2026-01-01': ['e']})])
    pc.click('.cx-nav [data-x=c-clientes]'); pc.wait_for_timeout(1000)
    t = txt(pc); chk('Fuerza Ana' in t and 'hace' in t, 'lista de clientes con programa y último entreno')
    foto(pc, '28_coach_clientes')
    pc.click('.cx-nav [data-x=c-hoy]'); pc.wait_for_timeout(1000)
    chk('no entrena hace' in txt(pc), 'alerta de inactividad')
    pc.click('.cx-nav [data-x=c-academia]'); pc.wait_for_timeout(700)
    chk('Método Aeterion' in txt(pc), 'academia con el curso base')
    pc.click('[data-c=cx-doc][data-x=seguridad]'); pc.wait_for_timeout(600)
    chk('dolor en el pecho' in txt(pc), 'material: preguntas de seguridad')
    foto(pc, '29_coach_material')
    pc.click('.cx-nav [data-x=c-ganancias]'); pc.wait_for_timeout(800)
    chk('POR COBRAR' in txt(pc).upper() and 'DANI123' in txt(pc), 'ganancias')
    pc.click('.cx-nav [data-x=c-programas]'); pc.wait_for_timeout(800)
    pc.click('[data-c=cx-seg][data-x=asignados]'); pc.wait_for_timeout(700)
    chk('Para Ana Torres' in txt(pc), 'programas asignados')
    pc.click('.cx-nav [data-x=c-hoy]'); pc.wait_for_timeout(900)
    pc.click('[data-c=cx-ir][data-x=c-agenda]'); pc.wait_for_timeout(800)
    chk('Agenda' in txt(pc), 'agenda')
    chk(pc.evaluate("_atrasCapas().slice(-1)[0]") == 'coach', 'atrás reconoce subvista')
    pc.evaluate("_atrasCerrarCapa()"); pc.wait_for_timeout(900)
    chk('Hola, Daniela' in txt(pc), 'atrás regresa a Hoy')
    pc.click('.cx-ico'); pc.wait_for_timeout(900)
    chk('Membresía' in txt(pc), 'mi cuenta de coach')
    pc.click('.cx-salir'); pc.wait_for_timeout(700)
    chk(pc.evaluate("document.querySelector('.app-screen.activo').id") == 'app-screen-inicio' and pc.evaluate("getComputedStyle(document.querySelector('.app-bottomnav')).display") != 'none', 'Mi entreno regresa a la app normal')
    chk(not e1 and not e2, 'sin errores de JS ' + str(e1 + e2))
    b.close()
print('\n%d fallas' % len(bad)); sys.exit(1 if bad else 0)
