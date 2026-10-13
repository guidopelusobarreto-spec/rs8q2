// Panel, registro, historial, catálogo, ficha de producto y perfiles.
import { esc, $, $$, opt, field, inp, toast, dialog, fmtDate, fmtNum, readForm, showErr } from './ui.js';
import { ADMIN_STATUS, EXCEED_TEXT, PLAN_MODES, planEnd, todayISO } from './model.js';
import { CATEGORY_LABEL, STATUS_LABEL, RUO_LABEL, NOT_IMPORTED, CATALOG_SOURCE, presentation, totalActive } from './catalog.js';
import { safetyFor, EMERGENCY, SEVERE_SYMPTOMS, SEVERE_SOURCE, CONSULTED } from './safety.js';
import { refreshProfiles } from './app.js';

const UNITS = ['mg', 'mcg', 'UI', 'ml', 'unidad', 'tableta', 'cápsula', 'aplicación', 'gotas'];
const nowTime = () => new Date().toTimeString().slice(0, 5);
export const esDates = (t) => String(t).replace(/(\d{4})-(\d{2})-(\d{2})/g, '$3/$2/$1');
export const alertBox = (a) => `<div class="alert ${esc(a.level)}">${esc(esDates(a.text))}</div>`;
export const ruoBadge = (p) => (p?.research ? `<span class="badge ruo">${esc(RUO_LABEL)}</span>` : '');
const rxBadge = (p) => (p?.rx ? '<span class="badge rx">Medicamento con receta en la UE</span>' : '');
export const dehydration = (txt) => /diarr|v[oó]mit/i.test(txt || '');
export const DEHYDRATION_TEXT = 'Se han registrado diarrea o vómitos: vigila signos de deshidratación (sed intensa, orina escasa u oscura, mareo, boca seca) y busca orientación sanitaria si los síntomas persisten o son importantes.';

export function productOptions(products, sel, { all = true } = {}) {
  const groups = [['plan', 'Plan actual'], ['alternativa', 'Alternativas aceptadas'], ['adicional', 'Productos adicionales'], ['custom', 'Añadidos por ti'], ['historico', 'Planes anteriores'], ['mercado', 'Vistas solo en ofertas']];
  return (all ? '<option value="">— Elige —</option>' : '') + groups.map(([g, l]) => {
    const ps = products.filter((p) => p.status === g);
    return ps.length ? `<optgroup label="${esc(l)}">${ps.map((p) => opt(p.id, `${p.substance} · ${presentation(p)}`, sel)).join('')}</optgroup>` : '';
  }).join('');
}

// ── Panel ──
export async function panel(view, r, ctx) {
  const rows = await ctx.model.dashboard();
  const products = await ctx.model.products();
  const pname = (id) => products.find((p) => p.id === id)?.substance || id;
  if (!rows.length) {
    view.innerHTML = `<div class="card"><h1>Bienvenido</h1><p>Esta app sustituye el registro en papel: anota lo que cada persona declara, organiza fechas y avisa de incoherencias. No indica cantidades ni protocolos, y registrar algo no significa que sea seguro.</p>
      <p><a class="btn" href="#/perfiles">Crear el primer perfil</a></p></div>`;
    return;
  }
  const all = rows.flatMap((x) => x.alerts.map((a) => ({ ...a, who: x.profile.name })));
  const order = { seguridad: 0, aviso: 1, info: 2 };
  all.sort((a, b) => order[a.level] - order[b.level]);
  view.innerHTML = `<h1>Panel</h1>
    <div class="card"><h2 style="margin-top:0">Alertas e incidencias</h2>
      ${all.length ? all.map((a) => `<div class="alert ${a.level}"><strong>${esc(a.who)}:</strong> ${esc(esDates(a.text))}</div>`).join('') : '<p class="muted">Sin alertas.</p>'}
      <p class="small muted">El panel no valora la seguridad de ninguna sustancia: solo muestra fechas, datos que faltan y avisos.</p></div>
    <div class="grid">${rows.map((x) => `<section class="card">
      <h2 style="margin-top:0">${esc(x.profile.name)}</h2>
      <p>Último peso: <strong>${x.lastWeight ? `${fmtNum(x.lastWeight.kg, 1)} kg (${fmtDate(x.lastWeight.date)})` : '—'}</strong></p>
      <h3>Próximos recordatorios</h3>${x.upcoming.length ? `<ul class="plain">${x.upcoming.map((o) => `<li>${fmtDate(o.date)} ${o.time} — ${esc(o.reminder.label)}</li>`).join('')}</ul>` : '<p class="muted">Ninguno en 48 h.</p>'}
      <h3>Historial reciente</h3>${x.recent.length ? `<ul class="plain">${x.recent.map((a) => `<li>${fmtDate(a.date)} ${a.time} — ${esc(pname(a.productId))} · ${ADMIN_STATUS[a.status]}</li>`).join('')}</ul>` : '<p class="muted">Sin registros.</p>'}
    </section>`).join('')}</div>`;
}

