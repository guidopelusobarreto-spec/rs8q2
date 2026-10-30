// Pantalla Hoy, cronograma de protocolos, fichas maquetadas, texto original como documento y menú «Más».
import { esc, $, $$, toast, dialog, fmtDate, field, inp } from './ui.js';
import { todayISO, planEnd, planBaseEnd, diffDays, addDays, planWeek, pausedOn, pausesOf } from './model.js';
import { pauseText, pauseDialog, resumeDialog } from './pausas.js';
import { MOMENTS, scheduleText, amountText, adherence, totalWeeks } from './schedule.js';
import { fmtDoc, fichaHTML, splitFichas, cleanInline } from './text.js';
import { productOptions, exceedFlow } from './views1.js';
import { confirmCompat } from './views3.js';
import { installApp, appInstalledHere } from './app.js';

const HUES = [205, 228, 252, 276, 300, 322, 188, 240, 265, 290];
export const hueFor = (s) => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return HUES[h % HUES.length]; };
const nowTime = () => new Date().toTimeString().slice(0, 5);
// Si se registró una cantidad distinta de la de la fase (cantidad fija), se muestra al lado del «Hecho».
const otherAmt = (a, ph) => (a && a.amount != null && ph?.amount != null && ph.amountMax == null && Number(a.amount) !== Number(ph.amount)
  ? ` <span class="chip">Otra cantidad: ${esc(String(a.amount).replace('.', ','))} ${esc(a.unit || ph.unit || '')}</span>` : '');
const longDate = (d) => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
const GROUPS = [['manana', 'Mañana'], ['mediodia', 'Mediodía'], ['tarde', 'Tarde'], ['noche', 'Noche'], ['', 'Sin hora fija']];
const groupOf = (s) => s.moment || (s.time ? (s.time < '12:00' ? 'manana' : s.time < '15:00' ? 'mediodia' : s.time < '20:00' ? 'tarde' : 'noche') : '');
export const LEGAL = `<ul class="small">
  <li>La app <strong>registra y organiza</strong> lo que escribe cada persona. No propone cantidades, pautas, postciclo ni preparación, y no convierte unidades.</li>
  <li>Las sustancias de investigación (RUO) no son medicamentos autorizados. Registrar algo no demuestra que sea seguro, puro ni adecuado.</li>
  <li>Los avisos solo comparan tus registros con tu propio plan. Ante cualquier síntoma o duda, consulta a un profesional sanitario (urgencias: <a href="tel:112">112</a>).</li>
  <li>Los datos se guardan <strong>solo en este dispositivo</strong>, sin cifrar: el PIN bloquea la pantalla, no cifra.</li></ul>`;

// Protocolos aplicados juntos (misma biblioteca y misma fecha de inicio) se muestran como un solo bloque.
function runsOf(plans, labels) {
  const map = new Map();
  for (const p of plans) {
    if (p.closed || !p.start) continue;
    const src = (p.source || '').match(/^Biblioteca: (.+?)(?: · |$)/);
    const name = src ? src[1] : p.name || labels.get(p.id);
    const key = (src ? name : p.id) + '|' + p.start;
    if (!map.has(key)) map.set(key, { name, start: p.start, plans: [] });
    map.get(key).plans.push(p);
  }
  return [...map.values()].map((r) => {
    const ends = r.plans.map(planEnd);
    const end = ends.includes(null) ? null : ends.sort().pop();
    const total = Math.max(0, ...r.plans.map(totalWeeks).filter(Boolean)) || null;
    return { ...r, end, total };
  }).sort((a, b) => b.start.localeCompare(a.start));
}
// Semana del protocolo en días activos (las pausas no cuentan). Si las sustancias van desfasadas, la más atrasada.
const runWeek = (x, date) => (date >= x.start ? Math.min(...x.plans.map((p) => planWeek(p, date))) : 0);
// Planes en pausa en una fecha, agrupados por protocolo y por pausa (las pausas puestas juntas comparten fechas).
function pausedGroups(runs, date) {
  const out = [];
  for (const x of runs) {
    const g = new Map();
    for (const p of x.plans) {
      const z = pausedOn(p, date), end = planEnd(p);
      if (!z || date < p.start || (end && date > end)) continue;
      const k = `${z.from}|${z.to}`;
      if (!g.has(k)) g.set(k, { run: x, pause: z, plans: [] });
      g.get(k).plans.push(p);
    }
    out.push(...g.values());
  }
  return out;
}

