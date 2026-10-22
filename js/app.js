import { IDBStore } from './store.js';
import { Model } from './model.js';
import { esc, $, opt, toast, dialog } from './ui.js';
import { checkPin, checkDue, tryPeriodicSync } from './notify.js';
import * as V1 from './views1.js';
import * as V2 from './views2.js';
import * as V3 from './views3.js';

import * as H from './hoy.js';

// Barra inferior: 5 pestañas. Cada pestaña agrupa rutas; algunas tienen apartados (fila de chips).
const I = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const TABS = [
  ['', 'Hoy', I('<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16.5 9"/>'), ['', 'registro']],
  ['calendario', 'Calendario', I('<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'), ['calendario']],
  ['protocolos', 'Protocolos', I('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M8.5 10h7M8.5 14h7M8.5 18h4"/>'), ['protocolos', 'planes', 'plan', 'biblioteca', 'ficha', 'texto', 'pct']],
  ['historial', 'Progreso', I('<path d="M4 19h16"/><path d="M5 15l4-4 3 3 6-7"/>'), ['historial', 'peso', 'habitos', 'informes', 'incidencias', 'avisos']],
  ['mas', 'Más', I('<circle cx="5.5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18.5" cy="12" r="1.6"/>'), ['mas', 'recordatorios', 'catalogo', 'producto', 'perfiles', 'ajustes', 'acerca']],
];
const SUB = {
  protocolos: [['protocolos', 'Cronograma'], ['planes', 'Planes'], ['biblioteca', 'Biblioteca'], ['pct', 'Postciclo']],
  historial: [['historial', 'Historial'], ['peso', 'Peso'], ['habitos', 'Hábitos'], ['informes', 'Informes'], ['incidencias', 'Incidencias'], ['avisos', 'Avisos']],
};
const SUB_OF = { plan: 'planes', ficha: 'biblioteca', texto: 'biblioteca' };
const ROUTES = {
  '': H.hoy, registro: V1.registro, avisos: V1.panel, historial: V1.historial, catalogo: V1.catalogo, producto: V1.producto, perfiles: V1.perfiles,
  calendario: V2.calendario, planes: V2.planes, plan: V2.planDetalle, pct: V2.pct, recordatorios: V2.recordatorios, peso: V2.peso,
  habitos: V2.habitos, biblioteca: V3.biblioteca, informes: V2.informes, incidencias: V2.incidencias, ajustes: V2.ajustes,
  protocolos: H.protocolos, ficha: H.ficha, texto: H.texto, mas: H.mas, acerca: H.acerca,
};

export const ctx = { store: null, model: null, profileId: null, ui: null, locked: false, lastActive: Date.now() };

async function loadUI() {
  ctx.ui = (await ctx.store.get('settings', 'ui')) || { id: 'ui', profileId: null, size: '22', contrast: 'normal', lockMinutes: 5 };
  if (!ctx.ui.sizeChosen) ctx.ui.size = '22';
  document.documentElement.dataset.size = ctx.ui.size;
  document.documentElement.dataset.contrast = ctx.ui.contrast;
}
export async function saveUI(patch) { Object.assign(ctx.ui, patch); await ctx.store.put('settings', ctx.ui); await loadUI(); }

export async function refreshProfiles() {
  const list = await ctx.model.profiles();
  if (!list.find((p) => p.id === ctx.profileId)) ctx.profileId = list[0]?.id || null;
  if (ctx.ui.profileId !== ctx.profileId) await saveUI({ profileId: ctx.profileId });
  $('#profileSel').innerHTML = list.length ? list.map((p) => opt(p.id, p.name, ctx.profileId)).join('') : '<option value="">Sin perfiles</option>';
}

function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, qs] = h.split('?');
  const [name, ...rest] = path.split('/');
  return { name: name || '', arg: rest.join('/'), query: Object.fromEntries(new URLSearchParams(qs || '')) };
}

