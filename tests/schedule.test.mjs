import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFrequency, scheduleText, buildAgenda, adherence, slotsOn, scheduleFor } from '../js/schedule.js';

const P = (t) => parseFrequency(t);
test('frecuencias del protocolo: lectura del texto literal', () => {
  assert.equal(P('1 vez por semana (SC)').kind, 'weekly');
  assert.deepEqual(P('3 veces por semana (lunes, miércoles y viernes, SC)').days, [1, 3, 5]);
  const pt = P('Dosis única 2 a 4 horas antes del encuentro; máximo 1 o 2 veces por semana');
  assert.equal(pt.kind, 'demand'); assert.equal(pt.maxPerWeek, 2);
  const bpc = P('2 veces al día (mañana y noche, SC)');
  assert.equal(bpc.kind, 'daily'); assert.equal(bpc.perDay, 2); assert.deepEqual(bpc.moments, ['manana', 'noche']);
  assert.match(P('2 veces por semana (ej. lunes y jueves, SC)').notes.join(), /ejemplo/);
  assert.deepEqual(P('1 vez al día a las 17:00, en 500 ml de agua').times, ['17:00']);
  assert.deepEqual(P('1 vez al día a las 5:00 p.m.').times, ['17:00']);
  const tesa = P('1 vez al día por la noche, 5 días activos y 2 de descanso (SC)');
  assert.equal(tesa.kind, 'weekly'); assert.equal(tesa.perWeek, 5);
  const ci = P('1 vez al día, en 300 ml de agua, 45-60 min antes del entrenamiento o actividad; días de descanso por la mañana');
  assert.equal(ci.kind, 'daily'); assert.deepEqual(ci.moments, []);
  assert.deepEqual(P('3 veces por semana (L-M-V, SC matutina o pre-ejercicio)').days, [1, 3, 5]);
  assert.equal(P('1 aplicación tópica al día por la noche sobre el cuero cabelludo limpio').kind, 'daily');
  assert.equal(P('Toma única 2 horas antes de la actividad sexual').kind, 'demand');
  assert.equal(P('Diaria, por la noche').moments[0], 'noche');
  assert.equal(P('cada 3 días').everyN, 3);
  assert.equal(P('algo raro').kind, 'unknown');
  assert.equal(P('').kind, 'unknown');
  assert.equal(scheduleText(P('Lunes, miércoles y viernes (SC)')), 'lunes, miércoles y viernes');
});

const plan = (id, phases, extra = {}) => ({ id, name: id, start: '2026-10-19', duration: 4, durationUnit: 'semanas', phases, ...extra }); // lunes
const F = (a, b, amount, unit, frequency) => ({ fromWeek: a, toWeek: b, amount, amountMax: null, unit, frequency, note: '' });
test('agenda del día: tomas fijas, cupo semanal, a demanda y estado', () => {
  const bpc = plan('bpc', [F(1, 4, 1, 'u', '2 veces al día (mañana y noche)')]);
  const reta = plan('reta', [F(1, 2, 1, 'u', '1 vez por semana (SC)'), F(3, 4, 2, 'u', '1 vez por semana (SC)')]);
  const kiss = plan('kiss', [F(1, 4, 1, 'u', 'Lunes, miércoles y viernes (SC)')]);
  const pt = plan('pt', [F(1, null, 1, 'u', 'Dosis única antes del encuentro; máximo 2 veces por semana')]);
  const raro = plan('raro', [F(1, 4, 1, 'u', 'cuando toque')]);
  const admins = [{ planId: 'bpc', date: '2026-10-21', time: '08:10', status: 'realizado' }, { planId: 'reta', date: '2026-10-20', time: '09:00', status: 'realizado' }];
  const a = buildAgenda({ plans: [bpc, reta, kiss, pt, raro], admins, date: '2026-10-21' }); // miércoles, semana 1
  assert.deepEqual(a.slots.map((s) => [s.plan.id, s.status]), [['bpc', 'done'], ['bpc', 'pending'], ['kiss', 'pending']]);
  assert.equal(a.weekly[0].count, 1); assert.equal(a.weekly[0].needed, 1);
  assert.equal(a.demand[0].plan.id, 'pt'); assert.equal(a.unknown[0].plan.id, 'raro');
  assert.equal(buildAgenda({ plans: [kiss], admins: [], date: '2026-10-22' }).slots.length, 0); // jueves
  assert.equal(buildAgenda({ plans: [reta], admins: [], date: '2026-11-05' }).weekly[0].phase.amount, 2); // semana 3
  assert.equal(buildAgenda({ plans: [bpc], admins: [], date: '2026-11-16' }).slots.length, 0); // tras el fin
  assert.equal(buildAgenda({ plans: [{ ...bpc, closed: true }], admins: [], date: '2026-10-21' }).slots.length, 0);
  // corrección del usuario: manda sobre la lectura automática
  const fixed = { ...raro, freqOverrides: { 'cuando toque': { kind: 'days', days: [3], perDay: 1 } } };
  assert.equal(scheduleFor(fixed, fixed.phases[0]).overridden, true);
  assert.equal(slotsOn(fixed, '2026-10-21').length, 1);
});
test('cumplimiento: tomas hechas frente a previstas', () => {
  const crea = plan('crea', [F(1, 4, 1, 'u', 'Diaria')]);
  const admins = ['2026-10-19', '2026-10-20', '2026-10-20'].map((date) => ({ planId: 'crea', date, time: '09:00', status: 'realizado' }));
  assert.deepEqual(adherence(crea, admins, '2026-10-21'), { expected: 3, done: 2, pct: 67 });
  const reta = plan('reta', [F(1, 4, 1, 'u', '1 vez por semana')]);
  assert.deepEqual(adherence(reta, [{ planId: 'reta', date: '2026-10-22', time: '09:00', status: 'realizado' }], '2026-11-02'), { expected: 2, done: 1, pct: 50 });
});
