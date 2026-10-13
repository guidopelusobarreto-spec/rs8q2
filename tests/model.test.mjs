import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore } from '../js/store.js';
import { Model, planEnd, compareToPlan, weightChange, occurrences, toCSV, PCT_UNDEFINED, EXCEED_LABEL, addDays } from '../js/model.js';
import { CATALOG, RUO_LABEL, totalActive } from '../js/catalog.js';
import { safetyFor } from '../js/safety.js';

const fixedNow = (iso) => () => new Date(iso);
const mk = (iso = '2026-10-13T10:00:00') => new Model(new MemoryStore(), { now: fixedNow(iso) });

test('catálogo: 21 presentaciones del plan, ids únicos, RUO en péptidos y SARM', () => {
  assert.equal(CATALOG.filter((p) => p.status === 'plan').length, 21);
  assert.equal(new Set(CATALOG.map((p) => p.id)).size, CATALOG.length);
  for (const p of CATALOG.filter((x) => ['peptido', 'sarm'].includes(x.category))) assert.equal(p.research, true, p.id);
  for (const id of ['reta15', 'reta30', 'tada40', 'tada20h', 'iver6', 'iver5h', 'duta05', 'duta1h', 'folig5', 'ghk100', 'tadadapo']) assert.ok(CATALOG.find((p) => p.id === id), id);
  const r30 = CATALOG.find((p) => p.id === 'reta30');
  assert.equal(r30.unitContent, 30); assert.equal(totalActive(r30), 300);
  assert.equal(totalActive(CATALOG.find((p) => p.id === 'folig5')), null); // concentración ≠ cantidad
});

test('catálogo: ningún campo de dosis o reconstitución', () => {
  const banned = /dose|dosis|reconstit|ml_per|mlPer|bac|inject.*amount|recommended/i;
  for (const p of CATALOG) for (const k of Object.keys(p)) assert.doesNotMatch(k, banned, `${p.id}.${k}`);
});

test('fichas de seguridad: cada efecto tiene fuente; sin datos → texto explícito', () => {
  for (const p of CATALOG) {
    const s = safetyFor(p.substance);
    if (s.effects.length) assert.ok(s.sources.length > 0, p.substance);
    else assert.ok(s.insufficient, p.substance);
  }
  assert.ok(safetyFor('Retatrutida').warning.includes('investigación'));
});

test('perfiles: datos aislados entre personas', async () => {
  const m = mk();
  const a = await m.createProfile({ name: 'Ana', initialWeight: 70 });
  const b = await m.createProfile({ name: 'Bruno', initialWeight: 90 });
  await m.addAdministration(a.id, { productId: 'bpc5', date: '2026-10-13', time: '08:00', amount: 1, unit: 'unidad', status: 'realizado' });
  await m.addWeight(a.id, { date: '2026-10-13', kg: 69 });
  await m.addReminder(b.id, { label: 'Agua', kind: 'agua', times: ['10:00'] });
  assert.equal((await m.history(a.id)).length, 1);
  assert.equal((await m.history(b.id)).length, 0);
  assert.deepEqual((await m.weights(b.id)).map((w) => w.kg), [90]);
  assert.equal((await m.list('reminders', a.id)).length, 0);
  for (const c of ['administrations', 'weights', 'reminders', 'plans', 'incidents', 'pct', 'audit']) {
    for (const r of await m.list(c, a.id)) assert.equal(r.profileId, a.id);
    for (const r of await m.list(c, b.id)) assert.equal(r.profileId, b.id);
  }
  const expB = await m.exportJSON(b.id);
  assert.ok(!JSON.stringify(expB).includes(a.id), 'la exportación de Bruno no contiene a Ana');
});

test('perfiles: no se puede usar un plan o lote de otra persona', async () => {
  const m = mk();
  const a = await m.createProfile({ name: 'A' }); const b = await m.createProfile({ name: 'B' });
  const plan = await m.addPlan(a.id, { mode: 'duracion', start: '2026-10-01', duration: 4, durationUnit: 'semanas' });
  const lot = await m.addLot(a.id, { productId: 'reta15', lot: 'L1' });
  await assert.rejects(m.addAdministration(b.id, { productId: 'reta15', date: '2026-10-13', time: '09:00', planId: plan.id }), /otro perfil/);
  await assert.rejects(m.addAdministration(b.id, { productId: 'reta15', date: '2026-10-13', time: '09:00', lotId: lot.id }), /otro perfil/);
  await assert.rejects(m.updatePlan(b.id, plan.id, { name: 'x' }), /otro perfil/);
});