// ── Hoy ──
export async function hoy(view, r, ctx) {
  const m = ctx.model;
  if (!(await m.profiles()).length) {
    view.innerHTML = `<div class="card"><h1>Bienvenido</h1><p>Anota lo que toma cada persona, sigue sus protocolos semana a semana y registra cada toma con un toque.</p>
      <h2>Antes de empezar</h2>${LEGAL}<p><a class="btn" href="#/perfiles">Crear el primer perfil</a></p></div>`;
    return;
  }
  if (!ctx.profileId) { view.innerHTML = '<div class="card"><p>Elige una persona arriba.</p></div>'; return; }
  const pid = ctx.profileId, t = todayISO(), date = r.query.d || t;
  const [ag, plans] = [await m.agenda(pid, date), await m.list('plans', pid)];
  const labels = await m.planLabels(plans);
  const L = (p) => labels.get(p.id);
  const runs = runsOf(plans, labels);
  const active = runs.filter((x) => x.start <= addDays(date, 14) && (!x.end || x.end >= date));
  const paused = pausedGroups(runs, date);
  const doneN = ag.slots.filter((s) => s.status === 'done').length;
  const head = `<div class="today-head"><h1>${date === t ? 'Hoy' : esc(longDate(date).replace(/^./, (c) => c.toUpperCase()))}</h1>
      ${ag.slots.length ? `<span class="chip ${doneN === ag.slots.length ? 'ok' : ''}">${doneN} de ${ag.slots.length} hechas</span>` : ''}</div>
    <div class="daynav noprint"><a class="btn sec slim" href="#/?d=${addDays(date, -1)}" aria-label="Día anterior">‹</a><span class="muted">${esc(longDate(date))}</span>${date !== t ? '<a class="btn sec slim" href="#/">Hoy</a>' : ''}<a class="btn sec slim" href="#/?d=${addDays(date, 1)}" aria-label="Día siguiente">›</a></div>`;
  const runsHTML = active.length ? `<div class="runs">${active.map((x) => {
    const w = runWeek(x, date), stop = x.plans.every((p) => pausedOn(p, date));
    return `<a class="run" href="#/protocolos" style="text-decoration:none;color:inherit"><strong>${esc(x.name)}</strong><br>
      <span class="small">${w ? `Semana ${w}${x.total ? ` de ${x.total}` : ''}${stop ? ' · en pausa' : ''}` : `Empieza el ${fmtDate(x.start)}`}</span>
      ${w && x.total ? `<div class="bar"><i style="width:${Math.min(100, Math.round((w / x.total) * 100))}%"></i></div>` : ''}</a>`;
  }).join('')}</div>` : '';
  const freqLine = (ph, sc) => `<p class="freq">${esc(ph.frequency || '—')}${ph.note ? ` · ${esc(ph.note)}` : ''}${sc.overridden || sc.notes.length ? `<br>Se entiende: ${esc(scheduleText(sc))}` : ''}</p>`;
  const card = (s) => {
    const label = L(s.plan), cls = s.status === 'done' ? 'done' : s.status === 'omitted' ? 'omitted' : '';
    const when = s.time || (s.moment ? MOMENTS[s.moment].label : '');
    const acts = s.status === 'done' ? `<span><span class="chip ok">✓ Hecho a las ${esc(s.admin.time)}</span>${otherAmt(s.admin, s.phase)}</span><button class="link" data-undo="${s.admin.id}">Deshacer</button>`
      : s.status === 'omitted' ? `<span class="chip">Omitido</span><button class="link" data-undo="${s.admin.id}">Deshacer</button>`
      : `<button class="ok" data-do="done" data-k="${esc(s.key)}">Hecho</button><button class="ghost" data-do="later" data-k="${esc(s.key)}">Más tarde</button><button class="ghost" data-do="skip" data-k="${esc(s.key)}">Omitir</button><button class="ghost" data-do="other" data-k="${esc(s.key)}">Otra cantidad</button>`;
    return `<div class="dose ${cls}" style="--h:${hueFor(label)}"><div class="top"><span class="name">${esc(label)}</span><span class="amt">${esc(amountText(s.phase) || '—')}</span></div>
      ${freqLine(s.phase, s.sched)}${when && s.sched.perDay > 1 ? `<p class="freq">${esc(when)}</p>` : ''}
      ${s.status === 'snoozed' ? `<p><span class="chip warn">Pospuesta hasta las ${new Date(s.snoozedUntil).toTimeString().slice(0, 5)}</span></p>` : ''}
      <div class="acts">${acts}</div></div>`;
  };
  const groups = GROUPS.map(([k, l]) => [l, ag.slots.filter((s) => groupOf(s) === k)]).filter(([, a]) => a.length);
  const weekly = ag.weekly.map((w, i) => {
    const label = L(w.plan), done = w.count >= w.needed;
    return `<div class="dose ${done ? 'done' : ''}" style="--h:${hueFor(label)}"><div class="top"><span class="name">${esc(label)}</span><span class="amt">${esc(amountText(w.phase) || '—')}</span></div>
      ${freqLine(w.phase, w.sched)}<p class="freq">Esta semana del plan (${fmtDate(w.weekStart)} – ${fmtDate(w.weekEnd)}): <strong>${w.count} de ${w.needed}</strong></p>
      <div class="acts">${w.today.length ? `<span><span class="chip ok">✓ Hecho hoy a las ${esc(w.today[w.today.length - 1].time)}</span>${otherAmt(w.today[w.today.length - 1], w.phase)}</span><button class="link" data-undo="${w.today[w.today.length - 1].id}">Deshacer</button>`
        : done ? '<span class="chip ok">✓ Completo esta semana</span>' : `<button class="ok" data-do="wdone" data-i="${i}">Hecho hoy</button><button class="ghost" data-do="wother" data-i="${i}">Otra cantidad</button>`}</div></div>`;
  }).join('');
  const demand = ag.demand.map((d, i) => {
    const label = L(d.plan), max = d.sched.maxPerWeek;
    return `<div class="dose" style="--h:${hueFor(label)}"><div class="top"><span class="name">${esc(label)}</span><span class="amt">${esc(amountText(d.phase) || '—')}</span></div>
      ${freqLine(d.phase, d.sched)}<p class="freq">Esta semana: <strong>${d.count}</strong>${max ? ` (tu máximo: ${max})` : ''}${d.today.length ? ` · hoy a las ${esc(d.today.map((a) => a.time).join(', '))}` : ''}</p>
      <div class="acts"><button class="sec" data-do="demand" data-i="${i}">Registrar toma</button></div></div>`;
  }).join('');
  const unknown = ag.unknown.map((u) => `<div class="dose" style="--h:${hueFor(L(u.plan))}"><div class="top"><span class="name">${esc(L(u.plan))}</span><span class="amt">${esc(amountText(u.phase))}</span></div>
      <p class="freq">«${esc(u.phase.frequency || 'sin frecuencia')}»: no sé qué días toca.</p><p><a href="#/plan/${u.plan.id}">Indicar la frecuencia en el plan</a></p></div>`).join('');
  const pausedHTML = paused.map((g, i) => `<div class="dose paused"><div class="top"><span class="name">${esc(g.plans.length > 1 ? g.run.name : L(g.plans[0]))}</span><span class="chip">En pausa</span></div>
      <p class="freq">${esc(pauseText(g.pause))}${g.pause.note ? ` · ${esc(g.pause.note)}` : ''}</p>${g.plans.length > 1 ? `<p class="freq">${g.plans.map((p) => esc(L(p))).join(', ')}</p>` : ''}
      <div class="acts">${!g.pause.to && date === t ? `<button class="ok" data-do="resume" data-i="${i}">Reanudar hoy</button>` : ''}<a class="btn sec" href="#/plan/${g.plans[0].id}">Ver el plan</a></div></div>`).join('');
  const nothing = !ag.slots.length && !ag.weekly.length && !ag.demand.length && !ag.unknown.length && !paused.length;
  view.innerHTML = head + runsHTML + (pausedHTML ? `<h2 class="grp">En pausa</h2>${pausedHTML}` : '') + (nothing ? `<div class="card empty"><p>Nada previsto ${date === t ? 'hoy' : 'este día'}.</p><p><a href="#/biblioteca">Aplicar un protocolo</a> · <a href="#/registro">Registrar una toma suelta</a></p></div>` : '')
    + groups.map(([l, a]) => `<h2 class="grp">${esc(l)}</h2>${a.map(card).join('')}`).join('')
    + (weekly ? `<h2 class="grp">Esta semana</h2>${weekly}` : '') + (demand ? `<h2 class="grp">A demanda</h2>${demand}` : '') + (unknown ? `<h2 class="grp">Revisar</h2>${unknown}` : '')
    + '<p class="noprint" style="margin-top:1.2rem"><a class="btn sec" href="#/registro">＋ Registrar una toma suelta</a></p>';
  const again = () => hoy(view, r, ctx);
  const slot = (k) => ag.slots.find((s) => s.key === k);
  view.onclick = async (e) => {
    const b = e.target.closest('button[data-do], button[data-undo]');
    if (!b) return;
    b.disabled = true;
    try {
      if (b.dataset.undo) { await m.updateAdministration(pid, b.dataset.undo, { status: 'cancelado' }); toast('Registro anulado (queda en el historial)'); return again(); }
      const d = b.dataset.do, at = date === t ? nowTime() : null;
      if (d === 'resume') { const g = paused[b.dataset.i]; await resumeDialog(ctx, g.plans, g.pause, L, { ask: false }); return again(); }
      if (d === 'later') {
        const res = await dialog(`<form><h2>Más tarde</h2><p>Queda pendiente y se marca como pospuesta.</p><input type="hidden" name="min">
          <div class="row">${[[30, '30 min'], [60, '1 hora'], [180, '3 horas']].map(([v, l]) => `<button type="button" class="sec" data-min="${v}">${l}</button>`).join('')}</div>
          <div class="row"><button type="button" class="ghost" data-close>Cancelar</button></div></form>`,
        { onOpen: (dl) => $$('[data-min]', dl).forEach((x) => x.addEventListener('click', () => { dl.querySelector('[name=min]').value = x.dataset.min; dl.querySelector('form').requestSubmit(); })), onSubmit: (x) => x });
        if (res?.min) { await m.snooze(pid, b.dataset.k, Number(res.min)); toast('Pospuesta'); }
        return again();
      }
      const other = d === 'other' || d === 'wother';
      const it = d === 'wdone' || d === 'wother' ? ag.weekly[b.dataset.i] : d === 'demand' ? ag.demand[b.dataset.i] : slot(b.dataset.k);
      const s = it.sched, ph = it.phase;
      const time = at || it.time || MOMENTS[it.moment]?.at || '12:00';
      let amount = ph.amountMax == null ? ph.amount : null;
      let notes = '';
      if (d === 'demand' || other || amount == null) {
        const res = await dialog(`<form><h2>${esc(L(it.plan))}</h2><p class="small">Tu plan: <strong>${esc(amountText(ph) || '—')}</strong> · ${esc(ph.frequency)}${ph.note ? ` · ${esc(ph.note)}` : ''}</p>
          <div class="grid">${field(`Cantidad (${esc(ph.unit || 'unidad')})`, inp('amount', amount ?? '', 'type="number" step="any" min="0" inputmode="decimal" required'), true)}${field('Hora', inp('time', time, 'type="time" required'), true)}</div>
          ${other ? field('Nota (opcional)', inp('notes', '', 'maxlength="200"')) : ''}
          ${s.maxPerWeek && it.count >= s.maxPerWeek ? `<div class="alert aviso">Esta semana ya hay ${it.count} tomas y tu protocolo dice «máximo ${s.maxPerWeek} por semana».</div>` : ''}
          <div class="row"><button class="ok">Guardar</button><button type="button" class="ghost" data-close>Cancelar</button></div></form>`, { onSubmit: (x) => x });
        if (!res) return again();
        amount = res.amount; it._time = res.time; notes = res.notes || '';
      }
      const ok = await register(ctx, { plan: it.plan, phase: ph, date, time: it._time || time, status: d === 'skip' ? 'omitido' : 'realizado', amount, label: L(it.plan), notes });
      if (ok) toast(d === 'skip' ? 'Omitida' : 'Hecho ✓');
      again();
    } catch (err) { toast('No se guardó: ' + err.message); again(); }
  };
}

