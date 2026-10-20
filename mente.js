/* ============================================================
   AETERION · MENTE — módulo de salud mental
   Basado en el cuaderno «Mi camino hacia el equilibrio» (TCC, DBT, mindfulness).
   Todo vive en localStorage «aet_mente» (se sincroniza con la cuenta) y es
   independiente del progreso de entrenamiento.
============================================================ */
(function () {
'use strict';
const KEY = 'aet_mente';
const $ = (id) => document.getElementById(id);
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hoy = () => AET.hoy();
const nid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const fechaBonita = (f) => { try { const [a, m, d] = f.split('-').map(Number); return new Date(a, m - 1, d).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }); } catch (e) { return f; } };
const diasEntre = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
const sumaDias = (f, n) => { const d = new Date(f + 'T12:00:00'); d.setDate(d.getDate() + n); return AET.fmt(d); };

function leer() {
  const d = AET.leer(KEY, null) || {};
  return Object.assign({ checkins: {}, practicas: {}, retos: {}, diario: {}, evals: {}, fichas: {}, activo: null }, d);
}
function guardar(d) { AET.guardar(KEY, d); }

/* ---------------- Contenido ---------------- */
const AREAS = {
  fisica: { n: 'Física', i: '💪', c: '#ff7a2f' },
  emocional: { n: 'Emocional', i: '❤️', c: '#ff6b8a' },
  mental: { n: 'Mental', i: '🧠', c: '#4aa8ff' },
  social: { n: 'Social', i: '🤝', c: '#3ecf8e' },
  espiritual: { n: 'Espiritual', i: '✨', c: '#c9a84c' },
};
const EMOS = ['Alegría', 'Calma', 'Gratitud', 'Motivación', 'Orgullo', 'Cansancio', 'Estrés', 'Ansiedad', 'Tristeza', 'Enojo', 'Miedo', 'Frustración', 'Soledad'];

const RETOS = {
  r21: { n: 'Reto 21 días de cuidado personal', c: 'Tres semanas para crear el hábito de cuidarte. Una acción simple al día.', i: '🌱', dias: [
    'Escribe 5 cosas que valoras de ti.', 'Sal a caminar al menos 25 minutos, de preferencia en un parque.', 'Practica 10 minutos de respiración profunda antes de dormir.',
    'Ordena y limpia un espacio de tu casa que te genere ruido mental.', 'Toma al menos 2 litros de agua durante el día.', 'Dedica 30 minutos a leer algo que disfrutes, sin interrupciones.',
    'Prepara y come una comida nutritiva con atención y sin pantallas.', 'Conéctate de verdad con alguien importante para ti.', 'Tómate un descanso completo de redes sociales durante 24 horas.',
    'Haz 20 minutos de yoga, pilates o estiramientos.', 'Escríbele una carta a tu yo del futuro (la encuentras en Escribe).', 'Pon tu canción favorita y baila sin pena.',
    'Prueba una actividad nueva que hayas querido intentar.', 'Medita 15 minutos enfocándote solo en tu respiración.', 'Empieza tu diario de gratitud: anota 3 cosas buenas del día.',
    'Haz algo creativo: dibujar, escribir, cocinar o fotografiar.', 'Acuéstate 30 minutos antes de lo normal. Prioriza el descanso.', 'Haz un acto de bondad sin esperar nada a cambio.',
    'Desconéctate del trabajo o la escuela al menos 2 horas esta tarde.', 'Reflexiona sobre tus avances y escribe qué has notado en ti.', 'Define 3 hábitos que vas a conservar y celebra haber llegado hasta aquí.'] },
  g30: { n: '30 días de gratitud', c: 'Pequeñas acciones que entrenan tu atención hacia lo que sí funciona y fortalecen tus relaciones.', i: '🙏', dias: [
    'Escribe un mensaje de agradecimiento a alguien que haya influido positivamente en tu vida.', 'Felicita a un compañero por algo específico que valoras de él o ella.', 'Haz una donación pequeña a una causa que te importe.',
    'Comparte un momento especial con alguien a quien quieres.', 'Organiza una salida sencilla con personas que te hacen bien.', 'Ayuda en una actividad de tu comunidad.',
    'Piensa en un recuerdo bonito y escríbelo con detalle.', 'Prepara una comida especial para alguien (o para ti).', 'Manda un mensaje motivador a alguien que lo necesite.',
    'Da un paseo en la naturaleza con atención plena.', 'Comparte una historia positiva con alguien.', 'Medita 10 minutos enfocado en la gratitud.',
    'Escribe 3 cosas buenas que pasaron esta semana.', 'Ayuda a un vecino o conocido con algo concreto.', 'Agradece a alguien que te ha guiado o apoyado.',
    'Dedica tiempo a un pasatiempo que de verdad disfrutes.', 'Ofrece ayuda con un encargo de alguien cercano.', 'Planta algo: una planta, una semilla, una flor.',
    'Sonríe a propósito a tres personas desconocidas hoy.', 'Comparte una comida con alguien que quieres.', 'Recuerda un reto que superaste y escribe qué aprendiste.',
    'Llama a alguien con quien no hayas hablado en mucho tiempo.', 'Empieza un frasco de gratitud: escribe notas para releerlas.', 'Practica 5 minutos de respiración consciente.',
    'Escribe sobre alguien que dejó una huella positiva en tu vida.', 'Describe un gesto amable que recibiste hace poco.', 'Comparte tu frase favorita con alguien.',
    'Pasa tiempo en la naturaleza y fíjate en lo bonito.', 'Anota tus tres momentos de mayor gratitud del mes.', 'Planea cómo vas a seguir practicando la gratitud el próximo mes.'] },
  a30: { n: '30 días de autoestima', c: 'La autoestima no es arrogancia: es tratarte de forma justa y amable. Estas acciones la construyen día a día.', i: '🦁', dias: [
    'Escribe 5 cualidades que valoras de ti.', 'Date un gusto consciente, algo que disfrutes sin culpa.', 'Dedica 30 minutos a un pasatiempo que te guste.',
    'Escribe una afirmación positiva y repítela durante el día.', 'Reflexiona sobre un logro reciente, por pequeño que sea.', 'Escribe una carta de agradecimiento a tu yo de hoy.',
    'Define una meta personal y escribe los primeros pasos.', 'Date un baño largo o un momento de descanso en casa.', 'Celebra un pequeño éxito de hoy.',
    'Practica la autocompasión: trátate como tratarías a alguien que quieres.', 'Escribe algo que te guste de tu personalidad.', 'Pasa tiempo con personas que te inspiran.',
    'Medita 10 minutos enfocado en tu bienestar.', 'Crea un tablero de sueños o metas que te motive.', 'Ponte algo que te haga sentir bien y seguro.',
    'Escribe tus habilidades y talentos más destacados.', 'Haz una lista de lo que valoras de ti.', 'Tómate un descanso consciente de redes sociales.',
    'Lee algo inspirador o que te impulse a crecer.', 'Mírate al espejo y dite algo amable.', 'Prueba algo diferente: una actividad, receta o lugar nuevo.',
    'Pasa tiempo en la naturaleza.', 'Escribe sobre un reto que superaste.', 'Haz algo creativo: dibuja, escribe, cocina o toma fotos.',
    'Escribe tus 3 rasgos personales favoritos.', 'Practica respiración profunda como acto de cuidado.', 'Prepara una comida nutritiva para ti, con atención.',
    'Escribe una nota de agradecimiento a tu cuerpo por todo lo que hace.', 'Haz la lista de tus logros de este mes y celébralos.', 'Arma tu rutina de autocuidado y comprométete a mantenerla.'] },
};

const FRASES_MED = ['Piensa en 3 cosas por las que hoy estás agradecido.', 'Está bien equivocarse: los errores son parte del aprendizaje.', 'Recuerda un momento en que estuviste muy orgulloso de ti.',
  'Ofrécete la misma bondad que le darías a alguien que amas.', 'Observa una emoción que sientas ahora, sin juzgarla.', 'Imagina un lugar donde te sientas completamente a salvo.',
  'Pon atención a las sensaciones de tu cuerpo, sin interpretarlas.', 'Escucha los sonidos a tu alrededor y déjate anclar en el presente.', '¿Qué aprendiste de un reto reciente?',
  'Imagina a tu yo del futuro: ¿qué habilidades quieres cultivar?', 'Visualiza una meta y los pasos concretos para alcanzarla.', 'Imagínate en un lugar natural que te dé calma.',
  '¿Cuál es tu propósito? ¿Qué le da sentido a tu vida?', 'Envía un pensamiento de paz a alguien que lo necesite.'];

const PASOS = {
  pausa: { n: 'PAUSA', i: '⏸️', c: 'Para antes de reaccionar cuando algo te altera.', area: 'emocional', fuente: 'Técnica de regulación emocional (DBT)', pasos: [
    ['P', 'Para', 'Detente. No hagas nada todavía. El impulso va a pasar.'], ['A', 'Atiende', 'Observa lo que está pasando dentro y fuera de ti.'],
    ['U', 'Usa la respiración', 'Respira profundo para calmarte. Pon distancia entre lo que pasó y tu respuesta.'], ['S', 'Selecciona', 'Elige cómo quieres responder, con intención y no por reacción.'],
    ['A', 'Actúa', 'Haz lo que elegiste, de acuerdo con tus valores.']] },
  calma: { n: 'CALMA', i: '🧊', c: 'Para emociones muy intensas, cuando sientes que te desbordas.', area: 'emocional', fuente: 'Habilidades de tolerancia al malestar (DBT)', pasos: [
    ['C', 'Controla la temperatura', 'Agua fría en la cara o en las muñecas. Ayuda a bajar la activación en segundos.'], ['A', 'Actividad física intensa', 'Un minuto de ejercicio vigoroso (sentadillas, saltos) para soltar la tensión acumulada.'],
    ['L', 'Lentifica la respiración', 'Respira lento y profundo. Que la exhalación dure más que la inhalación.'], ['M', 'Músculos relajados', 'Tensa 5 segundos y suelta cada grupo de músculos: manos, brazos, hombros, cara, piernas.'],
    ['A', 'Acepta la emoción', 'Deja que la emoción esté ahí sin pelear con ella. Va a pasar.']] },
  acepta: { n: 'ACEPTA', i: '🫶', c: 'Para tolerar un momento difícil sin empeorarlo.', area: 'emocional', fuente: 'Tolerancia al malestar (DBT)', pasos: [
    ['A', 'Aguanta', 'Reconoce la situación como es. No la evites ni la niegues.'], ['C', 'Conéctate', 'Busca a alguien de confianza o algo que te ancle.'],
    ['E', 'Expresa', 'Escribe, habla o crea. Deja que la emoción salga de forma segura.'], ['P', 'Practica algo que disfrutes', 'Haz algo que te guste o te distraiga sanamente.'],
    ['T', 'Tómate tu tiempo', 'No te presiones a reaccionar de inmediato.'], ['A', 'Acepta tus pensamientos', 'Obsérvalos sin dejar que te controlen.']] },
};

const RESP = {
  cuadrada: { n: 'Respiración cuadrada', i: '⬜', c: 'Calma el sistema nervioso en minutos. 4 segundos en cada fase.', fases: [['Inhala', 4, 'in'], ['Sostén', 4, 'hold'], ['Exhala', 4, 'out'], ['Sostén vacío', 4, 'hold0']], ciclos: 6 },
  r426: { n: 'Respiración 4-2-6', i: '🌙', c: 'La exhalación larga activa el «freno» del estrés. Ideal antes de dormir.', fases: [['Inhala', 4, 'in'], ['Sostén', 2, 'hold'], ['Exhala', 6, 'out']], ciclos: 10 },
};

