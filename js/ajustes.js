// Ajustes personales del ciclo: cómo sienta cada toma, notas-guía del usuario, cambio de cantidad desde una semana,
// fecha de inicio de un protocolo y días anteriores al alta. La app registra y muestra; no propone cantidades.
import { esc, toast, dialog, fmtDate, field, inp, opt } from './ui.js';
import { FEEL, todayISO, addDays, planWeek } from './model.js';
import { missingDoses } from './schedule.js';

// ── Cómo sienta ──
export const feelChip = (a) => (a?.feel ? ` <span class="chip ${a.feel === 'efectos' ? 'warn' : ''}">${esc(FEEL[a.feel])}</span>` : '');
export const feelSelect = (cur = '') => field('¿Cómo te sentó?', `<select name="feel"><option value="">Sin marcar</option>${Object.entries(FEEL).map(([k, v]) => opt(k, v, cur)).join('')}</select>`);
export async function feelDialog(ctx, admin) {
  return dialog(`<form><h2>¿Cómo te sentó?</h2><p class="small">${esc(fmtDate(admin.date))} ${esc(admin.time)}${admin.amount != null ? ` · ${esc(String(admin.amount).replace('.', ','))} ${esc(admin.unit)}` : ''}</p>
    <div class="row feel">${Object.entries(FEEL).map(([k, v]) => `<label class="check"><input type="radio" name="feel" value="${k}" ${admin.feel === k ? 'checked' : ''}>${esc(v)}</label>`).join('')}</div>
    ${field('Efectos o sensaciones (opcional)', `<textarea name="adverse" maxlength="500">${esc(admin.adverse || '')}</textarea>`)}
    <div class="row"><button>Guardar</button><button type="button" class="ghost" data-close>Cancelar</button></div></form>`, {
    onSubmit: (d) => ctx.model.updateAdministration(ctx.profileId, admin.id, { feel: d.feel || '', adverse: d.adverse || '' }),
  });
}

// Tabla «cómo te sienta cada cantidad» de un plan: solo cuenta tus registros.
export function feelTable(admins) {
  const rows = new Map();
  for (const a of admins) {
    if (!['realizado', 'retrasado'].includes(a.status) || a.amount == null) continue;
    const k = `${a.amount}|${a.unit}`;
    if (!rows.has(k)) rows.set(k, { amount: a.amount, unit: a.unit, n: 0, bien: 0, regular: 0, efectos: 0, notes: [] });
    const r = rows.get(k);
    r.n++; if (a.feel) r[a.feel]++;
    if (a.adverse) r.notes.push(`${fmtDate(a.date)}: ${a.adverse}`);
  }
  const list = [...rows.values()].sort((x, y) => x.amount - y.amount);
  if (!list.length) return '<p class="muted">Aún no hay tomas hechas con cantidad.</p>';
  return `<div class="table-wrap"><table class="feel-table"><thead><tr><th>Cantidad</th><th>Tomas</th><th>Bien</th><th>Regular</th><th>Efectos</th></tr></thead><tbody>
    ${list.map((r) => `<tr><th scope="row">${esc(String(r.amount).replace('.', ','))} ${esc(r.unit)}</th><td>${r.n}</td><td>${r.bien}</td><td>${r.regular}</td><td>${r.efectos ? `<strong>${r.efectos}</strong>` : 0}</td></tr>
      ${r.notes.length ? `<tr class="notes"><td colspan="5">${r.notes.slice(-3).map(esc).join('<br>')}</td></tr>` : ''}`).join('')}</tbody></table></div>
    <p class="small muted">Solo resume lo que has marcado tú en cada toma. No es una recomendación.</p>`;
}

// ── Notas-guía ──
const scopeText = (n) => (n.scope === 'always' ? 'Siempre' : n.scope === 'pause' ? 'Durante una pausa' : `Semanas ${n.fromWeek}${n.toWeek == null ? ' hasta el final' : n.toWeek === n.fromWeek ? '' : `–${n.toWeek}`}`);
export const notesList = (plan) => (plan.guideNotes || []).map((n) => `<li><span class="small muted">${esc(scopeText(n))}</span><br>${esc(n.text)}
  <div class="row noprint" style="margin-top:.3rem"><button class="sec slim" data-note-edit="${n.id}">Editar</button><button class="ghost slim" data-note-del="${n.id}">Borrar</button></div></li>`).join('');
export const guideBox = (notes) => (notes.length ? `<div class="guide">${notes.map((n) => `<p><strong>Tu nota:</strong> ${esc(n.text)}</p>`).join('')}</div>` : '');

export async function noteDialog(ctx, plan, note = null) {
  const phases = plan.phases || [];
  const cur = note ? (note.scope === 'weeks' ? (phases.findIndex((f) => f.fromWeek === note.fromWeek && (f.toWeek ?? null) === note.toWeek) >= 0 ? 'ph' + phases.findIndex((f) => f.fromWeek === note.fromWeek && (f.toWeek ?? null) === note.toWeek) : 'weeks') : note.scope) : 'always';
  return dialog(`<form><h2>${note ? 'Editar nota' : 'Nueva nota'}</h2><p class="small">La escribes tú; la app la enseña en Hoy cuando toca.</p>
    ${field('Nota', `<textarea name="text" rows="3" maxlength="500" required>${esc(note?.text || '')}</textarea>`, true)}
    ${field('¿Cuándo se muestra?', `<select name="when">${opt('always', 'Siempre', cur)}${phases.map((f, i) => opt('ph' + i, `Fase ${i + 1} (semanas ${f.fromWeek}${f.toWeek == null ? ' en adelante' : '–' + f.toWeek})`, cur)).join('')}${opt('weeks', 'Unas semanas concretas', cur)}${opt('pause', 'Durante una pausa', cur)}</select>`)}
    <div class="grid">${field('Desde la semana', inp('fromWeek', note?.fromWeek ?? '', 'type="number" min="1"'))}${field('Hasta la semana (vacío = hasta el final)', inp('toWeek', note?.toWeek ?? '', 'type="number" min="1"'))}</div>
    <p class="small muted">Las semanas solo se usan con «Unas semanas concretas».</p>
    <div class="row"><button>Guardar</button><button type="button" class="ghost" data-close>Cancelar</button></div></form>`, {
    onSubmit: (d) => {
      let n = { id: note?.id, text: d.text, scope: d.when, fromWeek: d.fromWeek, toWeek: d.toWeek };
      if (/^ph\d+$/.test(d.when)) { const f = phases[+d.when.slice(2)]; n = { ...n, scope: 'weeks', fromWeek: f.fromWeek, toWeek: f.toWeek ?? '' }; }
      return ctx.model.saveGuideNote(ctx.profileId, plan.id, n);
    },
  });
}