// Registra una toma de un plan; si el plan no tiene presentación del catálogo, se pide una vez y se guarda en el plan.
async function register(ctx, { plan, phase, date, time, status, amount, label, notes = '' }) {
  const m = ctx.model, pid = ctx.profileId;
  let productId = plan.productId;
  if (!productId) {
    const res = await dialog(`<form><h2>¿Qué presentación usas?</h2><p>El plan de <strong>${esc(label)}</strong> no tiene presentación del catálogo. Se guarda en el plan y no se vuelve a preguntar.</p>
      ${field('Presentación', `<select name="productId" required>${productOptions(await m.products(), '')}</select>`, true)}
      <div class="row"><button>Guardar</button><button type="button" class="ghost" data-close>Cancelar</button></div></form>`, { onSubmit: (x) => { if (!x.productId) throw new Error('Elige una presentación'); return x; } });
    if (!res) return false;
    productId = res.productId;
    await m.updatePlan(pid, plan.id, { productId });
  }
  if (status !== 'omitido') {
    const warns = await m.compatCheck(pid, { items: [{ productId }], from: date, to: date });
    if (warns.length && !(await confirmCompat(warns))) return false;
  }
  const { admin, check } = await m.addAdministration(pid, { productId, planId: plan.id, date, time, amount: status === 'omitido' ? '' : amount, unit: phase.unit, status, notes, source: 'Pantalla Hoy' });
  if (check.comparable && check.exceeded) await exceedFlow(ctx, admin, check);
  return true;
}

