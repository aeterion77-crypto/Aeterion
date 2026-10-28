// Prueba de las reglas de almacenamiento de documentos (002) en Postgres local.
const { PGlite } = require('@electric-sql/pglite'); const fs = require('fs'); const path = require('path');
const A = '00000000-0000-0000-0000-00000000000a', C = '00000000-0000-0000-0000-0000000000c1', X = '00000000-0000-0000-0000-0000000000e1';
let ok = 0, mal = 0; const chk = (n, c) => { if (c) ok++; else { mal++; console.log('FALLA:', n); } };
(async () => {
  const db = new PGlite();
  for (const f of ['stub_supabase.sql', 'stub_storage.sql']) await db.exec(fs.readFileSync(path.join(__dirname, f), 'utf8'));
  await db.exec(fs.readFileSync(path.join(__dirname, '..', 'sql', '001_coaches.sql'), 'utf8'));
  await db.exec(fs.readFileSync(path.join(__dirname, '..', 'sql', '003_accesos_origen.sql'), 'utf8'));
  await db.exec(fs.readFileSync(path.join(__dirname, '..', 'sql', '002_coach_documentos_storage.sql'), 'utf8'));
  await db.query(`insert into public.admins values ($1)`, [A]);
  const como = async (u, sql, p) => { await db.exec('reset role'); await db.query(`select set_config('request.jwt.claims',$1,false)`, [JSON.stringify({ sub: u })]); await db.exec('set role authenticated');
    try { return await db.query(sql, p); } catch (e) { return { error: e.message }; } finally { await db.exec('reset role'); } };
  chk('sube a su carpeta', !(await como(C, `insert into storage.objects (bucket_id,name) values ('coach-docs',$1)`, [C + '/ine.pdf'])).error);
  chk('no sube a carpeta ajena', !!(await como(X, `insert into storage.objects (bucket_id,name) values ('coach-docs',$1)`, [C + '/falso.pdf'])).error);
  chk('dueño ve su archivo', (await como(C, `select count(*)::int n from storage.objects`)).rows[0].n === 1);
  chk('otro no lo ve', (await como(X, `select count(*)::int n from storage.objects`)).rows[0].n === 0);
  chk('admin lo ve', (await como(A, `select count(*)::int n from storage.objects`)).rows[0].n === 1);
  const b = (await db.query(`select public, file_size_limit from storage.buckets where id='coach-docs'`)).rows[0];
  chk('bucket privado de 8 MB', b.public === false && Number(b.file_size_limit) === 8388608);
  console.log(`${ok} bien, ${mal} fallas`); process.exit(mal ? 1 : 0);
})();
