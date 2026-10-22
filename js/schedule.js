// Frecuencias: se leen del texto literal de cada fase («1 vez por semana (SC)», «2 veces al día (mañana y noche…)»).
// La lectura nunca sustituye al texto: se muestra al lado y el usuario puede corregirla por plan (plan.freqOverrides[texto]).
import { addDays, diffDays, planEnd, phaseFor } from './model.js';

export const MOMENTS = { manana: { label: 'Mañana', at: '09:00' }, mediodia: { label: 'Mediodía', at: '13:00' }, tarde: { label: 'Tarde', at: '17:00' }, noche: { label: 'Noche', at: '21:00' } };
export const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const KINDS = { daily: 'Todos los días', days: 'Días concretos de la semana', weekly: 'Veces por semana (días libres)', everyN: 'Cada N días', demand: 'A demanda', unknown: 'Sin frecuencia reconocida' };
const NUM = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7 };
const N = '(\\d+|una?|uno|dos|tres|cuatro|cinco|seis|siete)';
const num = (x) => (x == null ? null : /^\d+$/.test(x) ? +x : NUM[x] ?? null);
const norm = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const pad = (n) => String(n).padStart(2, '0');
const dow = (d) => new Date(d + 'T12:00:00Z').getUTCDay();

export function parseFrequency(text) {
  const out = { kind: 'unknown', perDay: 1, days: [], perWeek: null, everyN: null, times: [], moments: [], maxPerWeek: null, notes: [] };
  let s = norm(text);
  if (!s.trim()) return out;
  // «máximo 1 o 2 veces por semana» es un límite, no una pauta
  s = s.replace(new RegExp(`maximo\\s+${N}(?:\\s*o\\s*${N})?\\s+veces?\\s+(?:a|por)\\s+(?:la\\s+)?semana`), (_, a, b) => { out.maxPerWeek = num(b || a); return ' '; });
  for (const m of s.matchAll(/\b(\d{1,2})[:h](\d{2})\s*(a\.?\s?m\.?|p\.?\s?m\.?)?/g)) {
    let h = +m[1];
    if (m[3]?.startsWith('p') && h < 12) h += 12;
    if (m[3]?.startsWith('a') && h === 12) h = 0;
    if (h < 24 && +m[2] < 60) out.times.push(`${pad(h)}:${m[2]}`);
  }
  const flexible = /antes del entrenamiento|antes de la actividad|pre-?ejercicio|cualquier momento/.test(s);
  if (flexible) out.notes.push('Hora según actividad');
  else {
    const found = [];
    for (const [k, re] of [['manana', /manana|matutin|desayuno/], ['mediodia', /mediodia|almuerzo/], ['tarde', /\btarde\b/], ['noche', /noche|nocturn|antes de dormir/]]) {
      const i = s.search(re); if (i >= 0) found.push([i, k]);
    }
    out.moments = found.sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  }
  const named = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  const days = new Set();
  for (const m of s.matchAll(/\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/g)) days.add(named.indexOf(m[1]));
  if (!days.size && /\bl\s*-\s*m\s*-\s*v\b/.test(s)) { [1, 3, 5].forEach((d) => days.add(d)); out.notes.push('«L-M-V» leído como lunes, miércoles y viernes'); }
  if (days.size && /\bej\.|por ejemplo/.test(s)) out.notes.push('Días de ejemplo en tu texto');
  const perDayM = s.match(new RegExp(`${N}\\s+(?:vez|veces|aplicacion(?:es)?|tomas?)\\b[^,;()]*?\\b(?:al|por|cada)\\s+dia\\b`));
  const perWeekM = s.match(new RegExp(`${N}\\s+(?:vez|veces|aplicacion(?:es)?|tomas?)\\s+(?:a|por|cada)\\s+(?:la\\s+)?semana`));
  const activeM = s.match(/(\d+)\s+dias?\s+activos?/);
  const everyM = s.match(/cada\s+(\d+)\s+dias/);
  const daily = perDayM || /\bdiari[ao]s?\b|todos los dias|cada dia\b/.test(s);
  if (perDayM) out.perDay = num(perDayM[1]) || 1;
  if (activeM) { out.kind = 'weekly'; out.perWeek = +activeM[1]; }
  else if (days.size) {
    out.kind = 'days'; out.days = [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
    if (perWeekM && num(perWeekM[1]) !== out.days.length) out.notes.push(`Tu texto dice ${num(perWeekM[1])} veces por semana y nombra ${out.days.length} días`);
  } else if (daily) out.kind = 'daily';
  else if (everyM) { out.kind = 'everyN'; out.everyN = +everyM[1]; }
  else if (perWeekM || /\bsemanal\b/.test(s)) { out.kind = 'weekly'; out.perWeek = perWeekM ? num(perWeekM[1]) : 1; }
  else if (/demanda|puntual|episodic|dosis unica|toma unica|antes del encuentro|antes de la actividad/.test(s)) out.kind = 'demand';
  if (out.times.length > out.perDay) out.perDay = out.times.length;
  return out;
}

export function scheduleFor(plan, phase) {
  const base = parseFrequency(phase?.frequency);
  const ov = plan?.freqOverrides?.[phase?.frequency || ''];
  return ov ? { ...base, ...ov, notes: [], overridden: true } : base;
}

// Texto corto de la lectura, para mostrar junto al literal.
export function scheduleText(sc) {
  const mom = sc.moments?.length ? ' · ' + sc.moments.map((m) => MOMENTS[m]?.label || m).join(' y ') : '';
  const at = sc.times?.length ? ' · a las ' + sc.times.join(', ') : '';
  const per = sc.perDay > 1 ? ` · ${sc.perDay} veces` : '';
  const list = (a) => (a.length > 1 ? a.slice(0, -1).join(', ') + ' y ' + a[a.length - 1] : a[0] || '');
  switch (sc.kind) {
    case 'daily': return `Todos los días${per || ' · 1 vez'}${at}${mom}`;
    case 'days': return `${list(sc.days.map((d) => DAY_NAMES[d]))}${per}${at}${mom}`;
    case 'weekly': return `${sc.perWeek} ${sc.perWeek === 1 ? 'vez' : 'veces'} por semana, el día que elijas${at}${mom}`;
    case 'everyN': return `Cada ${sc.everyN} días${per}${at}${mom}`;
    case 'demand': return `A demanda${sc.maxPerWeek ? ` · máximo ${sc.maxPerWeek} por semana` : ''}`;
    default: return 'Sin frecuencia reconocida: corrígela en el plan';
  }
}

const DONE = new Set(['realizado', 'retrasado']);
const activePhase = (plan, date) => {
  if (plan.closed || !plan.start || date < plan.start) return null;
  const end = planEnd(plan);
  if (end && date > end) return null;
  const ph = phaseFor(plan, date);
  return ph && !ph.none ? ph : null;
};
const weekRange = (plan, week) => { const from = addDays(plan.start, (week - 1) * 7); return { from, to: addDays(from, 6) }; };

// Tomas previstas de un plan en una fecha (solo las de día fijo: diaria, días concretos, cada N días).
export function slotsOn(plan, date) {
  const ph = activePhase(plan, date);
  if (!ph) return [];
  const sc = scheduleFor(plan, ph);
  const due = sc.kind === 'daily' || (sc.kind === 'days' && sc.days.includes(dow(date))) || (sc.kind === 'everyN' && sc.everyN > 0 && diffDays(plan.start, date) % sc.everyN === 0);
  if (!due) return [];
  return Array.from({ length: Math.max(1, sc.perDay || 1) }, (_, i) => {
    const time = sc.times[i] || '';
    const moment = time ? '' : sc.moments[i] || (sc.perDay === 1 ? sc.moments[0] || '' : '');
    return { key: `${plan.id}|${date}|${i}`, plan, phase: ph, sched: sc, index: i, time, moment, sortAt: time || MOMENTS[moment]?.at || '99:99' };
  });
}

// Agenda de un día: tomas fijas con su estado, cupos semanales, a demanda y fases sin frecuencia reconocida.
export function buildAgenda({ plans, admins, date, snoozes = {}, now = new Date().toISOString() }) {
  const out = { date, slots: [], weekly: [], demand: [], unknown: [] };
  const byPlan = (pid, from, to) => admins.filter((a) => a.planId === pid && a.date >= from && a.date <= to && a.status !== 'cancelado');
  for (const plan of plans) {
    const ph = activePhase(plan, date);
    if (!ph) continue;
    const sc = scheduleFor(plan, ph);
    if (sc.kind === 'weekly' || sc.kind === 'demand') {
      const w = weekRange(plan, ph.week);
      const list = byPlan(plan.id, w.from, w.to).filter((a) => DONE.has(a.status));
      const item = { plan, phase: ph, sched: sc, weekStart: w.from, weekEnd: w.to, count: list.length, today: list.filter((a) => a.date === date) };
      if (sc.kind === 'weekly') out.weekly.push({ ...item, needed: sc.perWeek || 1 });
      else out.demand.push(item);
      continue;
    }
    if (sc.kind === 'unknown') { out.unknown.push({ plan, phase: ph, sched: sc }); continue; }
    const slots = slotsOn(plan, date);
    const recs = byPlan(plan.id, date, date).filter((a) => DONE.has(a.status) || a.status === 'omitido').sort((a, b) => a.time.localeCompare(b.time));
    slots.forEach((s, i) => {
      const a = recs[i];
      s.admin = a || null;
      s.status = a ? (a.status === 'omitido' ? 'omitted' : 'done') : snoozes[s.key] && snoozes[s.key] > now ? 'snoozed' : 'pending';
      s.snoozedUntil = s.status === 'snoozed' ? snoozes[s.key] : '';
      out.slots.push(s);
    });
  }
  out.slots.sort((a, b) => a.sortAt.localeCompare(b.sortAt) || (a.plan.name || '').localeCompare(b.plan.name || '', 'es'));
  return out;
}

// Cumplimiento hasta una fecha (incluida): tomas de día fijo y semanas completas de cupo semanal.
export function adherence(plan, admins, until) {
  let expected = 0, done = 0;
  const end = planEnd(plan);
  const last = end && end < until ? end : until;
  const mine = admins.filter((a) => a.planId === plan.id && DONE.has(a.status));
  for (let d = plan.start; d && d <= last; d = addDays(d, 1)) {
    const n = slotsOn(plan, d).length;
    if (n) { expected += n; done += Math.min(n, mine.filter((a) => a.date === d).length); }
    const ph = activePhase(plan, d);
    if (ph && scheduleFor(plan, ph).kind === 'weekly') {
      const w = weekRange(plan, ph.week);
      if (d === w.to) { const need = scheduleFor(plan, ph).perWeek || 1; expected += need; done += Math.min(need, mine.filter((a) => a.date >= w.from && a.date <= w.to).length); }
    }
  }
  return { expected, done, pct: expected ? Math.round((done / expected) * 100) : null };
}

export const amountText = (f) => (f?.amount == null ? '' : `${f.amount}${f.amountMax != null ? '–' + f.amountMax : ''} ${f.unit || ''}`.trim());

// Semanas totales de un plan (para «semana X de N»).
export function totalWeeks(plan) {
  const end = planEnd(plan);
  if (end) return Math.ceil((diffDays(plan.start, end) + 1) / 7);
  const ph = plan.phases || [];
  return ph.length && ph.every((f) => f.toWeek != null) ? Math.max(...ph.map((f) => f.toWeek)) : null;
}
