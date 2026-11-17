// Ciclos con descanso y repetición, avisos de ciclo, pendientes desde «contar desde». Textos neutros inventados.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore } from '../js/store.js';
import { Model, parseRest, restWindow, restText, planEnd } from '../js/model.js';
import { missingDoses } from '../js/schedule.js';

const ph = (fromWeek, toWeek, amount, frequency = 'diaria') => ({ fromWeek, toWeek, amount, amountMax: null, unit: 'u', frequency, note: '' });
const mk = async (now) => {
  const m = new Model(new MemoryStore(), { now: () => new Date(now + 'T10:00:00') });
  return { m, a: await m.createProfile({ name: 'Ana' }) };
};

test('descanso leído de tu texto', () => {
  assert.deepEqual(parseRest('Descanso obligatorio de 4 semanas completas sin administrar el compuesto.'), { n: 4, unit: 'semanas' });
  assert.deepEqual(parseRest('Descanso obligatorio de 6 meses; máximo dos veces por año.'), { n: 6, unit: 'meses' });
  assert.deepEqual(parseRest('Descanso de 4 a 6 meses.'), { n: 4, unit: 'meses' });
  assert.equal(parseRest('Mantenimiento prolongado. No requiere PCT.'), null);
  assert.equal(parseRest('PCT obligatorio: Clomifeno a partir de la semana 9 durante 4 semanas.'), null);
  assert.equal(restText({ n: 4, unit: 'semanas' }), '4 semanas');
});

test('ventana de descanso: 6 semanas desde el jueves 12-nov y 4 de descanso', () => {
  const p = { start: '2026-11-12', duration: 6, durationUnit: 'semanas', rest: { n: 4, unit: 'semanas' } };
  assert.deepEqual(restWindow(p, '2026-11-17'), { from: '2026-12-24', to: '2027-01-20', restart: '2027-01-21', days: 28 });
  assert.equal(restWindow({ ...p, rest: null }, '2026-11-17'), null);
  assert.equal(restWindow({ ...p, duration: null }, '2026-11-17'), null);
});

const kiss = (m, a, extra = {}) => m.addPlan(a.id, { mode: 'duracion', name: 'Kiss', start: '2026-11-12', duration: 6, durationUnit: 'semanas', productId: 'kiss10',
  phases: [ph(1, 6, 150, '3 veces por semana (lunes, miércoles y viernes)')], rest: { n: 4, unit: 'semanas' }, repeat: true, ...extra });

test('avisos: último día, descanso, víspera del ciclo nuevo; sin «fecha vencida»', async () => {
  const at = async (d) => { const { m, a } = await mk(d); await kiss(m, a); return (await m.alerts(a.id)).map((x) => x.text).join(' | '); };
  assert.match(await at('2026-12-22'), /Mañana es el último día del ciclo de «Kiss»\. Después, descanso de 4 semanas \(hasta el 20\/01\/2027\)/);
  assert.match(await at('2026-12-23'), /Hoy es el último día del ciclo de «Kiss»\. Descanso del 24\/12\/2026 al 20\/01\/2027/);
  const rest = await at('2026-12-30');
  assert.match(rest, /descanso, día 7 de 28 \(vuelves el 21\/01\/2027\)/);
  assert.doesNotMatch(rest, /vencida/);
  assert.match(await at('2027-01-20'), /Mañana \(21\/01\/2027\) empiezas un nuevo ciclo de «Kiss»/);
});

test('el día de vuelta empieza solo el ciclo siguiente (y no se duplica)', async () => {
  const { m, a } = await mk('2027-01-21');
  const p = await kiss(m, a);
  await m.setFrequency(a.id, p.id, '3 veces por semana (lunes, miércoles y viernes)', { kind: 'days', days: [1, 3, 5], perDay: 1, times: ['21:00'], moments: [] });
  const made = await m.ensureCycles(a.id);
  assert.equal(made.length, 1);
  const np = await m.store.get('plans', made[0]);
  assert.deepEqual([np.start, np.cycleNo, np.name, np.rest.n, np.repeat], ['2027-01-21', 2, 'Kiss · ciclo 2', 4, true]);
  assert.equal(np.freqOverrides['3 veces por semana (lunes, miércoles y viernes)'].times[0], '21:00', 'conserva tu corrección');
  const old = await m.store.get('plans', p.id);
  assert.equal(old.closed, true); assert.equal(old.nextPlanId, np.id);
  assert.equal((await m.ensureCycles(a.id)).length, 0, 'idempotente');
  const ag = await m.agenda(a.id, '2027-01-22'); // viernes
  assert.equal(ag.slots.length, 1);
});