// ── Registro de administración ──
export async function registro(view, r, ctx) {
  const m = ctx.model, pid = ctx.profileId;
  const profile = (await m.profiles()).find((p) => p.id === pid);
  const products = await m.products();
  const plans = (await m.list('plans', pid)).filter((p) => !p.closed);
  const rem = r.query.rem ? await ctx.store.get('reminders', r.query.rem) : null;
  const pre = rem && rem.profileId === pid ? rem : {};
  view.innerHTML = `<h1>Registrar administración o toma</h1>
    <form class="card" id="f" novalidate>
      <p>Persona: <strong>${esc(profile.name)}</strong> <span class="small muted">(cambia el perfil arriba)</span></p>
      ${pre.label ? `<div class="alert info">Desde el recordatorio «${esc(pre.label)}». El aviso no marca nada: confirma tú el estado.</div>` : ''}
      ${field('Sustancia / presentación', `<select name="productId" required>${productOptions(products, pre.productId)}</select>`, true)}
      <div id="pinfo"></div>
      <div class="grid">
        ${field('Fecha', inp('date', todayISO(), 'type="date" required'), true)}
        ${field('Hora', inp('time', nowTime(), 'type="time" required'), true)}
      </div>
      <fieldset><legend>Cantidad registrada (la que tú anotas)</legend>
        <p class="small muted">La app no propone ni calcula cantidades. Escribe lo que conste en tu plan o lo que realmente ocurrió.</p>
        <div class="grid">${field('Cantidad', inp('amount', '', 'type="number" step="any" min="0" inputmode="decimal"'))}
        ${field('Unidad', `${inp('unit', '', 'list="units"')}<datalist id="units">${UNITS.map((u) => `<option value="${u}">`).join('')}</datalist>`)}</div>
      </fieldset>
      ${field('Vía anotada (opcional)', inp('route', '', 'list="routes"') + '<datalist id="routes"><option value="Oral"><option value="Subcutánea"><option value="Tópica"></datalist>')}
      ${field('Plan asociado', `<select name="planId"><option value="">— Ninguno —</option>${plans.map((p) => opt(p.id, `${p.name || PLAN_MODES[p.mode]} (desde ${fmtDate(p.start)})`, pre.planId)).join('')}</select>`)}
      <div class="grid">
        ${field('Lote del inventario', '<select name="lotId"><option value="">— Ninguno —</option></select>')}
        ${field('Nº de lote (texto libre)', inp('lotText'))}
        ${field('Unidades del envase consumidas (inventario)', inp('unitsUsed', '', 'type="number" step="any" min="0"'))}
      </div>
      ${field('Síntomas posteriores', '<textarea name="symptoms"></textarea>')}
      ${field('Efectos adversos declarados', '<textarea name="adverse"></textarea>')}
      ${field('Observaciones', '<textarea name="notes"></textarea>')}
      <div class="grid">${field('Peso corporal hoy (kg, opcional)', inp('weightKg', '', 'type="number" step="0.1" min="1"'))}
      ${field('Fuente de la información', inp('source', '', 'placeholder="p. ej. plan anotado por…"'))}</div>
      ${field('Estado del registro', `<select name="status" required><option value="">— Elige —</option>${Object.entries(ADMIN_STATUS).map(([k, v]) => opt(k, v)).join('')}</select>`, true)}
      <p><button>Guardar registro</button></p>
    </form>`;
  const f = $('#f');
  const lots = await m.inventory(pid);
  const upd = () => {
    const p = products.find((x) => x.id === f.productId.value);
    $('#pinfo').innerHTML = p ? `${p.research ? `<div class="ruo-banner">${esc(RUO_LABEL)}</div>` : ''}
      <p class="small"><strong>Dato del catálogo:</strong> ${esc(presentation(p))}${totalActive(p) ? ` (total declarado del envase: ${fmtNum(totalActive(p))} mg)` : ''}.
      Es el contenido declarado del envase, <strong>no una cantidad a administrar</strong>.</p>` : '';
    f.lotId.innerHTML = '<option value="">— Ninguno —</option>' + lots.filter((l) => !p || l.productId === p.id).map((l) => opt(l.id, `${l.lot || 'sin nº'}${l.expiry ? ' · cad. ' + fmtDate(l.expiry) : ''}${l.unitsLeft != null ? ` · quedan ${l.unitsLeft}` : ''}`)).join('');
  };
  f.productId.addEventListener('change', upd); upd();
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = readForm(f);
    try {
      if (!d.status) throw new Error('Elige el estado del registro (Realizado, Omitido…)');
      const { admin, check } = await m.addAdministration(pid, d);
      if (check.afterEnd) await dialog(`<h2>Fecha final superada</h2><div class="alert seguridad">Este registro es posterior a la fecha final prevista del plan (${fmtDate(check.planEnd)}). Revisa el plan antes de continuar.</div><p><button data-close>Entendido</button></p>`);
      if (check.outsidePhases) await dialog(`<h2>Fuera del protocolo</h2><div class="alert aviso">La fecha cae en la semana ${check.phase.week} del plan y ninguna fase del protocolo la cubre. Revisa el plan.</div><p><button data-close>Entendido</button></p>`);
      if (check.comparable && check.exceeded) await exceedFlow(ctx, admin, check);
      if (dehydration(d.symptoms + ' ' + d.adverse)) await dialog(`<h2>Atención</h2><div class="alert aviso">${DEHYDRATION_TEXT}</div><p><button data-close>Entendido</button></p>`);
      toast('Registro guardado');
      location.hash = '#/historial';
    } catch (err) { showErr(f, err); }
  });
}

