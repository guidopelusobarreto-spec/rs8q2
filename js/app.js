import { IDBStore } from './store.js';
import { Model } from './model.js';
import { esc, $, opt, toast } from './ui.js';
import { checkPin, checkDue, tryPeriodicSync } from './notify.js';
import * as V1 from './views1.js';
import * as V2 from './views2.js';

const MENU = [
  ['', 'Panel'], ['registro', 'Registrar'], ['historial', 'Historial'], ['calendario', 'Calendario'], ['planes', 'Ciclos y periodos'],
  ['pct', 'Postciclo'], ['recordatorios', 'Recordatorios'], ['peso', 'Peso'], ['habitos', 'Hábitos'], ['informes', 'Informes'],
  ['incidencias', 'Incidencias'], ['catalogo', 'Catálogo'], ['perfiles', 'Perfiles'], ['ajustes', 'Ajustes'],
];
const ROUTES = {
  '': V1.panel, registro: V1.registro, historial: V1.historial, catalogo: V1.catalogo, producto: V1.producto, perfiles: V1.perfiles,
  calendario: V2.calendario, planes: V2.planes, plan: V2.planDetalle, pct: V2.pct, recordatorios: V2.recordatorios, peso: V2.peso,
  habitos: V2.habitos, informes: V2.informes, incidencias: V2.incidencias, ajustes: V2.ajustes,
};

export const ctx = { store: null, model: null, profileId: null, ui: null, locked: false, lastActive: Date.now() };

async function loadUI() {
  ctx.ui = (await ctx.store.get('settings', 'ui')) || { id: 'ui', profileId: null, size: '19', contrast: 'normal', lockMinutes: 5 };
  document.documentElement.dataset.size = ctx.ui.size;
  document.documentElement.dataset.contrast = ctx.ui.contrast;
}
export async function saveUI(patch) { Object.assign(ctx.ui, patch); await ctx.store.put('settings', ctx.ui); await loadUI(); }

export async function refreshProfiles() {
  const list = await ctx.model.profiles();
  if (!list.find((p) => p.id === ctx.profileId)) ctx.profileId = list[0]?.id || null;
  if (ctx.ui.profileId !== ctx.profileId) await saveUI({ profileId: ctx.profileId });
  $('#profileSel').innerHTML = list.length ? list.map((p) => opt(p.id, p.name, ctx.profileId)).join('') : '<option value="">(sin perfiles)</option>';
}

function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, qs] = h.split('?');
  const [name, ...rest] = path.split('/');
  return { name: name || '', arg: rest.join('/'), query: Object.fromEntries(new URLSearchParams(qs || '')) };
}

export async function render() {
  if (ctx.locked) return renderLock();
  const r = parseHash();
  $('#menu').innerHTML = MENU.map(([k, l]) => `<a href="#/${k}" class="${(r.name === k || (r.name === 'plan' && k === 'planes') || (r.name === 'producto' && k === 'catalogo')) ? 'active' : ''}">${esc(l)}</a>`).join('');
  const view = $('#view');
  const fn = ROUTES[r.name] || V1.panel;
  const needsProfile = !['', 'perfiles', 'catalogo', 'producto', 'ajustes', 'incidencias'].includes(r.name);
  if (needsProfile && !ctx.profileId) {
    view.innerHTML = '<div class="card"><h1>Primero crea un perfil</h1><p>Cada registro pertenece a una persona.</p><a class="btn" href="#/perfiles">Crear perfil</a></div>';
    return;
  }
  try { await fn(view, r, ctx); }
  catch (e) { console.error(e); view.innerHTML = `<div class="card"><p class="err">Error: ${esc(e.message)}</p></div>`; }
  view.focus({ preventScroll: true });
}

async function renderLock() {
  $('#menu').innerHTML = '';
  $('#view').innerHTML = `<div class="lock"><form class="card" id="lockForm"><h1>App bloqueada</h1>
    <label for="pin">PIN</label><input id="pin" name="pin" type="password" inputmode="numeric" autocomplete="off" required>
    <p class="err" id="pinErr" role="alert"></p><button>Desbloquear</button></form></div>`;
  $('#profileSel').disabled = true;
  $('#lockForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (await checkPin(ctx.store, $('#pin').value)) { ctx.locked = false; ctx.lastActive = Date.now(); $('#profileSel').disabled = false; render(); }
    else { $('#pinErr').textContent = 'PIN incorrecto'; $('#pin').value = ''; }
  });
  $('#pin').focus();
}
export async function lockNow() { if (await ctx.store.get('settings', 'pin')) { ctx.locked = true; render(); } else toast('Primero define un PIN en Ajustes'); }

async function init() {
  try {
    ctx.store = await IDBStore.open();
  } catch (e) {
    $('#view').innerHTML = `<div class="card"><p class="err">No se puede abrir la base de datos local (${esc(e.message)}). Comprueba que el navegador no está en modo privado.</p></div>`;
    return;
  }
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
  ctx.model = new Model(ctx.store);
  await loadUI();
  ctx.profileId = ctx.ui.profileId;
  ctx.locked = !!(await ctx.store.get('settings', 'pin'));
  await refreshProfiles();
  $('#profileSel').addEventListener('change', async (e) => { ctx.profileId = e.target.value; await saveUI({ profileId: ctx.profileId }); render(); });
  $('#lockBtn').addEventListener('click', lockNow);
  addEventListener('hashchange', render);
  for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => { ctx.lastActive = Date.now(); }, { passive: true });
  setInterval(() => {
    const mins = Number(ctx.ui.lockMinutes) || 0;
    if (!ctx.locked && mins > 0 && Date.now() - ctx.lastActive > mins * 60000) lockNow();
  }, 15000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkDue(ctx.model, ctx.store).catch(() => {}); });
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(() => tryPeriodicSync()).catch((e) => console.warn('SW', e));
    navigator.serviceWorker.addEventListener('message', (e) => { if (e.data?.url) location.href = e.data.url; });
  }
  setInterval(() => checkDue(ctx.model, ctx.store).catch(() => {}), 30000);
  render();
}
init();
