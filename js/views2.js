// Calendario, ciclos, postciclo, recordatorios, peso, hábitos, informes, incidencias y ajustes.
import { esc, $, $$, opt, field, inp, toast, dialog, fmtDate, fmtNum, readForm, showErr, download, lineChart } from './ui.js';
import { parseImportText, importPlans, parsePhaseLine, phaseText, PLAN_MODES, PCT_STATUS, PCT_UNDEFINED, REVIEW_DAYS, ADMIN_STATUS, planEnd, planBaseEnd, pausesOf, hasOpenPause, runSiblings, addDays, diffDays, todayISO, weightChange, toISODate } from './model.js';
import { pauseText, pauseDialog, resumeDialog, removePauseDialog, editPauseDialog } from './pausas.js';
import { notesList, noteDialog, feelTable, adjustDialog, startDialog, backfillDialog, guideContext, guideHTML } from './ajustes.js';
import { COLLECTIONS } from './store.js';
import { WHO_ACTIVITY, EMERGENCY } from './safety.js';
import { productOptions, alertBox, dehydration, DEHYDRATION_TEXT, ruoBadge } from './views1.js';
import { setPin, checkPin, askPermission, notifySupported, remindersToICS, checkDue } from './notify.js';
import { confirmCompat } from './views3.js';
import { scheduleFor, scheduleText, adherence, KINDS, DAY_NAMES, MOMENTS, substanceWeek, substanceWeekText } from './schedule.js';
import { saveUI, refreshProfiles, ctx as appCtx, installApp, appInstalledHere, updateLockBtn } from './app.js';

const DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const DOW_FULL = [['1', 'Lun'], ['2', 'Mar'], ['3', 'Mié'], ['4', 'Jue'], ['5', 'Vie'], ['6', 'Sáb'], ['0', 'Dom']];
const TYPES = { prevista: 'Toma prevista', sinregistro: 'Prevista sin registro', registro: 'Registro', recordatorio: 'Recordatorio', ciclo: 'Ciclo', descanso: 'Descanso', revision: 'Revisión', pct: 'Postciclo', peso: 'Pesaje', evento: 'Cita/evento', incidencia: 'Incidencia', sintoma: 'Síntoma' };
const dowMon = (s) => (new Date(s + 'T12:00:00').getDay() + 6) % 7;

// ── Calendario ──
export async function calendario(view, r, ctx) {
  const v = r.query.v || 'mes';
  const d = r.query.d || todayISO();
  let from, to;
  if (v === 'dia') { from = to = d; }
  else if (v === 'semana') { from = addDays(d, -dowMon(d)); to = addDays(from, 6); }
  else { const first = d.slice(0, 8) + '01'; from = addDays(first, -dowMon(first)); to = addDays(from, 41); }
  const items = await ctx.model.calendar(ctx.profileId, from, to);
  const byDay = (x) => items.filter((i) => i.date === x);
  const step = v === 'dia' ? 1 : v === 'semana' ? 7 : null;
  const prev = step ? addDays(d, -step) : toISODate(new Date(+d.slice(0, 4), +d.slice(5, 7) - 2, 1));
  const next = step ? addDays(d, step) : toISODate(new Date(+d.slice(0, 4), +d.slice(5, 7), 1));
  const title = v === 'mes' ? new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }) : v === 'semana' ? `${fmtDate(from)} – ${fmtDate(to)}` : new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const list = (arr) => arr.length ? `<ul class="plain">${arr.map((i) => `<li><span class="dot t-${i.type}"></span> ${i.time ? `<strong>${i.time}</strong> ` : ''}${esc(TYPES[i.type])}: ${esc(i.text)}</li>`).join('')}</ul>` : '<p class="muted">Sin elementos.</p>';
  let body;
  if (v === 'mes') {
    const t = todayISO();
    body = `<div class="cal">${DOW.map((x) => `<div class="dow">${x}</div>`).join('')}${Array.from({ length: 42 }, (_, i) => addDays(from, i)).map((x) => `
      <div class="day ${x.slice(5, 7) !== d.slice(5, 7) ? 'out' : ''} ${x === t ? 'today' : ''}" data-day="${x}" role="button" tabindex="0" aria-label="${fmtDate(x)}: ${byDay(x).length} elementos">
        ${+x.slice(8)}<div class="dots">${[...new Set(byDay(x).map((i) => i.type))].map((ty) => `<span class="dot t-${ty}" title="${TYPES[ty]}"></span>`).join('')}</div></div>`).join('')}</div>`;
  } else if (v === 'semana') {
    body = Array.from({ length: 7 }, (_, i) => addDays(from, i)).map((x) => `<h3>${new Date(x + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}</h3>${list(byDay(x))}`).join('');
  } else body = list(byDay(d));
  view.innerHTML = `<h1>Calendario</h1>
    <div class="row noprint">${['mes', 'semana', 'dia'].map((x) => `<a class="btn slim ${v === x ? '' : 'sec'}" href="#/calendario?v=${x}&d=${d}">${{ mes: 'Mes', semana: 'Semana', dia: 'Día' }[x]}</a>`).join('')}
      <button id="ev" class="ghost slim">＋ Cita</button></div>
    <div class="card" style="margin-top:.8rem"><div class="calnav"><a class="btn sec slim" href="#/calendario?v=${v}&d=${prev}" aria-label="Anterior">‹</a><strong>${esc(title)}</strong><a class="btn sec slim" href="#/calendario?v=${v}&d=${next}" aria-label="Siguiente">›</a></div>
      <details class="small" style="margin:.4rem 0"><summary>Leyenda</summary><div class="legend">${Object.entries(TYPES).map(([k, l]) => `<span><span class="dot t-${k}"></span> ${l}</span>`).join('')}</div></details>${body}</div>`;
  $$('[data-day]').forEach((el) => { const go = () => (location.hash = `#/calendario?v=dia&d=${el.dataset.day}`); el.addEventListener('click', go); el.addEventListener('keydown', (e) => e.key === 'Enter' && go()); });
  $('#ev').addEventListener('click', async () => {
    const ok = await dialog(`<form><h2>Cita o evento personal</h2>${field('Título', inp('title', '', 'required'), true)}
      <div class="grid">${field('Fecha', inp('date', d, 'type="date" required'), true)}${field('Hora', inp('time', '', 'type="time"'))}</div>
      ${field('Tipo', `<select name="type">${['cita', 'análisis', 'revisión médica', 'otro'].map((x) => opt(x, x)).join('')}</select>`)}${field('Notas', '<textarea name="notes"></textarea>')}
      <div class="row"><button>Guardar</button><button type="button" class="sec" data-close>Cancelar</button></div></form>`, { onSubmit: (x) => ctx.model.addEvent(ctx.profileId, x) });
    if (ok) calendario(view, r, ctx);
  });
}

// ── Ciclos y periodos de seguimiento ──
const planForm = (products, p = {}) => `
  ${field('Nombre del plan', inp('name', p.name || ''))}
  ${field('Modalidad', `<select name="mode" required>${Object.entries(PLAN_MODES).map(([k, v]) => opt(k, v, p.mode)).join('')}</select>`, true)}
  ${field('Sustancia (opcional)', `<select name="productId">${productOptions(products, p.productId)}</select>`)}
  <div class="grid">${field('Fecha de inicio', inp('start', p.start || todayISO(), 'type="date" required'), true)}
  ${field('Fecha de finalización', inp('end', p.end || '', 'type="date"'))}
  ${field('Duración', inp('duration', p.duration ?? '', 'type="number" min="1" step="1"'))}
  ${field('Unidad de duración', `<select name="durationUnit">${[['dias', 'días'], ['semanas', 'semanas'], ['meses', 'meses']].map(([k, v]) => opt(k, v, p.durationUnit)).join('')}</select>`)}</div>
  <p class="small muted">Si solo indicas duración, la fecha final se calcula desde el inicio (contando el día de inicio). Si no indicas ninguna, no se inventa.</p>
  <fieldset><legend>Cantidad documentada en el plan (opcional)</legend><p class="small muted">Solo se usa para avisar si un registro la supera con la misma unidad.</p>
  <div class="grid">${field('Cantidad del plan', inp('plannedAmount', p.plannedAmount ?? '', 'type="number" step="any" min="0"'))}${field('Unidad', inp('plannedUnit', p.plannedUnit || '', 'list="units2"') + '<datalist id="units2"><option value="mg"><option value="mcg"><option value="UI"><option value="ml"><option value="unidad"><option value="tableta"></datalist>')}</div></fieldset>
  <fieldset><legend>Fases del protocolo (las escribes tú)</legend>
    <p class="small muted">Una fase por línea: <code>semanas 1-4 | cantidad | unidad | frecuencia | nota</code>. Rango: <code>2-2.5</code>; hasta el final: <code>semanas 9-fin</code>. Ejemplo de formato: <code>semanas 1-4 | 1 | tableta | diaria | indicación de mi médico</code>. La frecuencia se lee para la pantalla Hoy; si se entiende mal, corrígela en el plan.</p>
    <textarea name="phasesText" rows="4">${esc((p.phases || []).map((f) => `semanas ${f.fromWeek}-${f.toWeek ?? 'fin'} | ${f.amount ?? ''}${f.amountMax != null ? '-' + f.amountMax : ''} | ${f.unit} | ${f.frequency} | ${f.note}`).join('\n'))}</textarea></fieldset>
  ${field('Pauta anotada (texto libre)', `<textarea name="scheduleNote">${esc(p.scheduleNote || '')}</textarea>`)}
  ${field('Revisión periódica cada (días; seguimiento continuo)', inp('reviewEveryDays', p.reviewEveryDays ?? '', 'type="number" min="1"'))}
  <div class="grid">${field('Fuente de la información', inp('source', p.source || ''))}${field('Introducido por', inp('enteredBy', p.enteredBy || ''))}</div>
  <fieldset><legend>Alertas</legend>${[['d7', '7 días antes'], ['d2', '2 días antes'], ['d0', 'El día final'], ['overdue', 'Tras vencer'], ['afterEnd', 'Registro posterior al final']].map(([k, l]) => `<label class="check"><input type="checkbox" name="al_${k}" ${p.alerts?.[k] === false ? '' : 'checked'}>${l}</label>`).join('')}</fieldset>
  ${field('Observaciones', `<textarea name="notes">${esc(p.notes || '')}</textarea>`)}`;