// Ejercicios de escritura. campos: [clave, pregunta, tipo] tipo: t (texto), l3/l5/l6 (lista), n (0-10)
const EJ = {
  diario: { n: 'Diario de bienestar', i: '📔', area: 'emocional', c: 'Responde las que te nazcan hoy. No tienes que contestar todas.', campos: [
    ['pos', '¿Cuál fue el momento más positivo del día?', 't'], ['reto', '¿Qué reto encontraste y cómo lo manejaste?', 't'], ['sent', '¿Cómo te sentiste en general hoy?', 't'],
    ['duro', '¿Fuiste demasiado duro contigo en algún momento? ¿Cómo podrías hablarte con más amabilidad?', 't'], ['semana', '¿Qué quieres lograr esta semana para tu bienestar?', 't']] },
  gratitud: { n: 'Gratitud de hoy', i: '🙏', area: 'espiritual', c: 'Entrenar la gratitud no es negar lo difícil: es enseñarle a tu atención a ver también lo que sí funciona.', campos: [
    ['g', 'Hoy agradezco…', 'l3'], ['porque', '¿Por qué esas cosas son importantes para ti?', 't']] },
  descarga: { n: 'Descarga mental', i: '🌀', area: 'mental', c: 'Suelta todo lo que traes en la cabeza: pendientes, preocupaciones, ideas. Sin orden y sin juicio.', campos: [['txt', 'Escribe todo lo que tienes en la mente…', 'tg']] },
  frasco: { n: 'Frasco de preocupaciones', i: '🫙', area: 'emocional', c: 'Escribe cada preocupación, luego imagina que la cierras en un frasco y la dejas descansar. No tienes que resolver todo hoy.', campos: [['p', 'Me preocupa…', 'l5']], fin: 'Tus preocupaciones quedaron en el frasco. Hoy no tienes que cargarlas todas.' },
  soltar: { n: 'Soltar pensamientos', i: '🎈', area: 'mental', c: 'Escribe en cada globo un pensamiento que ya no te sirve. Al guardar, déjalos ir.', campos: [['p', 'Pensamiento que suelto…', 'l6']], fin: 'Los dejaste ir. Hay más espacio para algo más ligero.', globos: true },
  chequeo: { n: 'Chequeo emocional', i: '🌡️', area: 'emocional', c: 'Conecta con lo que sientes antes de que se acumule.', campos: [
    ['nivel', '¿Qué tan intensa es la emoción ahora? (0 nada, 10 extrema)', 'n'], ['emo', '¿Qué estoy sintiendo? Ponle nombre con el mayor detalle posible.', 't'],
    ['causa', '¿Qué situación lo provocó?', 't'], ['cuerpo', '¿Qué noto en mi cuerpo? (tensión, peso, calor, agitación…)', 't'],
    ['pens', '¿Qué pensamientos acompañan esta emoción?', 't'], ['resp', '¿Cómo reaccioné? ¿Me ayudó?', 't']] },
  apoyo: { n: 'Mi plan de apoyo', i: '🛟', area: 'emocional', c: 'Pasos concretos para cuidarte cuando una emoción te está pesando.', campos: [
    ['ahora', '¿Qué puedo hacer ahora mismo para apoyarme?', 't'], ['act', '¿Qué actividades me ayudan con esta emoción?', 't'],
    ['quien', '¿Con quién puedo hablar? (nombre y qué apoyo me da)', 't'], ['expr', '¿Cómo puedo expresar esto de forma sana? (escribir, hablar, crear, moverme)', 't'],
    ['afirm', '¿Qué frase me hace bien repetirme hoy?', 't']] },
  iceberg: { n: 'Iceberg emocional', i: '🧊', area: 'emocional', c: 'El enojo suele ser la punta del iceberg. Debajo puede haber tristeza, miedo, vergüenza, decepción o soledad.', campos: [
    ['vis', 'En esa situación, ¿qué expresé o dije? (lo visible)', 't'], ['abajo', '¿Qué sentía realmente por debajo?', 't'], ['nec', '¿Qué necesitaba en ese momento que no estaba recibiendo?', 't']] },
  sabia: { n: 'Mente sabia', i: '⚖️', area: 'mental', c: 'Mente emocional: reacciona desde lo que sientes. Mente racional: solo ve hechos. Mente sabia: usa las emociones como información sin dejar que manden. (DBT)', campos: [
    ['sit', 'Describe una situación reciente en la que reaccionaste desde la mente emocional.', 't'], ['dif', 'Si hubieras usado tu mente sabia, ¿cómo habrías respondido?', 't']] },
  tcc: { n: 'Pensamiento, emoción y conducta', i: '🔺', area: 'mental', c: 'No son los hechos los que deciden cómo te sientes, sino cómo los interpretas. Pensamiento → emoción → conducta, y vuelta a empezar. (TCC)', campos: [
    ['sit', '¿Qué situación reciente te generó malestar?', 't'], ['pens', '¿Qué pensamientos automáticos aparecieron?', 't'], ['emo', '¿Qué emociones te generaron esos pensamientos?', 't'], ['cond', '¿Qué hiciste? ¿Te ayudó?', 't']] },
  abcde: { n: 'Modelo ABCDE', i: '🔤', area: 'mental', c: 'Herramienta de Albert Ellis para cambiar creencias que te hacen sufrir de más.', campos: [
    ['a', 'A · Acontecimiento: ¿qué pasó exactamente?', 't'], ['b', 'B · Creencia: ¿qué te dijiste sobre lo que pasó?', 't'], ['c', 'C · Consecuencias: ¿cómo te sentiste y qué hiciste?', 't'],
    ['d', 'D · Disputa: ¿es totalmente cierto? ¿Hay otra forma de verlo?', 't'], ['e', 'E · Efecto: ¿cuál es una forma más equilibrada de ver esto y cómo te sientes con ella?', 't']] },
  reencuadre: { n: 'Reencuadre', i: '🖼️', area: 'mental', c: 'La imagen es la misma, pero cambiar el marco cambia cómo la ves. No es negar la realidad.', campos: [
    ['id', '1 · Escribe el pensamiento o la situación negativa.', 't'], ['cu', '2 · ¿Es realmente tan grave? ¿Es un hecho o una interpretación?', 't'], ['re', '3 · Escribe una forma alternativa y más equilibrada de verlo.', 't'], ['ref', '4 · ¿Cómo te hace sentir esta nueva perspectiva?', 't']] },
  metacog: { n: 'Pensar sobre lo que pienso', i: '🔍', area: 'mental', c: 'Observar tus pensamientos con distancia te da control sobre cómo respondes.', campos: [
    ['q1', '¿Qué estoy pensando ahora mismo?', 't'], ['q2', '¿Este pensamiento me ayuda o me perjudica?', 't'], ['q3', '¿Cómo me hace sentir?', 't'], ['q4', '¿Tiene base real o es una interpretación?', 't'], ['q5', '¿Cómo podría verlo de otra manera?', 't']] },
  dialogo: { n: 'Mi diálogo interno', i: '💬', area: 'emocional', c: 'Cambiar cómo te hablas no es mentirte: es ser justo contigo. Escribe un pensamiento que se repite y una alternativa más equilibrada.', campos: [
    ['n1', 'Pensamiento negativo que se repite', 't'], ['a1', 'Alternativa más justa y equilibrada', 't'], ['n2', 'Otro pensamiento negativo', 't'], ['a2', 'Su alternativa', 't']] },
  distorsiones: { n: 'Detecta tus distorsiones', i: '🪞', area: 'mental', c: 'Patrones automáticos que deforman la realidad. Reconocerlos es el primer paso para cambiarlos.', campos: [
    ['sel', '¿Cuáles reconoces en ti?', 'chips'], ['ej', 'Un ejemplo de cómo aparece en tus pensamientos', 't']] },
  creencias: { n: 'Creencias que te frenan', i: '⛓️', area: 'mental', c: 'Historias sobre ti que nunca cuestionaste. Ej.: «no soy suficiente», «no merezco…».', campos: [
    ['cre', '¿Qué creencia limitante identificas en ti?', 't'], ['afec', '¿Cómo afecta tus decisiones y tu día a día?', 't'], ['orig', '¿De dónde crees que viene? ¿Cuándo la aprendiste?', 't'],
    ['evi', '¿Qué evidencia hay a favor? ¿Y en contra?', 't'], ['nueva', '¿Qué creencia más útil y justa podría reemplazarla?', 't']] },
  fortalezas: { n: 'Mis fortalezas', i: '🏆', area: 'emocional', c: 'Reconocer lo que haces bien no es arrogancia: es ser justo contigo.', campos: [
    ['buena', '¿En qué soy bueno? ¿Cuáles son mis fortalezas?', 't'], ['hab', '¿Qué habilidades he desarrollado con esfuerzo?', 't'], ['logros', '¿De qué logros me siento orgulloso?', 't'], ['obst', '¿Qué obstáculos he superado?', 't']] },
  aceptacion: { n: 'Aceptación radical', i: '🌊', area: 'espiritual', c: 'Aceptar no es aprobar: es dejar de pelear con lo que no puedes cambiar para usar tu energía en lo que sí. (DBT)', campos: [
    ['res', '¿Qué situación estás resistiendo?', 't'], ['juic', '¿Qué pensamientos de juicio tienes sobre ella?', 't'], ['emo', '¿Qué emociones surgen si las observas sin juzgar?', 't'],
    ['acepto', 'Completa: «Acepto que… aunque no me guste, porque pelear contra ello solo me genera más sufrimiento.»', 't'], ['acc', '¿Qué acción puedes tomar ahora que lo aceptaste?', 't']] },
  control: { n: 'Lo que está en mis manos', i: '✋', area: 'espiritual', c: 'Mucho sufrimiento viene de querer controlar lo que no podemos. Sepáralo y pon tu energía donde sí sirve.', campos: [
    ['no', 'NO depende de mí (solo puedo aceptarlo)', 'l3'], ['si', 'SÍ depende de mí (aquí puedo actuar)', 'l3'], ['q', '¿Qué estás intentando controlar sin éxito? ¿Qué pasaría si lo aceptaras?', 't']] },
  miedos: { n: 'Escalera de miedos', i: '🪜', area: 'emocional', c: 'Ordena de menor a mayor lo que te da miedo y enfréntalo poco a poco. La meta no es dejar de sentir miedo, sino actuar a pesar de él. (TCC)', campos: [
    ['m1', 'Nivel 1-2 · Algo que me incomoda un poco', 't'], ['m2', 'Nivel 3-4', 't'], ['m3', 'Nivel 5-6', 't'], ['m4', 'Nivel 7-8', 't'], ['m5', 'Nivel 9-10 · Lo que más me cuesta', 't'], ['est', 'Mi estrategia para dar el primer paso', 't']] },
  inspira: { n: 'Alguien que me inspira', i: '⭐', area: 'social', c: 'Las personas que admiras te muestran qué valores son importantes para ti.', campos: [
    ['quien', '¿Quién te inspira? (alguien cercano o una figura pública)', 't'], ['cual', '¿Qué cualidades admiras de esa persona?', 't'], ['imp', '¿Qué impacto tiene en tu vida?', 't'], ['cult', '¿Qué de esa persona quieres cultivar en ti?', 't']] },
  futuro: { n: 'Carta a mi yo del futuro', i: '✉️', area: 'espiritual', c: 'Una cápsula del tiempo con tus esperanzas y compromisos de hoy.', campos: [['para', '¿Para tu yo de cuándo? (ej. dentro de 1 año)', 't'], ['carta', 'Querido yo del futuro…', 'tg']] },
  semana: { n: 'Lo mejor de mi semana', i: '📸', area: 'emocional', c: 'Registrar lo bueno entrena tu atención y te deja recuerdos para releer en días grises.', campos: [
    ['mom', 'El momento más destacado de la semana fue…', 't'], ['imp', '¿Por qué fue importante para ti?', 't'], ['sent', '¿Cómo te sentiste?', 't']] },
  anio: { n: 'Mi resumen del año', i: '🗓️', area: 'espiritual', c: 'Mira hacia atrás para reconocer cómo creciste y planea el siguiente año con más claridad.', campos: [
    ['logros', 'Mis 3 logros más importantes', 'l3'], ['recu', 'Recuerdos que atesoro', 't'], ['hab', 'Habilidades que desarrollé', 't'], ['retos', 'Los retos más importantes que enfrenté y qué aprendí', 't'],
    ['cambio', '¿Cómo cambié este año?', 't'], ['gracias', 'Personas a quienes agradezco', 't'], ['metas', 'Metas y hábitos para el próximo año', 't']] },
};
const DISTORSIONES = [
  ['Todo o nada', 'Ver todo en blanco y negro. «Si no salió perfecto, fue un fracaso.»'], ['Generalizar', 'Una sola cosa se vuelve regla. «Siempre lo arruino todo.»'],
  ['Filtro negativo', 'Solo ves lo malo e ignoras lo bueno.'], ['Descalificar lo positivo', 'Le quitas valor a tus logros.'],
  ['Adivinar lo peor', 'Asumir sin pruebas. «No me contestó, seguro está enojado.»'], ['Catastrofizar', 'Hacer enorme lo negativo. «Si fallo, mi vida se acaba.»'],
  ['Razonamiento emocional', '«Me siento incapaz, entonces soy incapaz.»'], ['Etiquetarte', '«Me equivoqué, soy un tonto.»']];

const EVALS = {
  cuidado: { n: 'Cuestionario de cuidado personal', i: '🧭', c: 'Del 1 (nunca) al 5 (siempre). Repítelo cada mes para ver cómo cambias.', escala: 5, items: [
    ['fisica', 'Hago algún tipo de ejercicio con regularidad.'], ['fisica', 'Duermo entre 7 y 9 horas la mayoría de las noches.'], ['fisica', 'Me alimento de forma equilibrada.'],
    ['emocional', 'Identifico y expreso mis emociones de forma sana.'], ['emocional', 'Pido apoyo cuando lo necesito, sin culpa.'], ['emocional', 'Tengo momentos para mí que me recargan.'],
    ['mental', 'Leo, aprendo o hago cosas que estimulan mi mente.'], ['mental', 'Descanso la mente con pausas o actividades relajantes.'],
    ['social', 'Dedico tiempo de calidad a personas que me importan.'], ['social', 'Pongo límites en mis relaciones sin culpa.'], ['social', 'Participo en actividades con otras personas.'],
    ['espiritual', 'Tengo momentos de reflexión, silencio o conexión interior.'], ['espiritual', 'Vivo de acuerdo con mis valores.'], ['espiritual', 'Paso tiempo en la naturaleza o en lugares que me dan paz.']] },
  emocional: { n: 'Mi cuidado emocional', i: '❤️', c: 'Del 1 (casi nunca) al 5 (siempre).', escala: 5, items: [
    ['emocional', 'Me doy tiempo para hacer cosas que me traen alegría.'], ['emocional', 'Expreso lo que siento de forma sana, sin acumular.'], ['social', 'Pongo y mantengo límites en mis relaciones.'],
    ['mental', 'Practico meditación o respiración consciente.'], ['emocional', 'Me permito descansar sin sentirme culpable.'], ['social', 'Pido apoyo cuando lo necesito.'],
    ['emocional', 'Reflexiono sobre mis emociones con regularidad.'], ['emocional', 'Me trato con amabilidad cuando me equivoco.'], ['espiritual', 'Dedico tiempo a crecer y reflexionar.'],
    ['mental', 'Tengo actividades que estimulan mi mente y me satisfacen.']] },
  vida: { n: 'Rueda de mi vida', i: '🎡', c: '¿Qué tan satisfecho estás hoy con cada área? Del 1 al 10.', escala: 10, items: [
    ['fisica', 'Salud física'], ['emocional', 'Salud mental y emocional'], ['social', 'Familia'], ['social', 'Amistades y vida social'], ['social', 'Pareja o relaciones cercanas'],
    ['mental', 'Trabajo o estudios'], ['mental', 'Finanzas'], ['emocional', 'Tiempo libre y diversión'], ['mental', 'Desarrollo personal'], ['espiritual', 'Propósito y espiritualidad']] },
};

