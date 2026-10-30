// Revisiones (informe, fechas, avisos) y frecuencias nuevas: «cada N a M días» y «1 a 2 veces al día». Textos neutros.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore } from '../js/store.js';
import { Model } from '../js/model.js';
import { parseFrequency, scheduleText, buildAgenda, slotsOn, adherence } from '../js/schedule.js';

const ph = (fromWeek, toWeek, amount, frequency = 'diaria') => ({ fromWeek, toWeek, amount, amountMax: null, unit: 'u', frequency, note: '' });
const mk = async (now = '2026-10-30T10:00:00') => {
  const m = new Model(new MemoryStore(), { now: () => new Date(now) });
  return { m, a: await m.createProfile({ name: 'Ana', initialWeight: 80 }) };
};

test('frecuencias: intervalo y tomas opcionales', () => {
  const iv = parseFrequency('1 inyección cada 10 a 14 días');
  assert.deepEqual([iv.kind, iv.everyN, iv.everyMax], ['interval', 10, 14]);
  assert.equal(scheduleText(iv), 'Cada 10 a 14 días desde la última toma');
  const r = parseFrequency('1 a 2 veces al día, con agua');
  assert.deepEqual([r.kind, r.perDay, r.perDayMax], ['daily', 1, 2]);
  assert.equal(slotsOn({ id: 'w', start: '2026-10-01', duration: 4, durationUnit: 'semanas', phases: [ph(1, 4, 1, '1 a 2 veces al día')] }, '2026-10-02').length, 1, 'solo la obligatoria');
  assert.equal(parseFrequency('cada 3 días').kind, 'everyN');
});

test('agenda: ventana «cada 10 a 14 días» desde la última toma', () => {
  const plan = { id: 'p', productId: 'x', start: '2026-10-01', duration: 8, durationUnit: 'semanas', phases: [ph(1, 8, 2, '1 inyección cada 10 a 14 días')] };
  assert.equal(buildAgenda({ plans: [plan], admins: [], date: '2026-10-01' }).interval[0].from, '2026-10-01', 'sin tomas: desde el inicio');
  const done = [{ id: 'a', planId: 'p', productId: 'x', date: '2026-10-01', time: '09:00', status: 'realizado' }];
  assert.equal(buildAgenda({ plans: [plan], admins: done, date: '2026-10-05' }).interval.length, 0, 'aún no toca');
  const it = buildAgenda({ plans: [plan], admins: done, date: '2026-10-12' }).interval[0];
  assert.deepEqual([it.from, it.to, it.late], ['2026-10-11', '2026-10-15', false]);
  assert.ok(buildAgenda({ plans: [plan], admins: done, date: '2026-10-16' }).interval[0].late);
  assert.equal(buildAgenda({ plans: [plan], admins: done, date: '2026-10-01' }).interval[0].today.length, 1);
  assert.equal(adherence(plan, done, '2026-10-20').expected, 0, 'no se cuenta como fallo diario');
});

test('informe: tomas sin plan, cómo sentó y pausas', async () => {
  const { m, a } = await mk();
  const p = await m.addPlan(a.id, { mode: 'duracion', start: '2026-10-01', duration: 8, durationUnit: 'semanas', productId: 'crea500', phases: [ph(1, 8, 5)] });
  await m.addPause(a.id, p.id, { from: '2026-10-03', to: '2026-10-05' });
  await m.addAdministration(a.id, { productId: 'crea500', date: '2026-10-02', time: '09:00', amount: 5, unit: 'u', status: 'realizado', feel: 'bien' });
  await m.addAdministration(a.id, { productId: 'crea500', planId: p.id, date: '2026-10-09', time: '09:00', amount: 5, unit: 'u', status: 'realizado', feel: 'efectos' });
  await m.addAdministration(a.id, { productId: 'reta15', date: '2026-10-02', time: '09:00', status: 'realizado' });
  const rep = await m.report(a.id, { planId: p.id, days: 7 });
  assert.equal(rep.end, '2026-10-11', '7 días activos: 1-oct + 7 + 3 de pausa');
  assert.equal(rep.admins.length, 2, 'cuenta la toma sin plan de la misma presentación y no la de otra');
  assert.deepEqual(rep.feel, { bien: 1, regular: 0, efectos: 1 });
});

