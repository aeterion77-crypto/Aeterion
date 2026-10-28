// Pruebas de la migración 007 (casos, bloqueos, evaluaciones, nutrición, calendario) en Postgres local.
const { PGlite } = require('@electric-sql/pglite'); const fs = require('fs'); const path = require('path');
const U = { admin: '00000000-0000-0000-0000-00000000000a', coach: '00000000-0000-0000-0000-0000000000c1', coach2: '00000000-0000-0000-0000-0000000000c2',
  cli: '00000000-0000-0000-0000-0000000000e1', cli2: '00000000-0000-0000-0000-0000000000e2', dueno: '00000000-0000-0000-0000-0000000000d1' };
let ok = 0, mal = 0; const chk = (n, c, x) => { if (c) ok++; else { mal++; console.log('FALLA:', n, x !== undefined ? JSON.stringify(x) : ''); } };
(async () => {
  const db = new PGlite(); const L = (f) => db.exec(fs.readFileSync(f, 'utf8'));
  await L(path.join(__dirname, 'stub_supabase.sql'));
  for (const f of ['001_coaches.sql', '003_accesos_origen.sql', '004_coach_espacio.sql', '005_gym.sql', '006_gym_pos.sql', '007_coach_v3.sql']) await L(path.join(__dirname, '..', 'sql', f));
  const su = async (q, p) => { await db.exec('reset role'); return db.query(q, p); };
  for (const [k, id] of Object.entries(U)) { await su('insert into auth.users values ($1,$2)', [id, k + '@x.mx']); await su('insert into perfiles (id,email,nombre) values ($1,$2,$3)', [id, k + '@x.mx', { cli: 'Ana Torres', cli2: 'Beto' }[k] || k]); }
  await su('insert into admins values ($1)', [U.admin]);
  await su(`update coach_config set valor = $1 where clave='testers'`, [JSON.stringify(Object.values(U))]);
  const rpc = async (uid, fn, args = []) => { await db.exec('reset role'); await db.query(`select set_config('request.jwt.claims',$1,false)`, [JSON.stringify({ sub: uid })]); await db.exec('set role authenticated');
    try { return (await db.query(`select public.${fn}(${args.map((_, i) => '$' + (i + 1)).join(',')}) r`, args.map(a => a !== null && typeof a === 'object' ? JSON.stringify(a) : a))).rows[0].r; } finally { await db.exec('reset role'); } };
  const err = async (...a) => { try { await rpc(...a); return null; } catch (e) { return e.message; } };
  for (const [c, cod] of [[U.coach, 'DANI123'], [U.coach2, 'OTRO123']])
    await su(`insert into coaches (user_id, estado, nombre_publico, modalidades, precio_sesion, codigo, membresia_hasta, aprobado_en) values ($1,'activo',$2,'{presencial,linea}',300,$3, now()+interval '30 days', now())`, [c, 'Coach ' + cod, cod]);
  await rpc(U.cli, 'vinculo_por_codigo', ['DANI123', 'linea', { entrenos: true }]);
  await rpc(U.cli2, 'vinculo_por_codigo', ['DANI123', 'presencial', {}]);
  const vin = (await su(`select id from coach_vinculos where cliente_id=$1`, [U.cli])).rows[0].id;
  const vin2 = (await su(`select id from coach_vinculos where cliente_id=$1`, [U.cli2])).rows[0].id;

  // ---------- Casos ----------
  chk('texto corto', (await err(U.cli, 'caso_crear', ['reembolso', 'x', null, {}])) === 'texto_corto');
  chk('tipo inválido', (await err(U.cli, 'caso_crear', ['spam', 'hola mundo', null, {}])) === 'tipo_invalido');
  chk('contra sin relación', (await err(U.cli, 'caso_crear', ['conducta', 'Me trató mal', U.coach2, {}])) === 'sin_relacion');
  let c1 = await rpc(U.cli, 'caso_crear', ['reembolso', 'La sesión del martes no se dio y la pagué', U.coach, { sesion: 5 }]);
  chk('cliente reporta a su coach', c1.rol === 'cliente' && c1.tipo === 'reembolso' && c1.contra_nombre === 'Coach DANI123' && c1.estado === 'abierto', c1);
  const c2 = await rpc(U.coach, 'caso_crear', ['mensaje', 'Hola Aeterion, tengo una duda sobre mi membresía', null, {}]);
  chk('coach escribe a Aeterion', c2.rol === 'coach' && c2.tipo === 'mensaje');
  const c3 = await rpc(U.coach, 'caso_crear', ['conducta', 'El cliente me insulta por chat', U.cli2, {}]);
  chk('coach reporta a cliente', c3.rol === 'coach' && c3.contra_nombre === 'Beto');
  chk('mayoreo sin gimnasio', (await err(U.cli, 'caso_crear', ['mayoreo', 'Quiero proteína al mayoreo', null, {}])) === 'sin_permiso');
  const G = (await rpc(U.admin, 'admin_gym_guardar', [{ nombre: 'Titan', dueno_email: 'dueno@x.mx' }])).lista[0].id;
  chk('mayoreo de gimnasio', (await rpc(U.dueno, 'caso_crear', ['mayoreo', 'Proteína 20 piezas al mes', null, { gym_id: G }])).rol === 'gym');
  chk('no admin no ve casos', (await err(U.cli, 'admin_casos', [null])) === 'solo_admin');
  let A = await rpc(U.admin, 'admin_casos', [null]);
  chk('admin ve casos abiertos', A.lista.length === 4 && A.resumen.reembolsos === 1 && A.resumen.mayoreo === 1 && A.lista[0].autor_email, A.resumen);
  const r = await rpc(U.admin, 'admin_caso_responder', [c1.id, 'Ya revisamos: te reembolsamos en 5 días hábiles.', 'resuelto']);
  chk('admin responde', r.estado === 'resuelto' && r.mensajes.length === 1);
  chk('cliente tiene respuesta sin leer', (await rpc(U.cli, 'casos_sin_leer')) === 1);
  let mis = await rpc(U.cli, 'mis_casos');
  chk('cliente ve su caso y respuesta', mis.length === 1 && mis[0].mensajes[0].de_admin === true && mis[0].autor_id === undefined);
  chk('leído', (await rpc(U.cli, 'casos_sin_leer')) === 0);
  chk('otro no escribe en caso ajeno', (await err(U.cli2, 'caso_escribir', [c1.id, 'hola'])) === 'caso_no_encontrado');
  chk('responder reabre', (await rpc(U.cli, 'caso_escribir', [c1.id, 'Gracias, pero aún no llega'])).estado === 'abierto');

  // ---------- Evaluaciones ----------
  chk('muy pronto (menos de 7 días)', (await err(U.cli, 'evaluacion_guardar', [vin, 5, {}, 'Muy bien'])) === 'muy_pronto');
  await su(`update coach_vinculos set respondido_en = now() - interval '10 days'`);
  let ev = await rpc(U.cli, 'evaluacion_guardar', [vin, 5, { comunicacion: 5, conocimiento: '4', hackeo: 5 }, 'Excelente']);
  chk('cliente evalúa al coach', ev.lado === 'cliente' && ev.mia.estrellas === 5 && ev.mia.aspectos.conocimiento === 4 && ev.mia.aspectos.hackeo === undefined, ev.mia);
  ev = await rpc(U.cli, 'evaluacion_guardar', [vin, 4, {}, 'Cambio de opinión']);
  chk('una por mes (se actualiza)', ev.historial.filter(x => x.autor === 'cliente').length === 1 && ev.mia.estrellas === 4);
  ev = await rpc(U.coach, 'evaluacion_guardar', [vin, 3, { constancia: 2 }, 'Falta a veces']);
  chk('coach evalúa al cliente', ev.lado === 'coach' && ev.historial.length === 2);
  chk('estrellas inválidas', (await err(U.coach, 'evaluacion_guardar', [vin, 6, {}, ''])) === 'calificacion_invalida');
  chk('ajeno no evalúa', (await err(U.coach2, 'evaluacion_guardar', [vin, 5, {}, ''])) === 'vinculo_no_encontrado');
  chk('calificación pública incluye evaluaciones', Number((await rpc(U.cli2, 'coach_perfil', [U.coach])).calificacion.promedio) === 4);

  // ---------- Nutrición ----------
  const plan = { cliente_id: U.cli, kcal: '2200', proteina_g: '150', carbos_g: '230', grasas_g: '70', comidas: [{ nombre: 'Desayuno', texto: 'Avena con fruta y 3 huevos' }], nota: 'Agua 2.5 L' };
  chk('sin autorización no hay plan', (await err(U.coach, 'coach_nutricion_guardar', [plan])) === 'nutricion_no_autorizada');
  chk('cliente aún sin plan', (await rpc(U.cli, 'nutricion_mia')) === null);
  await rpc(U.admin, 'admin_coach_nutricion', [U.coach, true]);
  let n = await rpc(U.coach, 'coach_nutricion_guardar', [plan]);
  chk('plan guardado', n.kcal === 2200 && n.comidas.length === 1);
  chk('plan inválido', (await err(U.coach, 'coach_nutricion_guardar', [{ ...plan, kcal: '200' }])) === 'plan_invalido');
  chk('cliente ajeno', (await err(U.coach, 'coach_nutricion_guardar', [{ ...plan, cliente_id: U.admin }])) === 'sin_permiso');
  n = await rpc(U.cli, 'nutricion_mia');
  chk('cliente ve el plan de su coach', n.kcal === 2200 && n.coach === 'Coach DANI123' && n.coach_id === undefined);
  await rpc(U.admin, 'admin_coach_nutricion', [U.coach, false]);
  chk('si se quita la autorización, el cliente ya no lo ve', (await rpc(U.cli, 'nutricion_mia')) === null);
  await rpc(U.admin, 'admin_coach_nutricion', [U.coach, true]);

  // ---------- Calendario ----------
  const man = new Date(Date.now() + 86400000).toISOString();
  let e = await rpc(U.coach, 'coach_evento_guardar', [{ titulo: 'Revisión de técnica', inicio: man, minutos: '45', tipo: 'revision', cliente_id: U.cli }]);
  chk('evento creado', e.titulo === 'Revisión de técnica' && e.minutos === 45);
  chk('evento a cliente ajeno', (await err(U.coach2, 'coach_evento_guardar', [{ titulo: 'X x', inicio: man, cliente_id: U.cli }])) === 'sin_permiso');
  chk('evento inválido', (await err(U.coach, 'coach_evento_guardar', [{ titulo: 'Fecha mala', inicio: 'no es fecha' }])) === 'evento_invalido');
  await rpc(U.coach, 'coach_evento_guardar', [{ titulo: 'Gimnasio propio', inicio: man, tipo: 'personal' }]);
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
  const fin = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const cal = await rpc(U.coach, 'coach_calendario', [hoy, fin]);
  chk('calendario del coach', cal.eventos.length === 2 && cal.eventos.some(x => x.cliente === 'Ana Torres'), cal);
  chk('rango largo', (await err(U.coach, 'coach_calendario', [hoy, '2099-01-01'])) === 'rango_invalido');
  const citas = await rpc(U.cli, 'mis_citas_coach');
  chk('cliente ve su cita (no las personales)', citas.length === 1 && citas[0].titulo === 'Revisión de técnica');
  e = await rpc(U.coach, 'coach_evento_guardar', [{ id: e.id, titulo: 'Revisión de técnica', inicio: man, hecho: true }]);
  chk('evento hecho', e.hecho === true);

  // ---------- Ficha ----------
  const fi = await rpc(U.coach, 'coach_ficha', [U.cli]);
  chk('ficha completa', fi.nombre === 'Ana Torres' && fi.nutricion.puede === true && fi.nutricion.plan.kcal === 2200 && fi.proximas.length === 1 && Number(fi.reputacion.promedio) === 3, fi);
  chk('ficha ajena', (await err(U.coach2, 'coach_ficha', [U.cli])) === 'sin_permiso');

  // ---------- Bloqueo ----------
  await rpc(U.coach, 'mensaje_enviar', [vin2, 'Hola Beto']);
  let est = await rpc(U.cli2, 'vinculo_bloquear', [vin2, 'Me escribe a deshoras y me presiona', true]);
  chk('cliente bloquea: termina el vínculo', est.mi_coach === null);
  chk('bloqueo genera reporte', (await su(`select count(*)::int n from aet_casos where autor=$1 and tipo='conducta'`, [U.cli2])).rows[0].n === 1);
  chk('coach ya no escribe', (await err(U.coach, 'mensaje_enviar', [vin2, 'hola?'])) === 'sin_permiso');
  chk('no reaparece en directorio', !(await rpc(U.cli2, 'coach_directorio', [null, null, null, 30, 0])).some(x => x.id === U.coach));
  chk('no puede reconectar por código', (await err(U.cli2, 'vinculo_por_codigo', ['DANI123', 'presencial', {}])) === 'codigo_invalido');
  chk('ni solicitar', (await err(U.cli2, 'vinculo_solicitar', [U.coach, 'presencial', {}])) === 'coach_no_encontrado');
  chk('lista de bloqueados', (await rpc(U.cli2, 'coach_mis_bloqueos'))[0].nombre === 'Coach DANI123');
  chk('el coach no puede quitar un bloqueo del cliente', (await err(U.coach, 'coach_desbloquear', [U.coach, U.cli2])) === 'no_encontrado');
  await rpc(U.cli2, 'coach_desbloquear', [U.coach, U.cli2]);
  chk('desbloquear permite reconectar', (await rpc(U.cli2, 'vinculo_por_codigo', ['DANI123', 'presencial', {}])).mi_coach.estado === 'activo');
  // coach bloquea a un cliente
  const vin2b = (await su(`select id from coach_vinculos where cliente_id=$1 and estado='activo'`, [U.cli2])).rows[0].id;
  await rpc(U.coach, 'vinculo_bloquear', [vin2b, 'Falta al respeto', false]);
  chk('coach bloquea al cliente', (await err(U.cli2, 'vinculo_por_codigo', ['DANI123', 'presencial', {}])) === 'codigo_invalido' && (await rpc(U.coach, 'coach_mis_bloqueos')).length === 1);
  chk('tablas cerradas', /permission denied/.test(await (async () => { await db.exec('set role authenticated'); try { await db.query('select * from aet_casos'); return ''; } catch (x) { return x.message; } finally { await db.exec('reset role'); } })()));
  console.log(`${ok} bien, ${mal} fallas`); process.exit(mal ? 1 : 0);
})().catch(e => { console.error('ERROR', e.message, e.where || ''); process.exit(2); });
