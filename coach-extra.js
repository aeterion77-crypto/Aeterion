/* ============================================================
   AETERION COACH · extras
   - Coach: calendario, alimentación (si Aeterion lo autoriza),
     evaluación mutua, reportes y mensajes a Aeterion, bloqueos,
     vender productos, más material y menú «Más».
   - Alumno: sugerencia de su coach en Entrenar y Nutrición (sin
     quitar lo de la app), citas, evaluar al coach, reportar o bloquear.
   Se apoya en coach.js (__aetCoach) y coach-espacio.js (__coachEspacio).
============================================================ */
(function () {
'use strict';
const K = window.__aetCoach, X = window.__coachEspacio; if (!K || !X) return;
const { llamar, esc, money, fecha, fechaCorta, toast, avatar, VISTAS, nombreCorto, cab } = K;
const { irA, titulo } = X;
const $ = (id) => document.getElementById(id);
Object.assign(K.ERR, {
  texto_corto: 'Escribe un poco más de detalle.', tipo_invalido: 'Elige una opción válida.', sin_relacion: 'Solo puedes reportar a tu coach o a tus clientes.',
  demasiados_casos: 'Ya enviaste varios reportes hoy. Te contestamos pronto.', caso_no_encontrado: 'Ese reporte ya no existe.', caso_cerrado: 'Ese caso ya está cerrado. Abre uno nuevo.',
  vinculo_no_encontrado: 'Ese vínculo ya no existe.', muy_pronto: 'Podrán evaluarse después de 7 días de trabajar juntos.', calificacion_invalida: 'Elige de 1 a 5 estrellas.',
  nutricion_no_autorizada: 'Tu cuenta no tiene autorización para planes de alimentación.', plan_invalido: 'Revisa el plan: calorías de 800 a 6000 y hasta 8 comidas con texto.',
  rango_invalido: 'Revisa las fechas.', evento_invalido: 'Revisa el título, la fecha y la duración.', evento_no_encontrado: 'Ese evento ya no existe.', demasiados_eventos: 'Tienes demasiados eventos próximos.',
  no_encontrado: 'No se encontró.',
});
const TIPOS = { conducta: 'Trato o conducta', reembolso: 'Reembolso', pago: 'Pago o cobro', seguridad: 'Seguridad o salud', acoso: 'Acoso', mensaje: 'Mensaje para Aeterion', otro: 'Otro' };
const EST_CASO = { abierto: ['Abierto', 'warn'], en_revision: ['En revisión', 'warn'], resuelto: ['Resuelto', 'ok'], cerrado: ['Cerrado', 'gris'] };
const TIPO_EV = { revision: 'Revisión', llamada: 'Llamada', evaluacion: 'Evaluación', recordatorio: 'Recordatorio', personal: 'Personal' };
const hoyMx = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
const fechaLocal = (d) => { const z = new Date(d); return z.getFullYear() + '-' + String(z.getMonth() + 1).padStart(2, '0') + '-' + String(z.getDate()).padStart(2, '0'); };
const horaTxt = (iso) => new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
const estrellasInput = (id, val) => `<div class="cx-estr" id="${id}" role="radiogroup" aria-label="Calificación">${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="${n <= (val || 0) ? 'on' : ''}" data-c="cx-estrella" data-x="${n}" aria-label="${n} ${n === 1 ? 'estrella' : 'estrellas'}">★</button>`).join('')}</div>`;
const valorEstr = (id) => { const el = $(id); return el ? el.querySelectorAll('button.on').length : 0; };
const pillCaso = (e) => { const x = EST_CASO[e] || [e, 'gris']; return `<em class="cx-pill-e ${x[1]}">${x[0]}</em>`; };

/* =================================================================
   MÁS (menú del coach)
================================================================= */
VISTAS['c-mas'] = async () => {
  const nl = await llamar('casos_sin_leer').catch(() => 0);
  const op = [['c-academia', 'Academia y material', 'Curso Método Aeterion, guías, plantillas y protocolos'], ['c-ganancias', 'Ganancias', 'Comisiones por Premium y productos'],
    ['c-vender', 'Vender productos Aeterion', 'Tu enlace, tu código y cómo ganas 10% por venta'], ['c-casos', 'Escribir a Aeterion' + (nl ? ` · ${nl} ${nl === 1 ? 'respuesta nueva' : 'respuestas nuevas'}` : ''), 'Reportes, reembolsos, dudas y autorizaciones'],
    ['c-bloqueados', 'Personas bloqueadas', 'Quién ya no puede contactarte'], ['c-cuenta', 'Mi cuenta de coach', 'Membresía, cobros y perfil'], ['c-perfil', 'Mi perfil público', 'Nombre, especialidades, precios y documentos']];
  return titulo('Más') + op.map(([k, t, s]) => `<button class="cx-base" data-c="cx-ir" data-x="${k}"><b>${esc(t)}</b><span>${esc(s)}</span><i>›</i></button>`).join('');
};

/* =================================================================
   CASOS: reportes y mensajes a Aeterion (coach y alumno)
================================================================= */
async function vistaCasos(v, comoCoach) {
  const L = await llamar('mis_casos');
  const tipos = comoCoach ? ['mensaje', 'pago', 'reembolso', 'conducta', 'seguridad', 'acoso', 'otro'] : ['conducta', 'reembolso', 'pago', 'seguridad', 'acoso', 'mensaje', 'otro'];
  let contra = '';
  if (comoCoach) { const cl = (await X.clientes()).filter((c) => c.estado === 'activo'); contra = `<label class="co-lab">¿Es sobre un cliente? <span class="co-peq">(opcional)</span></label><select class="co-in" id="caContra"><option value="">No, es para Aeterion</option>${cl.map((c) => `<option value="${esc(c.cliente_id)}" ${v.contra === c.cliente_id ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select>`; }
  else { const mc = (K.est() || {}).mi_coach; if (mc) contra = `<label class="co-check"><input type="checkbox" id="caSobreCoach" ${v.contra ? 'checked' : ''}> Es sobre mi coach, ${esc(mc.nombre)}</label>`; }
  let h = (comoCoach ? titulo : cab)('Escribir a Aeterion', 'Reportes, reembolsos y cualquier situación. El equipo de Aeterion te contesta aquí.');
  h += `<div class="co-card"><b>Nuevo</b><label class="co-lab">¿De qué se trata?</label><select class="co-in" id="caTipo">${tipos.map((t) => `<option value="${t}" ${v.tipo === t ? 'selected' : ''}>${TIPOS[t]}</option>`).join('')}</select>${contra}
    <label class="co-lab">Cuéntanos qué pasó</label><textarea class="co-in" id="caTexto" rows="4" maxlength="2000" placeholder="Fechas, montos y lo que esperas que hagamos. No incluyas contraseñas ni datos de tarjeta.">${esc(v.texto || '')}</textarea>
    <button class="co-btn co-btn-grande" data-c="cx-caso-enviar" data-x="${comoCoach ? 'coach' : 'cliente'}">Enviar a Aeterion</button>
    <p class="co-peq">Si estás en peligro o es una emergencia, llama al 911.</p></div>`;
  h += '<div class="co-sec">Mis casos</div>' + (L.length ? L.map((c) => `<div class="co-card cx-caso"><div class="co-top"><b>${esc(TIPOS[c.tipo] || c.tipo)}${c.contra_nombre ? ' · ' + esc(c.contra_nombre) : ''}</b>${pillCaso(c.estado)}</div>
      <p class="co-peq">${fecha(c.creado_en)}</p><p class="cx-caso-txt">${esc(c.texto)}</p>
      ${c.mensajes.map((m) => `<div class="co-msg ${m.de_admin ? '' : 'mio'}"><p>${m.de_admin ? '<b>Aeterion:</b> ' : ''}${esc(m.texto)}</p><span>${fecha(m.fecha)}</span></div>`).join('')}
      ${c.estado !== 'cerrado' ? `<div class="co-fila co-escribir"><textarea class="co-in" id="caR${c.id}" rows="1" maxlength="2000" placeholder="Agregar información…"></textarea><button class="co-btn" data-c="cx-caso-resp" data-x="${c.id}">Enviar</button></div>` : ''}</div>`).join('')
    : '<p class="co-peq">No has enviado nada todavía.</p>');
  return h;
}
VISTAS['c-casos'] = (v) => vistaCasos(v, true);
VISTAS.casos = (v) => vistaCasos(v, false);