// ── Protocolos: cronograma de barras como la tabla de tu Parte 2, con cumplimiento ──
export async function protocolos(view, r, ctx) {
  const m = ctx.model, pid = ctx.profileId, t = todayISO();
  const plans = await m.list('plans', pid), admins = await m.list('administrations', pid);
  const labels = await m.planLabels(plans);
  const all = runsOf(plans, labels);
  const cur = all.filter((x) => !x.end || x.end >= t), old = all.filter((x) => x.end && x.end < t);
  const table = (x) => {
    const weeks = x.total || Math.max(1, ...x.plans.flatMap((p) => (p.phases || []).map((f) => f.toWeek || f.fromWeek)));
    const now = runWeek(x, t), i = all.indexOf(x), finished = x.end && x.end < t;
    const pz = [...new Map(x.plans.flatMap((p) => pausesOf(p)).map((z) => [`${z.from}|${z.to}`, z])).values()].sort((a, b) => a.from.localeCompare(b.from));
    const open = pz.find((z) => !z.to);
    const first = (p) => Math.min(99, ...(p.phases || []).map((f) => f.fromWeek));
    const rows = [...x.plans].sort((a, b) => first(a) - first(b) || labels.get(a.id).localeCompare(labels.get(b.id), 'es')).map((p) => {
      const lab = labels.get(p.id), adh = adherence(p, admins, t < x.start ? x.start : t), h = hueFor(lab);
      const cells = Array.from({ length: weeks }, (_, i) => {
        const w = i + 1, f = (p.phases || []).find((z) => w >= z.fromWeek && w <= (z.toWeek ?? weeks));
        const base = planBaseEnd(p), inPlan = !base || (w - 1) * 7 <= diffDays(p.start, base);
        return `<td class="${f && inPlan ? 'on' : ''} ${w === now ? 'now' : ''}" style="--h:${h}">${f && inPlan ? esc(amountText(f)) : ''}</td>`;
      }).join('');
      return `<tr><th class="sub" scope="row"><a href="#/plan/${p.id}" style="color:inherit"><span class="sw" style="--h:${h}"></span> ${esc(lab)}</a></th>${cells}<td>${adh.pct == null ? '—' : adh.pct + ' %'}</td></tr>`;
    }).join('');
    return `<div class="card"><h2 style="margin-top:0">${esc(x.name)}</h2><p class="small">Desde ${fmtDate(x.start)}${x.end ? ` hasta ${fmtDate(x.end)}` : ''} · ${now ? `<strong>semana ${now}${x.total ? ` de ${x.total}` : ''}</strong>` : 'aún no ha empezado'}</p>
      <div class="table-wrap"><table class="crono"><thead><tr><th class="sub">Semana</th>${Array.from({ length: weeks }, (_, i) => `<th class="${i + 1 === now ? 'now' : ''}">${i + 1}</th>`).join('')}<th title="Tomas hechas frente a previstas hasta hoy">Cumpl.</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="small muted">Cumplimiento: tomas registradas como hechas frente a las previstas por tus fases hasta hoy.${pz.length ? ' Las semanas cuentan solo días activos.' : ''}</p>
      ${pz.length ? `<p class="small"><strong>Pausas:</strong> ${pz.map((z) => esc(pauseText(z))).join(' · ')}</p>` : ''}
      ${finished ? '' : `<div class="row noprint">${open ? `<button class="ok slim" data-resume-run="${i}">Reanudar</button>` : `<button class="sec slim" data-pause-run="${i}">${x.plans.length > 1 ? 'Pausar el protocolo' : 'Pausar'}</button>`}</div>`}</div>`;
  };
  view.innerHTML = `<h1>Cronograma</h1>${cur.length ? cur.map(table).join('') : `<div class="card empty"><p>No hay protocolos en curso para esta persona.</p><p><a class="btn" href="#/biblioteca">Aplicar uno desde la Biblioteca</a></p></div>`}
    ${old.length ? `<details class="card"><summary>Terminados (${old.length})</summary>${old.map(table).join('')}</details>` : ''}`;
  const lab = (p) => labels.get(p.id) || p.name || 'plan', again = () => protocolos(view, r, ctx);
  $$('[data-pause-run]', view).forEach((b) => b.addEventListener('click', async () => { if (await pauseDialog(ctx, all[b.dataset.pauseRun].plans, lab)) again(); }));
  $$('[data-resume-run]', view).forEach((b) => b.addEventListener('click', async () => {
    const x = all[b.dataset.resumeRun], z = x.plans.flatMap((p) => pausesOf(p)).find((q) => !q.to);
    if (z && (await resumeDialog(ctx, x.plans, z, lab))) again();
  }));
  $$('.table-wrap', view).forEach((w) => { const th = w.querySelector('thead th.now'), lab = w.querySelector('th.sub'); if (th && lab) w.scrollLeft = Math.max(0, th.offsetLeft - lab.offsetWidth - th.offsetWidth); });
}