// Flujo de cantidad superior al plan: alerta, preguntas e incidencia en registro aparte.
export async function exceedFlow(ctx, admin, check) {
  const res = await dialog(`<form><h2>${esc(EXCEED_TEXT)}</h2>
    <div class="alert seguridad">Registrado: <strong>${fmtNum(check.registered, 4)} ${esc(check.unit)}</strong> · Plan: <strong>${fmtNum(check.reference, 4)} ${esc(check.unit)}</strong> (sin conversiones).</div>
    <p>La app <strong>no puede determinar la gravedad clínica</strong> solo con la cantidad: puede haber un error de unidad o de plan. Se guardará como «Cantidad superior al plan registrado» hasta que se revise.</p>
    <p><strong>No tomes una cantidad «compensatoria» ni esperes a la siguiente sin consultar.</strong> Contacta cuanto antes con un profesional sanitario o con toxicología:</p>
    <ul><li>Emergencias: <a href="tel:112">112</a></li><li>${esc(EMERGENCY.toxicology.label)}: <a href="tel:${EMERGENCY.toxicology.phone.replace(/\s/g, '')}">${esc(EMERGENCY.toxicology.phone)}</a></li></ul>
    ${field('¿Cuándo ocurrió?', inp('when', `${admin.date}T${admin.time}`, 'type="datetime-local"'))}
    <fieldset><legend>¿Hay síntomas?</legend>${SEVERE_SYMPTOMS.map((s) => `<label class="check"><input type="checkbox" name="sym" value="${esc(s)}" data-multi>${esc(s)}</label>`).join('')}</fieldset>
    ${field('Otros síntomas', '<textarea name="otherSym"></textarea>')}
    ${field('Otros productos o circunstancias relevantes', '<textarea name="others"></textarea>')}
    <p class="small muted">${esc(SEVERE_SOURCE)}</p>
    <div class="row"><button>Guardar incidencia</button></div></form>`, {
    onSubmit: async (d) => {
      const syms = [...(d.sym || []), ...(d.otherSym ? [d.otherSym] : [])];
      await ctx.model.addIncident(ctx.profileId, { adminId: admin.id, productId: admin.productId, registered: check.registered, reference: check.reference, unit: check.unit, when: d.when, symptoms: syms, severe: (d.sym || []).length > 0, others: d.others });
      return { severe: (d.sym || []).length > 0 };
    },
  });
  if (res?.severe) await dialog(`<h2>Busca asistencia sanitaria inmediata</h2><div class="alert seguridad">Has marcado síntomas que requieren atención urgente. Llama al <a href="tel:112">112</a> o acude a urgencias. Toxicología: <a href="tel:${EMERGENCY.toxicology.phone.replace(/\s/g, '')}">${esc(EMERGENCY.toxicology.phone)}</a>.</div><p class="small">La app no diagnostica ni atribuye los síntomas a ningún producto.</p><p><button data-close>Entendido</button></p>`);
}