const VALORES = ['Curiosidad', 'Alegría', 'Sabiduría', 'Autenticidad', 'Justicia', 'Paz interior', 'Independencia', 'Lealtad', 'Gratitud', 'Humildad', 'Integridad', 'Comunidad', 'Equilibrio', 'Creatividad', 'Confianza',
  'Empatía', 'Amistad', 'Perseverancia', 'Innovación', 'Aventura', 'Amabilidad', 'Servicio', 'Libertad', 'Logro', 'Espiritualidad', 'Generosidad', 'Autodisciplina', 'Seguridad', 'Conocimiento',
  'Trabajo en equipo', 'Sencillez', 'Felicidad', 'Aprendizaje', 'Salud', 'Respeto', 'Paciencia', 'Familia', 'Responsabilidad', 'Compasión', 'Liderazgo', 'Amor', 'Determinación', 'Excelencia',
  'Resiliencia', 'Flexibilidad', 'Esperanza', 'Compromiso'];
const IDEAS = {
  fisica: ['Salir a caminar', 'Estirarte 10 minutos', 'Bailar', 'Andar en bici', 'Nadar', 'Yoga', 'Correr al amanecer', 'Senderismo', 'Entrenar en casa', 'Clase de box', 'Saltar la cuerda', 'Caminar descalzo en el pasto'],
  emocional: ['Escribir en tu diario', 'Darte un baño largo', 'Escuchar música que te calme', 'Ver una película que te suba el ánimo', 'Abrazar a tu mascota', 'Dibujar o colorear', 'Llorar si lo necesitas', 'Repetir afirmaciones', 'Hacer algo creativo', 'Hacer una lista de alegría'],
  mental: ['Leer un libro', 'Aprender algo nuevo', 'Resolver un rompecabezas', 'Ver un documental', 'Ordenar tu espacio', 'Planear tu semana', 'Practicar un idioma', 'Escuchar un podcast', 'Un día sin pantallas', 'Juego de estrategia', 'Un curso en línea'],
  social: ['Llamar a un amigo', 'Organizar una comida', 'Unirte a un club o taller', 'Hacer voluntariado', 'Mandar un mensaje de ánimo', 'Tomar un café con alguien', 'Escribir una carta a mano', 'Reencontrarte con alguien especial', 'Ir a un evento de tu comunidad'],
  espiritual: ['Meditar en silencio', 'Pasar tiempo en la naturaleza', 'Leer algo que te inspire', 'Diario de gratitud', 'Ver un atardecer', 'Practicar el perdón', 'Un acto de bondad', 'Visualizar tus metas', 'Reflexionar sobre tus valores'],
};
const FICHAS = {
  afirmaciones: { n: 'Mis afirmaciones', i: '🗣️', c: 'Frases en presente y en primera persona sobre quién quieres ser. Te mostramos una cada día en tu inicio de Mente.', campos: [['a1', 'Afirmación 1 (ej. «Soy constante y cumplo lo que me propongo»)'], ['a2', 'Afirmación 2'], ['a3', 'Afirmación 3']] },
  valores: { n: 'Mis valores', i: '🧭', c: 'Elige hasta 5 valores. Cuando actúas de acuerdo con ellos hay dirección; cuando los ignoras, aparece el malestar.', tipo: 'valores' },
  alegria: { n: 'Mi lista de alegría', i: '🌞', c: 'Para los días grises: sabrás exactamente a dónde ir, qué ver o con quién hablar.', campos: [['hob', 'Pasatiempos que disfruto'], ['lug', 'Lugares que me dan paz'], ['pel', 'Películas, series o libros que me animan'], ['per', 'Personas con quienes recargo energía'],
    ['com', 'Comidas que me reconfortan'], ['mus', 'Canciones que cambian mi ánimo'], ['fis', 'Actividades físicas que disfruto'], ['peq', 'Cosas pequeñas que me hacen sonreír']] },
  circulo: { n: 'Mi círculo de apoyo', i: '🫂', c: 'Saber con quién cuentas hace más fácil pedir ayuda. Apoyo puede ser emocional, práctico, de consejo o de compañía.', campos: [['int', 'Círculo íntimo (2-3 personas de máxima confianza)'], ['cer', 'Círculo cercano (amigos o familia de confianza)'], ['con', 'En construcción (personas con quienes estás creando confianza)'], ['fort', '¿Cómo puedo fortalecer estos vínculos?']] },
  recursos: { n: 'Mis recursos', i: '🧰', c: 'Lo que te sostiene en momentos difíciles. Tenerlo a la mano lo hace más fácil de usar.', campos: [['int', 'Pasatiempos que me nutren'], ['red', 'Personas de mi red de apoyo'], ['hab', 'Mis fortalezas personales'], ['fis', 'Actividades físicas que me regulan'],
    ['emo', 'Prácticas que me calman'], ['lug', 'Lugares donde me siento bien'], ['cre', 'Creencias o valores que me sostienen']] },
  limites: { n: 'Mis límites', i: '🚧', c: 'Poner límites no es egoísmo: cuida tus relaciones. Escribe uno concreto para cada tipo.', campos: [['fis', 'Físicos (tu cuerpo, tu espacio, tu descanso)'], ['emo', 'Emocionales (no cargar emociones ajenas)'], ['men', 'Mentales (tus opiniones y valores)'], ['soc', 'Sociales (con quién y cuánto tiempo)'], ['dig', 'Digitales (desconectarte, no responder al instante)']] },
  rutinas: { n: 'Mi rutina de mañana y noche', i: '🌅', c: 'Mañana: prepara lo que puedas la noche anterior, nada de celular la primera media hora, mueve el cuerpo 10 minutos y define una intención. Noche: luz baja, sin cafeína después de las 7 pm, un ritual fijo y algo de relajación.', campos: [['man', 'Mi rutina de mañana (hora y actividad, una por línea)'], ['noc', 'Mi rutina de noche (hora y actividad, una por línea)']] },
  cambiar: { n: 'Hábitos que quiero cambiar', i: '🔁', c: 'Reconoce sin juzgarte el hábito que ya no te sirve y define con qué lo reemplazas. Hazlo fácil, atractivo y con una señal clara.', campos: [['d1', 'Hábito que quiero dejar'], ['r1', 'Hábito sano que lo reemplaza'], ['p1', 'Mi plan concreto (cuándo, dónde, cómo)'], ['d2', 'Otro hábito que quiero dejar'], ['r2', 'Lo que lo reemplaza'], ['p2', 'Mi plan concreto']] },
  plan: { n: 'Mi plan de bienestar', i: '🗺️', c: 'Para cada área: qué ya haces bien, qué quieres mejorar y una meta concreta.', tipo: 'plan' },
  ideas: { n: 'Ideas que quiero probar', i: '💡', c: 'Elige actividades de cada área. Te sugeriremos una cada día en tu inicio de Mente.', tipo: 'ideas' },
};

const APRENDE = [
  { n: 'Las 5 áreas del cuidado personal', i: '🧩', h: '<p>Cuidarte no es un lujo ni egoísmo: es la base para relacionarte, rendir y enfrentar lo difícil. Abarca cinco áreas:</p><ul><li><b>Física:</b> movimiento, sueño, alimentación, descanso.</li><li><b>Emocional:</b> reconocer y expresar lo que sientes.</li><li><b>Mental:</b> aprender, descansar la mente, ordenar tus pensamientos.</li><li><b>Social:</b> vínculos de calidad y límites sanos.</li><li><b>Espiritual:</b> valores, propósito, naturaleza, silencio.</li></ul>' },
  { n: 'Entiende tus emociones', i: '🎭', h: '<p>No hay emociones buenas ni malas: todas informan algo.</p><ul><li><b>Alegría:</b> «esto me nutre, voy bien».</li><li><b>Tristeza:</b> «necesito procesar algo; pide apoyo si lo necesitas».</li><li><b>Miedo:</b> «algo parece peligroso, préstale atención».</li><li><b>Enojo:</b> «un límite o un valor mío fue cruzado».</li><li><b>Asco:</b> «esto va contra mis valores o mi bienestar».</li><li><b>Sorpresa:</b> «algo nuevo pasa, adapta tu respuesta».</li></ul><p>Medir su intensidad (0 a 10) te ayuda a elegir qué hacer: no se maneja igual un 2 que un 9.</p>' },
  { n: 'Distorsiones cognitivas', i: '🪞', h: '<p>Patrones automáticos que deforman la realidad y generan sufrimiento de más:</p><ul>' + DISTORSIONES.map((d) => `<li><b>${d[0]}:</b> ${d[1]}</li>`).join('') + '</ul><p>Reconocerlas es el primer paso. Practícalo en «Detecta tus distorsiones» y en el «Modelo ABCDE».</p>' },
  { n: 'Mentalidad de crecimiento', i: '🌿', h: '<p>Carol Dweck: tus capacidades se desarrollan con esfuerzo, estrategia y aprendizaje.</p><ul><li>«No tengo talento» → «Aún no lo domino, pero puedo aprenderlo».</li><li>«Es demasiado difícil» → «Voy a probar otra estrategia».</li><li>«Me equivoqué, soy un fracaso» → «Este error me enseñó algo».</li><li>«Si fallo, todos lo verán» → «Fallar es parte de aprender».</li></ul><p><b>CRECER:</b> Compromiso con metas · Resiliencia · Enfoque abierto · Curiosidad · Esfuerzo · Respeto a los errores.</p>' },
  { n: 'Habilidades para afrontar lo difícil', i: '🧰', h: '<p>Mientras más herramientas tengas, más flexible eres ante la adversidad:</p><ul><li><b>Físicas:</b> ejercicio, respiración, relajación muscular.</li><li><b>Tolerancia al malestar:</b> mindfulness, aceptación radical, PAUSA.</li><li><b>Distracción sana:</b> pasatiempos, juegos, algo creativo.</li><li><b>Calmarte con los 5 sentidos:</b> música, un baño tibio, tu comida favorita.</li><li><b>Expresión:</b> escribir, hablar con alguien, arte.</li><li><b>Cognitivas:</b> reencuadre, diálogo interno amable, resolver problemas.</li></ul>' },
  { n: '6 principios para cambiar hábitos', i: '🔁', h: '<ul><li><b>Señal:</b> todo hábito empieza con un disparador claro.</li><li><b>Atractivo:</b> júntalo con algo que ya disfrutes.</li><li><b>Fácil:</b> empieza con la versión mínima.</li><li><b>Entorno:</b> diseña tu espacio para que lo bueno sea lo más fácil.</li><li><b>Meta clara:</b> específica, medible y con fecha.</li><li><b>Revisión:</b> revisa cada semana y ajusta.</li></ul><p>Lo mínimo sostenible vale más que lo perfecto de vez en cuando. Tu cerebro aprende con recompensas, no con castigos.</p>' },
  { n: 'Tipos de apoyo', i: '🤝', h: '<p>No todas las personas pueden darte el mismo apoyo. Saber qué necesitas te dice a quién buscar:</p><ul><li><b>Emocional:</b> alguien que te escucha sin juzgar.</li><li><b>Práctico:</b> ayuda concreta con tareas.</li><li><b>Informativo:</b> un consejo o una guía para decidir.</li><li><b>De compañía:</b> alguien con quien reír o simplemente estar.</li></ul><p>Pedir ayuda es una muestra de fortaleza, no de debilidad.</p>' },
  { n: 'Salud mental: el centro de todo', i: '🧠', h: '<p>Salud mental no es no sufrir nunca: es poder relacionarte contigo y con el mundo desde el equilibrio, incluso cuando las cosas son difíciles.</p><ul><li><b>Bienestar emocional:</b> entender y manejar tus emociones, tolerar la frustración.</li><li><b>Bienestar psicológico:</b> autoestima sana, propósito, claridad para decidir.</li><li><b>Bienestar social:</b> relaciones sanas y sentido de pertenencia.</li></ul><p>El ejercicio, el sueño, la alimentación y tus vínculos influyen directamente en cómo te sientes. Entrenar tu cuerpo también entrena tu mente.</p>' },
];