// ── Ficha de una sustancia: tu texto, maquetado ──
export async function ficha(view, r, ctx) {
  const info = await ctx.model.libraryInfo();
  const s = info.substances.find((x) => x.key === r.arg);
  if (!s || !s.texto) { view.innerHTML = '<p><a href="#/biblioteca">← Biblioteca</a></p><div class="card"><p>No hay ficha para esta sustancia en tu biblioteca.</p></div>'; return; }
  const words = [s.nombre, ...(s.alias || [])].map((w) => w.toLowerCase());
  const rules = info.compat.filter((c) => c.a?.includes(s.key) || c.b?.includes(s.key) || (!c.a?.length && words.some((w) => `${c.combinacion} ${c.motivo}`.toLowerCase().includes(w))));
  view.innerHTML = `<p class="noprint"><a href="#/biblioteca">← Biblioteca</a></p><div class="row" style="justify-content:space-between"><h1 style="margin:0">${esc(s.nombre)}</h1><button class="sec slim noprint" id="pr">Imprimir / PDF</button></div>
    ${splitFichas(s.texto).map((f) => `<div class="card">${fichaHTML(f)}</div>`).join('')}
    ${rules.length ? `<div class="card"><h2 style="margin-top:0">Combinaciones (tu Parte 3)</h2>${rules.map((c) => `<section class="box ${c.tipo === 'prohibida' ? 'bad' : 'warn'}"><h3>${cleanInline(c.combinacion)}</h3><p>${cleanInline(c.motivo)}</p></section>`).join('')}</div>` : ''}
    <p class="small muted">Texto de tu biblioteca, sin cambios; solo se maqueta.</p>`;
  $('#pr').addEventListener('click', () => print());
}