// ── Historial ──
export async function historial(view, r, ctx) {
  const m = ctx.model, pid = ctx.profileId;
  const products = await m.products();
  const q = r.query;
  const rows = await m.history(pid, { productId: q.prod, from: q.from, to: q.to, status: q.st });
  const pname = (id) => products.find((p) => p.id === id);
  view.innerHTML = `<h1>Historial</h1>
    <form class="card noprint" id="flt"><div class="grid">
      ${field('Sustancia', `<select name="prod">${productOptions(products, q.prod)}</select>`)}
      ${field('Desde', inp('from', q.from || '', 'type="date"'))}${field('Hasta', inp('to', q.to || '', 'type="date"'))}
      ${field('Estado', `<select name="st"><option value="">Todos</option>${Object.entries(ADMIN_STATUS).map(([k, v]) => opt(k, v, q.st)).join('')}</select>`)}
    </div><p class="row"><button>Filtrar</button><a class="btn sec" href="#/historial">Quitar filtros</a></p></form>
    <div class="card"><p class="muted small">${rows.length} registros</p>
    ${rows.length ? `<ul class="plain">${rows.map((a) => { const p = pname(a.productId); return `<li>
      <strong>${fmtDate(a.date)} ${a.time}</strong> — ${esc(p?.substance || a.productId)} ${ruoBadge(p)}<br>
      ${ADMIN_STATUS[a.status]} · Cantidad: ${a.amount != null ? `${fmtNum(a.amount, 4)} ${esc(a.unit)}` : '—'}${a.route ? ' · ' + esc(a.route) : ''}${a.lotText ? ' · lote ' + esc(a.lotText) : ''}
      ${a.symptoms ? `<br><span class="small">Síntomas: ${esc(a.symptoms)}</span>` : ''}${a.adverse ? `<br><span class="small">Efectos adversos: ${esc(a.adverse)}</span>` : ''}
      ${a.history?.length ? `<br><span class="small muted">Modificado ${a.history.length} vez/veces</span>` : ''}
      <div class="row noprint" style="margin-top:.3rem"><button class="sec" data-edit="${a.id}">Confirmar / corregir</button></div></li>`; }).join('')}</ul>` : '<p class="muted">Sin registros con estos filtros.</p>'}</div>`;
  $('#flt').addEventListener('submit', (e) => { e.preventDefault(); const d = readForm(e.target); location.hash = '#/historial?' + new URLSearchParams(Object.entries(d).filter(([, v]) => v)).toString(); });
  $$('[data-edit]').forEach((b) => b.addEventListener('click', async () => {
    const a = rows.find((x) => x.id === b.dataset.edit);
    const hist = (a.history || []).map((h) => `<li>${new Date(h.at).toLocaleString('es-ES')}: ${h.changes.map((c) => `${esc(c.field)} «${esc(c.from ?? '')}» → «${esc(c.to ?? '')}»`).join('; ')}</li>`).join('');
    const ok = await dialog(`<form><h2>Confirmar o corregir</h2>
      ${field('Estado', `<select name="status">${Object.entries(ADMIN_STATUS).map(([k, v]) => opt(k, v, a.status)).join('')}</select>`)}
      <div class="grid">${field('Fecha', inp('date', a.date, 'type="date"'))}${field('Hora', inp('time', a.time, 'type="time"'))}
      ${field('Cantidad', inp('amount', a.amount ?? '', 'type="number" step="any" min="0"'))}${field('Unidad', inp('unit', a.unit, 'list="units"'))}</div>
      ${field('Síntomas posteriores', `<textarea name="symptoms">${esc(a.symptoms)}</textarea>`)}
      ${field('Efectos adversos', `<textarea name="adverse">${esc(a.adverse)}</textarea>`)}
      ${field('Observaciones', `<textarea name="notes">${esc(a.notes)}</textarea>`)}
      <h3>Historial de cambios</h3>${hist ? `<ul class="small">${hist}</ul>` : '<p class="muted small">Sin cambios.</p>'}
      <div class="row"><button>Guardar</button><button type="button" class="sec" data-close>Cancelar</button></div></form>`, {
      onSubmit: async (d) => {
        const patch = { ...d, amount: d.amount === '' ? null : Number(d.amount) };
        const u = await m.updateAdministration(pid, a.id, patch);
        const plan = u.planId ? await ctx.store.get('plans', u.planId) : null;
        const check = m.checkAdministration(u, plan);
        if (check.comparable && check.exceeded && (a.amount !== u.amount || a.unit !== u.unit)) await exceedFlow(ctx, u, check);
        return true;
      },
    });
    if (ok) { toast('Cambios guardados'); historial(view, r, ctx); }
  }));
}

