// Pausas: los días en pausa no cuentan; las fases, las semanas y el fin se desplazan. Textos neutros inventados (el repo es público).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore } from '../js/store.js';
import { Model, planEnd, planBaseEnd, phaseFor, pausedOn, activeDay, dateOfActiveDay, activeWindow } from '../js/model.js';
import { slotsOn, buildAgenda, adherence, totalWeeks } from '../js/schedule.js';

const ph = (fromWeek, toWeek, amount, frequency = 'diaria') => ({ fromWeek, toWeek, amount, amountMax: null, unit: 'u', frequency, note: '' });
// Lunes 19-oct-2026, 4 semanas → fin 15-nov sin pausas.
const plan = (pauses = [], phases = [ph(1, 2, 1), ph(3, 4, 2)], extra = {}) => ({ id: 'p1', name: 'A', start: '2026-10-19', duration: 4, durationUnit: 'semanas', phases, pauses, ...extra });

test('sin pausas: todo igual que antes', () => {
  const p = plan();
  assert.equal(planEnd(p, '2026-10-30'), '2026-11-15');
  assert.equal(phaseFor(p, '2026-11-02').week, 3);
  assert.equal(phaseFor(p, '2026-11-02').amount, 2);
  assert.equal(activeDay(p, '2026-10-25'), 6);
  assert.equal(dateOfActiveDay(p, 6), '2026-10-25');
});

test('pausa cerrada de 3 días: desplaza fases, semanas y fin', () => {
  const p = plan([{ id: 'z', from: '2026-10-22', to: '2026-10-24', note: '' }]);
  assert.equal(planBaseEnd(p), '2026-11-15');
  assert.equal(planEnd(p, '2026-10-30'), '2026-11-18');
  assert.equal(totalWeeks(p), 4, 'las pausas no añaden semanas activas');
  assert.ok(phaseFor(p, '2026-10-23').paused);
  assert.ok(phaseFor(p, '2026-10-23').none, 'en pausa no hay fase activa');
  assert.equal(pausedOn(p, '2026-10-25'), null);
  assert.equal(activeDay(p, '2026-10-25'), 3);
  assert.equal(phaseFor(p, '2026-11-02').week, 2, 'sin pausa sería la semana 3');
  assert.equal(phaseFor(p, '2026-11-02').amount, 1);
  assert.equal(phaseFor(p, '2026-11-05').week, 3);
  assert.deepEqual(slotsOn(p, '2026-10-23'), []);
  assert.equal(slotsOn(p, '2026-10-25').length, 1);
  assert.equal(slotsOn(p, '2026-11-18').length, 1, 'el último día real del plan tiene toma');
  assert.equal(slotsOn(p, '2026-11-19').length, 0);
  assert.deepEqual(activeWindow(p), { from: '2026-10-19', to: '2026-11-18' });
});

test('cupo semanal: la semana con pausa se alarga esos días', () => {
  const p = plan([{ id: 'z', from: '2026-10-22', to: '2026-10-24' }], [ph(1, 4, 1, '1 vez por semana')]);
  const ag = buildAgenda({ plans: [p], admins: [], date: '2026-10-27' });
  assert.equal(ag.weekly.length, 1);
  assert.equal(ag.weekly[0].weekStart, '2026-10-19');
  assert.equal(ag.weekly[0].weekEnd, '2026-10-28');
  assert.equal(buildAgenda({ plans: [p], admins: [], date: '2026-10-23' }).weekly.length, 0, 'en pausa no se pide el cupo');
});

test('cada N días cuenta solo días activos', () => {
  const p = plan([{ id: 'z', from: '2026-10-20', to: '2026-10-20' }], [ph(1, 4, 1, 'cada 3 días')]);
  assert.equal(slotsOn(p, '2026-10-19').length, 1);
  assert.equal(slotsOn(p, '2026-10-22').length, 0, 'sin pausa tocaría el 22');
  assert.equal(slotsOn(p, '2026-10-23').length, 1);
});

test('cumplimiento: los días en pausa no se cuentan como previstos', () => {
  const p = plan([{ id: 'z', from: '2026-10-22', to: '2026-10-24' }]);
  assert.equal(adherence(p, [], '2026-10-25').expected, 4);
  assert.equal(adherence(plan(), [], '2026-10-25').expected, 7);
});

test('pausa abierta: en pausa desde su inicio y fin provisional como si se reanudara mañana', () => {
  const p = plan([{ id: 'z', from: '2026-10-26', to: '' }]);
  assert.ok(pausedOn(p, '2026-12-01'));
  assert.equal(planEnd(p, '2026-10-30'), '2026-11-20'); // 26–30 = 5 días
  assert.equal(planEnd(p, '2026-10-26'), '2026-11-16');
  assert.deepEqual(slotsOn(p, '2026-11-02'), []);
});

test('pausa después del fin o sin fin escrito', () => {
  assert.equal(planEnd(plan([{ id: 'z', from: '2026-11-20', to: '2026-11-25' }]), '2026-10-30'), '2026-11-15');
  assert.equal(planEnd(plan([{ id: 'z', from: '2026-10-22', to: '2026-10-24' }], undefined, { duration: null }), '2026-10-30'), null);
});

test('modelo: pausar, validar, reanudar y borrar', async () => {
  const m = new Model(new MemoryStore(), { now: () => new Date('2026-10-30T10:00:00') });
  const a = await m.createProfile({ name: 'Ana' });
  const b = await m.createProfile({ name: 'Bruno' });
  const p = await m.addPlan(a.id, { mode: 'duracion', start: '2026-10-19', duration: 4, durationUnit: 'semanas', phases: [ph(1, 4, 1)] });
  await assert.rejects(m.addPause(a.id, p.id, { from: '2026-10-10' }), /antes del inicio/);
  await assert.rejects(m.addPause(a.id, p.id, { from: '2026-10-25', to: '2026-10-24' }), /termina antes/);
  await assert.rejects(m.addPause(b.id, p.id, { from: '2026-10-25' }), /otro perfil/);
  let u = await m.addPause(a.id, p.id, { from: '2026-10-22', to: '2026-10-24', note: 'viaje' });
  assert.equal(u.pauses.length, 1);
  assert.equal(u.computedEnd, '2026-11-18');
  await assert.rejects(m.addPause(a.id, p.id, { from: '2026-10-24' }), /solapa/);
  u = await m.addPause(a.id, p.id, { from: '2026-10-28' });
  const open = u.pauses.find((x) => !x.to);
  assert.equal(open.from, '2026-10-28');
  u = await m.resumePause(a.id, p.id, open.id, '2026-10-30');
  assert.equal(u.pauses.find((x) => x.id === open.id).to, '2026-10-29');
  assert.equal(planEnd(u, '2026-10-30'), '2026-11-20');
  const z = await m.addPause(a.id, p.id, { from: '2026-11-02' });
  u = await m.resumePause(a.id, p.id, z.pauses.find((x) => x.from === '2026-11-02').id, '2026-11-02');
  assert.equal(u.pauses.length, 2, 'volver el mismo día borra la pausa');
  u = await m.removePause(a.id, p.id, u.pauses[0].id);
  assert.equal(u.pauses.length, 1);
  assert.ok(u.history.length >= 4, 'cada cambio queda en el historial del plan');
  // Registro durante una pausa: se marca, no se compara con la fase.
  const { check } = await m.addAdministration(a.id, { productId: 'reta15', planId: p.id, date: '2026-10-28', time: '09:00', amount: 1, unit: 'u', status: 'realizado' });
  assert.ok(check.duringPause);
  assert.ok(!check.outsidePhases);
});
