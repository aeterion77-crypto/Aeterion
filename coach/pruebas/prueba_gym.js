// Pruebas de la migración 005 (Aeterion Gym) en Postgres local.
const { PGlite } = require('@electric-sql/pglite'); const fs = require('fs'); const path = require('path');
const U = { admin: 'a0000000-0000-0000-0000-000000000001', dueno: 'a0000000-0000-0000-0000-000000000002', recep: 'a0000000-0000-0000-0000-000000000003',
  coach: 'a0000000-0000-0000-0000-000000000004', dueno2: 'a0000000-0000-0000-0000-000000000005', socio: 'a0000000-0000-0000-0000-000000000006', otro: 'a0000000-0000-0000-0000-000000000007' };
let ok = 0, mal = 0; const chk = (n, c, x) => { if (c) ok++; else { mal++; console.log('FALLA:', n, x !== undefined ? JSON.stringify(x) : ''); } };
(async () => {
  const db = new PGlite(); const L = (f) => db.exec(fs.readFileSync(f, 'utf8'));
  await L(path.join(__dirname, 'stub_supabase.sql'));
  for (const f of ['001_coaches.sql', '003_accesos_origen.sql', '004_coach_espacio.sql', '005_gym.sql', '006_gym_pos.sql']) await L(path.join(__dirname, '..', 'sql', f));
  const su = async (q, p) => { await db.exec('reset role'); return db.query(q, p); };
  for (const [k, id] of Object.entries(U)) { await su('insert into auth.users values ($1,$2)', [id, k + '@x.mx']); await su('insert into perfiles (id,email,nombre) values ($1,$2,$3)', [id, k + '@x.mx', k]); }
  await su('insert into admins values ($1)', [U.admin]);
  const rpc = async (uid, fn, args = []) => { await db.exec('reset role'); await db.query(`select set_config('request.jwt.claims',$1,false)`, [JSON.stringify({ sub: uid })]); await db.exec('set role authenticated');
    try { return (await db.query(`select public.${fn}(${args.map((_, i) => '$' + (i + 1)).join(',')}) r`, args.map(a => a !== null && typeof a === 'object' ? JSON.stringify(a) : a))).rows[0].r; } finally { await db.exec('reset role'); } };
  const err = async (...a) => { try { await rpc(...a); return null; } catch (e) { return e.message; } };

  // Admin crea gimnasios
  chk('no admin no crea', (await err(U.dueno, 'admin_gym_guardar', [{ nombre: 'X', dueno_email: 'dueno@x.mx' }])) === 'solo_admin');
  chk('dueño sin cuenta', (await err(U.admin, 'admin_gym_guardar', [{ nombre: 'Titan', dueno_email: 'nadie@x.mx' }])) === 'cuenta_no_encontrada');
  let A = await rpc(U.admin, 'admin_gym_guardar', [{ nombre: 'Titan Gym', ciudad: 'CDMX', plan: 'piloto', dueno_email: 'DUENO@x.mx' }]);
  const G = A.lista[0].id;
  A = await rpc(U.admin, 'admin_gym_guardar', [{ nombre: 'Otro Gym', plan: 'profesional', dueno_email: 'dueno2@x.mx' }]);
  const G2 = A.lista.find(g => g.nombre === 'Otro Gym').id;
  chk('gym con dueño', A.lista.find(g => g.id === G).dueno === 'dueno@x.mx');
  const mis = await rpc(U.dueno, 'gym_mis');
  chk('dueño ve su gym', mis.length === 1 && mis[0].rol === 'dueno' && mis[0].nombre === 'Titan Gym');
  chk('ajeno no ve', (await rpc(U.otro, 'gym_mis')).length === 0);
  let info = await rpc(U.dueno, 'gym_info', [G]);
  chk('sede y plan por defecto', info.sedes.length === 1 && info.planes.length === 1 && info.plan_info.precio === 999);

  // Aislamiento
  chk('otro dueño no entra', (await err(U.dueno2, 'gym_info', [G])) === 'sin_permiso');
  chk('ajeno no lista socios', (await err(U.otro, 'gym_socios_listar', [G, 'activos', null])) === 'sin_permiso');
  chk('tablas cerradas', /permission denied/.test(await (async () => { await db.exec('set role authenticated'); try { await db.query('select * from gym_socios'); return ''; } catch (x) { return x.message; } finally { await db.exec('reset role'); } })()));

  // Planes del gimnasio
  info = await rpc(U.dueno, 'gym_plan_guardar', [G, { nombre: 'Mensual', precio: 450, dias: 30 }]);
  info = await rpc(U.dueno, 'gym_plan_guardar', [G, { nombre: 'Trimestral', precio: '1200', dias: 90 }]);
  const pMes = info.planes.find(p => p.nombre === 'Mensual' && Number(p.precio) === 450).id, pTri = info.planes.find(p => p.nombre === 'Trimestral').id;
  chk('días inválidos', (await err(U.dueno, 'gym_plan_guardar', [G, { nombre: 'Prueba', precio: 1, dias: 999 }])) === 'dias_invalidos');

  // Staff
  chk('staff sin cuenta', (await err(U.dueno, 'gym_staff_agregar', [G, 'nadie@x.mx', 'recepcion'])) === 'cuenta_no_encontrada');
  await rpc(U.dueno, 'gym_staff_agregar', [G, 'recep@x.mx', 'recepcion']);
  let st = await rpc(U.dueno, 'gym_staff_agregar', [G, 'coach@x.mx', 'coach']);
  chk('staff agregado', st.length === 3);
  chk('límite de staff (piloto = 3)', (await err(U.dueno, 'gym_staff_agregar', [G, 'otro@x.mx', 'recepcion'])) === 'limite_staff');
  chk('recepción no gestiona staff', (await err(U.recep, 'gym_staff_agregar', [G, 'otro@x.mx', 'coach'])) === 'sin_permiso');
  chk('no se quita al dueño', (await err(U.dueno, 'gym_staff_quitar', [G, st.find(s => s.rol === 'dueno').id])) === 'sin_permiso');

  // Socios
  chk('falta nombre', (await err(U.recep, 'gym_socio_guardar', [G, { nombre: ' ' }])) === 'falta_nombre');
  chk('coach no da de alta', (await err(U.coach, 'gym_socio_guardar', [G, { nombre: 'Ana' }])) === 'sin_permiso');
  const s1 = await rpc(U.recep, 'gym_socio_guardar', [G, { nombre: 'Ana Torres', telefono: '55 1234 5678', email: 'ana@x.mx' }]);
  const s2 = await rpc(U.recep, 'gym_socio_guardar', [G, { nombre: 'Beto Díaz' }]);
  chk('números consecutivos', s1.numero === 1 && s2.numero === 2 && s1.estado === 'sin_pago' && s1.telefono === '5512345678', s1);
  const s3 = await rpc(U.dueno2, 'gym_socio_guardar', [G2, { nombre: 'Socio del otro' }]);
  chk('numeración por gimnasio', s3.numero === 1);
  chk('editar socio ajeno', (await err(U.dueno, 'gym_socio_guardar', [G, { id: s3.id, nombre: 'hack' }])) === 'socio_no_encontrado');

  // Pagos
  const hoy = (await su(`select public._gym_hoy() d`)).rows[0].d.toISOString().slice(0, 10);
  const mas = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  let r = await rpc(U.recep, 'gym_pago_registrar', [G, s1.id, pMes, 450, 'efectivo', null]);
  chk('pago extiende 30 días', r.vence_en === mas(hoy, 29) && r.estado === 'al_corriente' && r.plan === 'Mensual', r);
  r = await rpc(U.recep, 'gym_pago_registrar', [G, s1.id, pTri, 1200, 'tarjeta', null]);
  chk('pago adelantado se suma al vencimiento', r.vence_en === mas(hoy, 119), r.vence_en);
  chk('plan de otro gym', (await err(U.recep, 'gym_pago_registrar', [G, s1.id, (await rpc(U.dueno2, 'gym_info', [G2])).planes[0].id, 1, 'efectivo', null])) === 'plan_invalido');
  chk('método inválido', (await err(U.recep, 'gym_pago_registrar', [G, s1.id, pMes, 1, 'bitcoin', null])) === 'metodo_invalido');
  chk('coach no cobra', (await err(U.coach, 'gym_pago_registrar', [G, s1.id, pMes, 1, 'efectivo', null])) === 'sin_permiso');
  let det = await rpc(U.dueno, 'gym_socio_detalle', [G, s1.id]);
  chk('detalle con pagos', det.pagos.length === 2 && det.codigo_vincular.length === 6 && det.token.length === 20);
  chk('coach no ve pagos ni QR', (await rpc(U.coach, 'gym_socio_detalle', [G, s1.id])).pagos === null && (await rpc(U.coach, 'gym_socio_detalle', [G, s1.id])).token === null);
  chk('recepción no anula', (await err(U.recep, 'gym_pago_anular', [G, det.pagos[0].id, 'error'])) === 'sin_permiso');
  r = await rpc(U.dueno, 'gym_pago_anular', [G, det.pagos[0].id, 'Se cobró dos veces']);
  chk('anular recalcula vencimiento', r.vence_en === mas(hoy, 29), r.vence_en);
  let caja = await rpc(U.dueno, 'gym_caja', [G, null, null]);
  chk('caja del día sin anulados', Number(caja.total) === 450 && Number(caja.por_metodo.efectivo) === 450 && caja.pagos.length === 2, caja);
  caja = await rpc(U.recep, 'gym_caja', [G, '2020-01-01', null]);
  chk('recepción solo ve hoy y ayer', caja.desde === mas(hoy, -1), caja.desde);
  chk('coach sin caja', (await err(U.coach, 'gym_caja', [G, null, null])) === 'sin_permiso');

  // Asistencia
  r = await rpc(U.recep, 'gym_checkin', [G, null, String(s1.numero)]);
  chk('entrada por número', r.ok && !r.repetido && r.al_corriente && r.socio.nombre === 'Ana Torres', r);
  r = await rpc(U.recep, 'gym_checkin', [G, null, 'AET-GYM:' + det.token.toUpperCase()]);
  chk('QR repetido en 2 h no duplica', r.ok && r.repetido);
  r = await rpc(U.recep, 'gym_checkin', [G, null, '2']);
  chk('socio sin pago entra con aviso', r.ok && r.al_corriente === false);
  chk('QR de otro gym', (await err(U.recep, 'gym_checkin', [G, null, String(s3.numero + 100)])) === 'socio_no_encontrado');
  chk('token ajeno', (await err(U.dueno2, 'gym_checkin', [G2, null, det.token])) === 'socio_no_encontrado');
  const res = await rpc(U.dueno, 'gym_resumen', [G]);
  chk('resumen', res.socios === 2 && res.al_corriente === 1 && res.vencidos_n === 1 && res.asistencias_hoy === 2 && Number(res.ingresos_hoy) === 450, res);
  chk('coach no ve dinero', (await rpc(U.coach, 'gym_resumen', [G])).ingresos_mes === null);
  // por vencer
  await su(`update gym_socios set vence_en = public._gym_hoy() + 3 where id = $1`, [s2.id]);
  chk('por vencer', (await rpc(U.dueno, 'gym_resumen', [G])).por_vencer.some(x => x.nombre === 'Beto Díaz' && x.estado === 'por_vencer'));
  chk('filtro vencidos/búsqueda', (await rpc(U.dueno, 'gym_socios_listar', [G, 'activos', 'ana'])).length === 1 && (await rpc(U.dueno, 'gym_socios_listar', [G, 'por_vencer', null])).length === 1);

  // Baja
  chk('recepción no da de baja', (await err(U.recep, 'gym_socio_baja', [G, s2.id, false])) === 'sin_permiso');
  await rpc(U.dueno, 'gym_socio_baja', [G, s2.id, false]);
  r = await rpc(U.recep, 'gym_checkin', [G, null, '2']);
  chk('baja no entra', r.ok === false && r.motivo === 'baja');

  // Socio en su app
  chk('código inválido', (await err(U.socio, 'socio_vincular', ['ZZZZZZ'])) === 'codigo_invalido');
  let mio = await rpc(U.socio, 'socio_vincular', [det.codigo_vincular.toLowerCase()]);
  chk('socio vinculado ve su membresía y QR', mio.length === 1 && mio[0].gym === 'Titan Gym' && mio[0].token === det.token && mio[0].numero === 1, mio);
  chk('código ya usado', (await err(U.otro, 'socio_vincular', [det.codigo_vincular])) === 'codigo_usado');
  chk('lista indica vinculado', (await rpc(U.dueno, 'gym_socios_listar', [G, 'activos', null])).find(x => x.id === s1.id).vinculado === true);
  await rpc(U.socio, 'socio_desvincular', [s1.id]);
  chk('desvincular', (await rpc(U.socio, 'socio_mio')).length === 0);

  // Límite de socios del plan
  await su(`update gym_config set valor = jsonb_set(valor, '{piloto,socios}', '2') where clave='planes'`);
  await rpc(U.dueno, 'gym_socio_baja', [G, s2.id, true]);
  chk('límite de socios del plan', (await err(U.recep, 'gym_socio_guardar', [G, { nombre: 'Tercero' }])) === 'limite_socios');

  // Suspensión: solo lectura
  await rpc(U.admin, 'admin_gym_guardar', [{ id: G, nombre: 'Titan Gym', estado: 'suspendido' }]);
  chk('suspendido: lectura sí', (await rpc(U.dueno, 'gym_resumen', [G])).socios === 2);
  chk('suspendido: escritura no', (await err(U.recep, 'gym_checkin', [G, null, '1'])) === 'gym_suspendido');
  // Cambio de dueño
  A = await rpc(U.admin, 'admin_gym_guardar', [{ id: G, nombre: 'Titan Gym', estado: 'activo', dueno_email: 'recep@x.mx' }]);
  chk('nuevo dueño', (await rpc(U.recep, 'gym_mis'))[0].rol === 'dueno' && (await rpc(U.dueno, 'gym_mis'))[0].rol === 'admin');
  console.log(`${ok} bien, ${mal} fallas`); process.exit(mal ? 1 : 0);
})().catch(e => { console.error('ERROR', e.message, e.where || ''); process.exit(2); });
