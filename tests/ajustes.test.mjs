// Notas-guía, cómo sienta, ajuste de fase, alta retroactiva, inicio de protocolo y pausas editables. Textos neutros inventados.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore } from '../js/store.js';
import { Model, notesFor, phaseFor } from '../js/model.js';
import { missingDoses, adherence } from '../js/schedule.js';

const ph = (fromWeek, toWeek, amount, frequency = 'diaria', amountMax = null) => ({ fromWeek, toWeek, amount, amountMax, unit: 'u', frequency, note: '' });
const mk = async () => {
  const m = new Model(new MemoryStore(), { now: () => new Date('2026-10-30T10:00:00') });
  const a = await m.createProfile({ name: 'Ana' });
  return { m, a };
};

test('notas-guía: siempre, por semanas y en pausa', () => {
  const p = { start: '2026-10-19', pauses: [{ id: 'z', from: '2026-11-02', to: '2026-11-03' }], guideNotes: [
    { id: '1', scope: 'always', text: 'A' }, { id: '2', scope: 'weeks', fromWeek: 2, toWeek: 2, text: 'B' }, { id: '3', scope: 'pause', text: 'C' }] };
  assert.deepEqual(notesFor(p, '2026-10-20').map((n) => n.text), ['A']);
  assert.deepEqual(notesFor(p, '2026-10-27').map((n) => n.text), ['A', 'B']);
  assert.deepEqual(notesFor(p, '2026-11-02').map((n) => n.text), ['A', 'C']);
  assert.deepEqual(notesFor(p, '2026-10-10'), []);
});

test('modelo: notas-guía, validación, edición y borrado', async () => {
  const { m, a } = await mk();
  const p = await m.addPlan(a.id, { mode: 'duracion', start: '2026-10-19', duration: 4, durationUnit: 'semanas', phases: [ph(1, 4, 1)] });
  await assert.rejects(m.saveGuideNote(a.id, p.id, { scope: 'always', text: ' ' }), /Escribe/);
  await assert.rejects(m.saveGuideNote(a.id, p.id, { scope: 'weeks', fromWeek: 3, toWeek: 2, text: 'x' }), /anterior/);
  let u = await m.saveGuideNote(a.id, p.id, { scope: 'weeks', fromWeek: 2, toWeek: '', text: 'desde la 2' });
  assert.equal(u.guideNotes[0].toWeek, null);
  u = await m.saveGuideNote(a.id, p.id, { id: u.guideNotes[0].id, scope: 'always', text: 'cambiada' });
  assert.equal(u.guideNotes.length, 1); assert.equal(u.guideNotes[0].text, 'cambiada');
  u = await m.removeGuideNote(a.id, p.id, u.guideNotes[0].id);
  assert.equal(u.guideNotes.length, 0);
});

test('ajuste de fase: desde una semana, hacia abajo o hacia arriba', async () => {
  const { m, a } = await mk();
  const p = await m.addPlan(a.id, { mode: 'duracion', start: '2026-10-19', duration: 12, durationUnit: 'semanas', phases: [ph(1, 4, 2), ph(5, 12, 4)] });
  let u = await m.adjustPhase(a.id, p.id, { fromWeek: 7, amount: 3.5 });
  assert.deepEqual(u.phases.map((f) => [f.fromWeek, f.toWeek, f.amount]), [[1, 4, 2], [5, 6, 4], [7, 12, 3.5]]);
  assert.match(u.phases[2].note, /Ajustado por ti \(antes 4 u\)/);
  u = await m.adjustPhase(a.id, p.id, { fromWeek: 7, amount: 4.5 });
  assert.deepEqual(u.phases.map((f) => [f.fromWeek, f.toWeek, f.amount]), [[1, 4, 2], [5, 6, 4], [7, 12, 4.5]]);
  assert.equal((u.phases[2].note.match(/Ajustado/g) || []).length, 1, 'no repite la etiqueta');
  assert.equal(phaseFor(u, '2026-12-01').amount, 4.5);
  await assert.rejects(m.adjustPhase(a.id, p.id, { fromWeek: 20, amount: 1 }), /Ninguna fase/);
  await assert.rejects(m.adjustPhase(a.id, p.id, { fromWeek: 2, amount: -1 }), /no válida/);
});

test('tomas: cómo sienta y por encima del plan intencionado', async () => {
  const { m, a } = await mk();
  const p = await m.addPlan(a.id, { mode: 'duracion', start: '2026-10-19', duration: 4, durationUnit: 'semanas', phases: [ph(1, 4, 4)] });
  const { admin, check } = await m.addAdministration(a.id, { productId: 'reta15', planId: p.id, date: '2026-10-20', time: '09:00', amount: 4.5, unit: 'u', status: 'realizado', feel: 'efectos', adverse: 'x' });
  assert.equal(admin.feel, 'efectos'); assert.ok(check.exceeded);
  const u = await m.updateAdministration(a.id, admin.id, { aboveIntent: true, feel: 'bien' });
  assert.equal(u.aboveIntent, true); assert.equal(u.feel, 'bien');
  const { admin: b } = await m.addAdministration(a.id, { productId: 'reta15', date: '2026-10-20', time: '10:00', status: 'realizado', feel: 'raro' });
  assert.equal(b.feel, '', 'valor desconocido no se guarda');
});