// ── Cambiar la cantidad desde una semana ──
export async function adjustDialog(ctx, plan, phase) {
  const now = planWeek(plan, todayISO());
  const def = now >= phase.fromWeek && now <= (phase.toWeek ?? Infinity) ? now : phase.fromWeek;
  return dialog(`<form><h2>Cambiar la cantidad</h2>
    <p class="small">Fase de las semanas ${phase.fromWeek}${phase.toWeek == null ? ' en adelante' : '–' + phase.toWeek}: <strong>${esc(phase.amount ?? '—')}${phase.amountMax != null ? '–' + esc(phase.amountMax) : ''} ${esc(phase.unit)}</strong> · ${esc(phase.frequency)}.
    Las semanas anteriores quedan como estaban; se anota «Ajustado por ti».</p>
    <div class="grid">${field('Desde la semana', inp('fromWeek', def, `type="number" min="${phase.fromWeek}" ${phase.toWeek != null ? `max="${phase.toWeek}"` : ''} required`), true)}
    ${field(`Nueva cantidad (${esc(phase.unit)})`, inp('amount', '', 'type="number" step="any" min="0" inputmode="decimal" required'), true)}
    ${field('Hasta (solo si es un rango)', inp('amountMax', '', 'type="number" step="any" min="0" inputmode="decimal"'))}</div>
    <div class="row"><button>Guardar</button><button type="button" class="ghost" data-close>Cancelar</button></div></form>`, {
    onSubmit: (d) => ctx.model.adjustPhase(ctx.profileId, plan.id, d),
  });
}

// ── Días anteriores al alta ──
// Ofrece registrar como hechas las tomas previstas que faltan o contar el cumplimiento solo desde hoy.
export async function backfillDialog(ctx, plans) {
  const t = todayISO(), y = addDays(t, -1), start = plans.map((p) => p.start).sort()[0];
  if (!start || start >= t) return false;
  const admins = await ctx.model.list('administrations', ctx.profileId);
  const n = plans.reduce((s, p) => s + missingDoses(p, admins, y).length, 0);
  const res = await dialog(`<form><h2>Días anteriores</h2>
    <p>Este ciclo empezó el <strong>${fmtDate(start)}</strong>. Entre esa fecha y ayer faltan <strong>${n}</strong> tomas previstas sin registrar.</p>
    <input type="hidden" name="v">
    <div class="stack">
      <button type="button" class="ok" data-v="fill" ${n ? '' : 'disabled'}>Marcarlas como hechas con la cantidad del plan</button>
      <p class="small muted">Luego puedes corregir cada una en Progreso → Historial (cantidad, día, cómo te sentó).</p>
      <button type="button" class="sec" data-v="track">No registrarlas: contar el cumplimiento desde hoy</button>
      <button type="button" class="ghost" data-close>Dejarlo como está</button>
    </div></form>`, {
    onOpen: (dl) => dl.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => { dl.querySelector('[name=v]').value = b.dataset.v; dl.querySelector('form').requestSubmit(); })),
    onSubmit: async (d) => {
      const ids = plans.map((p) => p.id);
      if (d.v === 'fill') return { fill: await ctx.model.backfill(ctx.profileId, ids, y) };
      if (d.v === 'track') { await ctx.model.setTrackFrom(ctx.profileId, ids, t); return { track: true }; }
      return false;
    },
  });
  if (res?.fill) toast(`${res.fill.added} tomas registradas${res.fill.skipped.length ? `. Sin presentación del catálogo (no se registran): ${res.fill.skipped.join(', ')}` : ''}`, res.fill.skipped.length ? 8000 : 3000);
  if (res?.track) toast('El cumplimiento cuenta desde hoy');
  return !!res;
}

// ── Fecha de inicio de todo un protocolo ──
export async function startDialog(ctx, plans, labelOf = (p) => p.name || 'plan') {
  const ok = await dialog(`<form><h2>Fecha de inicio</h2>
    <p class="small">Si ya lo llevabas tomando, pon el día en que empezaste: la semana, las fases y el fin se recalculan desde ahí.</p>
    ${field('Empecé el', inp('start', plans[0].start, 'type="date" required'), true)}
    ${plans.length > 1 ? `<p class="small">Se mueve todo el protocolo: ${plans.map((p) => esc(labelOf(p))).join(', ')}.</p>` : ''}
    <div class="row"><button>Guardar</button><button type="button" class="ghost" data-close>Cancelar</button></div></form>`, {
    onSubmit: (d) => ctx.model.setStart(ctx.profileId, plans.map((p) => p.id), d.start),
  });
  if (!ok) return false;
  toast('Fecha de inicio cambiada');
  await backfillDialog(ctx, ok);
  return true;
}