// ── Catálogo ──
export async function catalogo(view, r, ctx) {
  const products = await ctx.model.products();
  const cat = r.query.cat || '';
  const list = products.filter((p) => !cat || p.category === cat);
  view.innerHTML = `<h1>Catálogo</h1>
    <div class="card small"><p>Importado de <em>${esc(CATALOG_SOURCE)}</em>: ${products.filter((p) => p.status !== 'custom').length} presentaciones de ${new Set(products.filter((p) => p.status !== 'custom').map((p) => p.active.split(' (')[0])).size} principios activos (${products.filter((p) => p.status === 'plan').length} del plan actual).</p>
    <details><summary>Entradas del libro no importadas</summary><ul>${NOT_IMPORTED.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></details></div>
    <div class="row noprint">${['', ...Object.keys(CATEGORY_LABEL)].map((c) => `<a class="btn ${cat === c ? '' : 'sec'}" href="#/catalogo${c ? '?cat=' + c : ''}">${esc(c ? CATEGORY_LABEL[c] : 'Todos')}</a>`).join('')}
    <button id="addP">Añadir producto</button></div>
    <div class="card" style="margin-top:1rem"><ul class="plain">${list.map((p) => `<li><a href="#/producto/${p.id}"><strong>${esc(p.substance)}</strong></a> — ${esc(presentation(p))}
      <br><span class="badge">${esc(STATUS_LABEL[p.status])}</span> <span class="badge">${esc(CATEGORY_LABEL[p.category] || p.category)}</span> ${ruoBadge(p)} ${rxBadge(p)} ${p.review?.length ? '<span class="badge">Revisar datos</span>' : ''}</li>`).join('')}</ul></div>`;
  $('#addP').addEventListener('click', async () => {
    const ok = await dialog(`<form><h2>Añadir producto</h2><p class="small muted">Para presentaciones que no están en la tabla maestra. Anota solo lo que declara el envase.</p>
      ${field('Nombre', inp('substance', '', 'required'), true)}${field('Principio activo', inp('active'))}
      ${field('Categoría', `<select name="category">${Object.entries(CATEGORY_LABEL).map(([k, v]) => opt(k, v, 'custom')).join('')}</select>`)}
      ${field('Forma', inp('form', '', 'placeholder="Tableta, vial, crema…"'))}
      <div class="grid">${field('Contenido por unidad', inp('unitContent', '', 'type="number" step="any" min="0"'))}${field('Unidad del contenido', inp('unitContentUnit', 'mg'))}
      ${field('Nombre de la unidad', inp('unitLabel', 'unidad'))}${field('Unidades por envase', inp('unitsPerPack', '', 'type="number" step="1" min="0"'))}</div>
      ${field('Concentración declarada', inp('concentration'))}
      <label class="check"><input type="checkbox" name="research">Sustancia de investigación (RUO)</label>
      <label class="check"><input type="checkbox" name="rx">Medicamento con receta</label>
      ${field('Fuente documental', inp('source'))}
      <div class="row"><button>Añadir</button><button type="button" class="sec" data-close>Cancelar</button></div></form>`, { onSubmit: (d) => ctx.model.addCustomProduct(d) });
    if (ok) { toast('Producto añadido'); catalogo(view, r, ctx); }
  });
}