test('alta retroactiva: tomas que faltan, sin duplicar, y cupo semanal solo en semanas completas', () => {
  const daily = { id: 'd', start: '2026-10-19', duration: 4, durationUnit: 'semanas', phases: [ph(1, 4, 2, '2 veces al día (mañana y noche)')] };
  const m1 = missingDoses(daily, [{ planId: 'd', date: '2026-10-19', status: 'realizado' }], '2026-10-21');
  assert.equal(m1.length, 5, '3 días × 2 tomas − 1 ya registrada');
  assert.deepEqual(m1.slice(0, 1).map((x) => [x.date, x.time, x.amount]), [['2026-10-19', '21:00', 2]]);
  const weekly = { id: 'w', start: '2026-10-19', duration: 4, durationUnit: 'semanas', phases: [ph(1, 4, 1, '1 vez por semana')] };
  assert.deepEqual(missingDoses(weekly, [], '2026-10-29').map((x) => x.date), ['2026-10-19'], 'la semana en curso no se rellena');
  assert.deepEqual(missingDoses(weekly, [{ planId: 'w', date: '2026-10-22', status: 'realizado' }], '2026-10-29'), []);
  const range = { id: 'r', start: '2026-10-19', duration: 1, durationUnit: 'semanas', phases: [ph(1, 1, 1, 'diaria', 2)] };
  assert.equal(missingDoses(range, [], '2026-10-19')[0].amount, null, 'con rango no se inventa la cantidad');
  const demand = { id: 'x', start: '2026-10-19', duration: 1, durationUnit: 'semanas', phases: [ph(1, 1, 1, 'a demanda')] };
  assert.deepEqual(missingDoses(demand, [], '2026-10-25'), []);
});

test('modelo: inicio de protocolo, alta retroactiva y cumplimiento desde una fecha', async () => {
  const { m, a } = await mk();
  const p1 = await m.addPlan(a.id, { mode: 'duracion', start: '2026-10-30', duration: 8, durationUnit: 'semanas', productId: 'reta15', phases: [ph(1, 8, 4)] });
  const p2 = await m.addPlan(a.id, { mode: 'duracion', start: '2026-10-30', duration: 8, durationUnit: 'semanas', phases: [ph(1, 8, 1)] });
  const [u1] = await m.setStart(a.id, [p1.id, p2.id], '2026-10-02');
  assert.equal(u1.start, '2026-10-02');
  assert.equal(phaseFor(u1, '2026-10-30').week, 5, 'lleva 4 semanas: hoy es la semana 5');
  const r = await m.backfill(a.id, [p1.id, p2.id]);
  assert.equal(r.added, 28, '2-oct → 29-oct, una al día');
  assert.equal(r.skipped.length, 1, 'el plan sin presentación se salta');
  assert.equal((await m.backfill(a.id, [p1.id])).added, 0, 'no duplica');
  const admins = await m.list('administrations', a.id);
  assert.equal(adherence(await m.store.get('plans', p1.id), admins, '2026-10-29').pct, 100);
  const [t2] = await m.setTrackFrom(a.id, [p2.id], '2026-10-30');
  assert.equal(adherence(t2, admins, '2026-10-30').expected, 1, 'solo cuenta desde la fecha elegida');
  await assert.rejects(m.setStart(a.id, [p1.id], 'x'), /no válida/);
});

test('modelo: editar una pausa', async () => {
  const { m, a } = await mk();
  const p = await m.addPlan(a.id, { mode: 'duracion', start: '2026-10-19', duration: 4, durationUnit: 'semanas', phases: [ph(1, 4, 1)] });
  let u = await m.addPause(a.id, p.id, { from: '2026-10-22', to: '2026-10-24' });
  u = await m.addPause(a.id, p.id, { from: '2026-11-01', to: '2026-11-02' });
  const z = u.pauses[0];
  await assert.rejects(m.updatePause(a.id, p.id, z.id, { from: '2026-10-22', to: '2026-11-01' }), /solapa/);
  u = await m.updatePause(a.id, p.id, z.id, { from: '2026-10-21', to: '2026-10-25', note: 'n' });
  assert.deepEqual([u.pauses[0].from, u.pauses[0].to, u.pauses[0].note], ['2026-10-21', '2026-10-25', 'n']);
});

test('tu protocolo como guía: elige la ficha por número, por sexo o por presentación', async () => {
  const { protocolFicha } = await import('../js/ajustes.js');
  const info = { substances: [
    { key: 'reta', nombre: 'Sust A', productIds: ['pa'], texto: '1. Sust A (Hombres)\n * Notas y advertencias: H\n\n2. Sust A (Mujeres)\n * Notas y advertencias: M' },
    { key: 'b', nombre: 'Sust B', productIds: ['pb'], texto: '3. Sust B (Hombres y Mujeres)\n * Notas: B' }] };
  assert.match(protocolFicha(info, { substance: 'Sust A', source: 'Biblioteca: x · Protocolo v3, ficha 2' }).text, /^2\./);
  assert.match(protocolFicha(info, { substance: 'Sust A', source: 'Biblioteca: comb · Parte 2' }, 'mujer').text, /^2\./);
  assert.match(protocolFicha(info, { substance: 'Sust A' }, 'hombre').text, /^1\./);
  assert.equal(protocolFicha(info, { substance: '', productId: 'pb' }).key, 'b');
  assert.equal(protocolFicha(info, { substance: 'Otra', productId: 'zz' }), null);
});