let lastPath = null;
export async function render() {
  if (ctx.locked) return renderLock();
  const r = parseHash();
  const tab = TABS.find((t) => t[3].includes(r.name)) || TABS[0];
  $('#tabbar').innerHTML = TABS.map(([k, l, ico]) => `<a href="#/${k}" class="${tab[0] === k ? 'active' : ''}"${tab[0] === k ? ' aria-current="page"' : ''}>${ico}<span>${esc(l)}</span></a>`).join('');
  const sub = SUB[tab[0]], cur = SUB_OF[r.name] || r.name;
  $('#subnav').innerHTML = sub ? sub.map(([k, l]) => `<a href="#/${k}" class="${cur === k ? 'active' : ''}">${esc(l)}</a>`).join('') : '';
  $('#subnav').hidden = !sub;
  if (lastPath !== r.name + '/' + r.arg) { lastPath = r.name + '/' + r.arg; scrollTo(0, 0); }
  const view = $('#view');
  const fn = ROUTES[r.name] || H.hoy;
  const needsProfile = !['', 'perfiles', 'catalogo', 'producto', 'ajustes', 'incidencias', 'biblioteca', 'ficha', 'texto', 'mas', 'acerca', 'avisos'].includes(r.name);
  if (needsProfile && !ctx.profileId) {
    view.innerHTML = '<div class="card"><h1>Primero crea un perfil</h1><p>Cada registro pertenece a una persona.</p><a class="btn" href="#/perfiles">Crear perfil</a></div>';
    return;
  }
  view.onclick = null;
  try { await fn(view, r, ctx); }
  catch (e) { console.error(e); view.innerHTML = `<div class="card"><p class="err">Error: ${esc(e.message)}</p></div>`; }
  view.focus({ preventScroll: true });
}

async function renderLock() {
  $('#tabbar').innerHTML = ''; $('#subnav').innerHTML = ''; $('#subnav').hidden = true;
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

// ── Instalación ──
let deferredInstall = null;
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; updateInstallBtn(); });
addEventListener('appinstalled', () => { deferredInstall = null; updateInstallBtn(); toast('App instalada'); });
function updateInstallBtn() { const b = $('#installBtn'); if (b) b.hidden = isStandalone() || !deferredInstall; }
export const appInstalledHere = isStandalone;
export async function updateLockBtn() { $('#lockBtn').hidden = !(await ctx.store.get('settings', 'pin')); }
export async function installApp() {
  if (deferredInstall) {
    deferredInstall.prompt();
    const { outcome } = await deferredInstall.userChoice;
    deferredInstall = null; updateInstallBtn();
    if (outcome === 'accepted') return;
  }
  await dialog(`<h2>Instalar la app</h2>
    <p>Tu navegador no ha ofrecido la instalación automática. Hazlo a mano:</p>
    <h3>Android (Chrome)</h3><ol><li>Menú <strong>⋮</strong> arriba a la derecha.</li><li><strong>Instalar aplicación</strong> o <strong>Añadir a pantalla de inicio</strong> → <strong>Instalar</strong>.</li></ol>
    <h3>Ordenador (Chrome o Edge)</h3><ol><li>Icono de instalar a la derecha de la barra de direcciones, o menú <strong>⋮</strong> → <strong>Enviar, guardar y compartir</strong> → <strong>Instalar página como aplicación</strong>.</li></ol>
    <h3>iPhone (Safari)</h3><ol><li>Botón <strong>Compartir</strong> → <strong>Añadir a pantalla de inicio</strong>.</li></ol>
    <p class="small muted">Si no aparece la opción, recarga la página una vez: Chrome necesita que la app se haya cargado completa al menos una vez.</p>
    <p><button data-close>Entendido</button></p>`);
}

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
  $('#installBtn').addEventListener('click', installApp);
  updateLockBtn();
  updateInstallBtn();
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