export function parsePhaseText(t) {
  return (t || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => parsePhaseLine(l));
}
const planData = (d) => { d.phases = parsePhaseText(d.phasesText); delete d.phasesText; const alerts = {}; for (const k of ['d7', 'd2', 'd0', 'overdue', 'afterEnd']) { alerts[k] = !!d['al_' + k]; delete d['al_' + k]; } return { ...d, alerts }; };

export async function planes(view, r, ctx) {
  const m = ctx.model;
  const products = await m.products();
  const list = (await m.list('plans', ctx.profileId)).sort((a, b) => b.start.localeCompare(a.start));
  const pn = (id) => products.find((p) => p.id === id);
  view.innerHTML = `<h1>Ciclos y periodos de seguimiento</h1>
    <div class="row"><button id="new">Nuevo plan o periodo</button><button id="imp" class="sec">Importar desde texto</button></div>
    <div class="card" style="margin-top:1rem"><ul class="plain">${list.map((p) => { const end = planEnd(p); return `<li><a href="#/plan/${p.id}"><strong>${esc(p.name || PLAN_MODES[p.mode])}</strong></a> ${p.closed ? '<span class="badge">Cerrado</span>' : ''}
      <br>${esc(PLAN_MODES[p.mode])} · ${esc(pn(p.productId)?.substance || 'sin sustancia')} ${ruoBadge(pn(p.productId))}
      <br><span class="small">Inicio ${fmtDate(p.start)} · Fin ${end ? fmtDate(end) : 'sin fecha final registrada'}</span></li>`; }).join('') || '<li class="muted">Sin planes.</li>'}</ul></div>`;
  $('#imp').addEventListener('click', () => importDialog(ctx).then((n) => n && planes(view, r, ctx)));
  $('#new').addEventListener('click', async () => {
    const p = await dialog(`<form><h2>Nuevo plan o periodo</h2>${planForm(products)}<div class="row"><button>Guardar</button><button type="button" class="sec" data-close>Cancelar</button></div></form>`, { onSubmit: (d) => m.addPlan(ctx.profileId, planData(d)) });
    if (!p) return;
    const warns = await m.compatCheck(ctx.profileId, { items: [{ productId: p.productId, text: p.name, label: p.name || 'este plan' }], from: p.start, to: planEnd(p), excludePlanIds: [p.id] });
    if (warns.length && !(await confirmCompat(warns))) { await m.closePlan(ctx.profileId, p.id, true); toast('Plan guardado como cerrado: no se usará'); }
    location.hash = '#/plan/' + p.id;
  });
}