test('una toma sin plan de la misma presentación cuenta para la previsión del plan', async () => {
  const { buildAgenda } = await import('../js/schedule.js');
  const plan = { id: 'p', productId: 'reta15', start: '2026-09-04', duration: 16, durationUnit: 'semanas', phases: [ph(1, 16, 2, 'viernes a las 21:30')] };
  const rec = (extra) => ({ id: 'a', productId: 'reta15', date: '2026-10-02', time: '21:30', status: 'realizado', planId: '', ...extra });
  assert.equal(buildAgenda({ plans: [plan], admins: [rec()], date: '2026-10-02' }).slots[0].status, 'done', 'sin plan, misma presentación');
  assert.equal(buildAgenda({ plans: [plan], admins: [rec({ planId: 'otro' })], date: '2026-10-02' }).slots[0].status, 'pending', 'vinculada a otro plan: no cuenta');
  assert.equal(buildAgenda({ plans: [plan], admins: [rec({ productId: 'reta30' })], date: '2026-10-02' }).slots[0].status, 'pending', 'otra presentación: no cuenta');
  assert.equal(adherence(plan, [rec()], '2026-10-02').done, 1);
});

test('modelo: vincular una toma a un plan de otro perfil no se permite', async () => {
  const { m, a } = await mk();
  const b = await m.createProfile({ name: 'Bruno' });
  const pb = await m.addPlan(b.id, { mode: 'duracion', start: '2026-10-19', duration: 4, durationUnit: 'semanas' });
  const { admin } = await m.addAdministration(a.id, { productId: 'reta15', date: '2026-10-20', time: '09:00', status: 'realizado' });
  await assert.rejects(m.updateAdministration(a.id, admin.id, { planId: pb.id }), /otro perfil/);
});

test('toma adelantada: cuenta como la prevista de otro día', async () => {
  const { buildAgenda } = await import('../js/schedule.js');
  const plan = { id: 'p', productId: 'reta15', start: '2026-09-04', duration: 16, durationUnit: 'semanas', phases: [ph(1, 16, 2, 'viernes a las 21:30')] };
  const early = { id: 'a', planId: 'p', productId: 'reta15', date: '2026-10-22', time: '21:30', status: 'realizado', forDate: '2026-10-23' };
  assert.equal(buildAgenda({ plans: [plan], admins: [early], date: '2026-10-23' }).slots[0].status, 'done');
  assert.equal(buildAgenda({ plans: [plan], admins: [{ ...early, forDate: '' }], date: '2026-10-23' }).slots[0].status, 'pending', 'sin indicarlo no se adivina');
  assert.equal(adherence(plan, [early], '2026-10-23').done, 1);
  assert.equal(missingDoses(plan, [early], '2026-10-23').filter((x) => x.date === '2026-10-23').length, 0);
  const { m, a } = await mk();
  const { admin } = await m.addAdministration(a.id, { productId: 'reta15', date: '2026-10-22', time: '21:30', status: 'realizado', forDate: '2026-10-23' });
  assert.equal(admin.forDate, '2026-10-23');
  const { admin: same } = await m.addAdministration(a.id, { productId: 'reta15', date: '2026-10-22', time: '21:30', status: 'realizado', forDate: '2026-10-22' });
  assert.equal(same.forDate, '', 'el mismo día no hace falta');
  await assert.rejects(m.updateAdministration(a.id, admin.id, { forDate: 'x' }), /no válida/);
});

test('semana por sustancia: cuenta desde su primera fase', async () => {
  const { substanceWeek, substanceWeekText } = await import('../js/schedule.js');
  const kiss = { id: 'k', start: '2026-09-18', duration: 17, durationUnit: 'semanas', phases: [ph(3, 8, 150)] };
  const sw = substanceWeek(kiss, '2026-10-16'); // semana 5 del protocolo
  assert.deepEqual([sw.week, sw.sub, sw.total, sw.offset], [5, 3, 6, true]);
  assert.equal(substanceWeekText(sw), 'Semana 3 de 6 · semana 5 del protocolo');
  assert.ok(substanceWeek(kiss, '2026-09-20').before);
  assert.ok(substanceWeek(kiss, '2026-11-30').after);
  const reta = { id: 'r', start: '2026-09-18', duration: 16, durationUnit: 'semanas', phases: [ph(1, 4, 2), ph(5, 16, 4)] };
  assert.equal(substanceWeekText(substanceWeek(reta, '2026-10-23')), 'Semana 6 de 16');
  assert.equal(substanceWeek(reta, '2026-09-01'), null);
});