test('eliminar perfil borra solo sus datos', async () => {
  const m = mk();
  const a = await m.createProfile({ name: 'A', initialWeight: 80 }); const b = await m.createProfile({ name: 'B', initialWeight: 60 });
  await m.deleteProfile(a.id);
  assert.equal((await m.profiles()).length, 1);
  assert.equal((await m.store.all('weights')).length, 1);
  assert.ok((await m.store.all('audit')).every((x) => x.profileId === b.id));
});

test('perfil mínimo: solo nombre; peso inicial > 0', async () => {
  const m = mk();
  assert.ok(await m.createProfile({ name: 'Solo nombre' }));
  await assert.rejects(m.createProfile({ name: '' }), /nombre/);
  await assert.rejects(m.createProfile({ name: 'X', initialWeight: 0 }), /mayor que cero/);
});

test('fecha final: solo con datos; nunca supone 4 semanas', () => {
  assert.equal(planEnd({ start: '2026-10-01', duration: 28, durationUnit: 'dias' }), '2026-10-28');
  assert.equal(planEnd({ start: '2026-10-01', duration: 4, durationUnit: 'semanas' }), '2026-10-28');
  assert.equal(planEnd({ start: '2026-01-31', duration: 1, durationUnit: 'meses' }), '2026-02-27');
  assert.equal(planEnd({ start: '2026-10-01' }), null);
  assert.equal(planEnd({ start: '2026-10-01', mode: 'continuo' }), null);
  assert.equal(planEnd({ start: '2026-10-01', end: '2026-12-01' }), '2026-12-01');
});

test('alertas de fin de periodo: 7, 2, 0 días, vencida y registro posterior', async () => {
  for (const [today, re] of [['2026-10-21', /faltan 7/], ['2026-10-26', /faltan 2/], ['2026-10-28', /termina hoy/], ['2026-10-30', /vencida/]]) {
    const m = mk(`${today}T09:00:00`);
    const p = await m.createProfile({ name: 'P' });
    await m.addPlan(p.id, { mode: 'fecha_fin', start: '2026-10-01', end: '2026-10-28', name: 'Ciclo' });
    assert.ok((await m.alerts(p.id)).some((a) => re.test(a.text)), today);
  }
  const m = mk('2026-10-30T09:00:00');
  const p = await m.createProfile({ name: 'P' });
  const plan = await m.addPlan(p.id, { mode: 'fecha_fin', start: '2026-10-01', end: '2026-10-28' });
  const { check } = await m.addAdministration(p.id, { productId: 'tada40', date: '2026-10-30', time: '08:00', planId: plan.id, status: 'realizado' });
  assert.equal(check.afterEnd, true);
  assert.ok((await m.alerts(p.id)).some((a) => /posterior a la fecha final/.test(a.text)));
});

test('alertas: plan sin duración no inventa fecha final', async () => {
  const m = mk();
  const p = await m.createProfile({ name: 'P' });
  const plan = await m.addPlan(p.id, { mode: 'pendiente', start: '2026-10-01' });
  assert.equal(plan.computedEnd, null);
  const al = await m.alerts(p.id);
  assert.ok(al.some((a) => /pendiente de confirmar/.test(a.text)));
  assert.ok(!al.some((a) => /vencida|faltan/.test(a.text)));
});

test('cantidad superior al plan: solo con misma unidad y cantidad numérica', async () => {
  assert.deepEqual(compareToPlan(5, 'mg', { plannedAmount: 4, plannedUnit: 'mg' }), { comparable: true, exceeded: true, registered: 5, reference: 4, unit: 'mg' });
  assert.equal(compareToPlan(4, 'mg', { plannedAmount: 4, plannedUnit: 'mg' }).exceeded, false);
  assert.equal(compareToPlan(5, 'ml', { plannedAmount: 4, plannedUnit: 'mg' }).comparable, false);
  assert.equal(compareToPlan(5, 'mg', { plannedAmount: null, plannedUnit: 'mg' }).comparable, false);
  assert.equal(compareToPlan(5, 'mg', null).comparable, false);
  const m = mk();
  const p = await m.createProfile({ name: 'P' });
  const plan = await m.addPlan(p.id, { mode: 'duracion', start: '2026-10-01', duration: 10, plannedAmount: 2, plannedUnit: 'unidades' });
  const { admin, check } = await m.addAdministration(p.id, { productId: 'reta15', date: '2026-10-05', time: '08:00', amount: 3, unit: 'unidades', planId: plan.id, status: 'realizado' });
  assert.equal(check.exceeded, true);
  const inc = await m.addIncident(p.id, { adminId: admin.id, registered: 3, reference: 2, unit: 'unidades', severe: false });
  assert.equal(inc.label, EXCEED_LABEL);
  assert.ok(!/sobredosis/i.test(inc.label));
});