test('sin repetir: no crea ciclo y avisa de que terminó el descanso', async () => {
  const { m, a } = await mk('2027-01-25');
  await kiss(m, a, { repeat: false });
  assert.equal((await m.ensureCycles(a.id)).length, 0);
  assert.match((await m.alerts(a.id)).map((x) => x.text).join('|'), /Tu descanso de «Kiss» terminó; podías empezar el 21\/01\/2027\. Decide en Hoy/);
});

test('calendario: marca el descanso y el ciclo nuevo una sola vez', async () => {
  const { m, a } = await mk('2026-11-17');
  await kiss(m, a);
  const cal = await m.calendar(a.id, '2026-12-20', '2027-01-25');
  assert.ok(cal.some((x) => x.date === '2026-12-24' && /^Descanso: Kiss \(hasta el 20\/01\/2027\)$/.test(x.text)));
  assert.ok(cal.some((x) => x.date === '2027-01-21' && /^Nuevo ciclo: Kiss$/.test(x.text)));
});

test('aplicar desde la biblioteca guarda el descanso de tu texto', async () => {
  const { m, a } = await mk('2026-11-17');
  await m.store.put('templates', { id: 'k', name: 'Kiss', sex: 'hombre', durationUnit: 'semanas', restText: 'Descanso obligatorio de 4 semanas completas.', items: [{ substance: 'Kisspeptin-10', productId: 'kiss10', phases: [ph(1, 6, 150)] }] });
  const [p] = await m.applyTemplate(a.id, 'k', { start: '2026-11-12', duration: 6 });
  assert.deepEqual([p.rest, p.repeat], [{ n: 4, unit: 'semanas' }, false], 'por defecto pregunta antes del ciclo siguiente');
});

test('pendientes: no reclama lo anterior a «contar desde»', () => {
  const p = { id: 'p', productId: 'x', start: '2026-11-01', duration: 4, durationUnit: 'semanas', trackFrom: '2026-11-10', phases: [ph(1, 4, 1)] };
  assert.equal(missingDoses(p, [], '2026-11-12').length, 3);
});

test('preguntar: la víspera propone la fecha; «No seguir» cierra; los planes de la v19 pasan a preguntar', async () => {
  const { m, a } = await mk('2027-01-20');
  const p = await kiss(m, a, { repeat: false });
  assert.match((await m.alerts(a.id)).map((x) => x.text).join('|'), /Mañana termina tu descanso de «Kiss»\. Según tu protocolo puedes empezar un nuevo ciclo el 21\/01\/2027/);
  const np = await m.startNextCycle(a.id, p.id, '2027-01-21');
  assert.deepEqual([np.start, np.cycleNo], ['2027-01-21', 2]);
  await m.stopCycle(a.id, np.id);
  assert.equal((await m.store.get('plans', np.id)).closed, true);
  const { m: m2, a: a2 } = await mk('2026-11-17');
  const old = await kiss(m2, a2, { repeat: true, templateId: 'kiss-h', enteredBy: 'Biblioteca de protocolos' });
  await m2.ensureCycles(a2.id);
  assert.equal((await m2.store.get('plans', old.id)).repeat, false);
});

