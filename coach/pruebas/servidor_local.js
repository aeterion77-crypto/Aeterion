// Servidor de pruebas: imita /rest/v1/rpc de Supabase sobre un Postgres local (PGlite)
// con la migración de coaches. Uso: node servidor_local.js 54329
// Token de autorización "T-<uuid>" = sesión de ese usuario.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { PGlite } = require('@electric-sql/pglite');

const PUERTO = Number(process.argv[2] || 54329);
(async () => {
  const db = new PGlite();
  await db.exec(fs.readFileSync(path.join(__dirname, 'stub_supabase.sql'), 'utf8'));
  await db.exec(fs.readFileSync(path.join(__dirname, '..', 'sql', '001_coaches.sql'), 'utf8'));
  await db.exec(fs.readFileSync(path.join(__dirname, '..', 'sql', '003_accesos_origen.sql'), 'utf8'));
  let cola = Promise.resolve();
  const enCola = (fn) => { const p = cola.then(fn, fn); cola = p.catch(() => {}); return p; };

  const llamar = (uid, fn, args) => enCola(async () => {
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claims', $1, false)`, [uid ? JSON.stringify({ sub: uid, role: 'authenticated' }) : '']);
    await db.exec(uid ? 'set role authenticated' : 'set role anon');
    try {
      const nombres = Object.keys(args || {});
      const vals = nombres.map((k) => { const v = args[k]; return v !== null && typeof v === 'object' ? JSON.stringify(v) : v; });
      const sql = `select public.${fn.replace(/[^a-z0-9_]/g, '')}(${nombres.map((k, i) => `${k.replace(/[^a-z0-9_]/g, '')} := $${i + 1}`).join(', ')}) as r`;
      const r = await db.query(sql, vals);
      return { status: 200, body: r.rows[0].r };
    } catch (e) {
      return { status: e.code === '42501' ? 403 : 400, body: { message: e.message, code: e.code } };
    } finally { await db.exec('reset role'); }
  });
  const sqlAdmin = (sql, params) => enCola(async () => { await db.exec('reset role'); const r = await db.query(sql, params || []); return r.rows; });

  http.createServer((req, res) => {
    let cuerpo = '';
    req.on('data', (c) => { cuerpo += c; });
    req.on('end', async () => {
      const send = (st, o) => { res.writeHead(st, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
      try {
        const datos = cuerpo ? JSON.parse(cuerpo) : {};
        if (req.url === '/sql') { return send(200, await sqlAdmin(datos.sql, datos.params)); }
        const m = req.url.match(/^\/rpc\/([a-z0-9_]+)/);
        if (!m) return send(404, { message: 'no' });
        const tok = String(req.headers.authorization || '').replace('Bearer ', '');
        const uid = tok.startsWith('T-') ? tok.slice(2) : null;
        const r = await llamar(uid, m[1], datos);
        send(r.status, r.body);
      } catch (e) { send(500, { message: String(e.message || e) }); }
    });
  }).listen(PUERTO, () => console.log('listo ' + PUERTO));
})();