export async function planDetalle(view, r, ctx) {
  const m = ctx.model;
  const p = await ctx.store.get('plans', r.arg);
  if (!p || p.profileId !== ctx.profileId) { view.innerHTML = '<p>Plan no encontrado en este perfil.</p>'; return; }
  const products = await m.products();
  const prod = products.find((x) => x.id === p.productId);
  const end = planEnd(p);
  const days = Number(r.query.dias) || null;
  const rep = days ? await m.report(ctx.profileId, { planId: p.id, days }) : null;
  const t = todayISO();
  const admins = await m.list('administrations', ctx.profileId);
  const sibs = runSiblings(await m.list('plans', ctx.profileId), p), sibLabels = await m.planLabels(sibs), labelOf = (x) => sibLabels.get(x.id) || x.name || 'plan';
  const protoHTML = guideHTML((await guideContext(ctx, [p]))(p), { open: true });
  const pauses = pausesOf(p), base = planBaseEnd(p), shift = base && end ? diffDays(base, end) : 0;
  const pausesCard = `<div class="card" id="pausas"><h2 style="margin-top:0">Pausas</h2>
    <p class="small muted">Los días en pausa no cuentan: las fases siguientes y el fin se retrasan esos días.${sibs.length > 1 ? ` Se aplican a todo el protocolo (${sibs.length} sustancias aplicadas juntas).` : ''}</p>
    ${pauses.length ? `<ul class="plain">${pauses.map((x) => `<li><strong>${esc(pauseText(x))}</strong>${x.note ? `<br><span class="small">${esc(x.note)}</span>` : ''}
      <div class="row noprint" style="margin-top:.3rem">${x.to ? '' : `<button class="ok slim" data-resume="${x.id}">Reanudar</button>`}<button class="sec slim" data-pedit="${x.id}">Editar</button><button class="ghost slim" data-unpause="${x.id}">Borrar</button></div></li>`).join('')}</ul>` : '<p class="muted">Sin pausas.</p>'}
    ${p.closed || hasOpenPause(p) ? '' : `<div class="row noprint"><button id="pause" class="sec">${sibs.length > 1 ? 'Pausar el protocolo' : 'Pausar'}</button></div>`}</div>`;
  const nextReview = p.reviewEveryDays > 0 ? addDays(p.start, (Math.floor(diffDays(p.start, t) / p.reviewEveryDays) + 1) * p.reviewEveryDays) : null;
  const lastReview = p.reviewEveryDays > 0 && diffDays(p.start, t) >= p.reviewEveryDays ? addDays(p.start, Math.floor(diffDays(p.start, t) / p.reviewEveryDays) * p.reviewEveryDays) : null;
  view.innerHTML = `<p><a href="#/planes">← Ciclos y periodos</a></p><h1>${esc(p.name || PLAN_MODES[p.mode])}</h1>
    ${prod?.research ? `<div class="ruo-banner">${esc(prod.substance)}: sustancia de investigación. Este seguimiento no es un protocolo validado.</div>` : ''}
    ${p.mode === 'continuo' ? '<div class="alert info">El seguimiento continuo organiza revisiones; no es una recomendación para continuar ninguna sustancia indefinidamente.</div>' : ''}
    ${(await m.alerts(ctx.profileId)).filter((a) => a.ref === p.id).map(alertBox).join('')}
    <div class="card"><dl class="kv"><dt>Modalidad</dt><dd>${esc(PLAN_MODES[p.mode])}</dd><dt>Sustancia</dt><dd>${esc(prod?.substance || '—')}</dd>
      <dt>Semana actual</dt><dd>${(() => { const sw = substanceWeek(p, t), pz = pausesOf(p).find((x) => t >= x.from && (!x.to || t <= x.to));
        if (p.start > t) return `Empieza el ${fmtDate(p.start)}`;
        if (sw?.before) return `Empieza en la semana ${sw.week - sw.sub + 1} del protocolo (ahora: semana ${sw.week})`;
        if ((end && t > end) || sw?.after) return 'Terminado';
        return `<strong>${esc(substanceWeekText(sw))}</strong>${pz ? ' · en pausa' : ''}`; })()}</dd>
      <dt>Inicio</dt><dd>${fmtDate(p.start)}</dd><dt>Fin</dt><dd>${end ? fmtDate(end) + (p.end ? '' : ' (calculado por duración)') : 'Sin fecha final registrada'}${shift ? `<br><span class="small">Incluye ${shift} ${shift === 1 ? 'día' : 'días'} de pausa (sin pausas: ${fmtDate(base)})${hasOpenPause(p) ? '. Provisional: supone que reanudas mañana' : ''}.</span>` : ''}</dd>
      <dt>Cantidad del plan</dt><dd>${p.plannedAmount != null ? `${fmtNum(p.plannedAmount, 4)} ${esc(p.plannedUnit)}` : '—'}</dd><dt>Pauta anotada</dt><dd>${esc(p.scheduleNote || '—')}</dd>
      <dt>Fases del protocolo</dt><dd>${p.phases?.length ? p.phases.map((f) => esc(phaseText(f))).join('<br>') : '—'}</dd>
      <dt>Revisión periódica</dt><dd>${p.reviewEveryDays ? `cada ${p.reviewEveryDays} días · próxima ${fmtDate(nextReview)}` : '—'}</dd>
      <dt>Fuente</dt><dd>${esc(p.source || '—')}</dd><dt>Introducido por</dt><dd>${esc(p.enteredBy || '—')}</dd><dt>Registrado</dt><dd>${new Date(p.createdAt).toLocaleString('es-ES')}</dd></dl>
      <div class="row noprint" style="margin-top:.6rem"><button id="edit" class="sec">Editar</button>${lastReview ? `<button id="rev" class="sec">Marcar revisión del ${fmtDate(lastReview)} como hecha</button>` : ''}<button id="close" class="sec">${p.closed ? 'Reabrir' : 'Cerrar plan'}</button>
      <a class="btn sec" href="#/pct?ciclo=${p.id}">Seguimiento postciclo</a>
      <button id="startBtn" class="sec">Fecha de inicio${sibs.length > 1 ? ' del protocolo' : ''}</button>${p.start < t ? '<button id="backBtn" class="sec">Días anteriores</button>' : ''}</div>
      ${p.trackFrom ? `<p class="small">El cumplimiento cuenta desde el ${fmtDate(p.trackFrom)}.</p>` : ''}
      ${p.history?.length ? `<details><summary>Historial de modificaciones (${p.history.length})</summary><ul class="small">${p.history.map((h) => `<li>${new Date(h.at).toLocaleString('es-ES')}: ${h.changes.map((c) => esc(c.field)).join(', ')}</li>`).join('')}</ul></details>` : ''}</div>
    ${protoHTML ? `<div class="card" id="protocolo"><h2 style="margin-top:0">Tu protocolo (guía)</h2>${protoHTML}</div>` : ''}
    ${pausesCard}
    <div class="card" id="notas"><h2 style="margin-top:0">Tus notas (guía)</h2><p class="small muted">Las escribes tú; salen en Hoy cuando toca (siempre, en unas semanas o durante una pausa).</p>
      ${p.guideNotes?.length ? `<ul class="plain">${notesList(p)}</ul>` : '<p class="muted">Sin notas.</p>'}<div class="row noprint"><button id="addNote" class="sec">Añadir nota</button></div></div>
    <div class="card" id="sienta"><h2 style="margin-top:0">Cómo te sienta cada cantidad</h2>${feelTable(admins.filter((a) => a.planId === p.id))}</div>
    ${p.phases?.length ? `<div class="card"><h2 style="margin-top:0">Frecuencia y cumplimiento</h2>
      ${(() => { const ad = adherence(p, admins, t); return `<p>Cumplimiento hasta hoy: <strong>${ad.pct == null ? '—' : `${ad.done} de ${ad.expected} (${ad.pct} %)`}</strong></p>`; })()}
      <ul class="plain">${p.phases.map((f, i) => { const sc = scheduleFor(p, f); return `<li><strong>${esc(phaseText(f))}</strong><br><span class="small">Se entiende: ${esc(scheduleText(sc))}${sc.overridden ? ' (corregido por ti)' : ''}${sc.notes.length ? ` · ${esc(sc.notes.join(' · '))}` : ''}</span>
        <div class="row noprint" style="margin-top:.3rem"><button class="sec slim" data-adj="${i}">Cambiar cantidad</button><button class="sec slim" data-freq="${i}">Corregir frecuencia</button></div></li>`; }).join('')}</ul></div>` : ''}
    <div class="card"><h2 style="margin-top:0">Revisiones</h2><div class="row">${REVIEW_DAYS.map((d) => `<a class="btn ${days === d ? '' : 'sec'}" href="#/plan/${p.id}?dias=${d}">${d} días (${fmtDate(addDays(p.start, d))})</a>`).join('')}</div>
      ${rep ? reportHTML(rep, products) : '<p class="muted">Elige una revisión para ver el informe.</p>'}</div>`;
  $('#edit').addEventListener('click', async () => {
    const ok = await dialog(`<form><h2>Editar plan</h2>${planForm(products, p)}<div class="row"><button>Guardar</button><button type="button" class="sec" data-close>Cancelar</button></div></form>`, {
      onSubmit: (d) => { const x = planData(d); for (const k of ['duration', 'plannedAmount', 'reviewEveryDays']) x[k] = x[k] === '' ? null : Number(x[k]); return m.updatePlan(ctx.profileId, p.id, x); },
    });
    if (ok) planDetalle(view, r, ctx);
  });
  $('#rev')?.addEventListener('click', async () => { await m.markReviewDone(ctx.profileId, p.id, lastReview); planDetalle(view, r, ctx); });
  const again = () => planDetalle(view, r, ctx);
  $('#pause')?.addEventListener('click', async () => { if (await pauseDialog(ctx, sibs, labelOf)) again(); });
  $$('[data-resume]').forEach((b) => b.addEventListener('click', async () => { if (await resumeDialog(ctx, sibs, pauses.find((x) => x.id === b.dataset.resume), labelOf)) again(); }));
  $$('[data-pedit]').forEach((b) => b.addEventListener('click', async () => { if (await editPauseDialog(ctx, sibs, pauses.find((x) => x.id === b.dataset.pedit), labelOf)) again(); }));
  $('#addNote').addEventListener('click', async () => { if (await noteDialog(ctx, p)) again(); });
  $$('[data-note-edit]').forEach((b) => b.addEventListener('click', async () => { if (await noteDialog(ctx, p, p.guideNotes.find((n) => n.id === b.dataset.noteEdit))) again(); }));
  $$('[data-note-del]').forEach((b) => b.addEventListener('click', async () => {
    if (await dialog('<form><h2>Borrar la nota</h2><div class="row"><button class="sec">Borrar</button><button type="button" class="ghost" data-close>Cancelar</button></div></form>')) { await m.removeGuideNote(ctx.profileId, p.id, b.dataset.noteDel); again(); }
  }));
  $$('[data-adj]').forEach((b) => b.addEventListener('click', async () => { if (await adjustDialog(ctx, p, p.phases[b.dataset.adj])) { toast('Cantidad cambiada'); again(); } }));
  $('#startBtn').addEventListener('click', async () => { if (await startDialog(ctx, sibs, labelOf)) again(); });
  $('#backBtn')?.addEventListener('click', async () => { if (await backfillDialog(ctx, sibs)) again(); });
  $$('[data-unpause]').forEach((b) => b.addEventListener('click', async () => { if (await removePauseDialog(ctx, sibs, pauses.find((x) => x.id === b.dataset.unpause), labelOf)) again(); }));
  $$('[data-freq]').forEach((btn) => btn.addEventListener('click', async () => {
    const f = p.phases[btn.dataset.freq], sc = scheduleFor(p, f);
    const ok = await dialog(`<form><h2>Frecuencia de la fase</h2><p class="small">Tu texto: «${esc(f.frequency || '—')}». No se cambia: solo se corrige cómo lo entiende la pantalla Hoy.</p>
      ${field('Tipo', `<select name="kind">${Object.entries(KINDS).map(([k, v]) => opt(k, v, sc.kind)).join('')}</select>`)}
      <fieldset><legend>Días (si son días concretos)</legend><div class="row">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<label class="check"><input type="checkbox" name="days" value="${d}" data-multi ${sc.days.includes(d) ? 'checked' : ''}>${DAY_NAMES[d].slice(0, 3)}</label>`).join('')}</div></fieldset>
      <div class="grid">${field('Veces al día', inp('perDay', sc.perDay || 1, 'type="number" min="1" max="12"'))}${field('Veces por semana', inp('perWeek', sc.perWeek ?? '', 'type="number" min="1" max="21"'))}
      ${field('Cada N días', inp('everyN', sc.everyN ?? '', 'type="number" min="1"'))}${field('Momento', `<select name="moment"><option value="">—</option>${Object.entries(MOMENTS).map(([k, v]) => opt(k, v.label, sc.moments[0])).join('')}</select>`)}</div>
      ${field('Horas fijas (HH:MM, separadas por comas)', inp('times', sc.times.join(', ')))}
      <input type="hidden" name="reset" value="">
      <div class="row"><button>Guardar</button><button type="button" class="ghost" id="fReset">Lectura automática</button><button type="button" class="ghost" data-close>Cancelar</button></div></form>`, {
      onOpen: (dl) => dl.querySelector('#fReset').addEventListener('click', () => { dl.querySelector('[name=reset]').value = '1'; dl.querySelector('form').requestSubmit(); }),
      onSubmit: async (d) => {
        if (d.reset) return m.setFrequency(ctx.profileId, p.id, f.frequency, null);
        const times = d.times.split(',').map((x) => x.trim()).filter(Boolean);
        if (times.some((x) => !/^\d{2}:\d{2}$/.test(x))) throw new Error('Horas en formato HH:MM, p. ej. 08:30');
        const days = (d.days || []).map(Number);
        if (d.kind === 'days' && !days.length) throw new Error('Marca al menos un día');
        if (d.kind === 'weekly' && !(Number(d.perWeek) > 0)) throw new Error('Indica cuántas veces por semana');
        if (d.kind === 'everyN' && !(Number(d.everyN) > 0)) throw new Error('Indica cada cuántos días');
        return m.setFrequency(ctx.profileId, p.id, f.frequency, { kind: d.kind, days, perDay: Number(d.perDay) || 1, perWeek: Number(d.perWeek) || null, everyN: Number(d.everyN) || null, times, moments: d.moment ? [d.moment] : [], maxPerWeek: sc.maxPerWeek });
      },
    });
    if (ok) { toast('Frecuencia guardada'); planDetalle(view, r, ctx); }
  }));
  $('#close').addEventListener('click', async () => { await m.closePlan(ctx.profileId, p.id, !p.closed); planDetalle(view, r, ctx); });
}

export function reportHTML(rep, products) {
  const pn = (id) => products.find((p) => p.id === id)?.substance || id;
  return `<h3>Informe ${rep.days} días · ${fmtDate(rep.start)} – ${fmtDate(rep.end)} · ${esc(rep.profile)}</h3>
    <dl class="kv"><dt>Peso inicial</dt><dd>${rep.initial != null ? fmtNum(rep.initial, 1) + ' kg' : '—'}</dd><dt>Peso actual</dt><dd>${rep.current != null ? fmtNum(rep.current, 1) + ' kg' : '—'}</dd>
      <dt>Diferencia</dt><dd>${rep.change ? `${rep.change.kg > 0 ? '+' : ''}${fmtNum(rep.change.kg)} kg (${rep.change.pct > 0 ? '+' : ''}${fmtNum(rep.change.pct)} %)` : '—'}</dd>
      <dt>Registros</dt><dd>${Object.entries(rep.counts).map(([k, n]) => `${ADMIN_STATUS[k]}: ${n}`).join(' · ')}</dd>
      <dt>Siguiente revisión</dt><dd>${rep.nextReview ? fmtDate(rep.nextReview) : '—'}</dd>
      <dt>Datos que faltan</dt><dd>${rep.missing.length ? esc(rep.missing.join(', ')) : 'Ninguno'}</dd></dl>
    <h3>Cantidades registradas</h3>${rep.admins.length ? `<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Sustancia</th><th>Cantidad</th><th>Estado</th></tr></thead><tbody>${rep.admins.map((a) => `<tr><td>${fmtDate(a.date)} ${a.time}</td><td>${esc(pn(a.productId))}</td><td>${a.amount != null ? `${fmtNum(a.amount, 4)} ${esc(a.unit)}` : '—'}</td><td>${ADMIN_STATUS[a.status]}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Sin registros.</p>'}
    <h3>Síntomas y efectos adversos</h3>${rep.symptoms.length ? `<ul>${rep.symptoms.map((s) => `<li>${fmtDate(s.date)}: ${esc([s.symptoms, s.adverse].filter(Boolean).join(' · '))}</li>`).join('')}</ul>` : '<p class="muted">Ninguno registrado.</p>'}
    <h3>Incidencias</h3>${rep.incidents.length ? `<ul>${rep.incidents.map((i) => `<li>${esc(i.label)} (${esc(i.status)})</li>`).join('')}</ul>` : '<p class="muted">Ninguna.</p>'}
    <h3>Hábitos registrados</h3><p>${rep.habits.length ? Object.entries(rep.habits.reduce((o, h) => ((o[h.type] = (o[h.type] || 0) + 1), o), {})).map(([k, n]) => `${esc(k)}: ${n}`).join(' · ') : '<span class="muted">Ninguno.</span>'}</p>
    <p class="small"><strong>${esc(rep.disclaimer)}</strong> Los cambios observados no se atribuyen automáticamente a ninguna sustancia.</p>`;
}

// ── Seguimiento postciclo ──
export async function pct(view, r, ctx) {
  const m = ctx.model;
  const cycles = await m.list('plans', ctx.profileId);
  const list = await m.list('pct', ctx.profileId);
  view.innerHTML = `<h1>Seguimiento postciclo</h1>
    <p><button id="new">Nuevo seguimiento</button></p>
    ${list.map((x) => { const c = cycles.find((y) => y.id === x.cycleId); return `<div class="card"><h2 style="margin-top:0">${esc(c?.name || 'Seguimiento postciclo')} <span class="badge">${esc(PCT_STATUS[x.status])}</span></h2>
      <dl class="kv"><dt>Ciclo relacionado</dt><dd>${esc(c ? (c.name || PLAN_MODES[c.mode]) : '—')}</dd><dt>Fin previsto</dt><dd>${fmtDate(x.plannedEnd)}</dd><dt>Fin real</dt><dd>${fmtDate(x.actualEnd)}</dd>
      <dt>Revisión</dt><dd>${fmtDate(x.reviewDate)}</dd><dt>Plan</dt><dd>${esc(m.pctPlanLabel(x))}</dd><dt>Fuente del plan</dt><dd>${esc(x.planSource || '—')}</dd>
      <dt>Productos anotados</dt><dd>${esc(x.products || '—')}</dd><dt>Cantidades anotadas</dt><dd>${esc(x.amounts || '—')}</dd>
      <dt>Fechas del plan</dt><dd>${x.dates?.length ? x.dates.map((d) => `${fmtDate(d.date)} ${esc(d.label)}`).join('<br>') : '—'}</dd>
      <dt>Síntomas</dt><dd>${esc(x.symptoms || '—')}</dd><dt>Análisis aportados</dt><dd>${esc(x.labResults || '—')}</dd><dt>Observaciones</dt><dd>${esc(x.notes || '—')}</dd></dl>
      <p><button class="sec" data-ed="${x.id}">Editar</button></p></div>`; }).join('') || '<div class="card muted">Sin seguimientos.</div>'}`;
  const form = (x = {}) => `
    ${field('Ciclo relacionado', `<select name="cycleId"><option value="">—</option>${cycles.map((c) => opt(c.id, `${c.name || PLAN_MODES[c.mode]} (${fmtDate(c.start)})`, x.cycleId || r.query.ciclo)).join('')}</select>`)}
    <div class="grid">${field('Fin previsto', inp('plannedEnd', x.plannedEnd || '', 'type="date"'))}${field('Fin real', inp('actualEnd', x.actualEnd || '', 'type="date"'))}${field('Fecha de revisión', inp('reviewDate', x.reviewDate || '', 'type="date"'))}</div>
    ${field('Plan de seguimiento existente', `<textarea name="planText" placeholder="${esc(PCT_UNDEFINED)}">${esc(x.planText || '')}</textarea>`)}
    ${field('Fuente de ese plan', inp('planSource', x.planSource || ''))}
    ${field('Productos anotados por el usuario', `<textarea name="products">${esc(x.products || '')}</textarea>`)}
    ${field('Cantidades introducidas', `<textarea name="amounts">${esc(x.amounts || '')}</textarea>`)}
    ${field('Fechas ya documentadas (una por línea: AAAA-MM-DD texto)', `<textarea name="datesText">${esc((x.dates || []).map((d) => `${d.date} ${d.label}`).join('\n'))}</textarea>`)}
    ${field('Síntomas', `<textarea name="symptoms">${esc(x.symptoms || '')}</textarea>`)}${field('Resultados de análisis aportados', `<textarea name="labResults">${esc(x.labResults || '')}</textarea>`)}
    ${field('Observaciones', `<textarea name="notes">${esc(x.notes || '')}</textarea>`)}
    ${field('Estado', `<select name="status">${Object.entries(PCT_STATUS).map(([k, v]) => opt(k, v, x.status)).join('')}</select>`)}`;
  const parse = (d) => { const dates = d.datesText.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => ({ date: l.slice(0, 10), label: l.slice(10).trim() })); delete d.datesText; return { ...d, dates }; };
  $('#new').addEventListener('click', async () => { if (await dialog(`<form><h2>Nuevo seguimiento postciclo</h2>${form()}<div class="row"><button>Guardar</button><button type="button" class="sec" data-close>Cancelar</button></div></form>`, { onSubmit: (d) => m.addPCT(ctx.profileId, parse(d)) })) pct(view, r, ctx); });
  $$('[data-ed]').forEach((b) => b.addEventListener('click', async () => {
    const x = list.find((y) => y.id === b.dataset.ed);
    if (await dialog(`<form><h2>Editar seguimiento</h2>${form(x)}<div class="row"><button>Guardar</button><button type="button" class="sec" data-close>Cancelar</button></div></form>`, {
      onSubmit: (d) => { const p = parse(d); if (p.dates.some((z) => !/^\d{4}-\d{2}-\d{2}$/.test(z.date))) throw new Error('Cada fecha debe empezar por AAAA-MM-DD'); return m._update('pct', x.id, p, ctx.profileId); },
    })) pct(view, r, ctx);
  }));
}

// ── Recordatorios ──
export async function recordatorios(view, r, ctx) {
  const m = ctx.model;
  const products = await m.products();
  const plans = await m.list('plans', ctx.profileId);
  const list = await m.list('reminders', ctx.profileId);
  const perm = notifySupported() ? Notification.permission : 'no-soportado';
  view.innerHTML = `<h1>Recordatorios</h1>
    <div class="card small"><p><strong>Cómo avisa la app:</strong> mientras está abierta (o en segundo plano reciente) muestra notificaciones del sistema. Con la app cerrada, un navegador no garantiza avisos a una hora exacta: para eso, exporta los recordatorios al calendario de Android (.ics), que sí avisa.</p>
      <p>Permiso de notificaciones: <strong>${esc({ granted: 'concedido', denied: 'denegado', default: 'sin decidir', 'no-soportado': 'no disponible en este navegador' }[perm])}</strong></p>
      <div class="row noprint"><button id="perm" class="sec">Activar notificaciones</button><button id="test" class="sec">Probar aviso</button><button id="ics" class="sec">Exportar a calendario (.ics)</button></div></div>
    <p><button id="new">Nuevo recordatorio</button></p>
    <div class="card"><ul class="plain">${list.map((x) => `<li><strong>${esc(x.label)}</strong> ${x.enabled ? '' : '<span class="badge">Desactivado</span>'} <span class="badge">${esc(x.kind)}</span>
      <br><span class="small">${x.times.join(', ')} · ${x.days.length ? x.days.map((d) => DOW_FULL.find((z) => +z[0] === d)[1]).join(' ') : 'todos los días'} · desde ${fmtDate(x.startDate)}${x.endDate ? ' hasta ' + fmtDate(x.endDate) : ''}${x.snoozedUntil && new Date(x.snoozedUntil) > new Date() ? ' · pospuesto hasta ' + new Date(x.snoozedUntil).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
      <div class="row" style="margin-top:.3rem"><button class="sec" data-a="tog" data-id="${x.id}">${x.enabled ? 'Desactivar' : 'Activar'}</button><button class="sec" data-a="snz" data-id="${x.id}">Posponer 30 min</button><button class="sec" data-a="ed" data-id="${x.id}">Editar</button><button class="danger" data-a="del" data-id="${x.id}">Borrar</button></div></li>`).join('') || '<li class="muted">Sin recordatorios.</li>'}</ul></div>`;
  const form = (x = {}) => `${field('Texto', inp('label', x.label || '', 'required'), true)}
    ${field('Tipo', `<select name="kind">${[['administracion', 'Aplicación / toma'], ['agua', 'Hidratación'], ['comida', 'Alimentación'], ['entreno', 'Entrenamiento'], ['revision', 'Revisión'], ['otro', 'Otro']].map(([k, v]) => opt(k, v, x.kind)).join('')}</select>`)}
    ${field('Sustancia (opcional)', `<select name="productId">${productOptions(products, x.productId)}</select>`)}
    ${field('Plan (opcional)', `<select name="planId"><option value="">—</option>${plans.map((p) => opt(p.id, p.name || PLAN_MODES[p.mode], x.planId)).join('')}</select>`)}
    ${field('Horas (separadas por comas, HH:MM)', inp('timesText', (x.times || ['09:00']).join(', '), 'required'), true)}
    <fieldset><legend>Días (vacío = todos)</legend><div class="row">${DOW_FULL.map(([v, l]) => `<label class="check"><input type="checkbox" name="days" value="${v}" data-multi ${x.days?.includes(+v) ? 'checked' : ''}>${l}</label>`).join('')}</div></fieldset>
    <div class="grid">${field('Desde', inp('startDate', x.startDate || todayISO(), 'type="date"'))}${field('Hasta (opcional)', inp('endDate', x.endDate || '', 'type="date"'))}</div>`;
  const parse = (d) => ({ ...d, times: d.timesText.split(',').map((s) => s.trim()).filter(Boolean).map((s) => (s.length === 4 ? '0' + s : s)), days: (d.days || []).map(Number) });
  $('#new').addEventListener('click', async () => { if (await dialog(`<form><h2>Nuevo recordatorio</h2>${form()}<div class="row"><button>Guardar</button><button type="button" class="sec" data-close>Cancelar</button></div></form>`, { onSubmit: (d) => m.addReminder(ctx.profileId, parse(d)) })) recordatorios(view, r, ctx); });
  $('#perm').addEventListener('click', async () => { toast('Permiso: ' + (await askPermission())); recordatorios(view, r, ctx); });
  $('#test').addEventListener('click', async () => {
    if (!notifySupported() || Notification.permission !== 'granted') return toast('Primero activa las notificaciones');
    (await navigator.serviceWorker.ready).showNotification('Prueba de aviso', { body: 'Las notificaciones funcionan en este dispositivo.' });
  });
  $('#ics').addEventListener('click', async () => {
    const profs = await m.profiles();
    const items = [];
    for (const p of profs) for (const x of await m.list('reminders', p.id)) items.push({ reminder: x, profileName: p.name });
    if (!items.length) return toast('No hay recordatorios');
    download(`recordatorios-${todayISO()}.ics`, remindersToICS(items), 'text/calendar');
  });
  $$('[data-a]').forEach((b) => b.addEventListener('click', async () => {
    const x = list.find((y) => y.id === b.dataset.id);
    if (b.dataset.a === 'tog') await m._update('reminders', x.id, { enabled: !x.enabled }, ctx.profileId);
    if (b.dataset.a === 'snz') await m.snoozeReminder(ctx.profileId, x.id, 30);
    if (b.dataset.a === 'del') await ctx.store.del('reminders', x.id);
    if (b.dataset.a === 'ed') await dialog(`<form><h2>Editar recordatorio</h2>${form(x)}<div class="row"><button>Guardar</button><button type="button" class="sec" data-close>Cancelar</button></div></form>`, {
      onSubmit: (d) => { const p = parse(d); if (!p.times.length || !p.times.every((t) => /^\d{2}:\d{2}$/.test(t))) throw new Error('Horas en formato HH:MM'); delete p.timesText; return m._update('reminders', x.id, p, ctx.profileId); },
    });
    recordatorios(view, r, ctx);
  }));
}

// ── Peso ──
export async function peso(view, r, ctx) {
  const m = ctx.model;
  const prof = (await m.profiles({ includeArchived: true })).find((p) => p.id === ctx.profileId);
  const ws = await m.weights(ctx.profileId);
  const first = ws[0], last = ws[ws.length - 1];
  let ch = null; try { ch = first && last && ws.length > 1 ? weightChange(first.kg, last.kg) : null; } catch { ch = null; }
  view.innerHTML = `<h1>Peso corporal</h1>
    <form class="card" id="f"><div class="grid">${field('Fecha', inp('date', todayISO(), 'type="date" required'), true)}${field('Peso (kg)', inp('kg', '', 'type="number" step="0.1" min="1" required inputmode="decimal"'), true)}</div>
      ${field('Nota', inp('note'))}<p><button>Añadir pesaje</button></p></form>
    <div class="card"><h2 style="margin-top:0">Evolución</h2>
      <p>Inicial: <strong>${first ? fmtNum(first.kg, 1) + ' kg' : '—'}</strong> · Actual: <strong>${last ? fmtNum(last.kg, 1) + ' kg' : '—'}</strong> · Variación: <strong>${ch ? `${ch.kg > 0 ? '+' : ''}${fmtNum(ch.kg)} kg (${ch.pct > 0 ? '+' : ''}${fmtNum(ch.pct)} %)` : '—'}</strong>
      ${prof?.targetWeight ? ` · Objetivo personal: ${fmtNum(prof.targetWeight, 1)} kg` : ''}</p>
      <p class="small muted">Variación = actual − inicial; % = (actual − inicial) / inicial × 100.</p>
      <div class="chart">${lineChart(ws.map((w) => ({ date: w.date, value: w.kg })))}</div>
      <div class="table-wrap"><table><thead><tr><th>Fecha</th><th>kg</th><th>Nota</th><th></th></tr></thead><tbody>${[...ws].reverse().map((w) => `<tr><td>${fmtDate(w.date)}</td><td>${fmtNum(w.kg, 1)}</td><td>${esc(w.note)}</td><td><button class="sec" data-del="${w.id}">Borrar</button></td></tr>`).join('')}</tbody></table></div></div>`;
  $('#f').addEventListener('submit', async (e) => { e.preventDefault(); try { await m.addWeight(ctx.profileId, readForm(e.target)); peso(view, r, ctx); } catch (err) { showErr(e.target, err); } });
  $$('[data-del]').forEach((b) => b.addEventListener('click', async () => { await ctx.store.del('weights', b.dataset.del); peso(view, r, ctx); }));
}

// ── Hábitos ──
export async function habitos(view, r, ctx) {
  const m = ctx.model;
  const t = todayISO();
  const prof = (await m.profiles({ includeArchived: true })).find((p) => p.id === ctx.profileId);
  const habits = (await m.list('habits', ctx.profileId)).sort((a, b) => b.date.localeCompare(a.date));
  const admins = await m.history(ctx.profileId, { from: addDays(t, -2) });
  const recentGI = admins.some((a) => dehydration(a.symptoms + ' ' + a.adverse)) || habits.some((h) => h.date >= addDays(t, -2) && dehydration(h.discomfort + ' ' + h.notes));
  const recentBad = admins.some((a) => /mare|desmay|deshidrat|malestar|fiebre|v[oó]mit/i.test(a.symptoms + ' ' + a.adverse));
  const water = habits.filter((h) => h.type === 'agua' && h.date === t).reduce((s, h) => s + (Number(h.ml) || 0), 0);
  const weekStart = addDays(t, -dowMon(t));
  const strengthDone = habits.filter((h) => h.type === 'entreno' && h.done && h.date >= weekStart && /fuerza/i.test(h.activity || '')).length;
  view.innerHTML = `<h1>Hábitos saludables</h1>
    ${recentGI ? `<div class="alert aviso">${DEHYDRATION_TEXT}</div>` : ''}
    ${recentBad ? '<div class="alert aviso">Hay síntomas recientes (mareo, malestar, vómitos o deshidratación): no es momento de entrenamiento intenso. Consulta si persisten.</div>' : ''}
    <div class="grid">
    <form class="card" data-type="agua"><h2 style="margin-top:0">Hidratación</h2><p>Hoy: <strong>${fmtNum(water, 0)} ml</strong></p>
      <p class="small muted">Las necesidades varían según la persona; algunas enfermedades requieren limitar líquidos. Beber más agua no neutraliza los efectos adversos de ninguna sustancia.</p>
      <div class="row"><button type="button" data-ml="250">+ 1 vaso (250 ml)</button><button type="button" class="sec" data-ml="500">+ 500 ml</button></div>
      ${field('Otra cantidad (ml)', inp('ml', '', 'type="number" min="1" step="1"'))}<button>Anotar</button></form>
    <form class="card" data-type="comida"><h2 style="margin-top:0">Alimentación</h2>
      <ul class="small"><li>Reduce bebidas azucaradas y azúcares añadidos.</li><li>Prioriza alimentos poco procesados; incluye frutas y verduras.</li><li>Mantén una alimentación variada; evita dietas extremas o restricciones no supervisadas.</li></ul>
      <p class="small muted">Son consejos generales: no previenen por sí solos efectos adversos.</p>
      ${field('Comida (opcional)', inp('meal', '', 'placeholder="p. ej. comida: lentejas y ensalada"'))}
      <label class="check"><input type="checkbox" name="sugaryDrink">Tomé bebida azucarada</label><label class="check"><input type="checkbox" name="fruitVeg">Incluí fruta o verdura</label>
      <button>Anotar</button></form>
    <form class="card" data-type="entreno"><h2 style="margin-top:0">Actividad y fuerza</h2>
      <p class="small">${esc(WHO_ACTIVITY.text)} <a href="${WHO_ACTIVITY.source}" target="_blank" rel="noopener">Fuente: ${esc(WHO_ACTIVITY.sourceName)}</a></p>
      ${field('Objetivo semanal de sesiones de fuerza', inp('goal', prof?.strengthGoal ?? '', 'type="number" min="0" max="14"'))}
      <p>Esta semana: <strong>${strengthDone}</strong> sesiones de fuerza completadas${prof?.strengthGoal ? ` de ${prof.strengthGoal}` : ''}.</p>
      ${prof?.limitations ? `<p class="small">Limitaciones declaradas: ${esc(prof.limitations)}</p>` : ''}
      <div class="grid">${field('Fecha', inp('date', t, 'type="date"'))}${field('Tipo de actividad', inp('activity', 'Fuerza', 'list="acts"') + '<datalist id="acts"><option value="Fuerza"><option value="Caminar"><option value="Bicicleta"><option value="Natación"><option value="Movilidad"></datalist>')}
      ${field('Duración (min)', inp('minutes', '', 'type="number" min="1"'))}${field('Intensidad percibida (1–10)', inp('rpe', '', 'type="number" min="1" max="10"'))}</div>
      ${field('Grupos musculares', inp('muscles'))}${field('Molestias / observaciones', inp('discomfort'))}
      <label class="check"><input type="checkbox" name="done" checked>Completada (desmarca si es una sesión prevista)</label><button>Anotar</button></form>
    <form class="card" data-type="sueno"><h2 style="margin-top:0">Sueño y estado general</h2>
      <div class="grid">${field('Horas de sueño', inp('sleepHours', '', 'type="number" step="0.5" min="0" max="24"'))}${field('Calidad del descanso (1–5)', inp('sleepQuality', '', 'type="number" min="1" max="5"'))}
      ${field('Energía (1–5)', inp('energy', '', 'type="number" min="1" max="5"'))}${field('Apetito (1–5)', inp('appetite', '', 'type="number" min="1" max="5"'))}</div>
      ${field('Estado general', inp('general'))}${field('Molestias', inp('discomfort'))}${field('Cumplimiento de hábitos elegidos', inp('compliance'))}
      <p class="small muted">Los cambios registrados no se atribuyen automáticamente a ninguna sustancia.</p><button>Anotar</button></form>
    </div>
    <p class="small">Para avisos de hidratación, comidas o entrenamiento, crea recordatorios del tipo correspondiente en <a href="#/recordatorios">Recordatorios</a>.</p>
    <div class="card"><h2 style="margin-top:0">Últimos registros</h2><ul class="plain">${habits.slice(0, 30).map((h) => `<li>${fmtDate(h.date)} · ${esc(h.type)} · ${esc(Object.entries(h).filter(([k, v]) => !['id', 'profileId', 'createdAt', 'type', 'date'].includes(k) && v !== '' && v !== false).map(([k, v]) => `${k}: ${v}`).join(', '))}</li>`).join('') || '<li class="muted">Sin registros.</li>'}</ul></div>`;
  $$('form[data-type]').forEach((f) => {
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = readForm(f);
      try {
        if (f.dataset.type === 'entreno' && d.goal !== String(prof?.strengthGoal ?? '')) await m.updateProfile(ctx.profileId, { strengthGoal: d.goal === '' ? null : Number(d.goal) });
        delete d.goal;
        if (f.dataset.type === 'agua' && !(Number(d.ml) > 0)) throw new Error('Indica los ml');
        await m.addHabit(ctx.profileId, { ...d, date: d.date || t, type: f.dataset.type });
        toast('Anotado'); habitos(view, r, ctx);
      } catch (err) { showErr(f, err); }
    });
  });
  $$('[data-ml]').forEach((b) => b.addEventListener('click', async () => { await m.addHabit(ctx.profileId, { date: t, type: 'agua', ml: b.dataset.ml }); habitos(view, r, ctx); }));
}

// ── Informes y exportación ──
export async function informes(view, r, ctx) {
  const m = ctx.model;
  const products = await m.products();
  const q = r.query;
  const days = q.from && q.to ? diffDays(q.from, q.to) : null;
  const rep = days != null && days >= 0 ? await m.report(ctx.profileId, { start: q.from, days }) : null;
  const filtered = rep ? rep.admins.filter((a) => (!q.prod || a.productId === q.prod) && (!q.cat || products.find((p) => p.id === a.productId)?.category === q.cat)) : [];
  const ws = (await m.weights(ctx.profileId)).filter((w) => !rep || (w.date >= q.from && w.date <= q.to));
  const inv = await m.inventory(ctx.profileId);
  const incs = await m.list('incidents', ctx.profileId);
  const usedSources = [...new Set(filtered.map((a) => a.productId))].map((id) => products.find((p) => p.id === id)?.substance).filter(Boolean);
  view.innerHTML = `<h1>Informes y exportación</h1>
    <form class="card noprint" id="flt"><div class="grid">${field('Desde', inp('from', q.from || addDays(todayISO(), -28), 'type="date" required'))}${field('Hasta', inp('to', q.to || todayISO(), 'type="date" required'))}
      ${field('Sustancia', `<select name="prod">${productOptions(products, q.prod)}</select>`)}
      ${field('Categoría', `<select name="cat"><option value="">Todas</option>${['peptido', 'sarm', 'oral', 'combinacion', 'topico', 'cosmetico', 'custom'].map((c) => opt(c, c, q.cat)).join('')}</select>`)}</div>
      <p class="row"><button>Generar informe</button>${rep ? '<button type="button" id="print" class="sec">Imprimir / guardar PDF</button>' : ''}</p></form>
    ${rep ? `<div class="card">${reportHTML({ ...rep, admins: filtered }, products)}
      <h3>Evolución del peso</h3><div class="chart">${lineChart(ws.map((w) => ({ date: w.date, value: w.kg })))}</div>
      <h3>Lotes y caducidades</h3>${inv.length ? `<ul>${inv.map((l) => `<li>${esc(products.find((p) => p.id === l.productId)?.substance)} · lote ${esc(l.lot || '—')} · cad. ${fmtDate(l.expiry)} · quedan ${l.unitsLeft ?? '—'}</li>`).join('')}</ul>` : '<p class="muted">Sin lotes.</p>'}
      <h3>Fuentes de la información de seguridad</h3><p class="small">${usedSources.length ? `Consulta la ficha de cada sustancia (${esc(usedSources.join(', '))}) en el catálogo; cada efecto adverso lleva su fuente y fecha de consulta.` : '—'}</p></div>` : ''}
    <div class="card noprint"><h2 style="margin-top:0">Exportar datos</h2>
      <div class="row"><button id="jsonP" class="sec">JSON de este perfil</button><button id="jsonA" class="sec">JSON de todos (copia completa)</button></div>
      <div class="row" style="margin-top:.5rem"><select id="csvColl" style="max-width:16rem">${COLLECTIONS.filter((c) => !['settings', 'customProducts', 'templates'].includes(c)).map((c) => opt(c, c, 'administrations')).join('')}</select><button id="csv" class="sec">CSV de este perfil</button></div>
      <p class="small muted">El CSV usa «;» como separador para abrirse bien en Excel en español. Incidencias registradas: ${incs.length}.</p></div>`;
  $('#flt').addEventListener('submit', (e) => { e.preventDefault(); const d = readForm(e.target); location.hash = '#/informes?' + new URLSearchParams(Object.entries(d).filter(([, v]) => v)).toString(); });
  $('#print')?.addEventListener('click', () => window.print());
  const prof = (await m.profiles({ includeArchived: true })).find((p) => p.id === ctx.profileId);
  const slug = (prof?.name || 'perfil').replace(/[^\w-]+/g, '_');
  $('#jsonP').addEventListener('click', async () => download(`registro-${slug}-${todayISO()}.json`, JSON.stringify(await m.exportJSON(ctx.profileId), null, 1), 'application/json'));
  $('#jsonA').addEventListener('click', async () => download(`registro-completo-${todayISO()}.json`, JSON.stringify(await m.exportJSON(), null, 1), 'application/json'));
  $('#csv').addEventListener('click', async () => { const c = $('#csvColl').value; const csv = await m.exportCSV(c, ctx.profileId); if (!csv) return toast('No hay datos en esa sección'); download(`${c}-${slug}-${todayISO()}.csv`, csv, 'text/csv;charset=utf-8'); });
}

// ── Incidencias ──
export async function incidencias(view, r, ctx) {
  const m = ctx.model;
  const products = await m.products();
  const list = ctx.profileId ? (await m.list('incidents', ctx.profileId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [];
  view.innerHTML = `<h1>Incidencias</h1>
    <div class="card"><h2 style="margin-top:0">Ayuda urgente</h2><ul><li>Emergencias: <a href="tel:112">112</a></li><li>${esc(EMERGENCY.toxicology.label)}: <a href="tel:${EMERGENCY.toxicology.phone.replace(/\s/g, '')}">${esc(EMERGENCY.toxicology.phone)}</a></li></ul>
      <p class="small muted">${esc(EMERGENCY.toxicology.note)} <a href="${EMERGENCY.toxicology.source}" target="_blank" rel="noopener">Fuente</a></p>
      <p>Si se ha registrado más cantidad que la del plan: no tomes una cantidad compensatoria ni esperes a la siguiente sin consultar. Contacta cuanto antes con un profesional sanitario o con toxicología.</p></div>
    <div class="card"><h2 style="margin-top:0">Registro de incidencias</h2>${list.length ? `<ul class="plain">${list.map((i) => `<li><strong>${esc(i.label)}</strong> <span class="badge">${esc(i.status)}</span>${i.severe ? ' <span class="badge ruo">Síntomas graves marcados</span>' : ''}
      <br>${esc(products.find((p) => p.id === i.productId)?.substance || '')} · registrado ${fmtNum(i.registered, 4)} / plan ${fmtNum(i.reference, 4)} ${esc(i.unit)} · ${i.when ? new Date(i.when).toLocaleString('es-ES') : ''}
      ${i.symptoms?.length ? `<br><span class="small">Síntomas: ${esc(i.symptoms.join(', '))}</span>` : ''}${i.others ? `<br><span class="small">Otros: ${esc(i.others)}</span>` : ''}${i.notes ? `<br><span class="small">Revisión: ${esc(i.notes)}</span>` : ''}
      <div class="row" style="margin-top:.3rem"><button class="sec" data-rev="${i.id}">Revisar</button></div></li>`).join('')}</ul>` : '<p class="muted">Sin incidencias.</p>'}</div>`;
  $$('[data-rev]').forEach((b) => b.addEventListener('click', async () => {
    const i = list.find((x) => x.id === b.dataset.rev);
    if (await dialog(`<form><h2>Revisar incidencia</h2>${field('Estado', `<select name="status">${['abierta', 'revisada: error de registro', 'revisada: consultado con profesional', 'cerrada'].map((x) => opt(x, x, i.status)).join('')}</select>`)}
      ${field('Notas de la revisión', `<textarea name="notes">${esc(i.notes)}</textarea>`)}<div class="row"><button>Guardar</button><button type="button" class="sec" data-close>Cancelar</button></div></form>`, { onSubmit: (d) => m._update('incidents', i.id, { ...d, status: d.status === 'abierta' ? 'abierta' : d.status }, ctx.profileId) })) incidencias(view, r, ctx);
  }));
}

// ── Ajustes ──
export async function ajustes(view, r, ctx) {
  const hasPin = !!(await ctx.store.get('settings', 'pin'));
  const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : null;
  view.innerHTML = `<h1>Ajustes</h1>
    <form class="card" id="ui"><h2 style="margin-top:0">Lectura</h2><div class="grid">
      ${field('Tamaño de letra', `<select name="size">${[['16', 'Normal'], ['19', 'Grande'], ['22', 'Muy grande'], ['25', 'Enorme']].map(([k, v]) => opt(k, v, ctx.ui.size)).join('')}</select>`)}
      ${field('Contraste', `<select name="contrast">${[['normal', 'Normal'], ['alto', 'Alto']].map(([k, v]) => opt(k, v, ctx.ui.contrast)).join('')}</select>`)}
      ${field('Bloqueo automático tras (minutos sin uso; 0 = nunca)', inp('lockMinutes', ctx.ui.lockMinutes, 'type="number" min="0" max="120"'))}</div><button>Guardar</button></form>
    <form class="card" id="pin"><h2 style="margin-top:0">Bloqueo con PIN</h2><p>Estado: <strong>${hasPin ? 'PIN activo' : 'sin PIN'}</strong></p>
      ${hasPin ? field('PIN actual', inp('old', '', 'type="password" inputmode="numeric" autocomplete="off"')) : ''}
      <p class="small">Con PIN aparece arriba el botón <strong>Bloquear</strong>, que cierra la app al momento y pide el PIN para volver. Sin PIN ese botón no se muestra.</p>
      ${field('Nuevo PIN (4–8 cifras; vacío para quitarlo)', inp('pin', '', 'type="password" inputmode="numeric" autocomplete="off"'))}
      <p class="small muted">El PIN impide abrir la app en este dispositivo. <strong>Los datos no están cifrados</strong>: alguien con acceso técnico al navegador podría leerlos. Bloquea también el teléfono.</p><button>Guardar PIN</button></form>
    <div class="card"><h2 style="margin-top:0">Instalación</h2><p>${appInstalledHere() ? 'Estás usando la app instalada.' : 'Estás en el navegador. Si ya la instalaste, ábrela desde su icono.'}</p>
      <button id="inst" class="sec">Cómo instalar</button></div>
    <div class="card"><h2 style="margin-top:0">Copia de seguridad</h2>
      <p class="small">Los datos se guardan solo en este navegador y dispositivo; no se envían a ningún servidor ni servicio de IA. Si borras los datos del navegador o desinstalas la app, se pierden: haz copias.</p>
      <p class="small">Almacenamiento persistente: <strong>${persisted == null ? 'no disponible' : persisted ? 'concedido' : 'no concedido (el navegador podría borrar datos si falta espacio)'}</strong></p>
      <div class="row"><button id="bk" class="sec">Descargar copia (.json)</button><label class="btn sec" style="margin:0">Restaurar copia<input type="file" id="rs" accept=".json,application/json" hidden></label></div>
      <label class="check"><input type="checkbox" id="rsReplace">Al restaurar, sustituir todos los datos actuales</label></div>
    <div class="card"><h2 style="margin-top:0">Borrar todo</h2><p>Elimina todos los perfiles y datos de este dispositivo.</p><button id="wipe" class="danger">Borrar todos los datos</button></div>
    <div class="card small"><h2 style="margin-top:0">Sobre la app</h2><p>Registro organizado de datos declarados. No es un dispositivo médico, no recomienda cantidades ni protocolos, y registrar algo no prueba que un producto sea seguro, puro o adecuado.</p></div>`;
  $('#ui').addEventListener('submit', async (e) => { e.preventDefault(); const d = readForm(e.target); await saveUI({ size: d.size, sizeChosen: true, contrast: d.contrast, lockMinutes: Number(d.lockMinutes) || 0 }); toast('Guardado'); });
  $('#pin').addEventListener('submit', async (e) => {
    e.preventDefault(); const d = readForm(e.target);
    try {
      if (hasPin && !(await checkPin(ctx.store, d.old || ''))) throw new Error('El PIN actual no es correcto');
      if (!d.pin) { await ctx.store.del('settings', 'pin'); toast('PIN eliminado'); } else { await setPin(ctx.store, d.pin); toast('PIN guardado'); }
      await updateLockBtn(); ajustes(view, r, ctx);
    } catch (err) { showErr(e.target, err); }
  });
  $('#inst').addEventListener('click', installApp);
  $('#bk').addEventListener('click', async () => download(`registro-copia-${todayISO()}.json`, JSON.stringify(await ctx.model.exportJSON(), null, 1), 'application/json'));
  $('#rs').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try { const data = JSON.parse(await file.text()); if (data?.tipo === 'biblioteca-protocolos') { const n = await ctx.model.importLibrary(data); toast(`Era una biblioteca: ${n} modelos cargados en Biblioteca`); return; } const n = await ctx.model.importJSON(data, { replace: $('#rsReplace').checked }); toast(`Restaurados ${n} registros`); await refreshProfiles(); }
    catch (err) { toast('No se pudo restaurar: ' + err.message, 5000); }
    e.target.value = '';
  });
  $('#wipe').addEventListener('click', async () => {
    const ok = await dialog(`<form><h2>Borrar todos los datos</h2><div class="alert seguridad">No se puede deshacer.</div>${field('Escribe BORRAR para confirmar', inp('c', '', 'required autocomplete="off"'))}
      <div class="row"><button class="danger">Borrar</button><button type="button" class="sec" data-close>Cancelar</button></div></form>`, {
      onSubmit: async (d) => { if (d.c !== 'BORRAR') throw new Error('Escribe BORRAR en mayúsculas'); for (const c of COLLECTIONS) await ctx.store.clear(c); return true; },
    });
    if (ok) { appCtx.profileId = null; location.hash = '#/'; location.reload(); }
  });
}

// ── Importar planes desde texto ──
export const IMPORT_TEMPLATE = `PLAN: nombre del plan
PERSONA: nombre exacto del perfil
SUSTANCIA: código del catálogo (p. ej. reta15)
INICIO: AAAA-MM-DD
DURACION: N semanas
FUENTE: de dónde sale este protocolo
FASE: semanas 1-4 | cantidad | unidad | frecuencia | nota
FASE: semanas 5-8 | cantidad | unidad | frecuencia | nota
---`;
async function importDialog(ctx) {
  const m = ctx.model;
  const products = await m.products();
  let parsed = [];
  const d = document.getElementById('dlg');
  d.innerHTML = `<h2>Importar planes desde texto</h2>
    <p class="small">Pega uno o varios planes con esta plantilla. Separa cada plan con una línea <code>---</code>. Las líneas que empiezan por <code>#</code> se ignoran. Opcionales: <code>FIN:</code>, <code>MODALIDAD:</code>, <code>REVISION CADA:</code> (días), <code>NOTA:</code>.</p>
    <pre class="small" style="white-space:pre-wrap;background:var(--bg);padding:.5rem;border-radius:.4rem">${esc(IMPORT_TEMPLATE)}</pre>
    <div class="row"><button type="button" class="sec" id="cpy">Copiar plantilla</button><a class="btn sec" href="#/catalogo" id="cat">Ver códigos del catálogo</a></div>
    <label for="impTxt">Tu texto</label><textarea id="impTxt" rows="10" spellcheck="false"></textarea>
    <div class="row" style="margin-top:.6rem"><button type="button" id="chk">Revisar</button><button type="button" id="go" disabled>Importar</button><button type="button" class="sec" data-close>Cancelar</button></div>
    <div id="prev" aria-live="polite"></div>`;
  return new Promise((resolve) => {
    const close = (v) => { d.close(); resolve(v); };
    d.querySelector('[data-close]').addEventListener('click', () => close(0));
    d.querySelector('#cat').addEventListener('click', () => close(0));
    d.addEventListener('cancel', () => resolve(0), { once: true });
    d.querySelector('#cpy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(IMPORT_TEMPLATE); toast('Plantilla copiada'); } catch { toast('No se pudo copiar: selecciona el texto a mano'); } });
    d.querySelector('#chk').addEventListener('click', async () => {
      parsed = parseImportText(d.querySelector('#impTxt').value, { profiles: await m.profiles(), products });
      const bad = parsed.some((x) => x.errors.length);
      d.querySelector('#go').disabled = !parsed.length || bad;
      d.querySelector('#prev').innerHTML = !parsed.length ? '<p class="err">No hay ningún plan en el texto.</p>' : parsed.map((x) => `<div class="card">
        <h3 style="margin-top:0">Plan ${x.index}: ${esc(x.plan.name || '(sin nombre)')}</h3>
        <dl class="kv"><dt>Persona</dt><dd>${esc(x.profile?.name || '—')}</dd><dt>Sustancia</dt><dd>${esc(x.product ? `${x.product.substance} (${x.product.id})` : '—')}</dd>
        <dt>Inicio</dt><dd>${esc(x.plan.start || '—')}</dd><dt>Fin</dt><dd>${esc(planEnd(x.plan) || 'sin fecha final')}</dd><dt>Modalidad</dt><dd>${esc(PLAN_MODES[x.plan.mode] || x.plan.mode)}</dd>
        <dt>Fases</dt><dd>${x.plan.phases.length ? x.plan.phases.map((f) => esc(phaseText(f))).join('<br>') : '—'}</dd></dl>
        ${x.errors.length ? `<div class="alert seguridad">${x.errors.map(esc).join('<br>')}</div>` : '<p class="small">Sin errores.</p>'}</div>`).join('')
        + (bad ? '<p class="err">Corrige los errores y vuelve a pulsar Revisar.</p>' : '<p>Comprueba cada cifra y unidad antes de importar.</p>');
    });
    d.querySelector('#go').addEventListener('click', async () => {
      try { const out = await importPlans(m, parsed); toast(`${out.length} plan(es) importados`); close(out.length); }
      catch (e) { d.querySelector('#prev').insertAdjacentHTML('afterbegin', `<p class="err">${esc(e.message)}</p>`); }
    });
    d.showModal();
  });
}
