// Pruebas de la migración 009 (Aeterion Gym Pro) en Postgres local.
const { PGlite } = require('@electric-sql/pglite'); const fs = require('fs'); const path = require('path');
const U = { admin: 'a0000000-0000-0000-0000-000000000001', dueno: 'a0000000-0000-0000-0000-000000000002', recep: 'a0000000-0000-0000-0000-000000000003', coach: 'a0000000-0000-0000-0000-000000000004', socio: 'a0000000-0000-0000-0000-000000000006' };
let ok = 0, mal = 0; const chk = (n, c, x) => { if (c) ok++; else { mal++; console.log('FALLA:', n, x !== undefined ? JSON.stringify(x) : ''); } };
(async () => {
  const db = new PGlite(); const L = (f) => db.exec(fs.readFileSync(f, 'utf8'));
  await L(path.join(__dirname, 'stub_supabase.sql'));
  for (const f of ['001_coaches.sql', '003_accesos_origen.sql', '004_coach_espacio.sql', '005_gym.sql', '006_gym_pos.sql', '007_coach_v3.sql', '009_gym_pro.sql']) await L(path.join(__dirname, '..', 'sql', f));
  const su = async (q, p) => { await db.exec('reset role'); return db.query(q, p); };
  for (const [k, id] of Object.entries(U)) { await su('insert into auth.users values ($1,$2)', [id, k + '@x.mx']); await su('insert into perfiles (id,email,nombre) values ($1,$2,$3)', [id, k + '@x.mx', k]); }
  await su('insert into admins values ($1)', [U.admin]);
  const rpc = async (uid, fn, args = []) => { await db.exec('reset role'); await db.query(`select set_config('request.jwt.claims',$1,false)`, [JSON.stringify({ sub: uid })]); await db.exec('set role authenticated');
    try { return (await db.query(`select public.${fn}(${args.map((_, i) => '$' + (i + 1)).join(',')}) r`, args.map(a => a !== null && typeof a === 'object' ? JSON.stringify(a) : a))).rows[0].r; } finally { await db.exec('reset role'); } };
  const err = async (...a) => { try { await rpc(...a); return null; } catch (e) { return e.message; } };
  const G = (await rpc(U.admin, 'admin_gym_guardar', [{ nombre: 'Titan Gym', dueno_email: 'dueno@x.mx' }])).lista[0].id;
  await rpc(U.dueno, 'gym_staff_agregar', [G, 'recep@x.mx', 'recepcion']); await rpc(U.dueno, 'gym_staff_agregar', [G, 'coach@x.mx', 'coach']);
  let info = await rpc(U.dueno, 'gym_plan_guardar', [G, { nombre: 'Mensual', precio: '600', dias: '30', color: '#3b82f6' }]);
  const pMes = info.planes.find((p) => Number(p.precio) === 600);
  chk('plan con color', pMes.color === '#3b82f6');
  chk('color inválido', (await err(U.dueno, 'gym_plan_guardar', [G, { nombre: 'XX', precio: '1', dias: '1', color: 'azul' }])) === 'color_invalido');
  const hoy = (await su(`select public._gym_hoy() d`)).rows[0].d.toISOString().slice(0, 10);

  // Socio con datos extra
  chk('fecha futura', (await err(U.recep, 'gym_socio_guardar', [G, { nombre: 'X Y', fecha_nac: '2999-01-01' }])) === 'fecha_invalida');
  const s1 = await rpc(U.recep, 'gym_socio_guardar', [G, { nombre: 'Ana Torres', telefono: '5512345678', fecha_nac: '1990-' + hoy.slice(5), emergencia: 'Mamá 5599999999' }]);
  chk('socio con cumpleaños y emergencia', s1.fecha_nac === '1990-' + hoy.slice(5) && s1.emergencia === 'Mamá 5599999999');
  const s2 = await rpc(U.recep, 'gym_socio_guardar', [G, { nombre: 'Beto Díaz' }]);
  const e2 = await rpc(U.recep, 'gym_socio_guardar', [G, { id: s1.id, nombre: 'Ana Torres' }]);
  chk('editar sin tocar datos extra los conserva', e2.emergencia === 'Mamá 5599999999');
  await rpc(U.recep, 'gym_pago_registrar', [G, s1.id, pMes.id, 600, 'efectivo', null, null]);

  // Marca
  info = await rpc(U.dueno, 'gym_ajustes_guardar', [G, { color: '#22c55e', tema: 'claro', aviso_dias: '5', telefono: '55 1111 2222', logo: 'data:image/png;base64,AAA' }]);
  chk('marca guardada', info.ajustes.color === '#22c55e' && info.ajustes.tema === 'claro' && info.ajustes.logo && info.aviso_dias === 5, info.ajustes);
  info = await rpc(U.dueno, 'gym_ajustes_guardar', [G, { ticket_ancho: '58' }]);
  chk('guardar parcial conserva lo demás', info.ajustes.color === '#22c55e' && info.ajustes.logo && info.ajustes.ticket_ancho === 58);
  chk('color de marca inválido', (await err(U.dueno, 'gym_ajustes_guardar', [G, { color: 'rojo' }])) === 'color_invalido');
  chk('recepción no configura', (await err(U.recep, 'gym_ajustes_guardar', [G, { tema: 'oscuro' }])) === 'sin_permiso');

  // Control de acceso
  let r = await rpc(U.recep, 'gym_checkin', [G, null, '2']);
  chk('avisar: sin pago entra', r.ok === true && r.al_corriente === false);
  await rpc(U.dueno, 'gym_ajustes_guardar', [G, { politica_vencidos: 'bloquear' }]);
  await su(`delete from gym_asistencias`);
  r = await rpc(U.recep, 'gym_checkin', [G, null, '2']);
  chk('bloquear: sin pago no entra', r.ok === false && r.motivo === 'sin_pago');
  r = await rpc(U.recep, 'gym_checkin', [G, null, '1']);
  chk('al corriente entra', r.ok === true && r.socio.foto === null);
  let A = await rpc(U.recep, 'gym_accesos', [G, null]);
  chk('bitácora: permitidos y denegados', A.permitidos === 1 && A.denegados === 1 && A.lista.length === 2 && A.por_hora.length === 24, A);

  // Congelar
  chk('recepción no congela', (await err(U.recep, 'gym_socio_congelar', [G, s1.id, 10, 'viaje'])) === 'sin_permiso');
  chk('no vigente no se congela', (await err(U.dueno, 'gym_socio_congelar', [G, s2.id, 10, 'viaje'])) === 'no_vigente');
  const antes = (await rpc(U.dueno, 'gym_socio_detalle', [G, s1.id])).vence_en;
  r = await rpc(U.dueno, 'gym_socio_congelar', [G, s1.id, 10, 'Viaje']);
  const mas = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  chk('congelar suma días y cambia estado', r.estado === 'congelado' && r.vence_en === mas(antes, 10) && r.congelado_hasta === mas(hoy, 9), r);
  chk('ya congelado', (await err(U.dueno, 'gym_socio_congelar', [G, s1.id, 5, ''])) === 'ya_congelado');
  await su(`delete from gym_asistencias`);
  r = await rpc(U.recep, 'gym_checkin', [G, null, '1']);
  chk('congelado no entra', r.ok === false && r.motivo === 'congelado');
  r = await rpc(U.dueno, 'gym_socio_descongelar', [G, s1.id]);
  chk('descongelar devuelve los días no usados', r.vence_en === antes && r.estado !== 'congelado', r);

  // Panel
  await rpc(U.dueno, 'gym_ajustes_guardar', [G, { politica_vencidos: 'avisar' }]);
  await rpc(U.recep, 'gym_checkin', [G, null, '1']);
  const prod = await rpc(U.dueno, 'gym_producto_guardar', [G, { nombre: 'Agua', precio: '15', existencia: '1', minimo: '2' }]);
  await rpc(U.recep, 'gym_venta_crear', [G, [{ producto_id: prod.id, cantidad: 1 }], 0, 'efectivo', null, s1.id, null]);
  let P = await rpc(U.dueno, 'gym_panel', [G]);
  chk('panel: kpis', P.socios === 2 && P.vigentes === 1 && P.asis_hoy === 1 && Number(P.ingresos_mes) === 615 && Number(P.ingresos_hoy) === 615 && P.cumple_hoy === 1 && P.stock_bajo === 1, P);
  chk('panel: series', P.serie_asis.length === 7 && P.serie_ing.length === 30 && Number(P.serie_ing[29].m) === 600 && Number(P.serie_ing[29].v) === 15, P.serie_ing.slice(-1));
  chk('panel: membresías con color', P.membresias[0].color === '#3b82f6');
  const tipos = P.actividad.map((a) => a.t);
  chk('panel: actividad reciente', ['entrada', 'denegado', 'pago', 'venta', 'alta'].every((t) => tipos.includes(t)), tipos);
  chk('panel: últimos socios', P.ultimos.length === 2 && P.ultimos[0].nombre === 'Beto Díaz');
  P = await rpc(U.coach, 'gym_panel', [G]);
  chk('entrenador no ve dinero', P.ingresos_mes === null && P.serie_ing === null && P.actividad.every((a) => a.monto == null));

  // Pagos y deudores
  await rpc(U.recep, 'gym_pago_registrar', [G, s2.id, pMes.id, 200, 'tarjeta', null, 600]);
  let PG = await rpc(U.dueno, 'gym_pagos_listar', [G, null, null, null]);
  chk('pagos y deudores', PG.pagos.length === 2 && Number(PG.total) === 800 && PG.deudores.length === 1 && Number(PG.deudores[0].saldo) === 400 && PG.pagos[0].por === 'recep', PG);
  chk('filtro por método', (await rpc(U.dueno, 'gym_pagos_listar', [G, null, null, 'tarjeta'])).pagos.length === 1);
  chk('entrenador sin pagos', (await err(U.coach, 'gym_pagos_listar', [G, null, null, null])) === 'sin_permiso');

  // Membresías
  const M = await rpc(U.dueno, 'gym_membresias', [G]);
  const mm = M.find((x) => Number(x.precio) === 600);
  chk('membresías con números', mm.vigentes === 2 && mm.vendidas_mes === 2 && Number(mm.ingresos_mes) === 800, mm);
  chk('recepción ve membresías sin dinero', (await rpc(U.recep, 'gym_membresias', [G])).find((x) => Number(x.precio) === 600).ingresos_mes === null);

  // Notificaciones
  await su(`update gym_socios set vence_en = public._gym_hoy() where id = $1`, [s2.id]);
  const N = await rpc(U.recep, 'gym_notificaciones', [G]);
  chk('notificaciones', N.vencen_hoy.length === 1 && N.cumpleanos.length === 1 && N.saldos.length === 1 && N.stock.length === 1, { h: N.vencen_hoy.length, c: N.cumpleanos.length, s: N.saldos.length, st: N.stock.length });
  chk('aviso por gimnasio (5 días)', (await rpc(U.dueno, 'gym_info', [G])).aviso_dias === 5);

  // Socio ve la marca
  const det = await rpc(U.dueno, 'gym_socio_detalle', [G, s1.id]);
  await rpc(U.socio, 'socio_vincular', [det.codigo_vincular]);
  const mio = await rpc(U.socio, 'socio_mio');
  chk('socio ve logo y color de su gimnasio', mio[0].gym_color === '#22c55e' && mio[0].gym_logo && mio[0].gym_telefono === '55 1111 2222');
  chk('tablas nuevas cerradas', /permission denied/.test(await (async () => { await db.exec('set role authenticated'); try { await db.query('select * from gym_accesos_denegados'); return ''; } catch (x) { return x.message; } finally { await db.exec('reset role'); } })()));
  console.log(`${ok} bien, ${mal} fallas`); process.exit(mal ? 1 : 0);
})().catch(e => { console.error('ERROR', e.message, e.where || ''); process.exit(2); });