// ── Texto original completo como documento, con índice ──
export async function texto(view, r, ctx) {
  const info = await ctx.model.libraryInfo();
  if (!info.original) { view.innerHTML = '<p><a href="#/biblioteca">← Biblioteca</a></p><div class="card"><p>La biblioteca no incluye el texto original.</p></div>'; return; }
  const { html, toc } = fmtDoc(info.original);
  view.innerHTML = `<p class="noprint"><a href="#/biblioteca">← Biblioteca</a></p><div class="row" style="justify-content:space-between"><h1 style="margin:0">${esc(info.title || 'Texto original')}</h1><button class="sec slim noprint" id="pr">Imprimir / PDF</button></div>
    <details class="card noprint toc"><summary>Índice (${toc.length})</summary>${toc.map((x) => `<a href="#" data-to="${x.id}" class="l${x.level}">${esc(x.text.replace(/\\rightarrow/g, '→'))}</a>`).join('')}</details>
    <div class="card doc">${html}</div>`;
  $('#pr').addEventListener('click', () => print());
  $$('[data-to]', view).forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); document.getElementById(a.dataset.to)?.scrollIntoView({ behavior: 'smooth' }); }));
}

// ── Más ──
export async function mas(view) {
  view.innerHTML = `<h1>Más</h1><div class="card menu-list">
    <a href="#/registro"><span>Registro completo<span class="small">Toma suelta, con lote, síntomas y observaciones</span></span></a>
    <a href="#/recordatorios"><span>Recordatorios<span class="small">Avisos y exportación al calendario (.ics)</span></span></a>
    <a href="#/catalogo"><span>Catálogo<span class="small">Presentaciones y lotes</span></span></a>
    <a href="#/perfiles"><span>Personas</span></a>
    <a href="#/ajustes"><span>Ajustes<span class="small">Letra, PIN, copia de seguridad</span></span></a>
    ${appInstalledHere() ? '' : '<button id="inst">Instalar la app</button>'}
    <a href="#/acerca">Avisos y límites de la app</a></div>`;
  $('#inst')?.addEventListener('click', installApp);
}
export async function acerca(view) {
  view.innerHTML = `<h1>Avisos y límites</h1><div class="card">${LEGAL}</div>
    <div class="card small"><p>Tipografía Atkinson Hyperlegible (Braille Institute), licencia SIL Open Font License 1.1, incluida en la app para que funcione sin conexión.</p></div>`;
}
