// Service worker: funciona sin conexión y gestiona avisos.
const CACHE = 'registro-v2';
const ASSETS = ['./', 'index.html', 'styles.css', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png',
  'js/app.js', 'js/ui.js', 'js/model.js', 'js/store.js', 'js/catalog.js', 'js/safety.js', 'js/notify.js', 'js/views1.js', 'js/views2.js'];

self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Red primero (para recibir actualizaciones) y caché como respaldo sin conexión.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))));
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