/* ---------------- Estado y cálculos ---------------- */
let pila = [];                   // subpantallas abiertas dentro del módulo
let vista = { v: 'inicio' };
let respTimer = null, medTimer = null;

function fechasActivas(d) {
  const s = new Set(Object.keys(d.checkins));
  Object.values(d.practicas).forEach((p) => p && !p.x && s.add(p.f));
  Object.values(d.diario).forEach((p) => p && !p.x && s.add(p.f));
  Object.values(d.evals).forEach((p) => p && !p.x && s.add(p.f));
  Object.values(d.retos).forEach((r) => Object.values((r && r.dias) || {}).forEach((x) => x && x.f && s.add(x.f)));
  return s;
}
function racha(d) {
  const s = fechasActivas(d); let n = 0, f = hoy();
  if (!s.has(f)) f = sumaDias(f, -1);
  while (s.has(f)) { n++; f = sumaDias(f, -1); }
  return n;
}
function mejorRacha(d) {
  const arr = [...fechasActivas(d)].sort(); let best = 0, cur = 0, prev = null;
  arr.forEach((f) => { cur = prev && diasEntre(prev, f) === 1 ? cur + 1 : 1; best = Math.max(best, cur); prev = f; });
  return best;
}
function totalPracticas(d) {
  return Object.values(d.practicas).filter((p) => p && !p.x).length + Object.values(d.diario).filter((p) => p && !p.x).length
    + Object.values(d.evals).filter((p) => p && !p.x).length + Object.values(d.retos).reduce((a, r) => a + Object.keys((r && r.dias) || {}).length, 0);
}
function practica(tipo, extra) {
  const d = leer(); const k = nid();
  d.practicas[k] = Object.assign({ f: hoy(), tipo, t: Date.now() }, extra || {});
  guardar(d);
  try { aetEvento('mente_' + tipo); } catch (e) {}
}
function retoEstado(d, id) {
  const r = d.retos[id] || {}; const dias = r.dias || {}; const R = RETOS[id];
  const hechos = Object.keys(dias).map(Number).filter((n) => n >= 1 && n <= R.dias.length);
  const sig = hechos.length ? Math.max(...hechos) + 1 : 1;
  const ultimo = hechos.length ? dias[Math.max(...hechos)].f : null;
  const fin = sig > R.dias.length;
  const disponible = !fin && (!ultimo || ultimo < hoy());
  return { hechos: hechos.length, sig, fin, disponible, total: R.dias.length, hoyHecho: ultimo === hoy() };
}

/* ---------------- Navegación interna ---------------- */
function ir(v, arg) { limpiarTimers(); pila.push(vista); vista = { v, arg }; pintar(); window.scrollTo(0, 0); }
function volver() { limpiarTimers(); vista = pila.pop() || { v: 'inicio' }; pintar(); window.scrollTo(0, 0); }
function aInicio() { limpiarTimers(); pila = []; vista = { v: 'inicio' }; pintar(); }
function limpiarTimers() { clearInterval(respTimer); respTimer = null; clearInterval(medTimer); medTimer = null; }
window.menteSub = () => pila.length > 0;
window.menteVolver = volver;
window.menteRender = () => { if (!pila.length) vista = { v: 'inicio' }; pintar(); };
window.menteAbrir = (v, arg) => { pila = []; vista = { v: 'inicio' }; if (v && v !== 'inicio') ir(v, arg); else pintar(); };

const cab = (t, sub) => `<button class="app-visor-volver" data-m="volver">← Volver</button><h2 class="app-titulo">${t}</h2>${sub ? `<p class="app-subtitulo">${sub}</p>` : ''}`;

/* ---------------- Vistas ---------------- */
function vInicio() {
  const d = leer(), h = hoy(), ci = d.checkins[h], rch = racha(d);
  const ult7 = []; for (let i = 6; i >= 0; i--) { const f = sumaDias(h, -i); ult7.push([f, d.checkins[f]]); }
  const prom = (() => { const v = ult7.filter((x) => x[1]).map((x) => x[1].animo); return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : '—'; })();
  const af = (() => { const a = (d.fichas.afirmaciones || {}).d || {}; const l = ['a1', 'a2', 'a3'].map((k) => a[k]).filter(Boolean); return l.length ? l[new Date().getDate() % l.length] : null; })();
  const idea = (() => { const s = ((d.fichas.ideas || {}).d || {}).sel || []; return s.length ? s[(new Date().getDate() * 7) % s.length] : null; })();
  const act = d.activo && RETOS[d.activo] ? d.activo : null;
  let retoHtml;
  if (act) {
    const e = retoEstado(d, act), R = RETOS[act], pct = Math.round(e.hechos / e.total * 100);
    retoHtml = `<div class="mt-card mt-reto" data-m="reto" data-a="${act}"><div class="mt-cardtop"><b>${R.i} ${esc(R.n)}</b><span>${e.hechos}/${e.total}</span></div>
      <div class="mt-barra"><i style="width:${pct}%"></i></div>
      <p>${e.fin ? '🏁 ¡Reto completado! Elige otro para seguir creciendo.' : e.disponible ? `<b>Día ${e.sig}:</b> ${esc(R.dias[e.sig - 1])}` : `✓ Listo por hoy. Mañana se abre el día ${e.sig}.`}</p>
      ${e.disponible ? `<button class="mt-btn" data-m="hacerdia" data-a="${act}">Hacer el día ${e.sig}</button>` : ''}</div>`;
  } else retoHtml = `<div class="mt-card" data-m="retos"><div class="mt-cardtop"><b>🏆 Empieza un reto</b><span>→</span></div><p>21 días de cuidado personal, 30 de gratitud o 30 de autoestima. Una acción al día.</p></div>`;
  return `<h2 class="app-titulo">Mente</h2><p class="app-subtitulo">Entrena tu mente como entrenas tu cuerpo</p>
  <div class="mt-stats"><div><b>${rch}</b><span>Racha (días)</span></div><div><b>${totalPracticas(d)}</b><span>Prácticas</span></div><div><b>${prom}</b><span>Ánimo 7 días</span></div></div>
  ${ci ? `<div class="mt-card mt-ci-ok"><div class="mt-cardtop"><b>Hoy te sientes ${ci.animo}/10 ${carita(ci.animo)}</b><button class="mt-link" data-m="checkin">Editar</button></div>${(ci.emo || []).length ? `<p>${ci.emo.map(esc).join(' · ')}</p>` : ''}${barras7(ult7)}</div>${ci.animo <= 3 ? apoyoBajo() : ''}`
    : `<div class="mt-card mt-ci" data-m="checkin"><div class="mt-cardtop"><b>¿Cómo estás hoy?</b><span>30 s</span></div><p>Registra tu ánimo: con el tiempo verás tus patrones y qué te hace bien.</p>${barras7(ult7)}</div>`}
  ${af ? `<div class="mt-afirm">“${esc(af)}”<span>Tu afirmación de hoy</span></div>` : ''}
  ${retoHtml}
  ${idea ? `<div class="mt-card mt-idea"><div class="mt-cardtop"><b>💡 Idea para hoy</b><button class="mt-link" data-m="idea-hecha" data-a="${esc(idea)}">La hice ✓</button></div><p>${esc(idea)}</p></div>` : ''}
  <div class="mt-sec">Calma rápida</div>
  <div class="mt-grid">${[['resp', 'cuadrada', '⬜', 'Respiración cuadrada', '2 min'], ['resp', 'r426', '🌙', 'Respirar 4-2-6', 'Antes de dormir'], ['anclaje', '', '🖐️', '5-4-3-2-1', 'Vuelve al presente'], ['pasos', 'calma', '🧊', 'CALMA', 'Emoción intensa'], ['pasos', 'pausa', '⏸️', 'PAUSA', 'Antes de reaccionar'], ['meditar', '', '🧘', 'Meditar', '5-15 min']]
    .map(([v, a, i, n, s]) => `<button class="mt-tile" data-m="${v}" data-a="${a}"><span>${i}</span><b>${n}</b><i>${s}</i></button>`).join('')}</div>
  <div class="mt-sec">Tu mente</div>
  ${[['escribe', '✍️', 'Escribe y ordena tu mente', `${Object.keys(EJ).length} ejercicios guiados: diario, gratitud, ABCDE, reencuadre…`], ['herramientas', '🛠️', 'Todas las herramientas', 'Respiración, anclaje, escaneo corporal, PAUSA, CALMA, ACEPTA y meditación'],
    ['retos', '🏆', 'Retos', 'Avanza un día a la vez'], ['evals', '📋', 'Evalúate', 'Cuidado personal, cuidado emocional y rueda de tu vida'], ['plan', '🗺️', 'Mi plan', 'Valores, afirmaciones, lista de alegría, círculo de apoyo y más'],
    ['progreso', '📈', 'Tu progreso mental', 'Racha, ánimo, emociones y tu historial'], ['aprende', '📖', 'Aprende', 'Ideas clave para entenderte mejor']]
    .map(([v, i, n, s]) => `<button class="app-card mt-ac" data-m="${v}"><div class="app-card-top"><span class="app-card-titulo">${i} ${n}</span><span class="app-card-meta">→</span></div><div class="app-card-desc">${s}</div></button>`).join('')}
  ${ayudaHtml()}`;
}
const carita = (n) => (n <= 2 ? '😞' : n <= 4 ? '😕' : n <= 6 ? '😐' : n <= 8 ? '🙂' : '😄');
const colorAnimo = (n) => (n <= 3 ? '#e57373' : n <= 5 ? '#f0b44c' : n <= 7 ? '#c9a84c' : '#3ecf8e');
function barras7(l) {
  return `<div class="mt-7">${l.map(([f, c]) => `<div><i style="height:${c ? Math.max(8, c.animo * 10) : 4}%;background:${c ? colorAnimo(c.animo) : 'rgba(255,255,255,.08)'}"></i><span>${'LMXJVSD'[(new Date(f + 'T12:00:00').getDay() + 6) % 7]}</span></div>`).join('')}</div>`;
}
function apoyoBajo() {
  return `<div class="mt-card mt-apoyo"><b>Gracias por decirlo. No tienes que pasarlo solo.</b><p>Esto puede ayudarte ahora:</p>
    <div class="mt-chips"><button class="mt-chip" data-m="resp" data-a="r426">🌙 Respiración 4-2-6</button><button class="mt-chip" data-m="pasos" data-a="calma">🧊 CALMA</button><button class="mt-chip" data-m="ej" data-a="apoyo">🛟 Mi plan de apoyo</button><button class="mt-chip" data-m="ficha" data-a="alegria">🌞 Mi lista de alegría</button></div>
    <p class="mt-peq">Si sientes que no puedes con esto o piensas en hacerte daño, llama gratis a la <b>Línea de la Vida: <a href="tel:8009112000">800 911 2000</a></b> (24 horas). En una emergencia, al <a href="tel:911">911</a>.</p></div>`;
}
function ayudaHtml() {
  return `<div class="mt-ayuda"><b>¿Necesitas hablar con alguien ahora?</b>
    <a href="tel:8009112000">📞 Línea de la Vida · 800 911 2000<span>Gratis, 24 horas, todo México</span></a>
    <a href="tel:5555335533">📞 Línea de Seguridad y Chat de Confianza · 55 5533 5533<span>CDMX</span></a>
    <a href="tel:911">🚨 Emergencias · 911</a>
    <p>Estas herramientas te ayudan a cuidarte, pero no sustituyen a un psicólogo o psiquiatra. Pedir ayuda profesional es una decisión valiente.</p></div>`;
}

function vCheckin() {
  const d = leer(), c = d.checkins[hoy()] || {};
  return cab('¿Cómo estás hoy?', 'Sin respuestas correctas. Solo sé honesto contigo.') + `
  <div class="mt-card"><b>Tu ánimo del 1 al 10</b><div class="mt-escala10" id="mtAnimo">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => `<button data-n="${n}" class="${c.animo === n ? 'on' : ''}" style="--c:${colorAnimo(n)}">${n}</button>`).join('')}</div>
  <div class="mt-escalaleg"><span>😞 Muy mal</span><span>Excelente 😄</span></div></div>
  <div class="mt-card"><b>¿Qué emociones sientes?</b><p class="mt-peq">Elige las que quieras. Ponerle nombre a lo que sientes ya ayuda a regularlo.</p>
  <div class="mt-chips" id="mtEmos">${EMOS.map((e) => `<button class="mt-chip ${(c.emo || []).includes(e) ? 'on' : ''}" data-e="${e}">${e}</button>`).join('')}</div></div>
  <div class="mt-card"><b>¿Qué pasó hoy? <span class="mt-peq">(opcional)</span></b><textarea id="mtNota" rows="3" maxlength="600" placeholder="Algo que quieras recordar de hoy…">${esc(c.nota || '')}</textarea></div>
  <button class="mt-btn mt-btn-grande" data-m="guardar-checkin">Guardar</button>`;
}

