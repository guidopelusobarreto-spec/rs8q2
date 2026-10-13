// Biblioteca de protocolos: modelos escritos por el usuario. Aplicar uno crea planes editables para una persona.
import { esc, $, $$, opt, field, inp, toast, dialog, download } from './ui.js';
import { phaseText, todayISO } from './model.js';
import { productOptions, ruoBadge } from './views1.js';
import { saveUI, refreshProfiles } from './app.js';

const SEX = { hombre: 'Hombres', mujer: 'Mujeres', ambos: 'Hombres y mujeres' };
const unitTxt = (t) => (t.durationUnit === 'dias' ? 'días' : 'semanas');

export async function biblioteca(view, r, ctx) {
  const m = ctx.model;
  const [list, info, products, profiles] = [await m.templates(), await m.libraryInfo(), await m.products(), await m.profiles()];
  const sex = r.query.s || '';
  const shown = list.filter((t) => !sex || t.sex === sex || t.sex === 'ambos');
  const groups = [...new Set(shown.map((t) => t.compound || 'Otros'))];
  const pn = (id) => products.find((p) => p.id === id);
  const card = (t) => `<div class="card tpl" data-id="${esc(t.id)}">
    <h3 style="margin-top:0">${esc(t.name)}</h3>
    <p class="small"><span class="badge">${esc(SEX[t.sex])}</span>${t.route ? ` · ${esc(t.route)}` : ''}</p>
    ${t.blocked ? `<div class="alert seguridad">${esc(t.blocked)}</div>` : ''}
    ${t.items.map((it) => `<p style="margin:.4rem 0 .1rem"><strong>${esc(it.substance)}</strong> ${pn(it.productId) ? ruoBadge(pn(it.productId)) : it.productId ? '' : '<span class="small muted">(sin producto del catálogo)</span>'}</p>
      ${it.phases.length ? `<ul class="plain small">${it.phases.map((f) => `<li>${esc(phaseText(f))}</li>`).join('')}</ul>` : ''}${it.notes ? `<p class="small">${esc(it.notes)}</p>` : ''}`).join('')}
    <dl class="kv small">${t.durationText ? `<dt>Duración</dt><dd>${esc(t.durationText)}</dd>` : ''}${t.restText ? `<dt>Descanso / después</dt><dd>${esc(t.restText)}</dd>` : ''}${t.notes ? `<dt>Notas</dt><dd>${esc(t.notes)}</dd>` : ''}${t.source ? `<dt>Fuente</dt><dd>${esc(t.source)}</dd>` : ''}</dl>
    <div class="row">${t.blocked ? '' : `<button class="apply"${profiles.length ? '' : ' disabled'}>Aplicar a una persona</button>`}<button class="sec del">Eliminar</button></div></div>`;
  view.innerHTML = `<h1>Biblioteca de protocolos</h1>
    <p class="small muted">Modelos escritos por ti. La app no propone cantidades: aplicar un modelo crea los planes de una persona con tus fases, y después puedes ajustar esos planes sin cambiar el modelo.</p>
    <div class="card"><div class="row">
      <label class="btn" style="margin:0">Cargar biblioteca (.json)<input type="file" id="libFile" accept=".json,application/json" hidden></label>
      <button id="libExp" class="sec"${list.length ? '' : ' disabled'}>Exportar biblioteca</button></div>
      <label class="check"><input type="checkbox" id="libReplace">Al cargar, sustituir la biblioteca actual</label>
      <p class="small muted">La biblioteca también se incluye en la copia de seguridad completa de Ajustes.</p></div>
    ${list.length ? `<p>${esc(info.title || '')} · ${list.length} modelos</p>
      ${field('Mostrar', `<select id="sexSel">${[['', 'Todos'], ['hombre', 'Hombres'], ['mujer', 'Mujeres']].map(([k, v]) => opt(k, v, sex)).join('')}</select>`)}
      ${groups.map((g) => `<details class="card" ${groups.length === 1 ? 'open' : ''}><summary><strong>${esc(g)}</strong> (${shown.filter((t) => (t.compound || 'Otros') === g).length})</summary>
        ${info.texts?.[g] ? `<details class="desc"><summary>Descripción completa (tu texto)</summary><div class="orig">${esc(info.texts[g])}</div></details>` : ''}
        ${shown.filter((t) => (t.compound || 'Otros') === g).map(card).join('')}</details>`).join('')}
      ${info.compat?.length ? `<details class="card"><summary><strong>Compatibilidades (según tu protocolo)</strong></summary><ul class="plain">${info.compat.map((c) => `<li class="cmp-${esc(c.tipo || '')}"><strong>${esc(c.combinacion)}</strong> — ${esc(c.nivel)}<br><span class="small">${esc(c.motivo)}</span></li>`).join('')}</ul></details>` : ''}
      ${info.original ? `<details class="card"><summary><strong>Texto original completo</strong></summary><div class="orig">${esc(info.original)}</div></details>` : ''}`
    : '<div class="card"><p>La biblioteca está vacía. Carga el archivo .json con tus protocolos.</p></div>'}`;

  $('#libFile').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try { const n = await m.importLibrary(JSON.parse(await file.text()), { replace: $('#libReplace').checked }); toast(`${n} modelos cargados`); biblioteca(view, r, ctx); }
    catch (err) { toast('No se pudo cargar: ' + err.message); }
  });
  $('#libExp').addEventListener('click', async () => download(`biblioteca-protocolos-${todayISO()}.json`, JSON.stringify(await m.exportLibrary(), null, 1), 'application/json'));
  $('#sexSel')?.addEventListener('change', (e) => { location.hash = '#/biblioteca' + (e.target.value ? '?s=' + e.target.value : ''); });
  $$('.tpl').forEach((el) => {
    const t = list.find((x) => x.id === el.dataset.id);
    el.querySelector('.del').addEventListener('click', async () => {
      if (await dialog(`<form><h2>Eliminar modelo</h2><p>«${esc(t.name)}». Los planes ya creados con él no se borran.</p><div class="row"><button>Eliminar</button><button type="button" class="sec" data-close>Cancelar</button></div></form>`)) { await m.deleteTemplate(t.id); biblioteca(view, r, ctx); }
    });
    el.querySelector('.apply')?.addEventListener('click', () => applyDialog(ctx, t, products, profiles));
  });
}

