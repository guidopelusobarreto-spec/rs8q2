// Ajustes personales del ciclo: cómo sienta cada toma, notas-guía del usuario, cambio de cantidad desde una semana,
// fecha de inicio de un protocolo y días anteriores al alta. La app registra y muestra; no propone cantidades.
import { esc, toast, dialog, fmtDate, field, inp, opt, download } from './ui.js';
import { FEEL, todayISO, addDays, planWeek, planEnd, phaseFor, restWindow } from './model.js';
import { missingDoses, slotsOn, MOMENTS, amountText } from './schedule.js';
import { eventsToICS } from './notify.js';
import { parseFicha, splitFichas, cleanInline } from './text.js';

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
      <button type="button" class="sec" data-v="pick" ${n ? '' : 'disabled'}>Elegir cuáles tomé</button>
      <button type="button" class="sec" data-v="track">No registrarlas: contar el cumplimiento desde hoy</button>
      <button type="button" class="ghost" data-close>Dejarlo como está</button>
    </div></form>`, {
    onOpen: (dl) => dl.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => { dl.querySelector('[name=v]').value = b.dataset.v; dl.querySelector('form').requestSubmit(); })),
    onSubmit: async (d) => {
      const ids = plans.map((p) => p.id);
      if (d.v === 'fill') return { fill: await ctx.model.backfill(ctx.profileId, ids, y) };
      if (d.v === 'track') { await ctx.model.setTrackFrom(ctx.profileId, ids, t); return { track: true }; }
      if (d.v === 'pick') return { pick: true };
      return false;
    },
  });
  if (res?.fill) toast(`${res.fill.added} tomas registradas${res.fill.skipped.length ? `. Sin presentación del catálogo (no se registran): ${res.fill.skipped.join(', ')}` : ''}`, res.fill.skipped.length ? 8000 : 3000);
  if (res?.track) toast('El cumplimiento cuenta desde hoy');
  if (res?.pick) {
    const fresh = await Promise.all(plans.map((p) => ctx.store.get('plans', p.id)));
    return reviewDialog(ctx, await pendingDoses(ctx, fresh, y, '0000-01-01'));
  }
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

// ── Tu protocolo como guía, por sustancia ──
// Busca en tu biblioteca la ficha de la sustancia del plan (por nombre o por presentación) y elige la que corresponde:
// la ficha que cita el plan («ficha N»), o la de mujeres / hombres según el modelo o la persona. Muestra tu texto tal cual.
export function protocolFicha(info, plan, sex = '') {
  const subs = info?.substances || [];
  const s = subs.find((x) => plan.substance && x.nombre === plan.substance) || subs.find((x) => plan.productId && (x.productIds || []).includes(plan.productId));
  if (!s?.texto) return null;
  const fichas = splitFichas(s.texto), head = (f) => f.split('\n')[0];
  const n = plan.ficha || (plan.source || '').match(/ficha (\d+)/)?.[1]; // la ficha del propio plan (combinados) o la del modelo
  const pick = (n && fichas.find((f) => f.startsWith(n + '. '))) || (sex === 'mujer' && fichas.find((f) => /mujer/i.test(head(f))))
    || (sex === 'hombre' && fichas.find((f) => /hombre/i.test(head(f)))) || fichas[0];
  return { key: s.key, text: pick };
}
// Contexto para varias tarjetas: biblioteca, modelos y sexo de la persona, leídos una vez.
export async function guideContext(ctx, plans) {
  const info = await ctx.model.libraryInfo();
  if (!info.substances?.length) return () => null;
  const prof = (await ctx.model.profiles()).find((p) => p.id === ctx.profileId);
  const tpl = new Map();
  for (const id of new Set(plans.map((p) => p.templateId).filter(Boolean))) tpl.set(id, await ctx.store.get('templates', id));
  const cache = new Map();
  return (plan) => {
    if (!cache.has(plan.id)) {
      const ts = tpl.get(plan.templateId)?.sex;
      cache.set(plan.id, protocolFicha(info, plan, ts && ts !== 'ambos' ? ts : prof?.sex || ''));
    }
    return cache.get(plan.id);
  };
}
export function guideHTML(g, { open = false } = {}) {
  if (!g) return '';
  const f = parseFicha(g.text), get = (re) => f.fields.filter((x) => re.test(x.key));
  const items = (x) => (x.items.length ? `<ul class="doc-list">${x.items.map((it) => `<li>${it.label ? `<strong>${cleanInline(it.label)}:</strong> ` : ''}${cleanInline(it.value)}</li>`).join('')}</ul>` : '');
  const parts = [...get(/^Fases/i), ...get(/^Descanso|PCT/i), ...get(/^Notas/i)];
  if (!parts.length) return '';
  return `<details class="proto"${open ? ' open' : ''}><summary>Tu protocolo · ${cleanInline(f.title)}</summary>
    ${parts.map((x) => `<p><strong>${cleanInline(x.key)}:</strong> ${cleanInline(x.value)}</p>${items(x)}`).join('')}
    <p class="small"><a href="#/ficha/${esc(g.key)}">Ver la ficha completa</a> · Es tu texto. Las cantidades que registras o ajustas son tuyas.</p></details>`;
}

// ── Cambiar de protocolo conservando las semanas que llevas y tus tomas ──
export async function switchDialog(ctx, plans, labelOf = (p) => p.name || 'plan') {
  const tpls = (await ctx.model.templates()).filter((t) => !t.blocked);
  if (!tpls.length) { toast('Carga primero tu biblioteca en Protocolos → Biblioteca'); return false; }
  const start = plans.map((p) => p.start).sort()[0];
  let ids = null;
  const ok = await dialog(`<form><h2>Cambiar de protocolo</h2>
    <p class="small">El protocolo nuevo empieza en la misma fecha, así que <strong>las semanas que llevas cuentan</strong>. Las tomas, pausas y notas de cada sustancia pasan al plan nuevo de esa misma sustancia. Las sustancias que no siguen se cierran (quedan en el historial).</p>
    ${field('Protocolo nuevo', `<select name="tpl" required><option value="">— Elige —</option>${tpls.map((t) => opt(t.id, `${t.name}${t.sex && t.sex !== 'ambos' ? ` (${t.sex})` : ''}`, '')).join('')}</select>`, true)}
    <div class="grid">${field('Fecha de inicio (la del ciclo actual)', inp('start', start, 'type="date" required'), true)}${field('Duración en semanas (vacío = sin fin)', inp('duration', '', 'type="number" min="1"'))}</div>
    <fieldset><legend>¿Qué cierro del protocolo actual?</legend>
      ${plans.map((p) => `<label class="check"><input type="checkbox" name="close" value="${p.id}" data-multi checked>${esc(labelOf(p))}</label>`).join('')}
      <p class="small muted">Desmarca lo que quieras seguir tomando como está. Si una sustancia sigue en el protocolo nuevo, su plan antiguo se cierra siempre y sus tomas pasan al nuevo.</p></fieldset>
    <div class="row"><button>Cambiar</button><button type="button" class="ghost" data-close>Cancelar</button></div></form>`, {
    onSubmit: async (d) => {
      if (!d.tpl) throw new Error('Elige el protocolo nuevo');
      const t = tpls.find((x) => x.id === d.tpl);
      const warns = await ctx.model.compatCheck(ctx.profileId, { items: t.items.map((it) => ({ productId: it.productId, text: it.substance, label: it.substance })), from: d.start, to: null, excludePlanIds: plans.map((p) => p.id) });
      if (warns.length && !(await (await import('./views3.js')).confirmCompat(warns))) return false; // import al usarlo: evita cargar la interfaz en las pruebas
      ids = await ctx.model.switchProtocol(ctx.profileId, plans.map((p) => p.id), d.tpl, { start: d.start, duration: d.duration, closeIds: d.close || [] });
      return true;
    },
  });
  if (!ok) return false;
  toast(`Protocolo cambiado: ${ids.length} plan(es) nuevos`);
  return ids;
}

// ── Tomas previstas que no registraste: revisarlas todas de una vez ──
export async function pendingDoses(ctx, plans, until = addDays(todayISO(), -1), since = addDays(todayISO(), -90)) {
  const admins = await ctx.model.list('administrations', ctx.profileId);
  const out = [];
  for (const p of plans) if (!p.closed) for (const x of missingDoses(p, admins, until)) if (x.date >= since) out.push({ ...x, plan: p });
  return out.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time) || (a.plan.name || '').localeCompare(b.plan.name || '', 'es'));
}
const shortDay = (d) => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: '2-digit' });
export async function reviewDialog(ctx, list, labelOf = (p) => p.name || 'plan') {
  if (!list.length) { toast('No hay tomas pendientes de registrar'); return false; }
  const { productOptions } = await import('./views1.js'); // al usarlo: evita cargar la interfaz en las pruebas
  const products = await ctx.model.products();
  const noProd = [...new Map(list.filter((x) => !x.plan.productId).map((x) => [x.plan.id, x.plan])).values()];
  const plans = [...new Map(list.map((x) => [x.plan.id, x.plan])).values()];
  let saved = 0;
  const res = await dialog(`<form><h2>Tomas sin registrar (${list.length})</h2>
    <p class="small">Marca las que tomaste; puedes cambiar la cantidad. Las desmarcadas se quedan como están.</p>
    ${noProd.map((p) => field(`Presentación de «${labelOf(p)}» (se guarda en el plan)`, `<select name="prod_${p.id}" required>${productOptions(products, '')}</select>`, true)).join('')}
    <div class="row"><button type="button" class="ghost slim" data-all="1">Todas</button><button type="button" class="ghost slim" data-all="0">Ninguna</button></div>
    ${plans.map((p) => `<h3 class="pend-h">${esc(labelOf(p))}</h3><ul class="plain pend">${list.map((x, i) => (x.plan.id !== p.id ? '' : `<li><label class="check"><input type="checkbox" name="sel" value="${i}" data-multi checked>${esc(shortDay(x.date))}</label>
      <input name="a${i}" value="${esc(x.amount ?? '')}" type="number" step="any" min="0" inputmode="decimal" aria-label="Cantidad" placeholder="cantidad"><span class="small">${esc(x.unit || '')}</span></li>`)).join('')}</ul>`).join('')}
    <input type="hidden" name="v">
    <div class="row sticky-acts"><button type="button" class="ok" data-v="realizado">Las tomé</button><button type="button" class="sec" data-v="omitido">No las tomé</button><button type="button" class="ghost" data-close>Cancelar</button></div></form>`, {
    onOpen: (dl) => {
      dl.querySelectorAll('[data-all]').forEach((b) => b.addEventListener('click', () => dl.querySelectorAll('[name=sel]').forEach((c) => { c.checked = b.dataset.all === '1'; })));
      dl.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => { dl.querySelector('[name=v]').value = b.dataset.v; dl.querySelector('form').requestSubmit(); }));
    },
    onSubmit: async (d) => {
      const sel = (d.sel || []).map(Number);
      if (!sel.length) throw new Error('No has marcado ninguna');
      for (const p of noProd) {
        if (!d['prod_' + p.id]) throw new Error(`Elige la presentación de «${labelOf(p)}»`);
        await ctx.model.updatePlan(ctx.profileId, p.id, { productId: d['prod_' + p.id] });
      }
      for (const i of sel) {
        const x = list[i], productId = x.plan.productId || d['prod_' + x.plan.id];
        const amount = d.v === 'omitido' ? '' : d['a' + i];
        await ctx.model.addAdministration(ctx.profileId, { productId, planId: x.plan.id, date: x.date, time: x.time, amount, unit: x.unit, status: d.v, source: 'Revisión de pendientes' });
        saved++;
      }
      return { v: d.v };
    },
  });
  if (res) toast(res.v === 'omitido' ? `${saved} marcadas como no tomadas` : `${saved} tomas registradas`);
  return !!res;
}

// ── Registrar una toma de cualquiera de tus planes en un día, aunque ese día no tocara ──
export async function quickDialog(ctx, date, plans, labelOf = (p) => p.name || 'plan') {
  const act = plans.filter((p) => !p.closed && p.start <= date && (!planEnd(p) || planEnd(p) >= date));
  if (!act.length) { location.hash = '#/registro'; return false; }
  const { productOptions, exceedFlow } = await import('./views1.js');
  const products = await ctx.model.products();
  const amt = (p) => { const f = phaseFor(p, date); return f && !f.none && f.amountMax == null ? f.amount ?? '' : ''; };
  const unit = (p) => { const f = phaseFor(p, date); return (f && !f.none && f.unit) || (p.phases || [])[0]?.unit || ''; };
  let check = null, admin = null;
  const now = date === todayISO() ? new Date().toTimeString().slice(0, 5) : '12:00';
  const ok = await dialog(`<form><h2>Registrar una toma</h2><p class="small">${esc(longDay(date))}</p>
    ${field('Plan', `<select name="planId" required>${act.map((p) => opt(p.id, labelOf(p), act[0].id)).join('')}</select>`, true)}
    <div id="qprod"></div>
    <div class="grid">${field('Cantidad', inp('amount', amt(act[0]), 'type="number" step="any" min="0" inputmode="decimal" required'), true)}${field('Unidad', inp('unit', unit(act[0])))}
    ${field('Hora', inp('time', now, 'type="time" required'), true)}</div>
    ${feelSelect()}${field('Nota (opcional)', inp('notes', '', 'maxlength="200"'))}
    <p class="small"><a href="#/registro" data-close>Otra sustancia (formulario completo)</a></p>
    <div class="row"><button class="ok">Guardar</button><button type="button" class="ghost" data-close>Cancelar</button></div></form>`, {
    onOpen: (dl) => {
      const sel = dl.querySelector('[name=planId]'), set = () => {
        const p = act.find((x) => x.id === sel.value);
        dl.querySelector('[name=amount]').value = amt(p); dl.querySelector('[name=unit]').value = unit(p);
        dl.querySelector('#qprod').innerHTML = p.productId ? '' : field('Presentación (se guarda en el plan)', `<select name="productId" required>${productOptions(products, '')}</select>`, true);
      };
      sel.addEventListener('change', set); set();
    },
    onSubmit: async (d) => {
      const p = act.find((x) => x.id === d.planId);
      let productId = p.productId;
      if (!productId) { if (!d.productId) throw new Error('Elige la presentación'); productId = d.productId; await ctx.model.updatePlan(ctx.profileId, p.id, { productId }); }
      ({ admin, check } = await ctx.model.addAdministration(ctx.profileId, { productId, planId: p.id, date, time: d.time, amount: d.amount, unit: d.unit, status: 'realizado', feel: d.feel, notes: d.notes, source: 'Registro rápido' }));
      return true;
    },
  });
  if (!ok) return false;
  if (check?.comparable && check.exceeded) await exceedFlow(ctx, admin, check);
  toast('Toma registrada');
  return true;
}
const longDay = (d) => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

// ── Avisos en el calendario del móvil: un evento por toma prevista (con su hora) y los avisos del ciclo ──
// Desde hoy hasta el fin del plan (máximo 12 semanas; 4 si el plan no tiene fin). Las tomas «a demanda», por cupo semanal o «cada N a M días» no tienen día fijo: no se incluyen.
export function calendarEvents(plans, labelOf = (p) => p.name || 'plan', today = todayISO()) {
  const ev = [];
  const at = (d, hhmm) => new Date(`${d}T${hhmm}:00`);
  for (const p of plans) {
    if (p.closed || !p.start) continue;
    const end = planEnd(p), from = p.start > today ? p.start : today, to = end && end < addDays(from, 83) ? end : addDays(from, end ? 83 : 27); // sin fin: 4 semanas
    for (let d = from; d <= to; d = addDays(d, 1)) {
      for (const s of slotsOn(p, d)) {
        const hhmm = s.time || MOMENTS[s.moment]?.at || '09:00';
        ev.push({ uid: `${p.id}-${d}-${s.index}`, start: at(d, hhmm), minutes: 15, title: `${labelOf(p)} · ${amountText(s.phase) || 'toma'}`, desc: 'Toma prevista por tu plan. Regístrala en la app Registro de sustancias.' });
      }
    }
    const rw = restWindow(p, today);
    if (rw && end) {
      const add = (d, title) => { if (d >= today) ev.push({ uid: `${p.id}-ciclo-${d}`, start: at(d, '10:00'), minutes: 15, title, desc: 'Aviso de tu ciclo (app Registro de sustancias).' }); };
      add(addDays(end, -1), `Mañana termina el ciclo: ${labelOf(p)}`);
      add(end, `Hoy termina el ciclo: ${labelOf(p)}. Descanso hasta el ${fmtDate(rw.to)}`);
      add(rw.to, `Mañana termina el descanso: ${labelOf(p)}. Decide si empiezas otro ciclo el ${fmtDate(rw.restart)}`);
    }
  }
  return ev.sort((a, b) => a.start - b.start);
}
export async function calendarDialog(ctx, plans, labelOf = (p) => p.name || 'plan') {
  const ev = calendarEvents(plans, labelOf);
  if (!ev.length) { toast('No hay tomas con día fijo a partir de hoy'); return false; }
  const last = ev[ev.length - 1].start.toISOString().slice(0, 10);
  const ok = await dialog(`<form><h2>Avisos en el calendario del móvil</h2>
    <p>Se crea un archivo con <strong>${ev.length} avisos</strong> (cada toma a su hora y los avisos de fin de ciclo y de descanso) desde hoy hasta el ${esc(fmtDate(last))}.</p>
    <ol class="small"><li>Pulsa <strong>Descargar</strong>.</li><li>Abre el archivo descargado y elige <strong>Fossify Calendar</strong>. Si no aparece: en Fossify, menú ⋮ → <strong>Importar eventos desde un archivo .ics</strong>.</li>
    <li>Al importar, elige o crea un tipo de evento propio (por ejemplo, «Tomas») para poder ocultarlo cuando quieras.</li></ol>
    <p class="small muted">El calendario avisa aunque la app esté cerrada. Registrar la toma se sigue haciendo en la app. Si cambias el plan, vuelve a descargar el archivo.</p>
    <div class="row"><button class="ok">Descargar</button><button type="button" class="ghost" data-close>Cancelar</button></div></form>`);
  if (!ok) return false;
  download(`avisos_tomas_${todayISO()}.ics`, eventsToICS(ev), 'text/calendar');
  return true;
}
