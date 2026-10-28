// Pruebas de la migración 004 (espacio de trabajo del coach) en Postgres local.
const { PGlite } = require('@electric-sql/pglite'); const fs = require('fs'); const path = require('path');
const U = { admin: '00000000-0000-0000-0000-00000000000a', coach: '00000000-0000-0000-0000-0000000000c1', coach2: '00000000-0000-0000-0000-0000000000c2',
  cli: '00000000-0000-0000-0000-0000000000e1', cli2: '00000000-0000-0000-0000-0000000000e2', cli3: '00000000-0000-0000-0000-0000000000e3' };
let ok = 0, mal = 0; const chk = (n, c, x) => { if (c) ok++; else { mal++; console.log('FALLA:', n, x !== undefined ? JSON.stringify(x) : ''); } };
(async () => {
  const db = new PGlite(); const L = (f) => db.exec(fs.readFileSync(f, 'utf8'));
  await L(path.join(__dirname, 'stub_supabase.sql'));
  for (const f of ['001_coaches.sql', '003_accesos_origen.sql', '004_coach_espacio.sql']) await L(path.join(__dirname, '..', 'sql', f));
  const su = async (q, p) => { await db.exec('reset role'); return db.query(q, p); };
  for (const [k, id] of Object.entries(U)) { await su('insert into auth.users values ($1,$2)', [id, k + '@x.mx']); await su('insert into perfiles (id,email,nombre) values ($1,$2,$3)', [id, k + '@x.mx', { cli: 'Ana Torres', cli2: 'Beto', cli3: 'Caro' }[k] || k]); }
  await su('insert into admins values ($1)', [U.admin]);
  await su(`update coach_config set valor = $1 where clave='testers'`, [JSON.stringify(Object.values(U))]);
  const rpc = async (uid, fn, args = []) => { await db.exec('reset role'); await db.query(`select set_config('request.jwt.claims',$1,false)`, [JSON.stringify({ sub: uid })]); await db.exec('set role authenticated');
    try { return (await db.query(`select public.${fn}(${args.map((_, i) => '$' + (i + 1)).join(',')}) r`, args.map(a => a !== null && typeof a === 'object' ? JSON.stringify(a) : a))).rows[0].r; } finally { await db.exec('reset role'); } };
  const err = async (...a) => { try { await rpc(...a); return null; } catch (e) { return e.message; } };
  // coaches activos
  for (const [c, cod] of [[U.coach, 'DANI123'], [U.coach2, 'OTRO123']])
    await su(`insert into coaches (user_id, estado, nombre_publico, modalidades, precio_sesion, codigo, membresia_hasta, aprobado_en) values ($1,'activo',$2,'{presencial,linea}',300,$3, now()+interval '30 days', now())`, [c, 'Coach ' + cod, cod]);

  // Invitación por código
  chk('código propio', (await err(U.coach, 'vinculo_por_codigo', ['DANI123', 'presencial', {}])) === 'no_contigo');
  chk('código inválido', (await err(U.cli, 'vinculo_por_codigo', ['NOPE', 'presencial', {}])) === 'codigo_invalido');
  const vista = await rpc(U.cli, 'coach_por_codigo', ['dani123']);
  chk('ver coach por código', vista.nombre === 'Coach DANI123' && vista.codigo === 'DANI123');
  let e = await rpc(U.cli, 'vinculo_por_codigo', ['dani123', 'linea', { entrenos: true, medidas: true }]);
  chk('invitación activa de inmediato', e.mi_coach.estado === 'activo' && e.mi_coach.modalidad === 'linea', e.mi_coach);
  chk('referido por código', (await su(`select codigo from coach_referidos where cliente_id=$1`, [U.cli])).rows[0].codigo === 'DANI123');
  chk('un solo coach', (await err(U.cli, 'vinculo_por_codigo', ['OTRO123', 'presencial', {}])) === 'ya_tienes_coach');
  await rpc(U.cli2, 'vinculo_por_codigo', ['DANI123', 'xx', {}]);   // modalidad inválida → la primera del coach
  chk('modalidad por defecto', (await su(`select modalidad from coach_vinculos where cliente_id=$1`, [U.cli2])).rows[0].modalidad === 'presencial');
  await rpc(U.cli3, 'vinculo_solicitar', [U.coach, 'presencial', {}]); // pendiente

  // Actividad y resumen
  const hoyMx = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date()); const f = (d) => { const x = new Date(hoyMx + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() - d); return x.toISOString().slice(0, 10); };
  await su(`insert into progreso (user_id, clave, valor) values ($1,'aet_actividad',$2)`, [U.cli, JSON.stringify({ [f(1)]: ['e'], [f(3)]: ['e', 'h'], [f(10)]: ['h'], [f(40)]: ['e'] })]);
  await su(`insert into progreso (user_id, clave, valor) values ($1,'aet_actividad',$2)`, [U.cli2, 'esto no es json']);
  let cl = await rpc(U.coach, 'coach_mis_clientes');
  const ana = cl.find(x => x.cliente_id === U.cli), beto = cl.find(x => x.cliente_id === U.cli2), caro = cl.find(x => x.cliente_id === U.cli3);
  chk('actividad de Ana', ana.actividad.n30 === 2 && ana.actividad.ultimo === f(1), ana.actividad);
  chk('JSON roto no rompe', beto.actividad === null || beto.actividad.n30 === 0, beto.actividad);
  chk('pendiente sin actividad', caro.estado === 'pendiente' && caro.actividad === null);
  let r = await rpc(U.coach, 'coach_resumen');
  chk('resumen clientes', r.clientes === 2, r);
  chk('alerta solicitud', r.alertas.some(a => a.tipo === 'solicitud' && a.nombre === 'Caro'));
  chk('alerta sin programa', r.alertas.filter(a => a.tipo === 'sin_programa').length === 2);
  chk('Ana no inactiva', !r.alertas.some(a => a.tipo === 'inactivo' && a.nombre === 'Ana Torres'));
  chk('constancia calculada', typeof r.constancia === 'number' || r.constancia !== null, r.constancia);
  // Ana sin entrenar 6 días
  await su(`update progreso set valor=$2 where user_id=$1 and clave='aet_actividad'`, [U.cli, JSON.stringify({ [f(6)]: ['e'] })]);
  r = await rpc(U.coach, 'coach_resumen');
  chk('alerta inactivo 6 días', r.alertas.some(a => a.tipo === 'inactivo' && a.nombre === 'Ana Torres' && a.dias === 6), r.alertas);
  // Ana deja de compartir entrenos: ya no hay datos de actividad
  await rpc(U.cli, 'vinculo_permisos', [{ medidas: true }]);
  r = await rpc(U.coach, 'coach_resumen');
  chk('sin permiso no hay alerta de actividad', !r.alertas.some(a => a.tipo === 'inactivo'));
  await rpc(U.cli, 'vinculo_permisos', [{ entrenos: true, medidas: true }]);

  // Programas
  const dias = [{ nombre: 'Día 1 · Pierna', ejercicios: [{ n: 'Sentadilla trasera', s: 4, r: '5', rir: 2, kg: 60, origen: 'motor' }, { n: 'Peso muerto rumano', s: 3, r: '8–10', rir: 2, kg: 50, nota: '+2.5 kg coach' }] },
    { nombre: 'Día 2 · Empuje', ejercicios: [{ n: 'Press banca', s: 4, r: '6–8', rir: null, kg: null }] }];
  chk('programa inválido', (await err(U.coach, 'coach_programa_guardar', [{ nombre: 'X', dias: [] }])) === 'programa_invalido');
  chk('series fuera de rango', (await err(U.coach, 'coach_programa_guardar', [{ nombre: 'Malo', dias: [{ nombre: 'd', ejercicios: [{ n: 'Sentadilla', s: 50, r: '5' }] }] }])) === 'programa_invalido');
  chk('kg absurdo', (await err(U.coach, 'coach_programa_guardar', [{ nombre: 'Malo', dias: [{ nombre: 'd', ejercicios: [{ n: 'Sentadilla', s: 3, r: '5', kg: 5000 }] }] }])) === 'programa_invalido');
  const pl = await rpc(U.coach, 'coach_programa_guardar', [{ nombre: 'Fuerza 5 días', base: 'entrenamiento', dias }]);
  chk('plantilla creada', pl.cliente_id === null && pl.id);
  chk('no asignar a ajeno', (await err(U.coach2, 'coach_programa_guardar', [{ nombre: 'Para Ana', dias, cliente_id: U.cli }])) === 'sin_permiso');
  chk('no asignar a pendiente', (await err(U.coach, 'coach_programa_guardar', [{ nombre: 'Para Caro', dias, cliente_id: U.cli3 }])) === 'sin_permiso');
  const a1 = await rpc(U.coach, 'coach_programa_guardar', [{ nombre: 'Fuerza Ana', dias, cliente_id: U.cli, nota: 'Técnica primero' }]);
  const a2 = await rpc(U.coach, 'coach_programa_guardar', [{ nombre: 'Fuerza Ana v2', dias, cliente_id: U.cli }]);
  chk('solo un programa activo', (await su(`select count(*)::int n from coach_programas where cliente_id=$1 and activo`, [U.cli])).rows[0].n === 1);
  let mio = await rpc(U.cli, 'programa_mio');
  chk('cliente ve su programa', mio && mio.nombre === 'Fuerza Ana v2' && mio.coach === 'Coach DANI123' && !('coach_id' in mio), mio);
  chk('otro cliente no ve', (await rpc(U.cli2, 'programa_mio')) === null);
  await rpc(U.coach, 'coach_programa_guardar', [{ id: a2.id, nombre: 'Fuerza Ana v3', dias, cliente_id: U.cli }]);
  chk('editar asignado', (await rpc(U.cli, 'programa_mio')).nombre === 'Fuerza Ana v3');
  chk('otro coach no edita', (await err(U.coach2, 'coach_programa_guardar', [{ id: a2.id, nombre: 'hack', dias }])) === 'programa_no_encontrado');
  let lista = await rpc(U.coach, 'coach_programas_listar');
  chk('listar', lista.plantillas.length === 1 && lista.asignados.length === 1 && lista.asignados[0].cliente === 'Ana Torres', lista);
  cl = await rpc(U.coach, 'coach_mis_clientes');
  chk('programa en lista de clientes', cl.find(x => x.cliente_id === U.cli).programa.nombre === 'Fuerza Ana v3');
  chk('tablas cerradas', /permission denied/.test(await (async () => { await db.exec('set role authenticated'); try { await db.query('select * from coach_programas'); return ''; } catch (x) { return x.message; } finally { await db.exec('reset role'); } })()));

  // Mensajes
  const vinc = ana.vinculo;
  chk('ajeno no lee', (await err(U.cli2, 'mensajes_listar', [vinc])) === 'sin_permiso');
  await rpc(U.cli, 'mensaje_enviar', [vinc, '  Hola coach  ']);
  chk('no leídos coach', (await rpc(U.coach, 'mensajes_no_leidos')) === 1);
  r = await rpc(U.coach, 'coach_resumen');
  chk('alerta mensaje', r.alertas.some(a => a.tipo === 'mensaje' && a.n === 1));
  let ms = await rpc(U.coach, 'mensajes_listar', [vinc]);
  chk('leer marca leídos', ms.length === 1 && ms[0].texto === 'Hola coach' && ms[0].mio === false && (await rpc(U.coach, 'mensajes_no_leidos')) === 0);
  ms = await rpc(U.coach, 'mensaje_enviar', [vinc, 'Hola Ana, ¿cómo te fue?']);
  chk('respuesta mía', ms[1].mio === true && ms[1].autor === 'coach');
  chk('vacío', (await err(U.cli, 'mensaje_enviar', [vinc, '   '])) === 'mensaje_vacio');
  for (let i = 0; i < 39; i++) await su(`insert into coach_mensajes (vinculo_id, autor, texto) values ($1,'cliente','x')`, [vinc]);
  chk('límite por hora', (await err(U.cli, 'mensaje_enviar', [vinc, 'otro'])) === 'demasiados_mensajes');

  // Notas privadas
  await rpc(U.coach, 'coach_nota_agregar', [U.cli, 'Molestia leve en rodilla izquierda']);
  chk('notas', (await rpc(U.coach, 'coach_notas_listar', [U.cli])).length === 1);
  chk('notas ajenas', (await err(U.coach2, 'coach_notas_listar', [U.cli])) === 'sin_permiso');
  chk('cliente no lee notas', (await err(U.cli, 'coach_notas_listar', [U.cli])) !== null);

  // Al terminar el vínculo, el coach pierde acceso y el programa deja de verse
  await rpc(U.cli, 'vinculo_terminar', [vinc]);
  chk('sin programa tras terminar', (await rpc(U.cli, 'programa_mio')) === null);
  chk('sin mensajes tras terminar', (await err(U.coach, 'mensajes_listar', [vinc])) === 'sin_permiso');
  chk('sin notas tras terminar', (await err(U.coach, 'coach_nota_agregar', [U.cli, 'x'])) === 'sin_permiso');
  chk('historial del cliente intacto', (await su(`select count(*)::int n from progreso where user_id=$1`, [U.cli])).rows[0].n === 1);
  console.log(`${ok} bien, ${mal} fallas`); process.exit(mal ? 1 : 0);
})().catch(e => { console.error('ERROR', e.message, e.where || ''); process.exit(2); });