test('interdiario desde el jueves 12-nov: 12, 14, 16…; una toma reasignada a un día que ya no toca cuenta en su fecha real', async () => {
  const { buildAgenda, slotsOn } = await import('../js/schedule.js');
  const p = { id: 'k', productId: 'kiss10', start: '2026-11-12', duration: 6, durationUnit: 'semanas', phases: [ph(1, 6, 150, '1 vez cada 2 días (interdiario), a las 21:30 (SC)')] };
  assert.deepEqual(['2026-11-12', '2026-11-13', '2026-11-14', '2026-11-22', '2026-12-22', '2026-12-23'].map((d) => slotsOn(p, d).length), [1, 0, 1, 1, 1, 0]);
  const a14 = { id: 'x', planId: 'k', productId: 'kiss10', date: '2026-11-14', time: '21:30', status: 'realizado', forDate: '2026-11-13' };
  assert.equal(buildAgenda({ plans: [p], admins: [a14], date: '2026-11-14' }).slots[0].status, 'done');
});

test('biblioteca nueva: detecta y actualiza el plan en curso conservando tomas e inicio', async () => {
  const { m, a } = await mk('2026-11-17');
  await m.store.put('templates', { id: 'kiss-h', name: 'Kiss', sex: 'hombre', durationUnit: 'semanas', restText: 'Descanso obligatorio de 4 semanas completas.', items: [{ substance: 'Kisspeptin-10', productId: 'kiss10', phases: [ph(1, 6, 150, '3 veces por semana (lunes, miércoles y viernes, SC)')] }] });
  const [p] = await m.applyTemplate(a.id, 'kiss-h', { start: '2026-11-12', duration: 6 });
  const { admin } = await m.addAdministration(a.id, { productId: 'kiss10', planId: p.id, date: '2026-11-12', time: '21:30', amount: 150, unit: 'u', status: 'realizado' });
  assert.equal((await m.libraryChanges()).length, 0);
  await m.store.put('templates', { id: 'kiss-h', name: 'Kiss', sex: 'hombre', durationUnit: 'semanas', restText: 'Descanso obligatorio de 4 semanas completas.', items: [{ substance: 'Kisspeptin-10', productId: 'kiss10', phases: [ph(1, 6, 150, '1 vez cada 2 días (interdiario), a las 21:30 (SC)')] }] });
  const ch = await m.libraryChanges();
  assert.equal(ch.length, 1);
  const u = await m.applyLibraryChange(a.id, p.id, ch[0].phases, ch[0].rest);
  assert.deepEqual([u.start, u.phases[0].frequency], ['2026-11-12', '1 vez cada 2 días (interdiario), a las 21:30 (SC)']);
  assert.equal((await m.store.get('administrations', admin.id)).planId, p.id);
  assert.equal((await m.libraryChanges()).length, 0);
});

test('avisos para el calendario del móvil: tomas interdiarias a las 21:30 y avisos del ciclo', async () => {
  const { calendarEvents } = await import('../js/ajustes.js');
  const { eventsToICS } = await import('../js/notify.js');
  const p = { id: 'k', name: 'Kiss', productId: 'kiss10', start: '2026-11-12', duration: 6, durationUnit: 'semanas', rest: { n: 4, unit: 'semanas' }, phases: [ph(1, 6, 150, '1 vez cada 2 días (interdiario), a las 21:30 (SC)')] };
  const ev = calendarEvents([p], () => 'Kisspeptin-10', '2026-11-17');
  const doses = ev.filter((e) => !e.uid.includes('ciclo'));
  assert.equal(doses.length, 18, '18/11 → 22/12, un día sí y uno no');
  assert.equal(doses[0].start.getHours() + ':' + doses[0].start.getMinutes(), '21:30');
  assert.equal(doses[0].title, '💊 Kisspeptin-10 · 150 u');
  assert.deepEqual(ev.filter((e) => e.uid.includes('ciclo')).map((e) => e.uid.slice(-10)), ['2026-12-22', '2026-12-23', '2027-01-20']);
  const ics = eventsToICS(ev);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 21);
  assert.match(ics, /TRIGGER:-P0DT0H0M0S/);
  assert.match(ics, /DTSTART:20261118T213000\r\n/, 'hora local sin Z, como Guido PRO');
  assert.match(ics, /CATEGORIES:TOMAS/);
  assert.equal(calendarEvents([{ ...p, closed: true }], () => 'x', '2026-11-17').length, 0);
});