function vHerramientas() {
  const t = [['resp', 'cuadrada', RESP.cuadrada], ['resp', 'r426', RESP.r426], ['anclaje', '', { i: '🖐️', n: 'Anclaje 5-4-3-2-1', c: 'Vuelve al presente con tus cinco sentidos cuando la ansiedad te saca del momento.' }],
    ['escaneo', '', { i: '🫀', n: 'Escaneo corporal', c: 'Las emociones se sienten en el cuerpo antes de tener nombre. Aprende a escucharlas.' }],
    ['pasos', 'pausa', PASOS.pausa], ['pasos', 'calma', PASOS.calma], ['pasos', 'acepta', PASOS.acepta], ['meditar', '', { i: '🧘', n: 'Meditación guiada', c: 'De 5 a 15 minutos con una frase para guiarte. No hay forma de hacerlo mal.' }]];
  return cab('Herramientas', 'Úsalas cuando las necesites. Cada vez que practicas, cuenta para tu racha.') + t.map(([v, a, x]) =>
    `<button class="app-card mt-ac" data-m="${v}" data-a="${a}"><div class="app-card-top"><span class="app-card-titulo">${x.i} ${esc(x.n)}</span><span class="app-card-meta">→</span></div><div class="app-card-desc">${esc(x.c)}</div></button>`).join('');
}

function vResp(id) {
  const R = RESP[id];
  return cab(R.i + ' ' + R.n, R.c) + `<div class="mt-resp"><div class="mt-circ" id="mtCirc"><div><b id="mtFase">Listo</b><span id="mtSeg"></span></div></div>
    <p class="mt-peq" id="mtCiclo">${R.ciclos} ciclos · ${R.fases.map((f) => f[0] + ' ' + f[1]).join(' · ')}</p>
    <button class="mt-btn mt-btn-grande" id="mtRespBtn" data-m="resp-start" data-a="${id}">Empezar</button></div>`;
}
function respIniciar(id) {
  const R = RESP[id], circ = $('mtCirc'); let ciclo = 0, fi = 0, seg = R.fases[0][1];
  const btn = $('mtRespBtn'); btn.textContent = 'Detener'; btn.dataset.m = 'resp-stop';
  const aplicar = () => {
    const [n, s, tipo] = R.fases[fi];
    $('mtFase').textContent = n; $('mtSeg').textContent = seg;
    circ.style.transitionDuration = s + 's';
    circ.classList.toggle('grande', tipo === 'in' || tipo === 'hold');
    $('mtCiclo').textContent = `Ciclo ${ciclo + 1} de ${R.ciclos}`;
  };
  aplicar();
  respTimer = setInterval(() => {
    seg--;
    if (seg <= 0) {
      fi++; if (fi >= R.fases.length) { fi = 0; ciclo++; }
      if (ciclo >= R.ciclos) { clearInterval(respTimer); respTimer = null; terminado('resp_' + id, `Completaste ${R.ciclos} ciclos de ${R.n.toLowerCase()}.`); return; }
      seg = R.fases[fi][1]; aplicar(); try { navigator.vibrate && navigator.vibrate(30); } catch (e) {}
    } else $('mtSeg').textContent = seg;
  }, 1000);
}

function vPasos(id) {
  const P = PASOS[id], i = vista.paso || 0, p = P.pasos[i];
  return cab(P.i + ' ' + P.n, P.c) + `<div class="mt-paso"><div class="mt-letra">${p[0]}</div><h3>${esc(p[1])}</h3><p>${esc(p[2])}</p>
    <div class="mt-puntos">${P.pasos.map((_, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('')}</div></div>
    <div class="mt-fila">${i > 0 ? '<button class="mt-btn mt-sec-btn" data-m="paso-ant">Anterior</button>' : ''}<button class="mt-btn mt-btn-grande" data-m="paso-sig" data-a="${id}">${i < P.pasos.length - 1 ? 'Siguiente' : 'Terminé'}</button></div>
    <p class="mt-peq mt-fuente">${esc(P.fuente)}</p>`;
}

const ANCLA = [[5, 'cosas que VES ahora mismo'], [4, 'cosas que ESCUCHAS'], [3, 'cosas que SIENTES en tu cuerpo (texturas, temperatura, contacto)'], [2, 'cosas que HUELES (o que te gustaría oler)'], [1, 'cosa que SABOREAS']];
function vAnclaje() {
  const i = vista.paso || 0, [n, t] = ANCLA[i];
  return cab('🖐️ Anclaje 5-4-3-2-1', 'Pausa. Respira profundo tres veces. Luego recorre cada sentido despacio.') + `<div class="mt-paso"><div class="mt-letra">${n}</div><h3>Nombra ${n} ${t}</h3>
    <p class="mt-peq">Puedes escribirlas o solo decirlas en tu mente.</p>${Array.from({ length: n }, (_, k) => `<input class="mt-in" placeholder="${k + 1}.">`).join('')}
    <div class="mt-puntos">${ANCLA.map((_, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('')}</div></div>
    <button class="mt-btn mt-btn-grande" data-m="ancla-sig">${i < 4 ? 'Siguiente' : 'Terminé'}</button>`;
}

const ZONAS = ['Cabeza y cara', 'Cuello y hombros', 'Pecho y corazón', 'Estómago y abdomen', 'Brazos y manos', 'Piernas y pies'];
function vEscaneo() {
  return cab('🫀 Escaneo corporal', 'Cierra los ojos, respira profundo y recorre tu cuerpo de los pies a la cabeza. Anota dónde sientes tensión, calor, peso o vacío, y qué emoción podría ser.') +
    ZONAS.map((z, k) => `<div class="mt-card"><b>${z}</b><input class="mt-in" id="mtZs${k}" placeholder="¿Qué sensación noto?"><input class="mt-in" id="mtZe${k}" placeholder="¿Qué emoción podría ser?"></div>`).join('') +
    `<button class="mt-btn mt-btn-grande" data-m="guardar-escaneo">Guardar escaneo</button>`;
}

function vMeditar() {
  const frase = FRASES_MED[Math.floor(Math.random() * FRASES_MED.length)];
  return cab('🧘 Meditación guiada', 'Siéntate cómodo, espalda recta, pies en el piso. Cuando tu mente se distraiga (y lo hará), regresa suavemente a tu respiración. Eso es meditar.') +
    `<div class="mt-card mt-frase"><span>Tu frase guía</span>“${esc(frase)}”</div>
    <div class="mt-resp"><div class="mt-reloj" id="mtReloj">—</div>
    <div class="mt-fila" id="mtMedOps">${[5, 10, 15].map((m) => `<button class="mt-btn mt-sec-btn" data-m="med-start" data-a="${m}">${m} min</button>`).join('')}</div></div>`;
}
function medIniciar(min) {
  let s = min * 60; const r = $('mtReloj'); const ops = $('mtMedOps');
  ops.innerHTML = '<button class="mt-btn mt-sec-btn" data-m="med-stop">Terminar antes</button>';
  const pinta = () => { r.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  pinta();
  medTimer = setInterval(() => { s--; pinta(); if (s <= 0) { clearInterval(medTimer); medTimer = null; try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) {} terminado('meditar', `Meditaste ${min} minutos. Bien hecho.`, { min }); } }, 1000);
  vista.medMin = min; vista.medIni = Date.now();
}

function terminado(tipo, msg, extra) {
  practica(tipo, extra);
  const c = document.getElementById('menteApp');
  c.innerHTML = `<div class="mt-fin"><div>✨</div><h3>¡Listo!</h3><p>${esc(msg)}</p><p class="mt-peq">Racha mental: <b>${racha(leer())} ${racha(leer()) === 1 ? 'día' : 'días'}</b></p>
    <button class="mt-btn mt-btn-grande" data-m="inicio">Volver a Mente</button></div>`;
  pila = []; vista = { v: 'fin' };
}

function vEscribe() {
  const d = leer(); const cuenta = {}; Object.values(d.diario).forEach((e) => { if (e && !e.x) cuenta[e.tipo] = (cuenta[e.tipo] || 0) + 1; });
  const grupos = [['Para todos los días', ['diario', 'gratitud', 'descarga', 'chequeo', 'semana']], ['Cuando algo te pesa', ['frasco', 'soltar', 'apoyo', 'iceberg', 'aceptacion', 'control']],
    ['Cambia cómo piensas (TCC y DBT)', ['abcde', 'tcc', 'reencuadre', 'distorsiones', 'dialogo', 'metacog', 'sabia', 'creencias', 'miedos']], ['Conócete y crece', ['fortalezas', 'inspira', 'futuro', 'anio']]];
  return cab('✍️ Escribe', 'Escribir lo que piensas y sientes aclara la mente. Solo tú puedes verlo.') + grupos.map(([g, ids]) => `<div class="mt-sec">${g}</div>` + ids.map((id) => {
    const E = EJ[id];
    return `<button class="app-card mt-ac" data-m="ej" data-a="${id}"><div class="app-card-top"><span class="app-card-titulo">${E.i} ${esc(E.n)}</span><span class="app-card-meta">${cuenta[id] ? cuenta[id] + ' ✓' : AREAS[E.area].n}</span></div><div class="app-card-desc">${esc(E.c.length > 110 ? E.c.slice(0, 107) + '…' : E.c)}</div></button>`;
  }).join('')).join('') + `<button class="mt-btn mt-sec-btn" data-m="historial" style="width:100%;margin-top:.6rem">📚 Ver todo lo que he escrito</button>`;
}

function campoHtml(c, val) {
  const [k, p, t] = c;
  if (t === 't' || t === 'tg') return `<label class="mt-lab">${esc(p)}</label><textarea class="mt-in" data-k="${k}" rows="${t === 'tg' ? 8 : 3}" maxlength="3000">${esc(val || '')}</textarea>`;
  if (t === 'n') return `<label class="mt-lab">${esc(p)}</label><div class="mt-escala10 mt-n" data-k="${k}">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => `<button data-n="${n}" class="${val === n ? 'on' : ''}" style="--c:${n >= 7 ? '#e57373' : n >= 4 ? '#f0b44c' : '#3ecf8e'}">${n}</button>`).join('')}</div>`;
  if (t === 'chips') return `<label class="mt-lab">${esc(p)}</label><div class="mt-chips" data-k="${k}">${DISTORSIONES.map(([n, x]) => `<button class="mt-chip ${(val || []).includes(n) ? 'on' : ''}" data-e="${esc(n)}" title="${esc(x)}">${esc(n)}</button>`).join('')}</div>
    <div class="mt-peq" style="margin-top:.5rem">${DISTORSIONES.map(([n, x]) => `<div><b>${esc(n)}:</b> ${esc(x)}</div>`).join('')}</div>`;
  const n = Number(t.slice(1));
  return `<label class="mt-lab">${esc(p)}</label>` + Array.from({ length: n }, (_, i) => `<input class="mt-in" data-k="${k}" data-i="${i}" value="${esc((val || [])[i] || '')}" placeholder="${t === 'l6' ? '🎈 ' : ''}${i + 1}." maxlength="300">`).join('');
}
function vEj(id) {
  const E = EJ[id], ed = vista.edit ? (leer().diario[vista.edit] || {}).r || {} : {};
  return cab(E.i + ' ' + E.n, E.c) + `<div class="mt-card mt-form">${E.campos.map((c) => campoHtml(c, ed[c[0]])).join('')}</div>
    <button class="mt-btn mt-btn-grande" data-m="guardar-ej" data-a="${id}">${E.globos ? '🎈 Dejarlos ir' : 'Guardar'}</button>`;
}
function leerForm(campos, raiz) {
  const r = {};
  campos.forEach(([k, , t]) => {
    if (t === 'n') { const b = raiz.querySelector(`.mt-n[data-k="${k}"] button.on`); if (b) r[k] = Number(b.dataset.n); }
    else if (t === 'chips') r[k] = [...raiz.querySelectorAll(`.mt-chips[data-k="${k}"] .on`)].map((b) => b.dataset.e);
    else if (t[0] === 'l') r[k] = [...raiz.querySelectorAll(`input[data-k="${k}"]`)].map((x) => x.value.trim()).filter(Boolean);
    else { const x = raiz.querySelector(`textarea[data-k="${k}"]`); if (x && x.value.trim()) r[k] = x.value.trim(); }
  });
  return r;
}
const vacio = (r) => !Object.values(r).some((v) => (Array.isArray(v) ? v.length : v !== undefined && v !== ''));

