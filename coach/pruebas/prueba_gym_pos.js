// Pruebas de la migración 006 (abonos, punto de venta, inventario, reportes) en Postgres local.
const { PGlite } = require('@electric-sql/pglite'); const fs = require('fs'); const path = require('path');
const U = { admin: 'a0000000-0000-0000-0000-000000000001', dueno: 'a0000000-0000-0000-0000-000000000002', recep: 'a0000000-0000-0000-0000-000000000003',
  coach: 'a0000000-0000-0000-0000-000000000004', dueno2: 'a0000000-0000-0000-0000-000000000005', socio: 'a0000000-0000-0000-0000-000000000006' };
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

  const G = (await rpc(U.admin, 'admin_gym_guardar', [{ nombre: 'Titan Gym', dueno_email: 'dueno@x.mx' }])).lista[0].id;
  const G2 = (await rpc(U.admin, 'admin_gym_guardar', [{ nombre: 'Otro Gym', dueno_email: 'dueno2@x.mx' }])).lista.find(g => g.nombre === 'Otro Gym').id;
  await rpc(U.dueno, 'gym_staff_agregar', [G, 'recep@x.mx', 'recepcion']); await rpc(U.dueno, 'gym_staff_agregar', [G, 'coach@x.mx', 'coach']);
  let info = await rpc(U.dueno, 'gym_plan_guardar', [G, { nombre: 'Mensual', precio: '600', dias: '30' }]);
  const pMes = info.planes.find(p => Number(p.precio) === 600).id;
  const s1 = await rpc(U.recep, 'gym_socio_guardar', [G, { nombre: 'Ana Torres' }]);

  // Foto
  chk('foto inválida', (await err(U.recep, 'gym_socio_foto', [G, s1.id, 'http://x/y.png'])) === 'foto_invalida');
  let r = await rpc(U.recep, 'gym_socio_foto', [G, s1.id, 'data:image/jpeg;base64,AAAA']);
  chk('foto guardada (no viaja en listas)', r.tiene_foto === true && r.foto === undefined);
  chk('foto en detalle', (await rpc(U.dueno, 'gym_socio_detalle', [G, s1.id])).foto === 'data:image/jpeg;base64,AAAA');
  chk('foto en entrada', (await rpc(U.recep, 'gym_checkin', [G, null, '1'])).socio.foto === 'data:image/jpeg;base64,AAAA');

  // Pago parcial y abonos
  chk('pagado mayor que total', (await err(U.recep, 'gym_pago_registrar', [G, s1.id, pMes, 700, 'efectivo', null, 600])) === 'monto_invalido');
  r = await rpc(U.recep, 'gym_pago_registrar', [G, s1.id, pMes, 200, 'efectivo', null, 600]);
  chk('pago parcial deja saldo y extiende', Number(r.saldo) === 400 && r.estado === 'al_corriente', r);
  let det = await rpc(U.recep, 'gym_socio_detalle', [G, s1.id]);
  const pago = det.pagos[0];
  chk('detalle muestra total y abonado', Number(pago.total) === 600 && Number(pago.abonado) === 200);
  chk('abono mayor al saldo', (await err(U.recep, 'gym_abono_registrar', [G, pago.id, 401, 'efectivo'])) === 'monto_invalido');
  r = await rpc(U.recep, 'gym_abono_registrar', [G, pago.id, 150, 'transferencia']);
  chk('abono baja el saldo', Number(r.saldo) === 250, r.saldo);
  det = await rpc(U.recep, 'gym_socio_detalle', [G, s1.id]);
  chk('abono en detalle', det.pagos.some(p => p.pago_de === pago.id && Number(p.monto) === 150) && Number(det.pagos.find(p => p.id === pago.id).abonado) === 350);
  chk('coach no abona', (await err(U.coach, 'gym_abono_registrar', [G, pago.id, 10, 'efectivo'])) === 'sin_permiso');
  const res0 = await rpc(U.dueno, 'gym_resumen', [G]);
  chk('resumen: con saldo e ingresos', res0.con_saldo === 1 && Number(res0.ingresos_hoy) === 350, res0);
  chk('serie de asistencias 7 días', res0.serie_asis.length === 7 && res0.serie_asis[6].n === 1, res0.serie_asis);
  chk('distribución de membresías', res0.membresias[0].plan === 'Mensual' && res0.membresias[0].n === 1);

  // Productos e inventario
  chk('recepción no crea productos', (await err(U.recep, 'gym_producto_guardar', [G, { nombre: 'Agua', precio: '15' }])) === 'sin_permiso');
  const agua = await rpc(U.dueno, 'gym_producto_guardar', [G, { nombre: 'Agua 1L', codigo: '7501', precio: '15', costo: '7', existencia: '10', minimo: '3' }]);
  const prot = await rpc(U.dueno, 'gym_producto_guardar', [G, { nombre: 'Proteína scoop', precio: '40', costo: '18', existencia: '2' }]);
  chk('código repetido', (await err(U.dueno, 'gym_producto_guardar', [G, { nombre: 'Otra agua', codigo: '7501', precio: '15' }])) === 'codigo_repetido');
  let LP = await rpc(U.recep, 'gym_productos_listar', [G, null]);
  chk("recepción lista sin costo", LP.length === 2 && LP[0].costo === null);
  chk('buscar por código', (await rpc(U.recep, 'gym_productos_listar', [G, '7501'])).length === 1);
  chk('otro gym no ve', (await err(U.dueno2, 'gym_productos_listar', [G, null])) === 'sin_permiso');
  r = await rpc(U.dueno, 'gym_inventario_mov', [G, prot.id, 'entrada', 8, 'Compra a proveedor']);
  chk('entrada de mercancía', r.existencia === 10);
  chk('ajuste sin motivo', (await err(U.dueno, 'gym_inventario_mov', [G, prot.id, 'ajuste', 9, null])) === 'falta_motivo');
  r = await rpc(U.dueno, 'gym_inventario_mov', [G, prot.id, 'ajuste', 9, 'Conteo físico']);
  chk('ajuste por conteo', r.existencia === 9);

  // Venta
  chk('venta vacía', (await err(U.recep, 'gym_venta_crear', [G, [], 0, 'efectivo', null, null, null])) === 'venta_vacia');
  chk('sin existencia', /^sin_existencia/.test(await err(U.recep, 'gym_venta_crear', [G, [{ producto_id: agua.id, cantidad: 11 }], 0, 'efectivo', null, null, null])));
  chk('venta fallida no descuenta', (await rpc(U.recep, 'gym_productos_listar', [G, '7501']))[0].existencia === 10);
  chk('descuento mayor', (await err(U.recep, 'gym_venta_crear', [G, [{ producto_id: agua.id, cantidad: 1 }], 20, 'efectivo', null, null, null])) === 'descuento_invalido');
  let v = await rpc(U.recep, 'gym_venta_crear', [G, [{ producto_id: agua.id, cantidad: 2 }, { producto_id: prot.id, cantidad: 1 }], 5, 'efectivo', 100, s1.id, null]);
  chk('venta con folio, total y cambio', v.folio === 1 && Number(v.subtotal) === 70 && Number(v.total) === 65 && Number(v.cambio) === 35 && v.items.length === 2 && v.socio.nombre === 'Ana Torres' && v.vendedor === 'recep', v);
  chk('existencia descontada', (await rpc(U.recep, 'gym_productos_listar', [G, '7501']))[0].existencia === 8);
  const v2 = await rpc(U.dueno, 'gym_venta_crear', [G, [{ producto_id: agua.id, cantidad: 1 }], 0, 'tarjeta', null, null, null]);
  chk('folio consecutivo', v2.folio === 2);
  chk('pago con solo en efectivo', (await err(U.recep, 'gym_venta_crear', [G, [{ producto_id: agua.id, cantidad: 1 }], 0, 'tarjeta', 100, null, null])) === 'pago_con_invalido');
  chk('folio por gym', (await rpc(U.dueno2, 'gym_venta_crear', [G2, [{ producto_id: (await rpc(U.dueno2, 'gym_producto_guardar', [G2, { nombre: 'Barra', precio: '30', existencia: '5' }])).id, cantidad: 1 }], 0, 'efectivo', null, null, null])).folio === 1);
  chk('producto de otro gym', (await err(U.recep, 'gym_venta_crear', [G, [{ producto_id: 999, cantidad: 1 }], 0, 'efectivo', null, null, null])) === 'producto_no_encontrado');
  let caja = await rpc(U.recep, 'gym_caja', [G, null, null]);
  chk('caja incluye ventas y abonos', Number(caja.total) === 350 + 65 + 15 && Number(caja.ventas) === 80 && Number(caja.membresias) === 350 && caja.pagos.length === 4, caja);
  chk('recepción no cancela', (await err(U.recep, 'gym_venta_cancelar', [G, v.id, 'error'])) === 'sin_permiso');
  r = await rpc(U.dueno, 'gym_venta_cancelar', [G, v.id, 'Devolución']);
  chk('cancelada', r.cancelada === true);
  chk('cancelación devuelve existencia', (await rpc(U.recep, 'gym_productos_listar', [G, '7501']))[0].existencia === 9);
  chk('no se cancela dos veces', (await err(U.dueno, 'gym_venta_cancelar', [G, v.id, 'otra vez'])) === 'venta_no_encontrada');
  const movs = await rpc(U.dueno, 'gym_inventario_movs', [G, agua.id]);
  chk('kardex', movs.length === 4 && movs[0].tipo === 'cancelacion', movs.map(m => m.tipo));
  chk('ventas listadas', (await rpc(U.recep, 'gym_ventas_listar', [G, null, null])).length === 2);
  chk('reimpresión', (await rpc(U.recep, 'gym_venta_detalle', [G, v2.id])).items[0].nombre === 'Agua 1L');
  chk('compras en ficha', (await rpc(U.recep, 'gym_socio_detalle', [G, s1.id])).compras.length === 1);

  // Reporte
  chk('recepción sin reportes', (await err(U.recep, 'gym_reporte', [G, null, null])) === 'sin_permiso');
  const rep = await rpc(U.dueno, 'gym_reporte', [G, null, null]);
  chk('reporte', Number(rep.membresias) === 350 && Number(rep.ventas) === 15 && Number(rep.costo_ventas) === 7 && rep.num_ventas === 1 && rep.serie.length === 30 && rep.top_productos[0].nombre === 'Agua 1L' && rep.altas === 1, rep);
  chk('stock bajo', (await rpc(U.dueno, 'gym_resumen', [G])).stock_bajo === 0);
  await rpc(U.dueno, 'gym_inventario_mov', [G, agua.id, 'ajuste', 2, 'Merma']);
  chk('stock bajo cuenta', (await rpc(U.dueno, 'gym_resumen', [G])).stock_bajo === 1);

  // Anular pago principal anula sus abonos
  r = await rpc(U.dueno, 'gym_pago_anular', [G, pago.id, 'Error de captura']);
  chk('anular principal anula abonos', Number(r.saldo) === 0 && r.vence_en === null, r);

  // Exportar
  chk('exportar socios', (await rpc(U.dueno, 'gym_exportar', [G, 'socios', null, null]))[0]['Nombre'] === 'Ana Torres');
  chk('exportar ventas', (await rpc(U.dueno, 'gym_exportar', [G, 'ventas', null, null])).length === 3);
  chk('exportar inválido', (await err(U.dueno, 'gym_exportar', [G, 'x', null, null])) === 'tipo_invalido');
  chk('recepción no exporta', (await err(U.recep, 'gym_exportar', [G, 'socios', null, null])) === 'sin_permiso');

  // Ajustes de ticket
  info = await rpc(U.dueno, 'gym_ajustes_guardar', [G, { ticket_ancho: '58', ticket_pie: 'Gracias', rfc: 'abc010101xyz' }]);
  chk('ajustes', info.ajustes.ticket_ancho === 58 && info.ajustes.rfc === 'ABC010101XYZ');

  // Socio en su app
  const mi = await rpc(U.dueno, 'gym_socio_detalle', [G, s1.id]);
  await rpc(U.socio, 'socio_vincular', [mi.codigo_vincular]);
  await rpc(U.recep, 'gym_pago_registrar', [G, s1.id, pMes, 600, 'efectivo', null, null]);
  const mio = await rpc(U.socio, 'socio_mio');
  chk('socio ve pagos, asistencias del mes y precio', mio[0].pagos.length >= 1 && mio[0].asistencias_mes === 1 && Number(mio[0].precio_plan) === 600 && mio[0].foto, mio[0]);
  chk('tablas nuevas cerradas', /permission denied/.test(await (async () => { await db.exec('set role authenticated'); try { await db.query('select * from gym_ventas'); return ''; } catch (x) { return x.message; } finally { await db.exec('reset role'); } })()));
  console.log(`${ok} bien, ${mal} fallas`); process.exit(mal ? 1 : 0);
})().catch(e => { console.error('ERROR', e.message, e.where || ''); process.exit(2); });
