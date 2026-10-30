// Service worker: funciona sin conexión y gestiona avisos.
const CACHE = 'registro-v10';
const ASSETS = ['./', 'index.html', 'styles.css', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png',
  'js/app.js', 'js/ui.js', 'js/model.js', 'js/store.js', 'js/catalog.js', 'js/safety.js', 'js/notify.js', 'js/views1.js', 'js/views2.js', 'js/views3.js',
  'js/schedule.js', 'js/text.js', 'js/hoy.js', 'js/pausas.js', 'js/ajustes.js', 'fonts/atkinson-400.woff2', 'fonts/atkinson-700.woff2'];

self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Fuentes e iconos no cambian: desde la caché. El resto, red primero (para recibir actualizaciones) pero sin esperar
// más de 3 s si ya hay copia: con mala señal la app abre desde la caché y la respuesta de la red la actualiza para la próxima vez.
const NET_WAIT = 3000;
// Tras una espera agotada, el resto de archivos de esa carga (y del minuto siguiente) salen directamente de la caché.
let slowUntil = 0;
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (/\/(fonts|icons)\//.test(url.pathname)) { e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req))); return; }
  let saving = Promise.resolve();
  const net = fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); saving = caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  });
  e.waitUntil(net.then(() => saving, () => {}));
  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (!hit) return net.catch(async () => (await caches.match('index.html')) || Response.error());
    if (Date.now() < slowUntil) return hit;
    let timer;
    const late = new Promise((res) => { timer = setTimeout(() => { slowUntil = Date.now() + 60000; res(hit); }, NET_WAIT); });
    const fresh = net.then((r) => { slowUntil = 0; return r.ok ? r : hit; }, () => hit);
    return Promise.race([fresh, late]).finally(() => clearTimeout(timer));
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    if (cs.length) { cs[0].focus(); cs[0].postMessage({ url }); return; }
    return self.clients.openWindow(url);
  }));
});

// Sincronización periódica (solo donde el navegador la conceda): avisa de recordatorios de los últimos 60 min.
function idb() {
  return new Promise((res, rej) => { const r = indexedDB.open('registro-sustancias'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
const getAll = (db, s) => new Promise((res, rej) => { const r = db.transaction(s).objectStore(s).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
self.addEventListener('periodicsync', (e) => {
  if (e.tag !== 'recordatorios') return;
  e.waitUntil((async () => {
    const db = await idb();
    const [rems, profs, settings] = await Promise.all([getAll(db, 'reminders'), getAll(db, 'profiles'), getAll(db, 'settings')]);
    const notified = new Set(settings.find((s) => s.id === 'notified')?.keys || []);
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const keys = [...notified];
    for (const r of rems) {
      if (!r.enabled || (r.startDate && r.startDate > today) || (r.endDate && r.endDate < today)) continue;
      if (r.days?.length && !r.days.includes(now.getDay())) continue;
      if (r.snoozedUntil && new Date(r.snoozedUntil) > now) continue;
      for (const t of r.times) {
        const at = new Date(`${today}T${t}:00`);
        const key = `${r.id}@${today}T${t}`;
        if (now - at >= 0 && now - at < 3600000 && !notified.has(key)) {
          const p = profs.find((x) => x.id === r.profileId);
          await self.registration.showNotification(r.label, { body: `${p?.name || ''} · ${t}. Confírmalo en la app.`, tag: key, data: { url: `./#/registro?rem=${r.id}` } });
          keys.push(key);
        }
      }
    }
    await new Promise((res) => { const tx = db.transaction('settings', 'readwrite'); tx.objectStore('settings').put({ id: 'notified', keys: keys.slice(-500) }); tx.oncomplete = res; tx.onerror = res; });
  })());
});