test('corregir un registro conserva el historial; la notificación no lo marca realizado', async () => {
  const m = mk();
  const p = await m.createProfile({ name: 'P' });
  const { admin } = await m.addAdministration(p.id, { productId: 'mots10', date: '2026-10-13', time: '08:00' });
  assert.equal(admin.status, 'pendiente');
  const u = await m.updateAdministration(p.id, admin.id, { status: 'realizado', amount: 1, unit: 'unidad' });
  assert.equal(u.history.length, 1);
  assert.deepEqual(u.history[0].changes.map((c) => c.field).sort(), ['amount', 'status', 'unit']);
  assert.equal(u.history[0].changes.find((c) => c.field === 'status').from, 'pendiente');
});

test('seguimiento continuo: revisión periódica y sin parada automática', async () => {
  const m = mk('2026-11-01T09:00:00');
  const p = await m.createProfile({ name: 'P' });
  const plan = await m.addPlan(p.id, { mode: 'continuo', start: '2026-09-01', reviewEveryDays: 30 });
  assert.equal(plan.computedEnd, null);
  let al = await m.alerts(p.id);
  assert.ok(al.some((a) => /Revisión periódica vencida \(2026-10-31\)/.test(a.text)));
  await m.markReviewDone(p.id, plan.id, '2026-10-31');
  al = await m.alerts(p.id);
  assert.ok(!al.some((a) => /vencida/.test(a.text)));
  const cal = await m.calendar(p.id, '2026-09-01', '2026-12-31');
  assert.deepEqual(cal.filter((c) => c.text === 'Revisión periódica').map((c) => c.date), ['2026-10-01', '2026-10-31', '2026-11-30', '2026-12-30']);
});

test('PCT: conserva el calendario introducido y no inventa plan', async () => {
  const m = mk('2026-11-10T09:00:00');
  const p = await m.createProfile({ name: 'P' });
  const cycle = await m.addPlan(p.id, { mode: 'fecha_fin', start: '2026-09-01', end: '2026-10-31' });
  const x = await m.addPCT(p.id, { cycleId: cycle.id, reviewDate: '2026-11-05', dates: [{ date: '2026-11-10', label: 'Análisis' }] });
  assert.equal(x.plannedEnd, '2026-10-31');
  assert.equal(m.pctPlanLabel(x), PCT_UNDEFINED);
  assert.equal(x.products, '');
  const al = await m.alerts(p.id);
  assert.ok(al.some((a) => /Revisión postciclo prevista el 2026-11-05/.test(a.text)));
  assert.ok(al.some((a) => /Análisis hoy/.test(a.text)));
  const cal = await m.calendar(p.id, '2026-11-01', '2026-11-30');
  assert.equal(cal.filter((c) => c.type === 'pct').length, 2);
});

test('periodos de descanso aparecen en calendario', async () => {
  const m = mk();
  const p = await m.createProfile({ name: 'P' });
  await m.addPlan(p.id, { mode: 'descanso', start: '2026-11-01', end: '2026-11-14', name: 'Descanso' });
  const cal = await m.calendar(p.id, '2026-11-01', '2026-11-30');
  assert.equal(cal.filter((c) => c.type === 'descanso').length, 2);
});

test('variación de peso: fórmulas y validación', () => {
  assert.deepEqual(weightChange(80, 76), { kg: -4, pct: -5 });
  assert.deepEqual(weightChange(62.5, 63), { kg: 0.5, pct: 0.8 });
  assert.throws(() => weightChange(0, 70), /mayor que cero/);
  assert.equal(weightChange(null, 70), null);
});

test('informe de 28 días', async () => {
  const m = mk('2026-10-30T09:00:00');
  const p = await m.createProfile({ name: 'P', initialWeight: 100, startDate: '2026-10-01' });
  const plan = await m.addPlan(p.id, { mode: 'duracion', start: '2026-10-01', duration: 8, durationUnit: 'semanas' });
  await m.addWeight(p.id, { date: '2026-10-15', kg: 98 });
  await m.addWeight(p.id, { date: '2026-10-29', kg: 96 });
  await m.addAdministration(p.id, { productId: 'reta15', date: '2026-10-02', time: '08:00', planId: plan.id, status: 'realizado', amount: 1, unit: 'u', symptoms: 'náuseas' });
  await m.addAdministration(p.id, { productId: 'reta15', date: '2026-10-09', time: '08:00', planId: plan.id, status: 'omitido' });
  const r = await m.report(p.id, { planId: plan.id, days: 28 });
  assert.equal(r.initial, 100); assert.equal(r.current, 96);
  assert.deepEqual(r.change, { kg: -4, pct: -4 });
  assert.equal(r.counts.realizado, 1); assert.equal(r.counts.omitido, 1);
  assert.equal(r.symptoms.length, 1);
  assert.ok(r.missing.includes('Hábitos'));
  assert.match(r.disclaimer, /No indica si hay que aumentar/);
  const r7 = await m.report(p.id, { planId: plan.id, days: 7 });
  assert.equal(r7.current, null); assert.ok(r7.missing.includes('Peso dentro del periodo'));
});

