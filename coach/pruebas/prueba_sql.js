// Pruebas de la migración de coaches en un Postgres local (PGlite). No toca producción.
const { PGlite } = require('@electric-sql/pglite');
const fs = require('fs');
const path = require('path');

const U = {
  admin: '00000000-0000-0000-0000-00000000000a',
  coach: '00000000-0000-0000-0000-0000000000c1',
  coach2: '00000000-0000-0000-0000-0000000000c2',
  cli: '00000000-0000-0000-0000-0000000000e1',
  cli2: '00000000-0000-0000-0000-0000000000e2',
  extra: '00000000-0000-0000-0000-0000000000e3',
};
let ok = 0, fallos = 0;
function check(nombre, cond, extra) {
  if (cond) { ok++; } else { fallos++; console.log('FALLA:', nombre, extra !== undefined ? JSON.stringify(extra) : ''); }
}

(async () => {
  const db = new PGlite();
  await db.exec(fs.readFileSync(path.join(__dirname, 'stub_supabase.sql'), 'utf8'));
  await db.exec(fs.readFileSync(path.join(__dirname, '..', 'sql', '001_coaches.sql'), 'utf8'));
  await db.exec(fs.readFileSync(path.join(__dirname, '..', 'sql', '003_accesos_origen.sql'), 'utf8'));

  const su = async (sql, params) => { await db.exec('reset role'); return db.query(sql, params); };
  for (const [k, id] of Object.entries(U)) {
    await su(`insert into auth.users values ($1, $2)`, [id, k + '@prueba.mx']);
    await su(`insert into perfiles (id, email, nombre) values ($1, $2, $3)`, [id, k + '@prueba.mx', k === 'cli' ? 'Ana Torres' : k]);
  }
  await su(`insert into admins values ($1)`, [U.admin]);

  const como = async (uid, sql, params) => {
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claims', $1, false)`, [uid ? JSON.stringify({ sub: uid, role: 'authenticated' }) : '']);
    await db.exec(uid ? 'set role authenticated' : 'set role anon');
    try { return await db.query(sql, params); } finally { await db.exec('reset role'); }
  };
  const rpc = async (uid, fn, args = []) => {
    const ph = args.map((_, i) => '$' + (i + 1)).join(',');
    const r = await como(uid, `select public.${fn}(${ph}) as r`, args);
    return r.rows[0].r;
  };
  const err = async (uid, fn, args = []) => {
    try { await rpc(uid, fn, args); return null; } catch (e) { return e.message; }
  };

  // 1. Interruptor apagado: nadie (salvo admin/testers) puede usarlo
  check('apagado bloquea', (await err(U.coach, 'coach_guardar', [JSON.stringify({ nombre_publico: 'X' })])) === 'coach_no_disponible');
  const est0 = await rpc(U.cli, 'coach_estado');
  check('estado dice no disponible', est0.disponible === false, est0);
  check('anon no ejecuta', /permission denied/.test(await err(null, 'coach_estado') || ''));

  // Testers
  check('no admin no cambia config', (await err(U.coach, 'admin_coach_config', ['activo', 'true'])) === 'solo_admin');
  await rpc(U.admin, 'admin_coach_config', ['testers', JSON.stringify([U.coach, U.coach2, U.cli, U.cli2])]);
  check('tester disponible', (await rpc(U.cli, 'coach_estado')).disponible === true);
  check('no tester sigue fuera', (await rpc(U.extra, 'coach_estado')).disponible === false);

  // 2. Solicitud del coach
  check('precio sobre tope', (await err(U.coach, 'coach_guardar', [JSON.stringify({ nombre_publico: 'Daniela Ruiz', precio_sesion: 400 })])) === 'precio_sobre_tope');
  check('rfc inválido', (await err(U.coach, 'coach_guardar', [JSON.stringify({ rfc: 'ABC' })])) === 'rfc_invalido');
  let e = await rpc(U.coach, 'coach_guardar', [JSON.stringify({ nombre_publico: 'Daniela Ruiz', bio: 'Fuerza con técnica primero.',
    especialidades: ['Fuerza', 'Hipertrofia', ' '], modalidades: ['presencial', 'linea', 'otra'], zona: 'Coyoacán',
    precio_sesion: 300, precio_mensual: 800, rfc: 'ruda900101ab1', experiencia_anios: 6 })]);
  check('coach creado en borrador', e.coach.estado === 'borrador' && e.coach.rfc === 'RUDA900101AB1', e.coach);
  check('especialidades limpias', JSON.stringify(e.coach.especialidades) === '["Fuerza","Hipertrofia"]', e.coach.especialidades);
  check('modalidades filtradas', JSON.stringify(e.coach.modalidades) === '["presencial","linea"]');
  check('tope visible', Number(e.coach.tope_sesion) === 350);

  check('enviar sin términos', (await err(U.coach, 'coach_enviar_revision')) === 'faltan_terminos');
  await rpc(U.coach, 'coach_guardar', [JSON.stringify({ acepto_terminos: true })]);
  check('enviar sin documentos', (await err(U.coach, 'coach_enviar_revision')) === 'faltan_documentos');
  check('archivo de otra carpeta', (await err(U.coach, 'coach_documento_agregar', ['identificacion', 'INE', null, U.cli + '/ine.pdf', null])) === 'archivo_invalido');
  await rpc(U.coach, 'coach_documento_agregar', ['identificacion', 'INE', 'INE', U.coach + '/ine.pdf', null]);
  e = await rpc(U.coach, 'coach_documento_agregar', ['certificacion', 'Entrenador personal certificado', 'NSCA', U.coach + '/nsca.pdf', '2027-03-01']);
  check('dos documentos', e.coach.documentos.length === 2);
  check('falta pago', (await err(U.coach, 'coach_enviar_revision')) === 'falta_pago');
  // El servidor registra el pago del primer mes
  check('usuario no registra pagos', /permission denied/.test(await err(U.coach, 'coach_membresia_registrar', [U.coach, 'primer_mes', 349, 'x', new Date().toISOString()]) || ''));
  const fin = new Date(Date.now() + 30 * 864e5).toISOString();
  await su(`select public.coach_membresia_registrar($1,'primer_mes',349,'cs_test_1',$2)`, [U.coach, fin]);
  const dup = (await su(`select public.coach_membresia_registrar($1,'primer_mes',349,'cs_test_1',$2) r`, [U.coach, fin])).rows[0].r;
  check('pago duplicado ignorado', dup.duplicado === true);
  e = await rpc(U.coach, 'coach_enviar_revision');
  check('en revisión', e.coach.estado === 'revision');
  check('premium aún no (no aprobado)', (await su(`select count(*)::int n from accesos where user_id=$1`, [U.coach])).rows[0].n === 0);

  // 3. RLS: otro usuario no ve al coach ni sus documentos
  const vis = await como(U.cli, `select count(*)::int n from coaches`);
  check('RLS coaches', vis.rows[0].n === 0);
  const visd = await como(U.cli, `select count(*)::int n from coach_documentos`);
  check('RLS documentos', visd.rows[0].n === 0);
  check('cliente no escribe directo', /permission denied/.test(await como(U.cli, `update coaches set nivel=3`).then(() => '', x => x.message)));
  check('coach no se sube de nivel', /permission denied/.test(await como(U.coach, `update coaches set nivel=3 where user_id='${U.coach}'`).then(() => '', x => x.message)));

  // 4. Admin aprueba
  let d = await rpc(U.admin, 'admin_coach_detalle', [U.coach]);
  check('admin ve detalle', d.email === 'coach@prueba.mx' && d.documentos.length === 2);
  check('aprobar sin validar docs', (await err(U.admin, 'admin_coach_decidir', [U.coach, 'aprobar', null, null])) === 'documentos_sin_validar');
  for (const doc of d.documentos) await rpc(U.admin, 'admin_coach_documento', [doc.id, 'valido', null]);
  d = await rpc(U.admin, 'admin_coach_decidir', [U.coach, 'aprobar', null, null]);
  check('aprobado', d.estado === 'activo' && /^DANIEL\d{3}$/.test(d.codigo), d.codigo);
  const acc = (await su(`select origen, hasta from accesos where user_id=$1 and revocado_en is null`, [U.coach])).rows;
  check('premium personal creado', acc.length === 1 && acc[0].origen === 'coach');
  const codigo = d.codigo;

  // 5. Directorio y perfil
  let dir = await rpc(U.cli, 'coach_directorio', [null, null, null, 30, 0]);
  check('directorio muestra coach', dir.length === 1 && dir[0].nombre === 'Daniela Ruiz' && dir[0].credenciales.length === 1, dir);
  check('directorio sin rfc ni teléfono', !('rfc' in dir[0]) && !('telefono' in dir[0]));
  check('filtro especialidad', (await rpc(U.cli, 'coach_directorio', [null, 'Yoga', null, 30, 0])).length === 0);
  check('filtro texto', (await rpc(U.cli, 'coach_directorio', ['coyo', null, null, 30, 0])).length === 1);
  check('coach no se ve a sí mismo', (await rpc(U.coach, 'coach_directorio', [null, null, null, 30, 0])).length === 0);

  // 6. Vínculo con permisos
  check('modalidad no ofrecida', (await err(U.cli, 'vinculo_solicitar', [U.coach2, 'presencial', '{}'])) === 'coach_no_encontrado');
  e = await rpc(U.cli, 'vinculo_solicitar', [U.coach, 'presencial', JSON.stringify({ entrenos: true, medidas: true, mente: 'sí' })]);
  check('vínculo pendiente', e.mi_coach.estado === 'pendiente');
  check('mente apagada si no es booleano', e.mi_coach.permisos.mente === false && e.mi_coach.permisos.comidas === false, e.mi_coach.permisos);
  check('un solo coach', (await err(U.cli, 'vinculo_solicitar', [U.coach, 'presencial', '{}'])) === 'ya_tienes_coach');
  const vinc = e.mi_coach.vinculo;
  check('sin datos antes de aceptar', (await err(U.coach, 'coach_cliente_datos', [U.cli])) === 'sin_permiso');
  await rpc(U.coach, 'vinculo_responder', [vinc, true]);
  const cl = await rpc(U.coach, 'coach_mis_clientes');
  check('cliente listado con nombre', cl.length === 1 && cl[0].nombre === 'Ana Torres' && !('email' in cl[0]));

  // Progreso del cliente: solo categorías autorizadas
  for (const [k, v] of [['gym_registro_series', '{"a":1}'], ['medidas_historial', '[1]'], ['dieta_sano', '{}'], ['aet_mente', '{"diario":"secreto"}'], ['aet_inicio', '1']])
    await su(`insert into progreso (user_id, clave, valor) values ($1,$2,$3)`, [U.cli, k, v]);
  let datos = await rpc(U.coach, 'coach_cliente_datos', [U.cli]);
  check('ve entrenos y medidas', 'gym_registro_series' in datos.datos && 'medidas_historial' in datos.datos);
  check('no ve comidas ni mente', !('dieta_sano' in datos.datos) && !('aet_mente' in datos.datos) && !('aet_inicio' in datos.datos), Object.keys(datos.datos));
  await rpc(U.cli, 'vinculo_permisos', [JSON.stringify({ entrenos: false, mente: true })]);
  datos = await rpc(U.coach, 'coach_cliente_datos', [U.cli]);
  check('permisos cambian al momento', !('gym_registro_series' in datos.datos) && 'aet_mente' in datos.datos, Object.keys(datos.datos));
  check('otro coach no ve', (await err(U.coach2, 'coach_cliente_datos', [U.cli])) !== null);
  check('RLS progreso intacto', (await como(U.coach, `select count(*)::int n from progreso`)).rows[0].n === 0);

  // 7. Sesiones
  const en = h => new Date(Date.now() + h * 3600e3).toISOString();
  check('precio de sesión sobre tope', (await err(U.coach, 'sesion_crear', [vinc, en(48), 60, 500, null])) === 'precio_sobre_tope');
  check('fecha pasada', (await err(U.coach, 'sesion_crear', [vinc, en(-1), 60, 300, null])) === 'fecha_invalida');
  const s1 = (await rpc(U.coach, 'sesion_crear', [vinc, en(48), 60, 300, 'Pierna'])).id;
  const s2 = (await rpc(U.coach, 'sesion_crear', [vinc, en(10), 60, 300, null])).id;
  const s3 = (await rpc(U.coach, 'sesion_crear', [vinc, en(72), 60, 300, null])).id;
  check('cliente no crea sesiones', (await err(U.cli, 'sesion_crear', [vinc, en(48), 60, 300, null])) !== null);
  // El servidor marca pagadas (webhook)
  await su(`update coach_sesiones set estado='pagada', pagada_en=now() where id = any($1)`, [[s1, s2, s3]]);
  let c1 = await rpc(U.cli, 'sesion_cancelar', [s1]);
  check('cancelar con 48h = reembolso', c1.reembolso === true && c1.estado === 'cancelada_cliente');
  c1 = await rpc(U.cli, 'sesion_cancelar', [s2]);
  check('cancelar con 10h = sin reembolso', c1.reembolso === false);
  c1 = await rpc(U.coach, 'sesion_cancelar', [s3]);
  check('coach cancela = reembolso y falta', c1.reembolso === true && c1.estado === 'cancelada_coach');
  check('una falta', (await rpc(U.coach, 'coach_estado')).coach.faltas === 1);
  check('otro no cancela', (await err(U.cli2, 'sesion_cancelar', [s1])) === 'sesion_no_encontrada');

  // Sesión pasada: cerrar, calificar, reportar
  const pasada = (await su(`insert into coach_sesiones (coach_id, cliente_id, vinculo_id, inicio, modalidad, precio, estado, pagada_en)
    values ($1,$2,$3, now() - interval '2 hours', 'presencial', 300, 'pagada', now() - interval '3 days') returning id`, [U.coach, U.cli, vinc])).rows[0].id;
  check('calificar antes de dada', (await err(U.cli, 'sesion_calificar', [pasada, 5, 'x'])) === 'no_se_puede_calificar');
  await rpc(U.coach, 'sesion_cerrar', [pasada, 'dada']);
  await rpc(U.cli, 'sesion_calificar', [pasada, 5, 'Excelente técnica']);
  check('no califica dos veces', (await err(U.cli, 'sesion_calificar', [pasada, 1, 'x'])) === 'no_se_puede_calificar');
  const perfil = await rpc(U.cli, 'coach_perfil', [U.coach]);
  check('calificación pública', Number(perfil.calificacion.promedio) === 5 && perfil.resenas_recientes[0].cliente === 'Ana');
  // Disputa y faltas -> suspensión automática a la 3a
  for (let i = 0; i < 2; i++) {
    const p = (await su(`insert into coach_sesiones (coach_id, cliente_id, vinculo_id, inicio, modalidad, precio, estado, pagada_en)
      values ($1,$2,$3, now() - interval '3 hours', 'presencial', 300, 'pagada', now() - interval '2 days') returning id`, [U.coach, U.cli, vinc])).rows[0].id;
    await rpc(U.cli, 'sesion_reportar', [p, 'No llegó']);
    await rpc(U.admin, 'admin_sesion_resolver', [p, true]);
  }
  e = await rpc(U.coach, 'coach_estado');
  check('3 faltas suspende', e.coach.estado === 'suspendido' && e.coach.faltas === 3, e.coach);
  check('premium revocado al suspender', (await su(`select count(*)::int n from accesos where user_id=$1 and revocado_en is null`, [U.coach])).rows[0].n === 0);
  check('suspendido sale del directorio', (await rpc(U.cli2, 'coach_directorio', [null, null, null, 30, 0])).length === 0);
  await rpc(U.admin, 'admin_coach_decidir', [U.coach, 'reactivar', null, null]);
  check('reactivado con premium', (await su(`select count(*)::int n from accesos where user_id=$1 and revocado_en is null`, [U.coach])).rows[0].n === 1);

  // 8. Comisiones
  const reg = async (cli, tipo, ref, base) => (await su(`select public.coach_comision_registrar($1,$2,$3,$4) r`, [cli, tipo, ref, base])).rows[0].r;
  check('cliente vinculado = referido', (await reg(U.cli, 'premium_nueva', 'pi_1', 53.06)).registrada === true);
  check('referencia duplicada', (await reg(U.cli, 'premium_nueva', 'pi_1', 53.06)).registrada === false);
  check('sin coach no hay comisión', (await reg(U.cli2, 'producto', 'pi_2', 399)).motivo === 'sin_coach');
  check('código propio rechazado', (await err(U.coach, 'coach_usar_codigo', [codigo])) === 'no_contigo');
  check('código inválido', (await err(U.cli2, 'coach_usar_codigo', ['NOEXISTE'])) === 'codigo_invalido');
  check('código válido', (await rpc(U.cli2, 'coach_usar_codigo', [codigo.toLowerCase()])).aplicado === true);
  await reg(U.cli2, 'producto', 'pi_3', 399);
  await reg(U.cli2, 'producto', 'pi_4', 399);
  await reg(U.cli2, 'producto', 'pi_5', 399);
  let k = await rpc(U.coach, 'coach_mis_comisiones');
  check('pendiente suma', Math.abs(Number(k.pendiente) - (15.92 + 39.9 * 3)) < 0.01, k.pendiente);
  // Reembolso de un producto antes de validar
  await su(`select public.coach_comision_cancelar('pi_5','reembolso')`);
  // Adelantar el tiempo de validación
  await su(`update coach_comisiones set valida_desde = now() - interval '1 day'`);
  let proc = (await su(`select public.coach_procesar_comisiones('2026-11') r`)).rows[0].r;
  check('validadas', proc.validadas === 3, proc);
  check('bajo el mínimo no liquida', proc.liquidaciones === 0);
  for (let i = 6; i < 12; i++) await reg(U.cli2, 'producto', 'pi_' + i, 399);
  await su(`update coach_comisiones set valida_desde = now() - interval '1 day'`);
  proc = (await su(`select public.coach_procesar_comisiones('2026-11') r`)).rows[0].r;
  check('liquida al pasar el mínimo', proc.liquidaciones === 1, proc);
  const liq = await rpc(U.admin, 'admin_coach_liquidaciones');
  check('liquidación correcta', liq.length === 1 && Math.abs(Number(liq[0].monto) - (15.92 + 39.9 * 8)) < 0.01, liq);
  await rpc(U.admin, 'admin_coach_liquidacion_pagada', [liq[0].id, 'SPEI 123', 'FAC-1']);
  // Contracargo de algo ya pagado -> descuento
  await su(`select public.coach_comision_cancelar('pi_3','contracargo')`);
  k = await rpc(U.coach, 'coach_mis_comisiones');
  check('descuento por contracargo', Math.abs(Number(k.validada) + 39.9) < 0.01, k.validada);
  check('comisiones RLS', (await como(U.coach2, `select count(*)::int n from coach_comisiones`)).rows[0].n === 0);

  // 9. Terminar vínculo: sesiones futuras pagadas se reembolsan
  const fut = (await rpc(U.coach, 'sesion_crear', [vinc, en(30), 60, 300, null])).id;
  await su(`update coach_sesiones set estado='pagada', pagada_en=now() where id=$1`, [fut]);
  await rpc(U.cli, 'vinculo_terminar', [vinc]);
  const sf = (await su(`select estado, reembolso from coach_sesiones where id=$1`, [fut])).rows[0];
  check('terminar reembolsa futuras', sf.estado === 'cancelada_cliente' && sf.reembolso === 'pendiente', sf);
  check('cambiar de coach quita atribución', (await reg(U.cli, 'premium_renovacion', 'pi_r1', 53.06)).motivo === 'sin_coach');
  check('sin acceso tras terminar', (await err(U.coach, 'coach_cliente_datos', [U.cli])) === 'sin_permiso');

  // 10. Membresía vencida -> suspensión tras gracia
  await su(`update coaches set membresia_hasta = now() - interval '8 days' where user_id=$1`, [U.coach]);
  const rm = (await su(`select public.coach_revisar_membresias() r`)).rows[0].r;
  check('suspende por no pago', rm.suspendidos === 1);
  await su(`select public.coach_membresia_registrar($1,'mensual',349,'in_2',now() + interval '30 days')`, [U.coach]);
  check('pago reactiva', (await rpc(U.coach, 'coach_estado')).coach.estado === 'activo');

  // 11. Nivel baja precios al nuevo tope; rfc bloqueado ya activo
  await rpc(U.admin, 'admin_coach_decidir', [U.coach, 'nivel', null, 3]);
  await rpc(U.coach, 'coach_guardar', [JSON.stringify({ precio_sesion: 900 })]);
  await rpc(U.admin, 'admin_coach_decidir', [U.coach, 'nivel', null, 1]);
  check('bajar nivel ajusta precio', Number((await rpc(U.coach, 'coach_estado')).coach.precio_sesion) === 350);
  check('rfc no editable activo', (await err(U.coach, 'coach_guardar', [JSON.stringify({ rfc: 'XAXX010101000' })])) === 'rfc_bloqueado');

  // 12. No se tocó nada existente: accesos solo tiene filas 'coach'
  const orig = (await su(`select distinct origen from accesos`)).rows.map(r => r.origen);
  check('solo filas coach en accesos', orig.length === 1 && orig[0] === 'coach', orig);

  // 13. Interruptor encendido = todos
  await rpc(U.admin, 'admin_coach_config', ['activo', 'true']);
  check('encendido abre a todos', (await rpc(U.extra, 'coach_estado')).disponible === true);
  check('config valida tipos', (await err(U.admin, 'admin_coach_config', ['activo', '"si"'])) === 'valor_invalido');

  console.log(`\n${ok} pruebas bien, ${fallos} fallas`);
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
