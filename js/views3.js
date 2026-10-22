// Biblioteca de protocolos: modelos escritos por el usuario. Aplicar uno crea planes editables para una persona.
import { esc, $, $$, opt, field, inp, toast, dialog, download } from './ui.js';
import { todayISO, phasesWindow } from './model.js';
import { amountText } from './schedule.js';
import { cleanInline } from './text.js';
import { hueFor } from './hoy.js';
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
  const subOf = (name) => info.substances.find((x) => x.nombre === name && x.texto);
  const card = (t) => `<div class="tpl" data-id="${esc(t.id)}">
    <h3 style="margin:.1rem 0 .2rem">${esc(t.name)}</h3>
    <p class="small"><span class="badge">${esc(SEX[t.sex])}</span>${t.route ? ` · ${esc(t.route)}` : ''}${t.durationText ? ` · ${esc(t.durationText)}` : ''}</p>
    ${t.blocked ? `<div class="alert seguridad">${esc(t.blocked)}</div>` : ''}
    ${t.items.map((it) => `${t.items.length > 1 ? `<p style="margin:.5rem 0 .1rem"><span class="sw" style="--h:${hueFor(it.substance)}"></span> <strong>${esc(it.substance)}</strong> ${pn(it.productId) ? ruoBadge(pn(it.productId)) : ''}</p>` : ''}
      ${it.phases.length ? `<div class="table-wrap"><table class="phases"><tbody>${it.phases.map((f) => `<tr><th scope="row">Semanas ${f.fromWeek}${f.toWeek == null ? '–fin' : f.toWeek !== f.fromWeek ? '–' + f.toWeek : ''}</th><td><strong>${esc(amountText(f) || '—')}</strong> · ${esc(f.frequency || '—')}${f.note ? ` · ${esc(f.note)}` : ''}</td></tr>`).join('')}</tbody></table></div>` : ''}`).join('')}
    <div class="row" style="margin-top:.5rem">${t.blocked ? '' : `<button class="apply"${profiles.length ? '' : ' disabled'}>Aplicar a una persona</button>`}<button class="ghost del">Eliminar</button></div></div>`;
  const fileCard = `<label class="btn" style="margin:0">Cargar biblioteca (.json)<input type="file" id="libFile" accept=".json,application/json" hidden></label>
      <button id="libExp" class="sec"${list.length ? '' : ' disabled'}>Exportar biblioteca</button>
      <label class="check"><input type="checkbox" id="libReplace">Al cargar, sustituir la biblioteca actual</label>
      <p class="small muted">También se incluye en la copia de seguridad completa de Ajustes.</p>`;
  view.innerHTML = `<h1>Biblioteca</h1>
    ${list.length ? `<p class="small">${esc(info.title || '')} · ${list.length} modelos${info.original ? ' · <a href="#/texto">Texto original completo</a>' : ''}</p>
      <div class="row noprint" style="margin-bottom:.8rem">${[['', 'Todos'], ['hombre', 'Hombres'], ['mujer', 'Mujeres']].map(([k, v]) => `<a class="btn slim ${sex === k ? '' : 'sec'}" href="#/biblioteca${k ? '?s=' + k : ''}">${v}</a>`).join('')}</div>
      ${groups.map((g) => { const sub = subOf(g); return `<section class="card" data-group="${esc(g)}"><h2 style="margin-top:0"><span class="sw" style="--h:${hueFor(g)}"></span> ${esc(g)}</h2>
        ${sub ? `<p><a href="#/ficha/${esc(sub.key)}">Ficha completa (tu texto)</a></p>` : g === 'Combinados' && info.original ? '<p><a href="#/texto">Tus cronogramas en el texto original</a></p>' : ''}
        ${shown.filter((t) => (t.compound || 'Otros') === g).map(card).join('')}</section>`; }).join('')}
      ${info.compat?.length ? `<section class="card"><h2 style="margin-top:0">Compatibilidades (tu Parte 3)</h2><ul class="plain">${info.compat.map((c) => `<li class="cmp-${esc(c.tipo || '')}"><strong>${cleanInline(c.combinacion)}</strong> — ${esc(c.nivel)}<br><span class="small">${cleanInline(c.motivo)}</span></li>`).join('')}</ul></section>` : ''}
      <details class="card noprint"><summary>Archivo de la biblioteca</summary>${fileCard}</details>`
    : `<div class="card"><p>La biblioteca está vacía. Carga el archivo .json con tus protocolos.</p>${fileCard}</div>`}`;

  $('#libFile').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try { const n = await m.importLibrary(JSON.parse(await file.text()), { replace: $('#libReplace').checked }); toast(`${n} modelos cargados`); biblioteca(view, r, ctx); }
    catch (err) { toast('No se pudo cargar: ' + err.message); }
  });
  $('#libExp').addEventListener('click', async () => download(`biblioteca-protocolos-${todayISO()}.json`, JSON.stringify(await m.exportLibrary(), null, 1), 'application/json'));
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
  const warns = data.start ? await ctx.model.compatCheck(data.profileId, { items: t.items.map((it, i) => ({ productId: products2[i], text: it.substance, label: it.substance, ...phasesWindow(data.start, it.phases, to) })), from: data.start, to }) : [];
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