function vRetos() {
  const d = leer();
  return cab('🏆 Retos', 'Un día a la vez: cada día se abre al siguiente, para que se vuelva hábito. Puedes llevar varios retos al mismo tiempo.') + Object.keys(RETOS).map((id) => {
    const R = RETOS[id], e = retoEstado(d, id), pct = Math.round(e.hechos / e.total * 100);
    return `<div class="mt-card ${d.activo === id ? 'mt-on' : ''}" data-m="reto" data-a="${id}"><div class="mt-cardtop"><b>${R.i} ${esc(R.n)}</b><span>${e.fin ? '🏁' : e.hechos + '/' + e.total}</span></div><p>${esc(R.c)}</p><div class="mt-barra"><i style="width:${pct}%"></i></div></div>`;
  }).join('');
}
function vReto(id) {
  const d = leer(), R = RETOS[id], e = retoEstado(d, id), dias = (d.retos[id] || {}).dias || {};
  return cab(R.i + ' ' + R.n, R.c) + `<div class="mt-stats"><div><b>${e.hechos}</b><span>Días hechos</span></div><div><b>${e.total - e.hechos}</b><span>Faltan</span></div><div><b>${Math.round(e.hechos / e.total * 100)}%</b><span>Avance</span></div></div>
    ${d.activo !== id && !e.fin ? `<button class="mt-btn mt-sec-btn" data-m="reto-principal" data-a="${id}" style="width:100%;margin-bottom:.8rem">Mostrar este reto en mi inicio</button>` : ''}
    <div class="mt-dias">${R.dias.map((t, k) => {
      const n = k + 1, h = dias[n], disp = e.disponible && n === e.sig;
      return `<div class="mt-dia ${h ? 'hecho' : disp ? 'hoy' : ''}" ${disp ? `data-m="hacerdia" data-a="${id}"` : ''}><span>${h ? '✓' : n}</span><div><b>Día ${n}</b><p>${esc(t)}</p>${h && h.nota ? `<p class="mt-peq">“${esc(h.nota)}”</p>` : ''}${!h && n === e.sig && !e.disponible ? '<p class="mt-peq">Se abre mañana</p>' : ''}</div>${h && h.sent ? `<em>${['', '😞', '😕', '😐', '🙂', '😄'][h.sent]}</em>` : ''}</div>`;
    }).join('')}</div>`;
}
function vHacerDia(id) {
  const d = leer(), R = RETOS[id], e = retoEstado(d, id);
  if (!e.disponible) return vReto(id);
  return cab(`Día ${e.sig} de ${e.total}`, R.n) + `<div class="mt-card mt-reto-dia"><p>${esc(R.dias[e.sig - 1])}</p></div>
    <div class="mt-card"><b>¿Cómo te sentiste?</b><div class="mt-escala10 mt-sent" id="mtSent">${[1, 2, 3, 4, 5].map((n) => `<button data-n="${n}">${['', '😞', '😕', '😐', '🙂', '😄'][n]}</button>`).join('')}</div>
    <label class="mt-lab">Una nota para ti <span class="mt-peq">(opcional)</span></label><textarea class="mt-in" id="mtDiaNota" rows="3" maxlength="600"></textarea></div>
    <button class="mt-btn mt-btn-grande" data-m="completar-dia" data-a="${id}">Lo hice ✓</button>`;
}

function vEvals() {
  const d = leer();
  return cab('📋 Evalúate', 'Una foto de cómo estás hoy. Repítelas cada mes y compara.') + Object.keys(EVALS).map((id) => {
    const E = EVALS[id], hist = Object.values(d.evals).filter((x) => x && !x.x && x.tipo === id).sort((a, b) => b.t - a.t);
    return `<button class="app-card mt-ac" data-m="eval" data-a="${id}"><div class="app-card-top"><span class="app-card-titulo">${E.i} ${esc(E.n)}</span><span class="app-card-meta">${hist.length ? 'Última: ' + fechaBonita(hist[0].f) : 'Hacer'}</span></div><div class="app-card-desc">${esc(E.c)}</div></button>`;
  }).join('');
}
function vEval(id) {
  const E = EVALS[id];
  return cab(E.i + ' ' + E.n, E.c) + E.items.map(([a, t], k) => `<div class="mt-card mt-item"><p>${k + 1}. ${esc(t)}</p><div class="mt-escala10 ${E.escala === 5 ? 'mt-5' : ''}" data-i="${k}">${Array.from({ length: E.escala }, (_, n) => `<button data-n="${n + 1}" style="--c:${AREAS[a].c}">${n + 1}</button>`).join('')}</div></div>`).join('') +
    `<button class="mt-btn mt-btn-grande" data-m="guardar-eval" data-a="${id}">Ver mi resultado</button>`;
}
function resultadoEval(id, r, prev) {
  const E = EVALS[id], por = {};
  E.items.forEach(([a], k) => { if (r[k] != null) { (por[a] = por[a] || []).push(r[k]); } });
  const pa = {}; if (prev) E.items.forEach(([a], k) => { if (prev.r[k] != null) (pa[a] = pa[a] || []).push(prev.r[k]); });
  const avg = (l) => l.reduce((x, y) => x + y, 0) / l.length;
  const filas = id === 'vida' ? E.items.map(([a, t], k) => [t, r[k], prev ? prev.r[k] : null, AREAS[a].c]) : Object.keys(por).map((a) => [AREAS[a].i + ' ' + AREAS[a].n, avg(por[a]), pa[a] ? avg(pa[a]) : null, AREAS[a].c]);
  const peor = filas.slice().sort((x, y) => x[1] - y[1])[0];
  return `<div class="mt-card"><b>Tu resultado</b>${filas.map(([n, v, p, c]) => `<div class="mt-res"><span>${esc(n)}</span><div class="mt-barra"><i style="width:${v / E.escala * 100}%;background:${c}"></i></div><em>${v.toFixed(1)}${p != null ? ` <small class="${v >= p ? 'sube' : 'baja'}">${v >= p ? '▲' : '▼'}${Math.abs(v - p).toFixed(1)}</small>` : ''}</em></div>`).join('')}
    ${peor ? `<p class="mt-peq" style="margin-top:.7rem">Área con más espacio para crecer: <b>${esc(peor[0])}</b>. Busca ideas para ella en «Mi plan» y elige una acción pequeña para esta semana.</p>` : ''}${prev ? `<p class="mt-peq">Comparado con tu evaluación del ${fechaBonita(prev.f)}.</p>` : ''}</div>`;
}

function vPlan() {
  const d = leer();
  return cab('🗺️ Mi plan', 'Tu mapa personal. Lo llenas una vez y lo ajustas cuando quieras.') + Object.keys(FICHAS).map((id) => {
    const F = FICHAS[id], f = d.fichas[id];
    return `<button class="app-card mt-ac" data-m="ficha" data-a="${id}"><div class="app-card-top"><span class="app-card-titulo">${F.i} ${esc(F.n)}</span><span class="app-card-meta">${f && f.t ? '✓ Actualizado' : 'Llenar'}</span></div><div class="app-card-desc">${esc(F.c.length > 110 ? F.c.slice(0, 107) + '…' : F.c)}</div></button>`;
  }).join('');
}
function vFicha(id) {
  const F = FICHAS[id], v = (leer().fichas[id] || {}).d || {};
  let cuerpo;
  if (F.tipo === 'valores') cuerpo = `<div class="mt-card"><b>Elige hasta 5</b><div class="mt-chips" id="mtVal">${VALORES.map((x) => `<button class="mt-chip ${(v.sel || []).includes(x) ? 'on' : ''}" data-e="${x}">${x}</button>`).join('')}</div></div>
    <div class="mt-card mt-form"><label class="mt-lab">¿Por qué son importantes para ti?</label><textarea class="mt-in" data-k="pq" rows="3">${esc(v.pq || '')}</textarea>
    <label class="mt-lab">¿Hay un área de tu vida donde no estás viviendo según tus valores?</label><textarea class="mt-in" data-k="area" rows="3">${esc(v.area || '')}</textarea></div>`;
  else if (F.tipo === 'ideas') cuerpo = Object.keys(IDEAS).map((a) => `<div class="mt-card"><b>${AREAS[a].i} ${AREAS[a].n}</b><div class="mt-chips mt-ideas">${IDEAS[a].map((x) => `<button class="mt-chip ${(v.sel || []).includes(x) ? 'on' : ''}" data-e="${esc(x)}">${esc(x)}</button>`).join('')}</div></div>`).join('');
  else if (F.tipo === 'plan') cuerpo = Object.keys(AREAS).map((a) => `<div class="mt-card mt-form"><b style="color:${AREAS[a].c}">${AREAS[a].i} ${AREAS[a].n}</b>
    <label class="mt-lab">Lo que ya hago bien</label><textarea class="mt-in" data-k="${a}_bien" rows="2">${esc(v[a + '_bien'] || '')}</textarea>
    <label class="mt-lab">Lo que quiero mejorar</label><textarea class="mt-in" data-k="${a}_mejorar" rows="2">${esc(v[a + '_mejorar'] || '')}</textarea>
    <label class="mt-lab">Mi meta concreta</label><textarea class="mt-in" data-k="${a}_meta" rows="2">${esc(v[a + '_meta'] || '')}</textarea></div>`).join('');
  else cuerpo = `<div class="mt-card mt-form">${F.campos.map(([k, p]) => `<label class="mt-lab">${esc(p)}</label><textarea class="mt-in" data-k="${k}" rows="${id === 'rutinas' ? 5 : 2}" maxlength="1500">${esc(v[k] || '')}</textarea>`).join('')}</div>`;
  return cab(F.i + ' ' + F.n, F.c) + cuerpo + `<button class="mt-btn mt-btn-grande" data-m="guardar-ficha" data-a="${id}">Guardar</button>`;
}

function vAprende() { return cab('📖 Aprende', 'Lo esencial para entenderte mejor.') + APRENDE.map((a, k) => `<details class="mt-card mt-apr"><summary>${a.i} ${esc(a.n)}</summary><div>${a.h}</div></details>`).join(''); }

function vProgreso() {
  const d = leer(), h = hoy();
  const ul30 = []; for (let i = 29; i >= 0; i--) { const f = sumaDias(h, -i); ul30.push([f, d.checkins[f]]); }
  const act = fechasActivas(d);
  const emoCuenta = {}; Object.values(d.checkins).forEach((c) => (c.emo || []).forEach((e) => { emoCuenta[e] = (emoCuenta[e] || 0) + 1; }));
  const topEmo = Object.entries(emoCuenta).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const porTipo = { 'Herramientas de calma': 0, 'Ejercicios escritos': 0, 'Días de reto': 0, 'Evaluaciones': 0, 'Registros de ánimo': Object.keys(d.checkins).length };
  Object.values(d.practicas).forEach((p) => { if (p && !p.x) porTipo['Herramientas de calma']++; });
  Object.values(d.diario).forEach((p) => { if (p && !p.x) porTipo['Ejercicios escritos']++; });
  Object.values(d.evals).forEach((p) => { if (p && !p.x) porTipo['Evaluaciones']++; });
  Object.values(d.retos).forEach((r) => { porTipo['Días de reto'] += Object.keys((r && r.dias) || {}).length; });
  const cal = []; for (let i = 34; i >= 0; i--) cal.push(sumaDias(h, -i));
  const v30 = ul30.filter((x) => x[1]).map((x) => x[1].animo);
  return cab('📈 Tu progreso mental', 'Separado de tu entrenamiento: aquí ves cómo cuidas tu mente.') + `
    <div class="mt-stats"><div><b>${racha(d)}</b><span>Racha actual</span></div><div><b>${mejorRacha(d)}</b><span>Mejor racha</span></div><div><b>${act.size}</b><span>Días practicando</span></div></div>
    <div class="mt-card"><b>Tu ánimo · últimos 30 días</b>${v30.length ? `<div class="mt-30">${ul30.map(([f, c]) => `<i title="${fechaBonita(f)}${c ? ': ' + c.animo : ''}" style="height:${c ? c.animo * 10 : 3}%;background:${c ? colorAnimo(c.animo) : 'rgba(255,255,255,.07)'}"></i>`).join('')}</div>
      <p class="mt-peq">Promedio: <b>${(v30.reduce((a, b) => a + b, 0) / v30.length).toFixed(1)}</b> · ${v30.length} registros</p>` : '<p class="mt-peq">Registra tu ánimo para ver tu gráfica.</p>'}</div>
    ${topEmo.length ? `<div class="mt-card"><b>Tus emociones más frecuentes</b>${topEmo.map(([e, n]) => `<div class="mt-res"><span>${esc(e)}</span><div class="mt-barra"><i style="width:${n / topEmo[0][1] * 100}%"></i></div><em>${n}</em></div>`).join('')}</div>` : ''}
    <div class="mt-card"><b>Días que practicaste</b><div class="mt-cal">${cal.map((f) => `<i class="${act.has(f) ? 'on' : ''} ${f === h ? 'hoy' : ''}" title="${fechaBonita(f)}"></i>`).join('')}</div><p class="mt-peq">Últimas 5 semanas</p></div>
    <div class="mt-card"><b>Lo que has hecho</b>${Object.entries(porTipo).map(([n, v]) => `<div class="mt-kv"><span>${n}</span><b>${v}</b></div>`).join('')}</div>
    <div class="mt-card"><b>Retos</b>${Object.keys(RETOS).map((id) => { const e = retoEstado(d, id); return `<div class="mt-res"><span>${RETOS[id].i} ${esc(RETOS[id].n)}</span><div class="mt-barra"><i style="width:${e.hechos / e.total * 100}%"></i></div><em>${e.hechos}/${e.total}</em></div>`; }).join('')}</div>
    <button class="mt-btn mt-sec-btn" data-m="historial" style="width:100%">📚 Mi historial de escritura y evaluaciones</button>`;
}