async function applyDialog(ctx, t, products, profiles) {
  const fixed = t.durationMin != null && t.durationMin === t.durationMax;
  const hint = t.durationText ? `Tu protocolo: ${t.durationText}.` : 'Tu protocolo no fija duración.';
  const data = await dialog(`<form><h2>Aplicar: ${esc(t.name)}</h2>
    ${field('Persona', `<select name="profileId">${profiles.map((p) => opt(p.id, p.name, ctx.profileId)).join('')}</select>`, true)}
    ${field('Fecha de inicio', inp('start', todayISO(), 'type="date" required'), true)}
    ${field(`Duración (${unitTxt(t)})`, inp('duration', fixed ? t.durationMin : '', 'type="number" min="1" step="1"'))}
    <p class="small muted">${esc(hint)} Si la dejas vacía, el plan queda «pendiente» sin fecha final.</p>
    ${t.items.map((it, i) => field(`Producto para «${it.substance}»`, `<select name="p${i}">${productOptions(products, it.productId)}</select>`)).join('')}
    <p class="small muted">Si una sustancia no está en el catálogo, añádela antes en Catálogo → «Añadir producto».</p>
    <div class="row"><button>Crear planes</button><button type="button" class="sec" data-close>Cancelar</button></div></form>`,
  { onSubmit: (d) => d });
  if (!data) return;
  const products2 = Object.fromEntries(t.items.map((_, i) => [i, data['p' + i] || '']));
  const dur = Number(data.duration) || 0;
  const days = dur ? (t.durationUnit === 'dias' ? dur : dur * 7) - 1 : null;
  const to = days != null && data.start ? new Date(new Date(data.start + 'T12:00:00').getTime() + days * 864e5).toISOString().slice(0, 10) : null;
  const warns = data.start ? await ctx.model.compatCheck(data.profileId, { items: t.items.map((it, i) => ({ productId: products2[i], text: it.substance, label: it.substance })), from: data.start, to }) : [];
  if (warns.length && !(await confirmCompat(warns))) return;
  let plans;
  try { plans = await ctx.model.applyTemplate(data.profileId, t.id, { start: data.start, duration: data.duration, products: products2 }); }
  catch (e) { toast('No se aplicó: ' + e.message); return; }
  if (plans) {
    if (plans[0].profileId !== ctx.profileId) { ctx.profileId = plans[0].profileId; await saveUI({ profileId: ctx.profileId }); await refreshProfiles(); }
    toast(`${plans.length} plan(es) creados`); location.hash = plans.length === 1 ? '#/plan/' + plans[0].id : '#/planes'; }
}

// Aviso de combinación según la matriz del usuario. Devuelve true si decide continuar.
const CMP_TITLE = { prohibida: 'No se debe combinar', precaucion: 'Combinación con precaución', redundante: 'Combinación redundante' };
export async function confirmCompat(warns) {
  const worst = warns[0].tipo;
  return !!(await dialog(`<form><h2>${esc(CMP_TITLE[worst])}</h2>
    <p class="small">Según la matriz de compatibilidad de tu protocolo:</p>
    ${warns.map((w) => `<div class="alert ${w.tipo === 'prohibida' ? 'seguridad' : 'aviso'}"><strong>${esc(w.combinacion)}</strong> — ${esc(w.nivel)}<br>
      ${esc(w.nuevo)} coincide con ${esc(w.con)}.<br><span class="small">${esc(w.motivo)}</span></div>`).join('')}
    <div class="row"><button type="button" data-close>Cancelar</button><button class="sec">${worst === 'prohibida' ? 'Continuar igualmente (bajo mi responsabilidad)' : 'Continuar'}</button></div></form>`));
}