VISTAS['c-bloqueados'] = async () => {
  const L = await llamar('coach_mis_bloqueos');
  return titulo('Personas bloqueadas', 'No pueden volver a vincularse contigo ni escribirte') + (L.length ? '<div class="co-card">' + L.map((b) => `<div class="co-top cx-fila-b"><b>${esc(b.nombre)}</b><button class="co-link" data-c="cx-desbloquear" data-x="${esc(b.coach_id)}" data-n="${esc(b.cliente_id)}">Desbloquear</button></div>`).join('') + '</div>' : '<div class="co-card co-vacio"><b>Nadie bloqueado</b></div>');
};
VISTAS.bloqueados = async () => {
  const L = await llamar('coach_mis_bloqueos');
  return cab('Coaches bloqueados') + (L.length ? '<div class="co-card">' + L.map((b) => `<div class="co-top cx-fila-b"><b>${esc(b.nombre)}</b><button class="co-link" data-c="cx-desbloquear" data-x="${esc(b.coach_id)}" data-n="${esc(b.cliente_id)}">Desbloquear</button></div>`).join('') + '</div>' : '<div class="co-card co-vacio"><b>No has bloqueado a nadie</b></div>');
};

/* =================================================================
   AGENDA: calendario del mes con sesiones y eventos
================================================================= */
VISTAS['c-agenda'] = async (v) => {
  const hoy = hoyMx(); const mes = v.mes || hoy.slice(0, 7); const sel = v.dia || (mes === hoy.slice(0, 7) ? hoy : mes + '-01');
  const p1 = new Date(mes + '-01T12:00:00'); const ini = new Date(p1); ini.setDate(1 - ((p1.getDay() + 6) % 7));
  const fin = new Date(ini); fin.setDate(ini.getDate() + 41);
  const [C, ses, cl] = await Promise.all([llamar('coach_calendario', { p_desde: fechaLocal(ini), p_hasta: fechaLocal(fin) }), llamar('sesiones_mias').catch(() => []), X.clientes()]);
  const porDia = {}; const add = (d, it) => { (porDia[d] = porDia[d] || []).push(it); };
  C.eventos.forEach((e) => add(fechaLocal(e.inicio), Object.assign({ k: 'ev' }, e)));
  C.sesiones.forEach((s) => add(fechaLocal(s.inicio), Object.assign({ k: 'ses' }, s)));
  const porCerrar = ses.filter((s) => s.rol === 'coach' && s.estado === 'pagada' && new Date(s.inicio) <= new Date());
  const mesTxt = p1.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  const mov = (n) => { const d = new Date(mes + '-01T12:00:00'); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 7); };
  let h = titulo('Agenda', 'Sesiones, revisiones y recordatorios', '<button class="co-btn co-mini" data-c="cx-ev-nuevo">＋ Agendar</button>');
  if (porCerrar.length) h += '<div class="co-sec">Marca cómo fue</div>' + porCerrar.map((s) => `<div class="co-card"><div class="co-top"><b>${esc(s.con)}</b><span>${fecha(s.inicio)}</span></div><div class="co-fila"><button class="co-btn" data-c="cerrar" data-x="${s.id}" data-n="dada">Se dio</button><button class="co-btn co-sec-btn" data-c="cerrar" data-x="${s.id}" data-n="no_show_cliente">No llegó</button></div></div>`).join('');
  h += `<div class="co-card cx-cal"><div class="cx-cal-cab"><button data-c="cx-mes" data-x="${mov(-1)}" aria-label="Mes anterior">‹</button><b>${esc(mesTxt.charAt(0).toUpperCase() + mesTxt.slice(1))}</b><button data-c="cx-mes" data-x="${mov(1)}" aria-label="Mes siguiente">›</button></div>
    <div class="cx-cal-g">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d) => `<span class="cx-cal-d">${d}</span>`).join('')}`;
  for (let i = 0; i < 42; i++) {
    const d = new Date(ini); d.setDate(ini.getDate() + i); const f = fechaLocal(d); const it = porDia[f] || [];
    h += `<button class="cx-cal-c ${f.slice(0, 7) !== mes ? 'fuera' : ''} ${f === hoy ? 'hoy' : ''} ${f === sel ? 'sel' : ''}" data-c="cx-cal-dia" data-x="${f}"><span>${d.getDate()}</span>${it.length ? `<i>${it.slice(0, 3).map((x) => `<em class="${x.k === 'ses' ? 'ses' : x.tipo}"></em>`).join('')}</i>` : ''}</button>`;
  }
  h += '</div><div class="cx-cal-ley"><span><em class="ses"></em>Sesión</span><span><em class="revision"></em>Revisión / llamada</span><span><em class="personal"></em>Personal</span></div></div>';
  const lista = (porDia[sel] || []).sort((a, b) => a.inicio.localeCompare(b.inicio));
  const selTxt = new Date(sel + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
  h += `<div class="co-sec">${esc(selTxt)}</div>`;
  h += lista.length ? lista.map((x) => x.k === 'ses'
    ? `<div class="co-card cx-ev ses"><div class="co-top"><b>${horaTxt(x.inicio)} · Sesión con ${esc(x.cliente)}</b><span>${{ por_pagar: 'Por pagar', pagada: 'Pagada', dada: 'Dada' }[x.estado] || x.estado}</span></div><p class="co-peq">${x.minutos} min · ${x.modalidad === 'linea' ? 'En línea' : 'Presencial'} · ${money(x.precio)}</p></div>`
    : `<div class="co-card cx-ev ${x.tipo} ${x.hecho ? 'hecho' : ''}"><div class="co-top"><b>${horaTxt(x.inicio)} · ${esc(x.titulo)}</b><span>${TIPO_EV[x.tipo]}</span></div><p class="co-peq">${x.minutos} min${x.cliente ? ' · con ' + esc(x.cliente) : ''}${x.nota ? ' · ' + esc(x.nota) : ''}</p>
      <div class="co-fila"><button class="co-btn co-sec-btn co-mini" data-c="cx-ev-hecho" data-x="${x.id}">${x.hecho ? 'Marcar pendiente' : '✓ Hecho'}</button><button class="co-link" data-c="cx-ev-borrar" data-x="${x.id}">Borrar</button></div></div>`).join('')
    : '<p class="co-peq">Nada agendado este día.</p>';
  if (v.nuevo) {
    const act = cl.filter((c) => c.estado === 'activo');
    h += `<div class="co-card" id="cxEvForm"><b>Agendar</b><label class="co-lab">Qué</label><input class="co-in" id="evTit" maxlength="80" placeholder="Ej. Revisión de técnica de sentadilla" value="${esc(v.preTitulo || '')}">
      <div class="co-doble"><div><label class="co-lab">Tipo</label><select class="co-in" id="evTipo">${Object.keys(TIPO_EV).map((k) => `<option value="${k}">${TIPO_EV[k]}</option>`).join('')}</select></div>
        <div><label class="co-lab">Con</label><select class="co-in" id="evCli"><option value="">Nadie (solo para mí)</option>${act.map((c) => `<option value="${esc(c.cliente_id)}" ${v.preCliente === c.cliente_id ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select></div></div>
      <div class="co-doble"><div><label class="co-lab">Día</label><input class="co-in" id="evDia" type="date" value="${sel}"></div><div><label class="co-lab">Hora</label><input class="co-in" id="evHora" type="time" value="09:00"></div></div>
      <div class="co-doble"><div><label class="co-lab">Minutos</label><input class="co-in" id="evMin" type="number" min="5" max="480" value="30"></div><div><label class="co-lab">Nota</label><input class="co-in" id="evNota" maxlength="300" placeholder="Opcional"></div></div>
      <p class="co-peq">Si agendas con un cliente, lo ve en su app (salvo los personales). Las sesiones con cobro se proponen desde su ficha.</p>
      <button class="co-btn co-btn-grande" data-c="cx-ev-guardar">Guardar</button></div>`;
  }
  return h;
};

/* =================================================================
   FICHA DEL CLIENTE: alimentación, evaluación y resumen extra
================================================================= */
window.__coachFichaTab = async function (tab, x, v) {
  const F = await llamar('coach_ficha', { p_cliente: x.cliente_id });
  if (tab === 'plan') {
    const N = F.nutricion || {};
    if (!N.puede) return `<div class="co-card"><b>Plan de alimentación</b><p>${esc(nombreCorto(x.nombre))} usa el plan recomendado de la app (Nutrición › Plan General), que ya calcula sus calorías y macros.</p>
      <p class="co-peq">Para enviar planes de alimentación propios necesitas autorización de Aeterion: sube tu cédula o certificación en nutrición en tu perfil y pídela en «Escribir a Aeterion». Mientras, orienta hábitos generales (proteína, agua, sueño, constancia) sin prescribir dietas.</p>
      <button class="co-btn co-sec-btn" data-c="cx-ir-casos" data-t="mensaje" data-texto="Quiero autorización para enviar planes de alimentación. Ya subí mi cédula o certificación en nutrición.">Pedir autorización</button></div>`;
    const P = N.plan || { comidas: [] }; const com = (P.comidas || []).concat(Array.from({ length: Math.max(0, 4 - (P.comidas || []).length) }, () => ({ nombre: '', texto: '' }))).slice(0, 8);
    return `<div class="co-card"><b>Plan de alimentación</b><p class="co-peq">${P.id ? 'Tu cliente lo ve en Nutrición como «Sugerencia de tu coach», junto al plan de la app. Actualizado ' + fechaCorta(P.actualizado_en) + '.' : 'Aún no le envías plan. Mientras, ve el plan recomendado de la app.'}</p>
      <div class="cx-macros"><label>Calorías<input class="co-in" id="nKcal" type="number" min="800" max="6000" value="${P.kcal || ''}"></label><label>Proteína g<input class="co-in" id="nProt" type="number" min="0" max="400" value="${P.proteina_g ?? ''}"></label><label>Carbos g<input class="co-in" id="nCarb" type="number" min="0" max="900" value="${P.carbos_g ?? ''}"></label><label>Grasas g<input class="co-in" id="nGras" type="number" min="0" max="300" value="${P.grasas_g ?? ''}"></label></div>
      <p class="co-peq" id="nCalc"></p>
      ${com.map((c, i) => `<div class="cx-comida"><input class="co-in cx-cn" maxlength="40" placeholder="Comida ${i + 1} (ej. Desayuno)" value="${esc(c.nombre)}"><textarea class="co-in cx-ct" rows="2" maxlength="500" placeholder="Qué y cuánto, con opciones">${esc(c.texto)}</textarea></div>`).join('')}
      <label class="co-lab">Indicaciones</label><textarea class="co-in" id="nNota" rows="2" maxlength="600" placeholder="Agua, horarios, cómo cambiar alimentos…">${esc(P.nota || '')}</textarea>
      <button class="co-btn co-btn-grande" data-c="cx-nut-guardar" data-x="${esc(x.cliente_id)}">${P.id ? 'Actualizar plan' : 'Enviar plan'}</button>${P.id ? `<button class="co-link" data-c="cx-nut-quitar" data-x="${esc(x.cliente_id)}">Quitar plan</button>` : ''}</div>
      <p class="co-peq">Para enfermedades (diabetes, riñón, embarazo con complicaciones, trastornos de la alimentación) refiere a su médico.</p>`;
  }
  // evaluación
  const E = F.evaluaciones, mia = E.mia || {}, R = F.reputacion || {};
  let h = `<div class="co-card"><b>Evalúa a ${esc(nombreCorto(x.nombre))} este mes</b>${E.puede ? `<p class="co-peq">Tu cliente ve tu evaluación; ayuda a que otros coaches sepan cómo trabaja. Una por mes, la puedes cambiar.</p>
      ${estrellasInput('evEst', mia.estrellas)}
      <div class="cx-asp">${[['constancia', 'Constancia'], ['compromiso', 'Compromiso'], ['puntualidad', 'Puntualidad'], ['respeto', 'Respeto']].map(([k, n]) => `<label>${n}<select class="co-in" data-asp="${k}"><option value="">—</option>${[5, 4, 3, 2, 1].map((s) => `<option ${((mia.aspectos || {})[k]) === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>`).join('')}</div>
      <textarea class="co-in" id="evCom" rows="2" maxlength="400" placeholder="Comentario (opcional)">${esc(mia.comentario || '')}</textarea>
      <button class="co-btn" data-c="cx-evaluar" data-x="${x.vinculo}">${mia.estrellas ? 'Actualizar evaluación' : 'Guardar evaluación'}</button>` : '<p class="co-peq">Podrán evaluarse después de 7 días de trabajar juntos.</p>'}</div>`;
  h += `<div class="co-card"><b>Reputación como cliente</b><p>${R.evaluaciones ? `★ ${Number(R.promedio).toFixed(1)} de ${R.evaluaciones} ${R.evaluaciones === 1 ? 'evaluación' : 'evaluaciones'} de coaches` : 'Aún sin evaluaciones.'}</p></div>`;
  if (E.historial.length) h += '<div class="co-sec">Historial</div>' + E.historial.map((e) => `<div class="co-card"><div class="co-top"><b>${e.mia ? 'Tú' : esc(nombreCorto(x.nombre))} · ${esc(e.periodo)}</b><span>${'★'.repeat(e.estrellas)}</span></div>${e.comentario ? `<p>${esc(e.comentario)}</p>` : ''}</div>`).join('');
  return h;
};
window.__coachFichaResumen = async function (x) {
  const F = await llamar('coach_ficha', { p_cliente: x.cliente_id });
  let h = '';
  if (F.reputacion && F.reputacion.evaluaciones) h += `<p class="co-peq">Reputación como cliente: ★ ${Number(F.reputacion.promedio).toFixed(1)} (${F.reputacion.evaluaciones})</p>`;
  h += `<div class="co-card"><div class="co-top"><b>Próximas citas</b><button class="co-link cx-link" data-c="cx-agendar-cli" data-x="${esc(x.cliente_id)}" data-n="${esc(x.nombre)}">＋ Agendar</button></div>${F.proximas.length ? F.proximas.map((e) => `<p>${fecha(e.inicio)} · ${esc(e.titulo)}</p>`).join('') : '<p class="co-peq">Nada agendado.</p>'}</div>`;
  h += `<div class="co-card"><div class="co-top"><b>Alimentación</b><span>${F.nutricion.plan ? 'Plan del coach' : 'Plan de la app'}</span></div><button class="co-btn co-sec-btn co-mini" data-c="cx-tabficha" data-x="plan">${F.nutricion.puede ? (F.nutricion.plan ? 'Ver o ajustar plan' : 'Enviar plan') : 'Ver'}</button></div>`;
  h += `<div class="cx-acciones"><button class="co-btn co-sec-btn" data-c="cx-ir-casos" data-x="${esc(x.cliente_id)}" data-t="conducta">Reportar a Aeterion</button><button class="co-btn co-sec-btn" data-c="cx-bloquear" data-x="${x.vinculo}" data-n="${esc(x.nombre)}">Bloquear</button></div>`;
  return h;
};

/* =================================================================
   MATERIAL EXTRA, VENDER y GANANCIAS
================================================================= */
const DOCS2 = {
  'mensajes': ['Mensajes listos para WhatsApp', 'Plantillas para el día a día con tus clientes', `
<h4>Bienvenida</h4><p>«¡Hola, {nombre}! Ya quedaste vinculado conmigo en Aeterion. En la app verás tu programa en Entrenar como “Sugerencia de tu coach”. Registra cada ejercicio para que yo pueda ajustar tus cargas. Cualquier duda, escríbeme por el chat de la app.»</p>
<h4>Recordatorio amable (3–5 días sin entrenar)</h4><p>«{nombre}, ¿cómo vas? Vi que no has registrado entrenos esta semana. ¿Te ajusto el programa a menos días para que sea más fácil cumplir?»</p>
<h4>Felicitación concreta</h4><p>«¡Subiste {kg} kg en {ejercicio} en 4 semanas! Eso es progreso real. Sigamos así.»</p>
<h4>Antes de su sesión</h4><p>«Mañana a las {hora} nos vemos. Trae agua y algo de comer 1–2 h antes. Si no puedes, avísame con 24 h para reprogramar sin costo.»</p>
<h4>Cierre de mes</h4><p>«Este mes entrenaste {n} veces y tu constancia fue de {x}%. El próximo mes vamos por {meta}. ¿Qué fue lo más difícil?»</p>
<p class="nota">Evita prometer resultados («bajarás 10 kg»). Habla de hábitos y avances medibles.</p>`],
  'inicio-30': ['Los primeros 30 días de un cliente', 'Cuando más clientes se pierden y cómo evitarlo', `
<ol><li><b>Semana 1:</b> programa sencillo (2–3 días), técnica y reserva alta (3 repeticiones). Objetivo: que vuelva.</li><li><b>Semana 2:</b> revisa su registro. Si cumplió, mantén; si faltó, reduce días antes de exigir más.</li><li><b>Semana 3:</b> primer ajuste de cargas con el motor. Explícale por qué.</li><li><b>Semana 4:</b> revisión con medidas y fotos (si quiere), y evalúense en la app.</li></ol>
<p>Un mensaje personal a la semana y una cita agendada en tu Agenda reducen las bajas más que cualquier promoción.</p>`],
  'progresion': ['Progresión de cargas en la práctica', 'Cómo usar repeticiones en reserva (RIR) con el motor', `
<ul><li><b>Doble progresión:</b> trabaja dentro de un rango (ej. 8–12). Cuando completa todas las series en el tope con la reserva indicada, sube la carga (2.5–5% en tren superior, 5–10% en inferior) y regresa al inicio del rango.</li>
<li><b>Reserva (RIR):</b> 2–3 para la mayoría del trabajo; 0–1 solo en ejercicios seguros y con experiencia.</li>
<li><b>El motor:</b> calcula la carga desde su mejor marca reciente (1RM estimado) para las repeticiones y reserva que pongas. Úsalo como punto de partida y ajusta con lo que ves.</li>
<li><b>Cuándo no subir:</b> dolor, técnica que se rompe, sueño muy malo o semanas de mucho estrés.</li></ul>
<p class="nota">El 1RM estimado (fórmula de Epley) es aproximado, sobre todo con más de 10 repeticiones.</p>`],
  'nutricion-alcance': ['Nutrición dentro de tu alcance', 'Qué puedes orientar si no eres nutriólogo(a)', `
<h4>Sí puedes</h4><ul><li>Orientar hábitos generales: comer proteína en cada comida, verduras, agua, horarios, sueño.</li><li>Recomendar que use el plan de la app (Nutrición › Plan General), que ya calcula calorías y macros con base en su perfil.</li><li>Revisar con él su registro de comidas si te lo comparte.</li></ul>
<h4>No puedes (sin autorización y cédula)</h4><ul><li>Diseñar dietas con cantidades exactas para enfermedades o condiciones (diabetes, renal, embarazo, trastornos alimentarios).</li><li>Prometer pérdida de peso en tiempos concretos.</li></ul>
<p>Si tienes licenciatura o certificación en nutrición, súbela en tu perfil y pide la autorización en «Escribir a Aeterion» para enviar planes desde la ficha del cliente.</p>`],
  'precios': ['Cómo poner tus precios', 'Sesiones, mensualidades y paquetes', `
<ol><li><b>Calcula tu costo por hora:</b> transporte, gimnasio, tu membresía Aeterion, impuestos.</li><li><b>Mira tu zona:</b> compara con 3–5 entrenadores de tu nivel.</li><li><b>Paquetes:</b> la mensualidad en línea suele retener mejor que sesiones sueltas.</li><li><b>Respeta tu tope de nivel:</b> Aeterion fija máximos por nivel para proteger a los clientes.</li></ol>
<p class="nota">No es asesoría fiscal. Consulta a un contador para tu régimen (las comisiones de Aeterion requieren factura).</p>`],
  'conflictos': ['Reembolsos, problemas y reportes', 'Qué hacer cuando algo sale mal', `
<ul><li><b>Cancelaciones:</b> con 24 h o más, el cliente recibe su dinero completo. Si tú cancelas o no llegas, siempre se le devuelve y cuenta como falta.</li><li><b>Disputas:</b> si el cliente reporta que no llegaste, Aeterion revisa ambas versiones. Contesta en «Escribir a Aeterion» con fechas y pruebas.</li><li><b>Trato inadecuado:</b> si un cliente te falta al respeto o te acosa, termina el vínculo, bloquéalo desde su ficha y repórtalo. Tu seguridad primero.</li><li><b>Pagos:</b> nunca cobres por fuera de la app. Es una de las causas de baja de la red.</li></ul>`],
  'evaluacion-inicial': ['Evaluación inicial y seguimiento', 'Qué medir y cada cuánto', `
<ul><li><b>Al inicio:</b> objetivo, historial (lista de seguridad), peso, cintura, 2–3 pruebas simples (sentadilla a caja, lagartijas, plancha) y fotos opcionales.</li><li><b>Cada 4 semanas:</b> peso y cintura (si los comparte), constancia, y una prueba repetida.</li><li><b>Cada 8–12 semanas:</b> revisa el objetivo y cambia lo necesario del programa.</li></ul>
<p>Registra todo en sus notas privadas y agenda la siguiente revisión en tu Agenda: tu cliente la verá en su app.</p>`],
};
const academiaOrig = VISTAS['c-academia'];
VISTAS['c-academia'] = async (v) => (await academiaOrig(v)).replace('<div class="co-sec">Cursos avanzados</div>',
  '<div class="co-sec">Más guías prácticas</div>' + Object.keys(DOCS2).map((k) => `<button class="cx-base" data-c="cx-doc2" data-x="${k}"><b>${DOCS2[k][0]}</b><span>${DOCS2[k][1]}</span><i>Leer ›</i></button>`).join('') + '<div class="co-sec">Cursos avanzados</div>');
VISTAS['c-doc2'] = async (v) => { const d = DOCS2[v.id]; return d ? titulo(d[0], d[1]) + `<div class="co-card cx-doc">${d[2]}</div>` : ''; };

VISTAS['c-vender'] = async () => {
  const k = await llamar('coach_mis_comisiones'); const base = location.origin + location.pathname;
  const enlace = base + '?modo=app&ref=' + encodeURIComponent(k.codigo || '');
  const msg = `Te recomiendo la app Aeterion: entrenamiento y nutrición con evidencia. Entra con mi enlace: ${enlace}`;
  return titulo('Vender productos Aeterion', 'Ganas por cada venta, sin inventario ni cobros') + `<div class="co-card cx-codigo"><span>Tu código</span><b>${esc(k.codigo || '—')}</b><p class="co-peq">${k.referidos} ${k.referidos === 1 ? 'persona usa' : 'personas usan'} tu código</p></div>
    <div class="co-card"><b>Cómo ganas</b><ul class="co-pasos"><li><b>10%</b> de cada producto Aeterion (suplementos y accesorios) que compren tus clientes o quien entre con tu enlace.</li><li><b>30%</b> de su primera compra de Premium y <b>15%</b> de sus renovaciones por 12 meses.</li><li>Aeterion envía, cobra y atiende devoluciones. Tú solo recomiendas.</li></ul>
      <p class="co-peq">Tus clientes vinculados ya cuentan como tuyos. Para otras personas usa tu enlace o pídeles que escriban tu código.</p></div>
    <div class="co-card"><b>Tu enlace para recomendar</b><p class="cx-url">${esc(enlace)}</p><a class="co-btn co-btn-grande cx-wa" href="https://wa.me/?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">Compartir por WhatsApp</a>
      <div class="co-fila"><button class="co-btn co-sec-btn" data-c="copiar" data-x="${esc(enlace)}">Copiar enlace</button><button class="co-btn co-sec-btn" data-c="cx-ir" data-x="c-ganancias">Ver ganancias</button></div></div>
    <button class="cx-base" data-c="cx-doc" data-x="promocion"><b>Cómo recomendar sin meterte en problemas</b><span>Reglas para hablar de suplementos</span><i>Leer ›</i></button>`;
};
const ganOrig = VISTAS['c-ganancias'];
VISTAS['c-ganancias'] = async (v) => (await ganOrig(v)) + '<button class="cx-base" data-c="cx-ir" data-x="c-vender"><b>Vender productos Aeterion</b><span>Tu enlace para recomendar y ganar 10% por venta</span><i>›</i></button>';
const cuentaOrig = VISTAS['c-cuenta'];
VISTAS['c-cuenta'] = async (v) => (await cuentaOrig(v)).replace('<button class="cx-base" data-c="cx-ayuda">', '<button class="cx-base" data-c="cx-ir" data-x="c-casos"><b>Escribir a Aeterion</b><span>Reportes, reembolsos y dudas, con seguimiento</span><i>›</i></button><button class="cx-base" data-c="cx-ayuda">');

/* =================================================================
   ALUMNO: Mi coach (extras), Entrenar y Nutrición
================================================================= */
window.__miCoachExtra = async function (mc) {
  let h = '';
  if (mc.estado === 'activo') {
    const [citas, nut, ev] = await Promise.all([llamar('mis_citas_coach').catch(() => []), llamar('nutricion_mia').catch(() => null), llamar('evaluaciones_vinculo', { p_vinculo: mc.vinculo }).catch(() => null)]);
    if (citas.length) h += '<div class="co-sec">Próximas citas</div><div class="co-card">' + citas.map((c) => `<p>🗓️ ${fecha(c.inicio)} · <b>${esc(c.titulo)}</b>${c.nota ? ' · ' + esc(c.nota) : ''}</p>`).join('') + '</div>';
    h += '<div class="co-sec">Alimentación</div>' + (nut ? `<div class="co-card"><b>Plan de tu coach</b><p class="co-peq">También lo ves en Nutrición. El plan de la app sigue disponible.</p>${tarjetaNut(nut)}</div>` : '<p class="co-peq">Tu coach no te ha enviado plan de alimentación; usa el plan recomendado de la app en Nutrición.</p>');
    if (ev) {
      const mia = ev.mia || {};
      h += `<div class="co-sec">Evalúa a tu coach</div><div class="co-card">${ev.puede ? `<p class="co-peq">Una evaluación por mes. Ayuda a otros a elegir y a tu coach a mejorar.</p>${estrellasInput('evEst', mia.estrellas)}
        <div class="cx-asp">${[['comunicacion', 'Comunicación'], ['conocimiento', 'Conocimiento'], ['puntualidad', 'Puntualidad'], ['trato', 'Trato']].map(([k, n]) => `<label>${n}<select class="co-in" data-asp="${k}"><option value="">—</option>${[5, 4, 3, 2, 1].map((s) => `<option ${((mia.aspectos || {})[k]) === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>`).join('')}</div>
        <textarea class="co-in" id="evCom" rows="2" maxlength="400" placeholder="Comentario (opcional)">${esc(mia.comentario || '')}</textarea><button class="co-btn" data-c="cx-evaluar" data-x="${mc.vinculo}">${mia.estrellas ? 'Actualizar' : 'Enviar evaluación'}</button>` : '<p class="co-peq">Podrás evaluar a tu coach después de 7 días de trabajar juntos.</p>'}
        ${(ev.historial || []).filter((e) => !e.mia).slice(0, 2).map((e) => `<p class="co-peq">Tu coach te evaluó (${esc(e.periodo)}): ${'★'.repeat(e.estrellas)}${e.comentario ? ' · ' + esc(e.comentario) : ''}</p>`).join('')}</div>`;
    }
  }
  h += `<div class="co-sec">¿Algún problema?</div><div class="co-card"><p class="co-peq">Si algo no está bien (trato, cobros, reembolsos o seguridad), Aeterion lo revisa.</p>
    <div class="co-fila"><button class="co-btn co-sec-btn" data-c="cx-ir-casos" data-x="${esc(mc.coach_id)}" data-t="conducta">Reportar a Aeterion</button><button class="co-btn co-sec-btn" data-c="cx-bloquear" data-x="${mc.vinculo}" data-n="${esc(mc.nombre)}">Bloquear coach</button></div>
    <button class="co-link" style="color:var(--oro,#c9a84c)" data-c="cx-ir-casos">Mis reportes</button> · <button class="co-link" style="color:var(--oro,#c9a84c)" data-c="cx-ir-bloqueados">Bloqueados</button></div>`;
  return h;
};
window.__coachInicioExtra = async function () {
  const n = await llamar('casos_sin_leer').catch(() => 0);
  return `${n ? `<div class="co-card co-aviso-card" data-c="cx-ir-casos"><b>Aeterion te respondió</b><p>${n} ${n === 1 ? 'respuesta nueva' : 'respuestas nuevas'} a tus reportes.</p></div>` : ''}
    <div class="co-fila" style="margin-top:.4rem"><button class="co-link" style="color:var(--oro,#c9a84c)" data-c="cx-ir-casos">Escribir a Aeterion</button></div>`;
};
function tarjetaNut(n) {
  return `${n.kcal ? `<div class="cx-macros-v"><div><b>${n.kcal}</b><span>kcal</span></div>${n.proteina_g != null ? `<div><b>${n.proteina_g} g</b><span>Proteína</span></div>` : ''}${n.carbos_g != null ? `<div><b>${n.carbos_g} g</b><span>Carbos</span></div>` : ''}${n.grasas_g != null ? `<div><b>${n.grasas_g} g</b><span>Grasas</span></div>` : ''}</div>` : ''}
    ${(n.comidas || []).map((c) => `<div class="cx-com-v"><b>${esc(c.nombre)}</b><p>${esc(c.texto)}</p></div>`).join('')}${n.nota ? `<p class="co-peq">${esc(n.nota)}</p>` : ''}`;
}

// ---- Entrenar: «Sugerencia de tu coach» arriba, sin quitar la rutina de la app ----
const leerDia = () => { try { return JSON.parse(localStorage.getItem('aet_coach_dia') || '{}'); } catch (e) { return {}; } };
const guardarDia = (o) => { try { localStorage.setItem('aet_coach_dia', JSON.stringify(o)); } catch (e) {} };
let PROG = null, NUT = null;
window.coachSugerencia = async function (forzar) {
  const el = $('appCoachSug'); if (!el) return;
  const E = K.est(); if (!E || !E.mi_coach || E.mi_coach.estado !== 'activo') { el.innerHTML = ''; return; }
  if (!PROG || forzar) PROG = await llamar('programa_mio').catch(() => null);
  const pr = PROG; if (!pr || !Array.isArray(pr.dias) || !pr.dias.length) { el.innerHTML = `<div class="aet-coach-sug vacio"><span class="aet-cs-eti">TU COACH · ${esc(E.mi_coach.nombre)}</span><p>Aún no te asigna programa. Mientras, sigue con tu rutina de la app.</p><button onclick="aetIr('coach');coachAbrir('mi-coach')">Escribirle</button></div>`; return; }
  const st = leerDia(); const sig = st.prog === pr.id ? ((st.ultimo == null ? -1 : st.ultimo) + 1) % pr.dias.length : 0;
  const d = st.prog === pr.id && st.ver != null ? Math.min(st.ver, pr.dias.length - 1) : (st.prog === pr.id && st.fecha === hoyMx() && st.ultimo != null ? Math.min(st.ultimo, pr.dias.length - 1) : sig); const dia = pr.dias[d];
  const hechoHoy = st.prog === pr.id && st.fecha === hoyMx() && st.ultimo === d;
  el.innerHTML = `<div class="aet-coach-sug"><span class="aet-cs-eti">SUGERENCIA DE TU COACH · ${esc(pr.coach || E.mi_coach.nombre)}</span>
    <div class="aet-cs-top"><b>${esc(pr.nombre)}</b><span>${st.prog === pr.id && st.fecha === hoyMx() && st.ultimo === d ? 'Hecho hoy' : d === sig ? 'Te toca hoy' : 'Viendo otro día'}</span></div>
    <div class="aet-cs-dias">${pr.dias.map((x, i) => `<button class="${i === d ? 'on' : ''}" onclick="coachSugDia(${i})">${esc(x.nombre.split(' · ')[0] || 'Día ' + (i + 1))}</button>`).join('')}</div>
    <p class="aet-cs-dia">${esc(dia.nombre)}</p>
    ${dia.ejercicios.map((e) => `<div class="aet-cs-ej"><div><b>${esc(e.n)}</b><span>${e.s} × ${esc(e.r)}${e.rir != null ? ` · reserva ${e.rir}` : ''}${e.kg ? ` · ${e.kg} kg` : ''}</span>${e.nota ? `<em>${esc(e.nota)}</em>` : ''}</div><button onclick="aetFormEntreno(${JSON.stringify(e.n).replace(/"/g, '&quot;')})">Registrar</button></div>`).join('')}
    ${pr.nota ? `<p class="aet-cs-nota">${esc(pr.nota)}</p>` : ''}
    <div class="aet-cs-acc"><button class="prim" onclick="coachSugHecho(${d})" ${hechoHoy ? 'disabled' : ''}>${hechoHoy ? '✓ Día completado' : 'Terminé este día'}</button><button onclick="aetIr('coach');coachAbrir('mi-coach',{ancla:'mensajes'})">Chat con mi coach</button></div>
    <p class="aet-cs-pie">Abajo sigue tu rutina normal de la app. Elige la que vas a hacer hoy.</p></div>`;
};
window.coachSugDia = function (i) { const st = leerDia(); st.prog = PROG && PROG.id; st.ver = i; guardarDia(st); window.coachSugerencia(); };
window.coachSugHecho = function (i) { guardarDia({ prog: PROG && PROG.id, ultimo: i, fecha: hoyMx() }); try { if (typeof aetMarcarEntreno === 'function' && !((AET.leer('aet_actividad', {})[AET.hoy()] || []).includes('e'))) aetMarcarEntreno(); } catch (e) {} toast('¡Bien! Tu coach lo verá en tu registro.'); window.coachSugerencia(); };
window.coachNutricionCard = async function (forzar) {
  const el = $('appCoachNut'); if (!el) return;
  const E = K.est(); if (!E || !E.mi_coach || E.mi_coach.estado !== 'activo') { el.innerHTML = ''; return; }
  if (!NUT || forzar) NUT = await llamar('nutricion_mia').catch(() => null);
  el.innerHTML = NUT ? `<div class="aet-coach-sug nut"><span class="aet-cs-eti">SUGERENCIA DE TU COACH · ${esc(NUT.coach)}</span><div class="aet-cs-nut">${tarjetaNut(NUT)}</div><p class="aet-cs-pie">El plan de la app sigue disponible abajo. Sigue el que acordaste con tu coach.</p></div>` : '';
};

/* =================================================================
   ACCIONES
================================================================= */
window.__coachAccion2 = async function (c, el, ocupado, V) {
  const x = el.dataset.x;
  switch (c) {
    case 'cx-estrella': { const g = el.parentElement; [...g.children].forEach((b, i) => b.classList.toggle('on', i < Number(x))); return; }
    case 'cx-doc2': return irA('c-doc2', { id: x }, true);
    case 'cx-ir-casos': {
      const enCoach = V.v.indexOf('c-') === 0; const extra = { contra: x || null, tipo: el.dataset.t || null, texto: el.dataset.texto || '' };
      if (enCoach) return irA('c-casos', extra, true); K.setVista(Object.assign({ v: 'casos' }, extra), true); window.scrollTo(0, 0); return K.pintar();
    }
    case 'cx-ir-bloqueados': K.setVista({ v: 'bloqueados' }, true); return K.pintar();
    case 'cx-caso-enviar': return ocupado(async () => {
      const t = ($('caTexto').value || '').trim(); if (t.length < 5) throw new Error(K.ERR.texto_corto);
      let contra = null;
      if (x === 'coach') contra = ($('caContra') || {}).value || null; else if ($('caSobreCoach') && $('caSobreCoach').checked) contra = (K.est().mi_coach || {}).coach_id || null;
      await llamar('caso_crear', { p_tipo: $('caTipo').value, p_texto: t, p_contra: contra, p_ref: {} });
      V.texto = ''; V.contra = null; toast('Enviado. Aeterion te contestará aquí.'); return K.pintar();
    });
    case 'cx-caso-resp': return ocupado(async () => { const t = ($('caR' + x).value || '').trim(); if (!t) throw new Error(K.ERR.mensaje_vacio); await llamar('caso_escribir', { p_caso: Number(x), p_texto: t }); return K.pintar(); });
    case 'cx-bloquear': {
      const nom = el.dataset.n || '';
      if (!confirm(`¿Bloquear a ${nom}? Se termina el vínculo, ya no podrán escribirse ni volver a conectarse. Las sesiones pagadas futuras se reembolsan.`)) return;
      const m = prompt('¿Qué pasó? Si escribes el motivo, Aeterion lo revisa como reporte (opcional).', ''); if (m == null) return;
      return ocupado(async () => { await llamar('vinculo_bloquear', { p_vinculo: Number(x), p_motivo: m, p_reportar: m.trim().length >= 5 }); X.sinCache(); toast('Bloqueado' + (m.trim().length >= 5 ? ' y reportado' : '')); await K.refrescar(); PROG = null; NUT = null; K.setVista({ v: V.v.indexOf('c-') === 0 ? 'c-clientes' : 'inicio' }); return K.pintar(); });
    }
    case 'cx-desbloquear': if (!confirm('¿Quitar el bloqueo? Podrán volver a conectarse.')) return; return ocupado(async () => { await llamar('coach_desbloquear', { p_coach: x, p_cliente: el.dataset.n }); return K.pintar(); });
    case 'cx-evaluar': return ocupado(async () => {
      const est = valorEstr('evEst'); if (!est) throw new Error(K.ERR.calificacion_invalida);
      const asp = {}; document.querySelectorAll('[data-asp]').forEach((s) => { if (s.value) asp[s.dataset.asp] = Number(s.value); });
      await llamar('evaluacion_guardar', { p_vinculo: Number(x), p_estrellas: est, p_aspectos: asp, p_comentario: ($('evCom') || {}).value || '' }); toast('Evaluación guardada'); return K.pintar();
    });
    case 'cx-nut-guardar': return ocupado(async () => {
      const comidas = [...document.querySelectorAll('.cx-comida')].map((d) => ({ nombre: d.querySelector('.cx-cn').value.trim(), texto: d.querySelector('.cx-ct').value.trim() })).filter((c) => c.nombre || c.texto);
      if (comidas.some((c) => !c.nombre || !c.texto)) throw new Error('Cada comida necesita nombre y contenido.');
      await llamar('coach_nutricion_guardar', { p: { cliente_id: x, kcal: $('nKcal').value, proteina_g: $('nProt').value, carbos_g: $('nCarb').value, grasas_g: $('nGras').value, comidas, nota: $('nNota').value } });
      toast('Plan enviado. Tu cliente lo ve en Nutrición.'); return K.pintar();
    });
    case 'cx-nut-quitar': if (!confirm('¿Quitar el plan? Tu cliente volverá a ver solo el plan de la app.')) return; return ocupado(async () => { await llamar('coach_nutricion_quitar', { p_cliente: x }); return K.pintar(); });
    case 'cx-mes': V.mes = x; V.dia = null; V.nuevo = false; return K.pintar();
    case 'cx-cal-dia': V.dia = x; if (x.slice(0, 7) !== (V.mes || hoyMx().slice(0, 7))) V.mes = x.slice(0, 7); return K.pintar();
    case 'cx-ev-nuevo': V.nuevo = true; await K.pintar(); { const f = $('cxEvForm'); if (f) f.scrollIntoView({ behavior: 'smooth' }); } return;
    case 'cx-agendar-cli': return irA('c-agenda', { nuevo: true, preCliente: x, preTitulo: 'Revisión con ' + nombreCorto(el.dataset.n || '') }, true).then(() => { const f = $('cxEvForm'); if (f) f.scrollIntoView(); });
    case 'cx-ev-guardar': return ocupado(async () => {
      const dia = $('evDia').value, hora = $('evHora').value; if (!dia || !hora) throw new Error('Elige día y hora.');
      const tit = $('evTit').value.trim(); if (tit.length < 2) throw new Error('Escribe qué vas a agendar.');
      await llamar('coach_evento_guardar', { p: { titulo: tit, tipo: $('evTipo').value, cliente_id: $('evCli').value || null, inicio: new Date(dia + 'T' + hora).toISOString(), minutos: $('evMin').value, nota: $('evNota').value } });
      toast('Agendado'); V.nuevo = false; V.dia = dia; V.mes = dia.slice(0, 7); return K.pintar();
    });
    case 'cx-ev-hecho': return ocupado(async () => { const e = (await llamar('coach_calendario', { p_desde: V.dia || hoyMx(), p_hasta: V.dia || hoyMx() })).eventos.find((q) => String(q.id) === x); if (!e) return; await llamar('coach_evento_guardar', { p: { id: e.id, titulo: e.titulo, inicio: e.inicio, hecho: !e.hecho } }); return K.pintar(); });
    case 'cx-ev-borrar': if (!confirm('¿Borrar este evento?')) return; return ocupado(async () => { await llamar('coach_evento_borrar', { p_id: Number(x) }); return K.pintar(); });
  }
};
// Cálculo rápido de calorías desde macros en el formulario del plan
document.addEventListener('input', (e) => {
  if (!e.target || !/^n(Prot|Carb|Gras)$/.test(e.target.id)) return;
  const p = Number(($('nProt') || {}).value) || 0, c = Number(($('nCarb') || {}).value) || 0, g = Number(($('nGras') || {}).value) || 0, el = $('nCalc');
  if (el) el.textContent = p || c || g ? `Los macros suman ${Math.round(p * 4 + c * 4 + g * 9)} kcal.` : '';
});

/* ---------------- Estilos ---------------- */
const css = document.createElement('style');
css.textContent = `
#coachApp .cx-estr{display:flex;gap:.3rem;margin:.6rem 0} #coachApp .cx-estr button{border:0;background:none;font-size:30px;line-height:1;color:rgba(255,255,255,.18);cursor:pointer;padding:0 .1rem;min-width:40px;min-height:40px} #coachApp .cx-estr button.on{color:#e8cf86}
#coachApp .cx-asp{display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.4rem} #coachApp .cx-asp label{font-size:11.5px;color:var(--gris,#999)}
#coachApp .cx-macros{display:grid;grid-template-columns:repeat(4,1fr);gap:.4rem;margin-top:.6rem} #coachApp .cx-macros label{font-size:10.5px;color:var(--gris,#999);text-transform:uppercase;letter-spacing:.04em;min-width:0}
#coachApp .cx-comida{border-top:1px solid rgba(255,255,255,.07);padding-top:.4rem;margin-top:.6rem} #coachApp .cx-comida textarea{resize:vertical}
#coachApp .cx-macros-v,.aet-cs-nut .cx-macros-v{display:grid;grid-template-columns:repeat(4,1fr);gap:.4rem;margin:.5rem 0}
#coachApp .cx-macros-v div{background:rgba(255,255,255,.04);border-radius:10px;padding:.5rem .2rem;text-align:center} #coachApp .cx-macros-v b{display:block;color:#fff;font-size:15px} #coachApp .cx-macros-v span{font-size:10px;color:var(--gris,#999);text-transform:uppercase}
#coachApp .cx-com-v{border-top:1px solid rgba(255,255,255,.06);padding:.5rem 0} #coachApp .cx-com-v b{color:#e8cf86;font-size:13px} #coachApp .cx-com-v p{margin:.15rem 0 0;white-space:pre-wrap}
#coachApp .cx-pill-e{font-style:normal;font-size:10.5px;font-weight:800;border-radius:20px;padding:2px 8px} #coachApp .cx-pill-e.ok{background:rgba(76,195,138,.15);color:#4cc38a} #coachApp .cx-pill-e.warn{background:rgba(232,182,76,.15);color:#e8b64c} #coachApp .cx-pill-e.gris{background:rgba(255,255,255,.08);color:#999}
#coachApp .cx-caso .co-msg{margin-top:.45rem} #coachApp .cx-caso-txt{white-space:pre-wrap} #coachApp .cx-fila-b{padding:.5rem 0;border-top:1px solid rgba(255,255,255,.06)} #coachApp .cx-fila-b:first-child{border-top:0}
#coachApp .cx-cal{padding:.7rem} #coachApp .cx-cal-cab{display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem} #coachApp .cx-cal-cab b{color:#fff;font-size:15px}
#coachApp .cx-cal-cab button{width:40px;height:40px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:none;color:var(--oro,#c9a84c);font-size:20px;cursor:pointer}
#coachApp .cx-cal-g{display:grid;grid-template-columns:repeat(7,1fr);gap:3px} #coachApp .cx-cal-d{text-align:center;font-size:10.5px;color:var(--gris,#999);padding:.2rem 0}
#coachApp .cx-cal-c{aspect-ratio:1;border:0;border-radius:9px;background:rgba(255,255,255,.03);color:#fff;font-family:var(--font-ui);font-size:13px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:0}
#coachApp .cx-cal-c.fuera{opacity:.35} #coachApp .cx-cal-c.hoy span{color:var(--oro,#c9a84c);font-weight:800} #coachApp .cx-cal-c.sel{background:rgba(201,168,76,.22);outline:1px solid var(--oro,#c9a84c)}
#coachApp .cx-cal-c i{display:flex;gap:2px} #coachApp .cx-cal-c em,#coachApp .cx-cal-ley em{display:inline-block;width:6px;height:6px;border-radius:50%;background:#7fb3d5}
#coachApp em.ses{background:#c9a84c!important} #coachApp em.personal,#coachApp em.recordatorio{background:#8aa1b1!important} #coachApp em.revision,#coachApp em.llamada,#coachApp em.evaluacion{background:#4cc38a!important}
#coachApp .cx-cal-ley{display:flex;gap:.8rem;flex-wrap:wrap;font-size:11px;color:var(--gris,#999);margin-top:.6rem} #coachApp .cx-cal-ley em{margin-right:.3rem}
#coachApp .cx-ev{border-left:3px solid #4cc38a} #coachApp .cx-ev.ses{border-left-color:#c9a84c} #coachApp .cx-ev.personal,#coachApp .cx-ev.recordatorio{border-left-color:#8aa1b1} #coachApp .cx-ev.hecho{opacity:.6}
.aet-coach-sug{background:linear-gradient(140deg,rgba(201,168,76,.16),rgba(20,20,20,.9) 60%);border:1px solid rgba(201,168,76,.5);border-radius:16px;padding:1rem;margin:0 0 1rem;font-family:var(--font-ui)}
.aet-coach-sug .aet-cs-eti{display:block;font-size:10.5px;letter-spacing:.12em;color:var(--oro,#c9a84c);font-weight:800;margin-bottom:.4rem}
.aet-coach-sug .aet-cs-top{display:flex;justify-content:space-between;align-items:center;gap:.5rem} .aet-coach-sug .aet-cs-top b{color:#fff;font-size:16px} .aet-coach-sug .aet-cs-top span{font-size:11.5px;color:#4cc38a;font-weight:700}
.aet-cs-dias{display:flex;gap:.35rem;overflow-x:auto;margin:.6rem 0 .4rem;scrollbar-width:none} .aet-cs-dias button{flex:none;border:1px solid rgba(255,255,255,.15);background:none;color:#ddd;border-radius:20px;padding:.35rem .75rem;font-size:12px;cursor:pointer;min-height:34px} .aet-cs-dias button.on{background:var(--oro,#c9a84c);color:#141109;border-color:var(--oro,#c9a84c);font-weight:700}
.aet-cs-dia{color:#e8cf86;font-size:13px;margin:.3rem 0} .aet-cs-ej{display:flex;align-items:center;gap:.6rem;padding:.55rem 0;border-top:1px solid rgba(255,255,255,.07)} .aet-cs-ej > div{flex:1;min-width:0}
.aet-cs-ej b{display:block;color:#fff;font-size:13.5px} .aet-cs-ej span{display:block;font-size:12px;color:var(--gris,#999)} .aet-cs-ej em{display:block;font-style:normal;font-size:12px;color:#e8cf86}
.aet-cs-ej button,.aet-cs-acc button,.aet-coach-sug.vacio button{border:1px solid rgba(201,168,76,.5);background:none;color:var(--oro,#c9a84c);border-radius:10px;padding:.45rem .7rem;font-size:12.5px;font-weight:700;cursor:pointer;min-height:38px}
.aet-cs-acc{display:flex;gap:.5rem;margin-top:.7rem} .aet-cs-acc button{flex:1} .aet-cs-acc .prim{background:var(--oro,#c9a84c);color:#141109;border:0} .aet-cs-acc button:disabled{opacity:.6}
.aet-cs-nota{font-size:12.5px;color:#ddd;margin:.6rem 0 0} .aet-cs-pie{font-size:11.5px;color:var(--gris,#999);margin:.6rem 0 0} .aet-coach-sug.vacio p{color:#ddd;font-size:13px}
.aet-cs-nut{padding:0!important;min-height:0!important} .aet-cs-nut .cx-macros-v div{background:rgba(255,255,255,.04);border-radius:10px;padding:.5rem .2rem;text-align:center} .aet-cs-nut .cx-macros-v b{display:block;color:#fff} .aet-cs-nut .cx-macros-v span{font-size:10px;color:#999;text-transform:uppercase}
.aet-cs-nut .cx-com-v{border-top:1px solid rgba(255,255,255,.07);padding:.5rem 0} .aet-cs-nut .cx-com-v b{color:#e8cf86;font-size:13px} .aet-cs-nut .cx-com-v p{margin:.15rem 0 0;color:#ddd;font-size:13px;white-space:pre-wrap}
`;
document.head.appendChild(css);
})();
