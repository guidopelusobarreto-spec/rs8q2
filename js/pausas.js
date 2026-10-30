// Pausar, reanudar y borrar pausas de un plan o de todo un protocolo aplicado junto.
// Los días en pausa no cuentan: las fases siguientes y el fin se retrasan esos días.
import { esc, toast, dialog, fmtDate, field, inp } from './ui.js';
import { todayISO, diffDays, pausesOf } from './model.js';

export const pauseText = (x) => (x.to
  ? `Del ${fmtDate(x.from)} al ${fmtDate(x.to)} (${diffDays(x.from, x.to) + 1} ${diffDays(x.from, x.to) ? 'días' : 'día'})`
  : `Desde el ${fmtDate(x.from)}, sin fecha de vuelta`);

const names = (list, labelOf) => list.map((p) => esc(labelOf(p))).join(', ');

// Aplica fn a cada plan; el primero manda (si falla, se muestra el error en la ventana). Devuelve los que fallaron.
async function each(targets, fn) {
  await fn(targets[0]);
  const failed = [];
  for (const p of targets.slice(1)) { try { await fn(p); } catch (e) { failed.push({ p, e }); } }
  return failed;
}
const report = (total, failed, labelOf, msg) => {
  const n = total - failed.length;
  if (failed.length) toast(`${msg(n)}. Sin cambios en: ${failed.map((f) => `${labelOf(f.p)} (${f.e.message})`).join('; ')}`, 8000);
  else toast(msg(n));
};

export async function pauseDialog(ctx, targets, labelOf = (p) => p.name || 'plan') {
  const many = targets.length > 1;
  let failed = [];
  const ok = await dialog(`<form><h2>${many ? 'Pausar el protocolo' : 'Pausar'}</h2>
    <p class="small">Los días en pausa no cuentan: las fases siguientes y el fin se retrasan esos días. Si no sabes cuándo vuelves, deja «Hasta» vacío y pulsa «Reanudar» al volver.</p>
    <div class="grid">${field('Desde', inp('from', todayISO(), 'type="date" required'), true)}${field('Hasta (incluido, opcional)', inp('to', '', 'type="date"'))}</div>
    ${field('Nota (opcional)', inp('note', '', 'maxlength="200"'))}
    ${many ? `<p class="small">Se pausa: ${names(targets, labelOf)}.</p>` : ''}
    <div class="row"><button>Pausar</button><button type="button" class="ghost" data-close>Cancelar</button></div></form>`, {
    onSubmit: async (d) => { failed = await each(targets, (p) => ctx.model.addPause(ctx.profileId, p.id, d)); return true; },
  });
  if (ok) report(targets.length, failed, labelOf, (n) => (n > 1 ? `Pausadas ${n} sustancias` : 'Pausado'));
  return !!ok;
}

// Reanuda la pausa abierta de cada plan (las que empezaron el mismo día que la del plan principal).
export async function resumeDialog(ctx, targets, pause, labelOf = (p) => p.name || 'plan', { ask = true } = {}) {
  const open = (p) => pausesOf(p).find((x) => !x.to && x.from === pause.from);
  const list = targets.filter(open);
  if (!list.length) return false;
  let failed = [];
  const run = async (backOn) => { failed = await each(list, (p) => ctx.model.resumePause(ctx.profileId, p.id, open(p).id, backOn)); return true; };
  const ok = ask ? await dialog(`<form><h2>Reanudar</h2><p class="small">En pausa desde el ${fmtDate(pause.from)}. El día de vuelta ya cuenta como día del plan.</p>
    ${field('Vuelvo el día', inp('backOn', todayISO(), 'type="date" required'), true)}
    ${list.length > 1 ? `<p class="small">Se reanuda: ${names(list, labelOf)}.</p>` : ''}
    <div class="row"><button class="ok">Reanudar</button><button type="button" class="ghost" data-close>Cancelar</button></div></form>`, { onSubmit: (d) => run(d.backOn) })
    : await run(todayISO());
  if (ok) report(list.length, failed, labelOf, (n) => (n > 1 ? `Reanudadas ${n} sustancias` : 'Reanudado'));
  return !!ok;
}

// Borra la misma pausa (mismas fechas) en cada plan.
export async function removePauseDialog(ctx, targets, pause, labelOf = (p) => p.name || 'plan') {
  const same = (p) => pausesOf(p).find((x) => x.from === pause.from && x.to === pause.to);
  const list = targets.filter(same);
  let failed = [];
  const ok = await dialog(`<form><h2>Borrar la pausa</h2><p>${esc(pauseText(pause))}</p>
    <p class="small">Esos días vuelven a contar como días del plan y el fin se adelanta. Queda anotado en el historial del plan.</p>
    ${list.length > 1 ? `<p class="small">Se borra en: ${names(list, labelOf)}.</p>` : ''}
    <div class="row"><button class="sec">Borrar</button><button type="button" class="ghost" data-close>Cancelar</button></div></form>`, {
    onSubmit: async () => { failed = await each(list, (p) => ctx.model.removePause(ctx.profileId, p.id, same(p).id)); return true; },
  });
  if (ok) report(list.length, failed, labelOf, (n) => (n > 1 ? `Pausa borrada en ${n} sustancias` : 'Pausa borrada'));
  return !!ok;
}

// Editar fechas y nota de una pausa (en todos los planes que la comparten).
export async function editPauseDialog(ctx, targets, pause, labelOf = (p) => p.name || 'plan') {
  const same = (p) => pausesOf(p).find((x) => x.from === pause.from && x.to === pause.to);
  const list = targets.filter(same);
  let failed = [];
  const ok = await dialog(`<form><h2>Editar la pausa</h2>
    <div class="grid">${field('Desde', inp('from', pause.from, 'type="date" required'), true)}${field('Hasta (incluido; vacío = sin fecha de vuelta)', inp('to', pause.to || '', 'type="date"'))}</div>
    ${field('Nota (opcional)', inp('note', pause.note || '', 'maxlength="200"'))}
    ${list.length > 1 ? `<p class="small">Se cambia en: ${names(list, labelOf)}.</p>` : ''}
    <div class="row"><button>Guardar</button><button type="button" class="ghost" data-close>Cancelar</button></div></form>`, {
    onSubmit: async (d) => { failed = await each(list, (p) => ctx.model.updatePause(ctx.profileId, p.id, same(p).id, d)); return true; },
  });
  if (ok) report(list.length, failed, labelOf, (n) => (n > 1 ? `Pausa cambiada en ${n} sustancias` : 'Pausa cambiada'));
  return !!ok;
}