// ── Ficha de producto ──
export async function producto(view, r, ctx) {
  const m = ctx.model;
  const p = await m.product(r.arg);
  if (!p) { view.innerHTML = '<p>Producto no encontrado.</p>'; return; }
  const s = safetyFor(p.substance);
  const lots = ctx.profileId ? (await m.inventory(ctx.profileId)).filter((l) => l.productId === p.id) : [];
  const audit = ctx.profileId ? (await m.list('audit', ctx.profileId)).filter((a) => lots.some((l) => l.id === a.recId)) : [];
  view.innerHTML = `<p><a href="#/catalogo">← Catálogo</a></p><h1>${esc(p.substance)}</h1>
    ${p.research ? `<div class="ruo-banner">${esc(RUO_LABEL)}</div>` : ''}
    ${s.warning ? `<div class="alert seguridad">${esc(s.warning)}</div>` : ''}
    <div class="card"><h2 style="margin-top:0">Ficha</h2><dl class="kv">
      <dt>Principio activo</dt><dd>${esc(p.active)}</dd>
      <dt>Nombres comerciales</dt><dd>${esc(p.brands?.join(', ') || '—')}</dd>
      <dt>Categoría</dt><dd>${esc(CATEGORY_LABEL[p.category] || p.category)} ${rxBadge(p)}</dd>
      <dt>Forma</dt><dd>${esc(p.form)}</dd>
      <dt>Contenido declarado por unidad</dt><dd>${p.unitContent != null ? `${fmtNum(p.unitContent, 3)} ${esc(p.unitContentUnit)} por ${esc(p.unitLabel)}` : '—'}</dd>
      <dt>Concentración declarada</dt><dd>${esc(p.concentration || '—')}</dd>
      <dt>Unidades por envase</dt><dd>${p.unitsPerPack ?? '—'}</dd>
      <dt>Cantidad total del envase</dt><dd>${totalActive(p) != null ? `${fmtNum(totalActive(p))} mg (dato del catálogo)` : '—'}</dd>
      <dt>Estado en el plan</dt><dd>${esc(STATUS_LABEL[p.status])}</dd>
      <dt>Fuente documental</dt><dd>${esc(p.source)}</dd>
      <dt>Nivel de confianza</dt><dd>${esc(p.confidence)}</dd>
      <dt>Datos para revisar</dt><dd>${p.review?.length ? esc(p.review.join(' · ')) : '—'}</dd></dl>
      <p class="small">Contenido del envase, concentración, cantidad registrada en cada toma y cantidad restante del inventario son datos distintos. Esta app no hace conversiones ni da instrucciones de preparación.</p></div>
    <div class="card"><h2 style="margin-top:0">Posibles efectos adversos</h2>
      ${s.context ? `<p class="small"><strong>Contexto:</strong> ${esc(s.context)}</p>` : ''}
      ${s.insufficient ? `<p>${esc(s.insufficient)}</p>` : ''}
      ${s.effects.length ? `<div class="table-wrap"><table><thead><tr><th>Efecto</th><th>Gravedad / frecuencia</th><th>Verificación</th></tr></thead><tbody>
        ${s.effects.map((e) => `<tr><td><strong>${esc(e.name)}</strong>${e.desc ? `<br><span class="small">${esc(e.desc)}</span>` : ''}</td><td>${esc(e.severity || '')}${e.freq ? `<br><span class="small">${esc(e.freq)}</span>` : ''}</td><td>${esc({ verificado: 'Leído en la fuente', titulo: 'Solo título' }[e.verification] || e.verification)}</td></tr>`).join('')}</tbody></table></div>` : ''}
      ${s.notes ? `<p class="small">${esc(s.notes)}</p>` : ''}
      ${s.sources.length ? `<h3>Fuentes (consultadas el ${CONSULTED})</h3><ul class="small">${s.sources.map((x) => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a> — ${esc(x.type)}</li>`).join('')}</ul>` : ''}
      <p class="small muted">Una lista de efectos no indica que una cantidad concreta sea segura ni que un síntoma demuestre que la cantidad fue alta.</p></div>
    <div class="card"><h2 style="margin-top:0">Lotes de este perfil</h2>
      ${!ctx.profileId ? '<p class="muted">Crea un perfil para registrar lotes.</p>' : lots.length ? `<div class="table-wrap"><table><thead><tr><th>Lote</th><th>Proveedor</th><th>Caducidad</th><th>Apertura</th><th>Unidades (inicial / restante estimado)</th></tr></thead><tbody>
        ${lots.map((l) => `<tr><td>${esc(l.lot || '—')}</td><td>${esc(l.supplier || '—')}</td><td>${fmtDate(l.expiry)}</td><td>${fmtDate(l.opened)}</td><td>${l.unitsInitial ?? '—'} / ${l.unitsLeft ?? '—'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Sin lotes.</p>'}
      ${ctx.profileId ? '<p><button id="addLot">Añadir lote</button></p>' : ''}
      ${audit.length ? `<details><summary>Historial de modificaciones</summary><ul class="small">${audit.map((a) => `<li>${new Date(a.at).toLocaleString('es-ES')} · ${esc(a.action)}</li>`).join('')}</ul></details>` : ''}</div>`;
  $('#addLot')?.addEventListener('click', async () => {
    const ok = await dialog(`<form><h2>Añadir lote</h2>
      ${field('Número de lote', inp('lot'))}${field('Proveedor', inp('supplier'))}
      <div class="grid">${field('Caducidad', inp('expiry', '', 'type="date"'))}${field('Fecha de apertura', inp('opened', '', 'type="date"'))}</div>
      ${field(`Unidades en el envase (${p.unitLabel})`, inp('unitsInitial', p.unitsPerPack ?? '', 'type="number" step="any" min="0"'))}
      ${field('Fuente documental', inp('source', '', 'placeholder="etiqueta, factura, COA…"'))}
      ${field('Confianza', `<select name="confidence">${['Alta', 'Media', 'Baja'].map((x) => opt(x, x, 'Media')).join('')}</select>`)}
      ${field('Observaciones', '<textarea name="notes"></textarea>')}
      <div class="row"><button>Guardar</button><button type="button" class="sec" data-close>Cancelar</button></div></form>`, { onSubmit: (d) => m.addLot(ctx.profileId, { ...d, productId: p.id }) });
    if (ok) producto(view, r, ctx);
  });
}

// ── Perfiles ──
const profileForm = (p = {}) => `
  ${field('Nombre o identificador', inp('name', p.name, 'required'), true)}
  <div class="grid">${field('Sexo (opcional)', `<select name="sex">${['', 'Mujer', 'Hombre', 'Otro'].map((x) => opt(x, x || '—', p.sex)).join('')}</select>`)}
  ${field('Fecha de nacimiento', inp('birthDate', p.birthDate, 'type="date"'))}${field('Edad', inp('age', p.age ?? '', 'type="number" min="0" max="120"'))}
  ${field('Altura (cm)', inp('heightCm', p.heightCm ?? '', 'type="number" min="50" max="250"'))}
  ${field('Peso inicial (kg)', inp('initialWeight', p.initialWeight ?? '', 'type="number" step="0.1" min="1"'))}
  ${field('Objetivo de peso (kg, opcional)', inp('targetWeight', p.targetWeight ?? '', 'type="number" step="0.1" min="1"'))}
  ${field('Inicio del seguimiento', inp('startDate', p.startDate || todayISO(), 'type="date"'))}</div>
  ${field('Actividad física habitual', inp('activity', p.activity))}
  ${field('Limitaciones declaradas (para hábitos)', inp('limitations', p.limitations))}
  ${field('Síntomas declarados', `<textarea name="symptoms">${esc(p.symptoms)}</textarea>`)}
  ${field('Observaciones', `<textarea name="notes">${esc(p.notes)}</textarea>`)}
  ${field('Notas de seguimiento', `<textarea name="followUp">${esc(p.followUp)}</textarea>`)}`;

export async function perfiles(view, r, ctx) {
  const m = ctx.model;
  const list = await m.profiles({ includeArchived: true });
  view.innerHTML = `<h1>Perfiles</h1><p class="small muted">Cada perfil tiene sus propios registros. Todos se guardan solo en este dispositivo.</p>
    <p><button id="new">Nuevo perfil</button></p>
    <div class="card"><ul class="plain">${list.map((p) => `<li><strong>${esc(p.name)}</strong> ${p.archived ? '<span class="badge">Archivado</span>' : ''}${p.id === ctx.profileId ? ' <span class="badge">Activo</span>' : ''}
      <br><span class="small muted">${[p.sex, p.age ? p.age + ' años' : '', p.heightCm ? p.heightCm + ' cm' : '', p.initialWeight ? 'inicio ' + p.initialWeight + ' kg' : ''].filter(Boolean).join(' · ') || 'Sin datos opcionales'}</span>
      <div class="row" style="margin-top:.3rem"><button class="sec" data-act="use" data-id="${p.id}">Usar</button><button class="sec" data-act="edit" data-id="${p.id}">Editar</button>
      <button class="sec" data-act="arch" data-id="${p.id}">${p.archived ? 'Desarchivar' : 'Archivar'}</button><button class="danger" data-act="del" data-id="${p.id}">Eliminar</button></div></li>`).join('') || '<li class="muted">Sin perfiles.</li>'}</ul></div>`;
  $('#new').addEventListener('click', async () => {
    const p = await dialog(`<form><h2>Nuevo perfil</h2><p class="small muted">Solo el nombre es obligatorio.</p>${profileForm()}<div class="row"><button>Crear</button><button type="button" class="sec" data-close>Cancelar</button></div></form>`, { onSubmit: (d) => m.createProfile(d) });
    if (p) { ctx.profileId = p.id; await refreshProfiles(); perfiles(view, r, ctx); }
  });
  $$('[data-act]').forEach((b) => b.addEventListener('click', async () => {
    const p = list.find((x) => x.id === b.dataset.id);
    if (b.dataset.act === 'use') { ctx.profileId = p.id; await refreshProfiles(); location.hash = '#/'; return; }
    if (b.dataset.act === 'edit') {
      await dialog(`<form><h2>Editar perfil</h2>${profileForm(p)}<div class="row"><button>Guardar</button><button type="button" class="sec" data-close>Cancelar</button></div></form>`, {
        onSubmit: (d) => m.updateProfile(p.id, { ...d, age: d.age ? Number(d.age) : null, heightCm: d.heightCm ? Number(d.heightCm) : null, initialWeight: d.initialWeight ? Number(d.initialWeight) : null, targetWeight: d.targetWeight ? Number(d.targetWeight) : null }),
      });
    }
    if (b.dataset.act === 'arch') await m.archiveProfile(p.id, !p.archived);
    if (b.dataset.act === 'del') {
      const ok = await dialog(`<form><h2>Eliminar «${esc(p.name)}»</h2><div class="alert seguridad">Se borrarán el perfil y TODOS sus datos (registros, planes, pesos, hábitos, incidencias). No se puede deshacer. Haz antes una copia en Ajustes si la necesitas.</div>
        ${field('Escribe ELIMINAR para confirmar', inp('c', '', 'required autocomplete="off"'))}<div class="row"><button class="danger">Eliminar</button><button type="button" class="sec" data-close>Cancelar</button></div></form>`, {
        onSubmit: async (d) => { if (d.c !== 'ELIMINAR') throw new Error('Escribe ELIMINAR en mayúsculas'); await m.deleteProfile(p.id); return true; },
      });
      if (ok) toast('Perfil eliminado');
    }
    await refreshProfiles(); perfiles(view, r, ctx);
  }));
}