function vHistorial() {
  const d = leer();
  const items = [...Object.entries(d.diario).filter(([, e]) => e && !e.x).map(([k, e]) => ({ k, e, tipo: 'ej' })), ...Object.entries(d.evals).filter(([, e]) => e && !e.x).map(([k, e]) => ({ k, e, tipo: 'eval' }))].sort((a, b) => b.e.t - a.e.t);
  if (!items.length) return cab('📚 Mi historial') + '<p class="app-subtitulo">Todavía no has guardado nada. Empieza con «Gratitud de hoy»: toma 2 minutos.</p>';
  return cab('📚 Mi historial', 'Todo lo que has escrito y evaluado. Solo tú puedes verlo.') + items.map(({ k, e, tipo }) => {
    const X = tipo === 'ej' ? EJ[e.tipo] : EVALS[e.tipo]; if (!X) return '';
    let resumen = '';
    if (tipo === 'ej') { const v = Object.values(e.r || {})[0]; resumen = Array.isArray(v) ? v.join(' · ') : String(v == null ? '' : v); }
    return `<details class="mt-card mt-hist"><summary><span>${X.i} ${esc(X.n)}</span><em>${fechaBonita(e.f)}</em></summary>
      ${tipo === 'ej' ? `<p class="mt-peq">${esc(resumen.slice(0, 140))}</p>` + X.campos.map(([c, p]) => e.r && e.r[c] != null && e.r[c] !== '' ? `<div class="mt-hq"><b>${esc(p)}</b><p>${esc(Array.isArray(e.r[c]) ? e.r[c].join(' · ') : e.r[c])}</p></div>` : '').join('') : resultadoEval(e.tipo, e.r, null)}
      <button class="mt-link mt-borrar" data-m="borrar" data-a="${tipo}" data-k="${k}">Borrar</button></details>`;
  }).join('');
}

/* ---------------- Pintar y eventos ---------------- */
function pintar() {
  const c = document.getElementById('menteApp'); if (!c) return;
  const V = { inicio: vInicio, checkin: vCheckin, herramientas: vHerramientas, resp: () => vResp(vista.arg), pasos: () => vPasos(vista.arg), anclaje: vAnclaje, escaneo: vEscaneo, meditar: vMeditar,
    escribe: vEscribe, ej: () => vEj(vista.arg), retos: vRetos, reto: () => vReto(vista.arg), hacerdia: () => vHacerDia(vista.arg), evals: vEvals, eval: () => vEval(vista.arg),
    plan: vPlan, ficha: () => vFicha(vista.arg), aprende: vAprende, progreso: vProgreso, historial: vHistorial, resultado: () => vista.html };
  c.innerHTML = (V[vista.v] || vInicio)();
}

function alClic(ev) {
  const raiz = document.getElementById('menteApp'); if (!raiz || !raiz.contains(ev.target)) return;
  // selecciones simples (escalas y chips)
  const bEsc = ev.target.closest('.mt-escala10 button');
  if (bEsc) { bEsc.parentNode.querySelectorAll('button').forEach((b) => b.classList.remove('on')); bEsc.classList.add('on'); return; }
  const chip = ev.target.closest('.mt-chip[data-e]');
  if (chip && !chip.dataset.m) {
    if (chip.closest('#mtVal') && !chip.classList.contains('on') && raiz.querySelectorAll('#mtVal .on').length >= 5) { aetToast('Elige máximo 5 valores'); return; }
    chip.classList.toggle('on'); return;
  }
  const el = ev.target.closest('[data-m]'); if (!el) return;
  const m = el.dataset.m, a = el.dataset.a;
  const d = () => leer();
  switch (m) {
    case 'volver': return volver();
    case 'inicio': return aInicio();
    case 'checkin': case 'herramientas': case 'anclaje': case 'escaneo': case 'meditar': case 'escribe': case 'retos': case 'evals': case 'plan': case 'aprende': case 'progreso': case 'historial':
      return ir(m);
    case 'resp': case 'pasos': case 'ej': case 'reto': case 'hacerdia': case 'eval': case 'ficha': return ir(m, a);
    case 'resp-start': return respIniciar(a);
    case 'resp-stop': limpiarTimers(); return pintar();
    case 'med-start': return medIniciar(Number(a));
    case 'med-stop': { const min = Math.max(1, Math.round((Date.now() - (vista.medIni || Date.now())) / 60000)); limpiarTimers(); return terminado('meditar', `Meditaste ${min} ${min === 1 ? 'minuto' : 'minutos'}. Cada minuto cuenta.`, { min }); }
    case 'paso-sig': { const P = PASOS[a]; const i = (vista.paso || 0) + 1; if (i >= P.pasos.length) return terminado('pasos_' + a, `Practicaste ${P.n}. Mientras más lo uses, más automático se vuelve.`); vista.paso = i; return pintar(); }
    case 'paso-ant': vista.paso = Math.max(0, (vista.paso || 0) - 1); return pintar();
    case 'ancla-sig': { const i = (vista.paso || 0) + 1; if (i >= ANCLA.length) return terminado('anclaje', 'Volviste al presente con tus cinco sentidos.'); vista.paso = i; pintar(); return; }
    case 'guardar-checkin': {
      const b = raiz.querySelector('#mtAnimo .on'); if (!b) { aetToast('Elige un número del 1 al 10'); return; }
      const D = d(); D.checkins[hoy()] = { animo: Number(b.dataset.n), emo: [...raiz.querySelectorAll('#mtEmos .on')].map((x) => x.dataset.e), nota: raiz.querySelector('#mtNota').value.trim(), t: Date.now() };
      guardar(D); try { aetEvento('mente_checkin'); } catch (e) {}
      aetToast('Registrado. Gracias por darte este momento.'); return aInicio();
    }
    case 'guardar-escaneo': {
      const r = {}; ZONAS.forEach((z, k) => { const s = raiz.querySelector('#mtZs' + k).value.trim(), e = raiz.querySelector('#mtZe' + k).value.trim(); if (s || e) r[z] = [s, e].filter(Boolean).join(' → '); });
      if (vacio(r)) { aetToast('Anota al menos una zona'); return; }
      const D = d(); D.diario[nid()] = { tipo: 'escaneo', f: hoy(), t: Date.now(), r }; guardar(D);
      return terminado('escaneo_hecho', 'Escuchaste a tu cuerpo. Esa información te ayuda a entender lo que sientes.');
    }
    case 'guardar-ej': {
      const E = EJ[a]; const r = leerForm(E.campos, raiz);
      if (vacio(r)) { aetToast('Escribe al menos una respuesta'); return; }
      const D = d(); const k = vista.edit || nid(); D.diario[k] = { tipo: a, f: (D.diario[k] && D.diario[k].f) || hoy(), t: Date.now(), r }; guardar(D);
      try { aetEvento('mente_ej'); } catch (e) {}
      if (E.globos) { globos(r.p || []); }
      limpiarTimers(); pila = []; vista = { v: 'fin' };
      raiz.innerHTML = `<div class="mt-fin"><div>${E.i}</div><h3>Guardado</h3><p>${esc(E.fin || 'Escribirlo ya es cuidarte. Puedes releerlo en tu historial.')}</p><p class="mt-peq">Racha mental: <b>${racha(leer())} ${racha(leer()) === 1 ? 'día' : 'días'}</b></p><button class="mt-btn mt-btn-grande" data-m="inicio">Volver a Mente</button></div>`;
      return;
    }
    case 'reto-principal': { const D = d(); D.activo = a; D.activoT = Date.now(); guardar(D); aetToast('Listo, lo verás en tu inicio de Mente'); return pintar(); }
    case 'completar-dia': {
      const D = d(); const e = retoEstado(D, a); if (!e.disponible) return pintar();
      const s = raiz.querySelector('#mtSent .on');
      D.retos[a] = D.retos[a] || { inicio: hoy(), dias: {} }; D.retos[a].dias = D.retos[a].dias || {};
      D.retos[a].dias[e.sig] = { f: hoy(), t: Date.now(), nota: raiz.querySelector('#mtDiaNota').value.trim(), sent: s ? Number(s.dataset.n) : null };
      if (!D.activo) D.activo = a;
      guardar(D); try { aetEvento('mente_reto'); } catch (er) {}
      const fin = e.sig === e.total;
      limpiarTimers(); pila = []; vista = { v: 'fin' };
      raiz.innerHTML = `<div class="mt-fin"><div>${fin ? '🏁' : '✅'}</div><h3>${fin ? '¡Reto completado!' : `Día ${e.sig} hecho`}</h3><p>${fin ? `Terminaste «${esc(RETOS[a].n)}». Eso dice mucho de ti: el cuidado personal se construye todos los días.` : `Mañana se abre el día ${e.sig + 1}. Vas ${e.sig} de ${e.total}.`}</p>
        <button class="mt-btn mt-btn-grande" data-m="inicio">Volver a Mente</button></div>`;
      return;
    }
    case 'guardar-eval': {
      const E = EVALS[a], r = {};
      raiz.querySelectorAll('.mt-escala10[data-i]').forEach((g) => { const b = g.querySelector('.on'); if (b) r[g.dataset.i] = Number(b.dataset.n); });
      if (Object.keys(r).length < E.items.length) { aetToast(`Te faltan ${E.items.length - Object.keys(r).length} respuestas`); return; }
      const D = d(); const prev = Object.values(D.evals).filter((x) => x && !x.x && x.tipo === a).sort((x, y) => y.t - x.t)[0];
      D.evals[nid()] = { tipo: a, f: hoy(), t: Date.now(), r }; guardar(D); try { aetEvento('mente_eval'); } catch (e) {}
      pila = []; vista = { v: 'resultado', html: cab(E.i + ' ' + E.n) + resultadoEval(a, r, prev) + '<button class="mt-btn mt-btn-grande" data-m="inicio">Volver a Mente</button>' };
      pila.push({ v: 'inicio' }); return pintar();
    }
    case 'guardar-ficha': {
      const F = FICHAS[a]; const v = {};
      if (F.tipo === 'valores' || F.tipo === 'ideas') v.sel = [...raiz.querySelectorAll('.mt-chip.on')].map((b) => b.dataset.e);
      raiz.querySelectorAll('textarea[data-k]').forEach((x) => { if (x.value.trim()) v[x.dataset.k] = x.value.trim(); });
      const D = d(); D.fichas[a] = { t: Date.now(), d: v }; guardar(D); try { aetEvento('mente_plan'); } catch (e) {}
      aetToast('Guardado'); return volver();
    }
    case 'idea-hecha': practica('idea', { idea: a }); aetToast('¡Bien! Sumó a tu racha mental'); return pintar();
    case 'borrar': {
      if (!confirm('¿Borrar esta entrada? No se puede deshacer.')) return;
      const D = d(); const col = a === 'eval' ? D.evals : D.diario; if (col[el.dataset.k]) col[el.dataset.k] = { x: 1, t: Date.now() };
      guardar(D); return pintar();
    }
  }
}
function globos(lista) {
  const n = Math.max(3, Math.min(6, lista.length || 3));
  for (let i = 0; i < n; i++) {
    const g = document.createElement('div'); g.className = 'mt-globo'; g.textContent = '🎈';
    g.style.left = (10 + i * (80 / n)) + '%'; g.style.animationDelay = (i * 0.25) + 's';
    document.body.appendChild(g); setTimeout(() => g.remove(), 5000);
  }
}
document.addEventListener('click', alClic);

/* ---------------- Fusión entre dispositivos ---------------- */
window.menteFusion = function (R, L) {
  R = R || {}; L = L || {};
  const nuevo = (x, y) => (!x ? y : !y ? x : ((y.t || 0) >= (x.t || 0) ? y : x));
  const mapa = (a, b) => { const o = {}; new Set([...Object.keys(a || {}), ...Object.keys(b || {})]).forEach((k) => { o[k] = nuevo((a || {})[k], (b || {})[k]); }); return o; };
  const retos = {}; new Set([...Object.keys(R.retos || {}), ...Object.keys(L.retos || {})]).forEach((k) => {
    const x = (R.retos || {})[k] || {}, y = (L.retos || {})[k] || {};
    retos[k] = { inicio: [x.inicio, y.inicio].filter(Boolean).sort()[0] || null, dias: mapa(x.dias, y.dias) };
  });
  const act = (L.activoT || 0) >= (R.activoT || 0) ? L : R;
  return { checkins: mapa(R.checkins, L.checkins), practicas: mapa(R.practicas, L.practicas), diario: mapa(R.diario, L.diario), evals: mapa(R.evals, L.evals), fichas: mapa(R.fichas, L.fichas), retos, activo: act.activo || R.activo || L.activo || null, activoT: act.activoT || 0 };
};