test('Fossify: solo reenvía si algo cambió; lo que ya no toca pasa a PAPELERA (01/01/2000) sin alarma; LAST-MODIFIED creciente', async () => {
  const { syncCalendar } = await import('../js/ajustes.js');
  const { m, a } = await mk('2026-11-17');
  const ctx = { model: m, store: m.store, profileId: a.id };
  const sent = [];
  const deliver = async (ics, base) => { sent.push(ics); return { shared: false, name: base + '.ics' }; };
  const p = await m.addPlan(a.id, { mode: 'duracion', name: 'Kiss', start: '2026-11-12', duration: 6, durationUnit: 'semanas', productId: 'kiss10', phases: [ph(1, 6, 150, '1 vez cada 2 días, a las 21:30')] });
  const r1 = await syncCalendar(ctx, { deliver });
  assert.equal(r1.n, 18);
  assert.equal((await syncCalendar(ctx, { deliver })).changed, false, 'sin cambios no se manda nada');
  const real = m.now; m.now = () => new Date('2026-11-19T10:00:00');
  assert.equal((await syncCalendar(ctx, { deliver })).changed, false, 'que pasen los días no cuenta como cambio');
  m.now = real;
  await m.setFrequency(a.id, p.id, '1 vez cada 2 días, a las 21:30', { kind: 'everyN', everyN: 3, perDay: 1, times: ['21:30'], days: [], moments: [] });
  const r2 = await syncCalendar(ctx, { deliver });
  assert.ok(r2.changed && r2.gone > 0);
  assert.match(sent[1], /SUMMARY:🗑 Libre — 💊 Kiss/);
  assert.match(sent[1], /DTSTART:20000101T000000\r\nDTEND:20000101T001000\r\nSUMMARY:🗑[^\r]*\r\nCATEGORIES:PAPELERA/);
  const lm = sent.map((x) => x.match(/LAST-MODIFIED:(\S+)/)[1]);
  assert.ok(lm[1] > lm[0], 'marca creciente');
  const borrar = sent[1].split('BEGIN:VEVENT').filter((b) => b.includes('PAPELERA'));
  assert.ok(borrar.every((b) => !b.includes('VALARM')));
});

test('biblioteca v6: Minoxidil tópico (2 al día) y Finasterida 1,25 mg (1 al día), uso continuo; avisos a las 09:00/21:00', { skip: !process.env.LIB_FILE && 'LIB_FILE no indicado' }, async () => {
  const { readFileSync } = await import('node:fs');
  const { calendarEvents } = await import('../js/ajustes.js');
  const { slotsOn } = await import('../js/schedule.js');
  const lib = JSON.parse(readFileSync(process.env.LIB_FILE, 'utf8'));
  if (!lib.templates.some((t) => t.id === 'fina-125')) return;
  const { m, a } = await mk('2026-11-17');
  await m.importLibrary(lib);
  const [mx] = await m.applyTemplate(a.id, 'minox-top', { start: '2026-11-17', duration: '' });
  const [fn] = await m.applyTemplate(a.id, 'fina-125', { start: '2026-11-17', duration: '' });
  for (const p of [mx, fn]) { assert.equal(p.mode, 'continuo'); assert.equal(planEnd(p), null); }
  assert.equal(fn.productId, 'fina5');
  assert.equal(fn.phases[0].amount, 1.25);
  assert.equal(slotsOn(mx, '2027-03-01').length, 2);
  assert.equal(slotsOn(fn, '2027-03-01').length, 1);
  const ev = calendarEvents([mx, fn], (p) => p.substance, '2026-11-17');
  const day = ev.filter((e) => e.uid.includes('2026-11-18'));
  assert.deepEqual(day.map((e) => e.start.toTimeString().slice(0, 5)).sort(), ['09:00', '09:00', '21:00']);
  assert.ok(ev.every((e) => e.start < new Date('2026-12-15T00:00:00')), 'sin fin: 4 semanas');
  assert.equal((await m.alerts(a.id)).filter((x) => /pendiente de confirmar/.test(x.text)).length, 0);
});