test('fechas de revisión y avisos periódicos en cualquier plan, sin contar pausas', async () => {
  const { m, a } = await mk('2026-10-18T10:00:00');
  const p = await m.addPlan(a.id, { mode: 'duracion', start: '2026-10-01', duration: 8, durationUnit: 'semanas', reviewEveryDays: 14, phases: [ph(1, 8, 1)] });
  await m.addPause(a.id, p.id, { from: '2026-10-03', to: '2026-10-05' });
  const cal = await m.calendar(a.id, '2026-10-01', '2026-11-30');
  const rev = cal.filter((x) => x.type === 'revision');
  assert.ok(rev.some((x) => x.date === '2026-10-11' && /7 días/.test(x.text)), 'revisión de 7 días desplazada');
  assert.ok(rev.some((x) => x.date === '2026-10-18' && /periódica/.test(x.text)), 'periódica de 14 días desplazada');
  const al = await m.alerts(a.id);
  assert.ok(al.some((x) => /Revisión periódica vencida \(2026-10-18\)/.test(x.text)), 'aviso aunque el plan no sea de seguimiento continuo');
  await m.markReviewDone(a.id, p.id, '2026-10-18');
  assert.ok(!(await m.alerts(a.id)).some((x) => /vencida/.test(x.text)));
});

test('cambiar de protocolo: misma fecha de inicio, tomas y pausas pasan al plan nuevo, lo demás se cierra', async () => {
  const { m, a } = await mk();
  const old = await m.addPlan(a.id, { mode: 'duracion', start: '2026-09-18', duration: 16, durationUnit: 'semanas', productId: 'reta15', substance: 'Retatrutida', phases: [ph(1, 4, 2, '1 vez por semana'), ph(5, 16, 4, '1 vez por semana')], source: 'Biblioteca: Viejo' });
  const sarm = await m.addPlan(a.id, { mode: 'duracion', start: '2026-09-18', duration: 16, durationUnit: 'semanas', productId: 'rad10', substance: 'RAD-140 (testolona)', phases: [ph(6, 13, 10)], source: 'Biblioteca: Viejo' });
  const d3 = await m.addPlan(a.id, { mode: 'duracion', start: '2026-09-18', duration: 16, durationUnit: 'semanas', productId: 'd3k2', substance: 'Vitamina D3 + K2', phases: [ph(1, 16, 1)], source: 'Biblioteca: Viejo' });
  await m.addPause(a.id, old.id, { from: '2026-10-01', to: '2026-10-01' });
  await m.setFrequency(a.id, old.id, '1 vez por semana', { ...parseFrequency('viernes a las 21:30') });
  const { admin } = await m.addAdministration(a.id, { productId: 'reta15', planId: old.id, date: '2026-10-16', time: '21:30', amount: 3.5, unit: 'u', status: 'realizado' });
  await m.store.put('templates', { id: 'lip-h', name: 'Lipólisis', sex: 'hombre', durationUnit: 'semanas', source: 'v4, ficha 24', items: [
    { substance: 'Retatrutida', productId: '', phases: [ph(1, 4, 2, '1 vez por semana (subcutánea)'), ph(5, 12, 4, '1 vez por semana'), ph(13, 24, 6, '1 vez por semana')], ficha: '24' },
    { substance: 'Creatina monohidrato', productId: 'crea500', phases: [ph(1, null, 5)], ficha: '27' }] });
  const ids = await m.switchProtocol(a.id, [old.id, sarm.id, d3.id], 'lip-h', { closeIds: [sarm.id] });
  const [nr, nc] = await Promise.all(ids.map((id) => m.store.get('plans', id)));
  assert.equal(nr.start, '2026-09-18', 'las semanas que llevas cuentan');
  assert.equal(nr.productId, 'reta15', 'toma la presentación del plan anterior');
  assert.equal(nr.ficha, '24');
  assert.equal(nr.pauses.length, 1);
  assert.equal(nr.freqOverrides['1 vez por semana (subcutánea)'].days[0], 5, 'tu corrección pasa a las fases semanales con otro texto');
  assert.equal((await m.store.get('administrations', admin.id)).planId, nr.id, 'la toma pasa al plan nuevo');
  assert.equal(nc.trackFrom, '2026-10-30', 'sustancia nueva: cumplimiento desde hoy');
  assert.equal((await m.store.get('plans', old.id)).closed, true, 'el plan sustituido se cierra siempre');
  assert.equal((await m.store.get('plans', sarm.id)).closed, true);
  assert.equal(!!(await m.store.get('plans', d3.id)).closed, false, 'lo que no marcas sigue abierto');
  assert.match((await m.store.get('plans', sarm.id)).notes, /Sustituido por «Lipólisis»/);
});