test('recordatorios: ocurrencias por días de la semana, desactivar y posponer', async () => {
  const r = { enabled: true, times: ['08:00', '20:00'], days: [1, 4], startDate: '2026-10-01' }; // lunes y jueves
  const o = occurrences(r, '2026-10-12', '2026-10-18');
  assert.deepEqual(o.map((x) => x.at), ['2026-10-12T08:00', '2026-10-12T20:00', '2026-10-15T08:00', '2026-10-15T20:00']);
  assert.equal(occurrences({ ...r, enabled: false }, '2026-10-12', '2026-10-18').length, 0);
  const m = mk();
  const p = await m.createProfile({ name: 'P' });
  const rem = await m.addReminder(p.id, { label: 'Tomar registro', times: ['09:00'], productId: 'fina1' });
  assert.equal(rem.amount, undefined); // el recordatorio no lleva cantidad por defecto
  const s = await m.snoozeReminder(p.id, rem.id, 15);
  assert.equal(s.snoozedUntil, new Date(Date.parse('2026-10-13T10:00:00') + 15 * 60000).toISOString());
  await assert.rejects(m.addReminder(p.id, { label: 'x', times: ['9h'] }), /HH:MM/);
});

test('inventario: restante estimado solo con unidades declaradas', async () => {
  const m = mk();
  const p = await m.createProfile({ name: 'P' });
  const lot = await m.addLot(p.id, { productId: 'bpc5', lot: 'B-1', unitsInitial: 10, expiry: '2027-01-01' });
  await m.addAdministration(p.id, { productId: 'bpc5', date: '2026-10-13', time: '08:00', lotId: lot.id, unitsUsed: 1, status: 'realizado' });
  await m.addAdministration(p.id, { productId: 'bpc5', date: '2026-10-14', time: '08:00', lotId: lot.id, unitsUsed: 1, status: 'omitido' });
  const inv = await m.inventory(p.id);
  assert.equal(inv[0].unitsLeft, 9);
});

test('exportación JSON/CSV válidas y restauración', async () => {
  const m = mk();
  const p = await m.createProfile({ name: 'P; "con comillas"', initialWeight: 70 });
  await m.addAdministration(p.id, { productId: 'reta30', date: '2026-10-13', time: '08:00', notes: 'línea1\nlínea2' });
  const json = JSON.parse(JSON.stringify(await m.exportJSON()));
  const m2 = mk();
  const n = await m2.importJSON(json);
  assert.ok(n >= 3);
  assert.equal((await m2.history(p.id)).length, 1);
  const csv = await m.exportCSV('profiles');
  assert.ok(csv.startsWith('﻿'));
  assert.ok(csv.includes('"P; ""con comillas"""'));
  assert.equal(toCSV([]), '');
  await assert.rejects(m2.importJSON({ foo: 1 }), /no es una copia/);
});

test('calendario incluye todos los tipos', async () => {
  const m = mk();
  const p = await m.createProfile({ name: 'P', initialWeight: 70, startDate: '2026-10-13' });
  await m.addReminder(p.id, { label: 'Agua', times: ['10:00'] });
  await m.addAdministration(p.id, { productId: 'reta15', date: '2026-10-13', time: '08:00', symptoms: 'náuseas' });
  await m.addPlan(p.id, { mode: 'duracion', start: '2026-10-13', duration: 2, durationUnit: 'semanas' });
  await m.addEvent(p.id, { date: '2026-10-20', title: 'Análisis de sangre' });
  await m.addIncident(p.id, { when: '2026-10-13T09:00' });
  const types = new Set((await m.calendar(p.id, '2026-10-01', '2026-11-30')).map((c) => c.type));
  for (const t of ['recordatorio', 'registro', 'ciclo', 'revision', 'peso', 'evento', 'incidencia', 'sintoma']) assert.ok(types.has(t), t);
});

test('RUO: etiqueta exacta', async () => {
  const m = mk();
  assert.equal(m.ruoLabel(await m.product('reta15')), RUO_LABEL);
  assert.equal(RUO_LABEL, 'Sustancia de investigación — no apta para uso humano');
  assert.equal(m.ruoLabel(await m.product('fina1')), null);
});

test('addDays cruza cambios de hora sin desfases', () => {
  assert.equal(addDays('2026-10-24', 2), '2026-10-26');
  assert.equal(addDays('2026-03-28', 2), '2026-03-30');
});