/* ---------------- Estilos ---------------- */
const css = document.createElement('style');
css.textContent = `
body.modo-app{--ac-m:#a78bfa}
.app-nav-btn[data-p="mente"].activo{color:var(--ac-m)}
#menteApp{padding-bottom:1rem}
#menteApp .mt-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:.55rem;margin:.2rem 0 1rem}
#menteApp .mt-stats div{background:var(--negro2,#141414);border:1px solid rgba(167,139,250,.18);border-top:3px solid var(--ac-m,#a78bfa);border-radius:12px;padding:.75rem .4rem;text-align:center}
#menteApp .mt-stats b{display:block;font-family:var(--font-ui);font-size:1.5rem;color:var(--ac-m,#a78bfa);line-height:1.1}
#menteApp .mt-stats span{display:block;font-family:var(--font-ui);font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--gris);margin-top:.3rem}
#menteApp .mt-card{background:var(--negro2,#141414);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:.95rem 1rem;margin-bottom:.8rem;font-family:var(--font-ui);font-size:13.5px;color:var(--texto,#ddd);line-height:1.5}
#menteApp .mt-card[data-m]{cursor:pointer}
#menteApp .mt-card > b{display:block;color:var(--blanco,#fff);font-size:14px;margin-bottom:.45rem}
#menteApp .mt-card p{margin:.3rem 0 0}
#menteApp .mt-cardtop{display:flex;justify-content:space-between;align-items:center;gap:.6rem}
#menteApp .mt-cardtop b{color:var(--blanco,#fff);font-size:14px}
#menteApp .mt-cardtop span{color:var(--ac-m,#a78bfa);font-size:12px;font-weight:600;white-space:nowrap}
#menteApp .mt-ci{border-color:rgba(167,139,250,.45);background:linear-gradient(135deg,rgba(167,139,250,.14),rgba(167,139,250,.03))}
#menteApp .mt-on{border-color:rgba(167,139,250,.5)}
#menteApp .mt-reto{border-left:3px solid var(--ac-m,#a78bfa)}
#menteApp .mt-idea{border-left:3px solid var(--oro,#c9a84c)}
#menteApp .mt-apoyo{border-color:rgba(229,115,115,.45);background:rgba(229,115,115,.06)}
#menteApp .mt-barra{height:7px;border-radius:7px;background:rgba(255,255,255,.07);overflow:hidden;margin:.55rem 0 .15rem;flex:1}
#menteApp .mt-barra i{display:block;height:100%;border-radius:7px;background:var(--ac-m,#a78bfa)}
#menteApp .mt-btn{background:var(--ac-m,#a78bfa);color:#140f22;border:0;border-radius:12px;padding:.75rem 1.1rem;font-family:var(--font-ui);font-weight:700;font-size:14px;cursor:pointer;margin-top:.6rem}
#menteApp .mt-btn-grande{width:100%;padding:.95rem;font-size:15px}
#menteApp .mt-sec-btn{background:transparent;color:var(--ac-m,#a78bfa);border:1px solid rgba(167,139,250,.45)}
#menteApp .mt-link{background:none;border:0;color:var(--ac-m,#a78bfa);font-family:var(--font-ui);font-size:12.5px;font-weight:600;cursor:pointer;padding:0}
#menteApp .mt-fila{display:flex;gap:.6rem}
#menteApp .mt-fila .mt-btn{flex:1}
#menteApp .mt-sec{font-family:var(--font-ui);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--ac-m,#a78bfa);margin:1.3rem 0 .6rem;font-weight:700}
#menteApp .mt-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:.55rem}
#menteApp .mt-tile{background:var(--negro2,#141414);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:.8rem .35rem;text-align:center;cursor:pointer;color:var(--blanco,#fff);font-family:var(--font-ui)}
#menteApp .mt-tile span{display:block;font-size:22px;line-height:1.2}
#menteApp .mt-tile b{display:block;font-size:12px;margin-top:.3rem;font-weight:600}
#menteApp .mt-tile i{display:block;font-style:normal;font-size:10px;color:var(--gris);margin-top:.15rem}
#menteApp .mt-ac{border-left:3px solid rgba(167,139,250,.6)}
#menteApp .mt-ac .app-card-meta{color:var(--ac-m,#a78bfa)}
#menteApp .mt-afirm{text-align:center;font-family:var(--font-display,serif);font-style:italic;font-size:17px;color:var(--blanco,#fff);padding:.9rem 1rem;margin:0 0 .8rem;border-top:1px solid rgba(167,139,250,.25);border-bottom:1px solid rgba(167,139,250,.25)}
#menteApp .mt-afirm span{display:block;font-family:var(--font-ui);font-style:normal;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--ac-m,#a78bfa);margin-top:.4rem}
#menteApp .mt-7{display:flex;gap:6px;height:54px;align-items:flex-end;margin-top:.7rem}
#menteApp .mt-7 div{flex:1;display:flex;flex-direction:column;align-items:center;height:100%;justify-content:flex-end}
#menteApp .mt-7 i{display:block;width:100%;border-radius:4px 4px 2px 2px}
#menteApp .mt-7 span{font-size:9px;color:var(--gris);margin-top:3px}
#menteApp .mt-30{display:flex;gap:2px;height:70px;align-items:flex-end;margin:.6rem 0 .3rem}
#menteApp .mt-30 i{flex:1;border-radius:2px}
#menteApp .mt-escala10{display:grid;grid-template-columns:repeat(10,1fr);gap:4px;margin-top:.6rem}
#menteApp .mt-escala10.mt-n{grid-template-columns:repeat(11,1fr)}
#menteApp .mt-escala10.mt-5,#menteApp .mt-escala10.mt-sent{grid-template-columns:repeat(5,1fr)}
#menteApp .mt-escala10 button{aspect-ratio:1;max-height:46px;border-radius:9px;border:1px solid rgba(255,255,255,.12);background:transparent;color:var(--texto,#ddd);font-family:var(--font-ui);font-weight:700;font-size:13px;cursor:pointer;padding:0}
#menteApp .mt-escala10.mt-sent button{font-size:22px}
#menteApp .mt-escala10 button.on{background:var(--c,var(--ac-m,#a78bfa));border-color:transparent;color:#111}
#menteApp .mt-escalaleg{display:flex;justify-content:space-between;font-size:11px;color:var(--gris);margin-top:.35rem}
#menteApp .mt-chips{display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.5rem}
#menteApp .mt-chip{background:transparent;border:1px solid rgba(255,255,255,.14);color:var(--texto,#ddd);border-radius:30px;padding:.42rem .8rem;font-family:var(--font-ui);font-size:12.5px;cursor:pointer}
#menteApp .mt-chip.on{background:rgba(167,139,250,.2);border-color:var(--ac-m,#a78bfa);color:#fff}
#menteApp textarea,#menteApp .mt-in{width:100%;box-sizing:border-box;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.12);border-radius:10px;color:var(--blanco,#fff);font-family:var(--font-ui);font-size:14px;padding:.65rem .75rem;margin-top:.4rem;resize:vertical}
#menteApp textarea:focus,#menteApp .mt-in:focus{outline:none;border-color:var(--ac-m,#a78bfa)}
#menteApp .mt-lab{display:block;font-size:13px;color:var(--blanco,#fff);font-weight:600;margin-top:.85rem}
#menteApp .mt-form .mt-lab:first-child{margin-top:0}
#menteApp .mt-peq{font-size:12px;color:var(--gris)}
#menteApp .mt-peq a,#menteApp .mt-ayuda a{color:var(--ac-m,#a78bfa)}
#menteApp .mt-resp{display:flex;flex-direction:column;align-items:center;padding:1rem 0}
#menteApp .mt-circ{width:150px;height:150px;border-radius:50%;background:radial-gradient(circle,rgba(167,139,250,.5),rgba(167,139,250,.12));border:2px solid var(--ac-m,#a78bfa);display:grid;place-items:center;transform:scale(.62);transition:transform 4s ease-in-out;margin:2.2rem 0}
#menteApp .mt-circ.grande{transform:scale(1.15)}
#menteApp .mt-circ div{text-align:center;transform:scale(1)}
#menteApp .mt-circ b{display:block;color:#fff;font-family:var(--font-ui);font-size:18px}
#menteApp .mt-circ span{display:block;color:#fff;font-family:var(--font-ui);font-size:30px;font-weight:700}
#menteApp .mt-reloj{font-family:var(--font-ui);font-size:56px;font-weight:700;color:var(--ac-m,#a78bfa);margin:1.5rem 0 .5rem;letter-spacing:.02em}
#menteApp .mt-frase{text-align:center;font-family:var(--font-display,serif);font-style:italic;font-size:17px;color:#fff}
#menteApp .mt-frase span{display:block;font-family:var(--font-ui);font-style:normal;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--ac-m,#a78bfa);margin-bottom:.4rem}
#menteApp .mt-paso{text-align:center;background:var(--negro2,#141414);border:1px solid rgba(167,139,250,.25);border-radius:16px;padding:1.6rem 1.2rem 1.2rem;margin-bottom:.4rem}
#menteApp .mt-letra{width:64px;height:64px;border-radius:50%;margin:0 auto .8rem;display:grid;place-items:center;background:var(--ac-m,#a78bfa);color:#140f22;font-family:var(--font-ui);font-size:30px;font-weight:800}
#menteApp .mt-paso h3{color:#fff;font-family:var(--font-ui);font-size:19px;margin:0 0 .5rem}
#menteApp .mt-paso p{color:var(--texto,#ddd);font-family:var(--font-ui);font-size:14.5px;line-height:1.55;margin:0 0 .6rem}
#menteApp .mt-puntos{display:flex;justify-content:center;gap:6px;margin-top:.9rem}
#menteApp .mt-puntos i{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.15)}
#menteApp .mt-puntos i.on{background:var(--ac-m,#a78bfa)}
#menteApp .mt-fuente{text-align:center;margin-top:.8rem}
#menteApp .mt-fin{text-align:center;padding:2.5rem 1rem}
#menteApp .mt-fin > div{font-size:56px}
#menteApp .mt-fin h3{color:#fff;font-family:var(--font-ui);font-size:22px;margin:.5rem 0}
#menteApp .mt-fin p{color:var(--texto,#ddd);font-family:var(--font-ui);font-size:14.5px;line-height:1.55}
#menteApp .mt-dias{display:flex;flex-direction:column;gap:.45rem}
#menteApp .mt-dia{display:flex;gap:.8rem;align-items:flex-start;background:var(--negro2,#141414);border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:.7rem .85rem;font-family:var(--font-ui);opacity:.55}
#menteApp .mt-dia > span{flex:none;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;border:1px solid rgba(255,255,255,.18);color:var(--gris);font-size:12px;font-weight:700}
#menteApp .mt-dia b{color:#fff;font-size:13px}
#menteApp .mt-dia p{margin:.15rem 0 0;font-size:13px;color:var(--texto,#ddd);line-height:1.45}
#menteApp .mt-dia em{margin-left:auto;font-style:normal;font-size:18px}
#menteApp .mt-dia.hecho{opacity:1}
#menteApp .mt-dia.hecho > span{background:var(--ac-m,#a78bfa);border-color:transparent;color:#140f22}
#menteApp .mt-dia.hoy{opacity:1;border-color:var(--ac-m,#a78bfa);cursor:pointer;background:rgba(167,139,250,.08)}
#menteApp .mt-dia.hoy > span{border-color:var(--ac-m,#a78bfa);color:var(--ac-m,#a78bfa)}
#menteApp .mt-reto-dia p{font-family:var(--font-display,serif);font-size:19px;color:#fff;line-height:1.45;text-align:center;margin:.4rem 0}
#menteApp .mt-res{display:flex;align-items:center;gap:.6rem;margin-top:.5rem;font-size:12.5px}
#menteApp .mt-res span{flex:0 0 42%;color:var(--texto,#ddd)}
#menteApp .mt-res em{flex:none;min-width:58px;text-align:right;font-style:normal;color:#fff;font-weight:700}
#menteApp .mt-res small{font-size:10.5px;font-weight:600}
#menteApp .mt-res small.sube{color:#3ecf8e} #menteApp .mt-res small.baja{color:#e57373}
#menteApp .mt-item p{margin:0;color:#fff}
#menteApp .mt-cal{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-top:.6rem}
#menteApp .mt-cal i{aspect-ratio:1;border-radius:5px;background:rgba(255,255,255,.06)}
#menteApp .mt-cal i.on{background:var(--ac-m,#a78bfa)}
#menteApp .mt-cal i.hoy{outline:2px solid #fff;outline-offset:-2px}
#menteApp .mt-kv{display:flex;justify-content:space-between;padding:.4rem 0;border-top:1px solid rgba(255,255,255,.05)}
#menteApp .mt-kv b{color:#fff}
#menteApp .mt-apr summary,#menteApp .mt-hist summary{cursor:pointer;color:#fff;font-weight:600;font-size:14px;list-style:none;display:flex;justify-content:space-between;gap:.5rem}
#menteApp .mt-hist summary em{font-style:normal;color:var(--gris);font-size:12px;font-weight:400;white-space:nowrap}
#menteApp .mt-apr div{margin-top:.6rem}
#menteApp .mt-apr ul{padding-left:1.1rem;margin:.4rem 0}
#menteApp .mt-apr li{margin:.25rem 0}
#menteApp .mt-hq{margin-top:.6rem} #menteApp .mt-hq b{display:block;color:var(--ac-m,#a78bfa);font-size:12px} #menteApp .mt-hq p{margin:.15rem 0 0;white-space:pre-wrap}
#menteApp .mt-borrar{color:#e57373;margin-top:.7rem}
#menteApp .mt-ayuda{margin-top:1.4rem;border:1px solid rgba(229,115,115,.3);border-radius:14px;padding:1rem;font-family:var(--font-ui);font-size:13px;color:var(--texto,#ddd)}
#menteApp .mt-ayuda > b{display:block;color:#fff;margin-bottom:.5rem}
#menteApp .mt-ayuda a{display:block;padding:.55rem 0;border-top:1px solid rgba(255,255,255,.06);text-decoration:none;font-weight:600}
#menteApp .mt-ayuda a span{display:block;color:var(--gris);font-weight:400;font-size:11.5px}
#menteApp .mt-ayuda p{font-size:11.5px;color:var(--gris);margin:.6rem 0 0;line-height:1.5}
.mt-globo{position:fixed;bottom:-60px;font-size:44px;z-index:9999;pointer-events:none;animation:mtSube 4.5s ease-in forwards}
@keyframes mtSube{0%{transform:translateY(0) rotate(0)}50%{transform:translateY(-55vh) rotate(8deg)}100%{transform:translateY(-115vh) rotate(-6deg);opacity:.2}}
`;
document.head.appendChild(css);
})();
