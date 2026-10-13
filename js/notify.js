// Bloqueo con PIN, notificaciones y exportación de recordatorios a calendario (.ics).
import { occurrences, todayISO, addDays } from './model.js';

// ── PIN ── (hash SHA-256 con sal; impide abrir la app, pero los datos del navegador NO están cifrados)
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
export async function hashPin(pin, salt) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${pin}`)));
}
export async function setPin(store, pin) {
  if (!/^\d{4,8}$/.test(pin)) throw new Error('El PIN debe tener de 4 a 8 cifras');
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  await store.put('settings', { id: 'pin', salt, hash: await hashPin(pin, salt) });
}
export async function checkPin(store, pin) {
  const s = await store.get('settings', 'pin');
  return !s || (await hashPin(pin, s.salt)) === s.hash;
}

// ── notificaciones locales mientras la app está abierta ──
export const notifySupported = () => 'Notification' in window && 'serviceWorker' in navigator;
export async function askPermission() {
  if (!notifySupported()) return 'no-soportado';
  return Notification.requestPermission();
}
// Comprueba recordatorios vencidos en los últimos 15 minutos y avisa una sola vez por ocurrencia.
export async function checkDue(model, store, now = new Date()) {
  if (!notifySupported() || Notification.permission !== 'granted') return 0;
  const t = todayISO();
  const rec = (await store.get('settings', 'notified')) || { id: 'notified', keys: [] };
  const keys = new Set(rec.keys);
  const profiles = await model.profiles();
  const reg = await navigator.serviceWorker.ready;
  let n = 0;
  for (const p of profiles) for (const r of await model.list('reminders', p.id)) {
    if (r.snoozedUntil && new Date(r.snoozedUntil) > now) continue;
    for (const o of occurrences(r, addDays(t, -1), t)) {
      const at = new Date(`${o.at}:00`);
      const key = `${r.id}@${o.at}`;
      const late = now - at;
      const snoozeKey = r.snoozedUntil ? `${key}#${r.snoozedUntil}` : key;
      if (late >= 0 && late < 15 * 60000 && !keys.has(snoozeKey)) {
        await reg.showNotification(r.label, { body: `${p.name} · ${o.time}. Confírmalo en la app; el aviso no marca nada como realizado.`, tag: key, data: { url: `./#/registro?rem=${r.id}&p=${p.id}` } });
        keys.add(snoozeKey); n++;
      }
    }
  }
  await store.put('settings', { id: 'notified', keys: [...keys].slice(-500) });
  return n;
}

// Intenta registrar la sincronización periódica (solo Chrome/Android con la app instalada; frecuencia decidida por el navegador).
export async function tryPeriodicSync() {
  try {
    const reg = await navigator.serviceWorker.ready;
    if (!('periodicSync' in reg)) return false;
    const st = await navigator.permissions.query({ name: 'periodic-background-sync' });
    if (st.state !== 'granted') return false;
    await reg.periodicSync.register('recordatorios', { minInterval: 60 * 60 * 1000 });
    return true;
  } catch { return false; }
}

// ── .ics: los recordatorios pasan al calendario de Android, que avisa aunque la app esté cerrada ──
const icsEsc = (s) => String(s).replace(/[\\;,]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
export function remindersToICS(items) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//registro-sustancias//ES', 'CALSCALE:GREGORIAN'];
  for (const { reminder: r, profileName } of items) {
    if (!r.enabled) continue;
    for (const t of r.times) {
      const [hh, mm] = t.split(':');
      const start = (r.startDate || todayISO()).replace(/-/g, '');
      const rule = ['FREQ=' + (r.days?.length ? 'WEEKLY' : 'DAILY')];
      if (r.days?.length) rule.push('BYDAY=' + r.days.map((d) => DAYS[d]).join(','));
      if (r.endDate) rule.push('UNTIL=' + r.endDate.replace(/-/g, '') + 'T235959');
      lines.push('BEGIN:VEVENT', `UID:${r.id}-${hh}${mm}@registro-sustancias`, `DTSTAMP:${stamp}`,
        `DTSTART:${start}T${hh}${mm}00`, 'DURATION:PT5M', `RRULE:${rule.join(';')}`,
        `SUMMARY:${icsEsc(r.label)}`, `DESCRIPTION:${icsEsc(`Perfil: ${profileName}. Recordatorio sin cantidad: confirma en la app lo que hayas hecho.`)}`,
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:PT0M', `DESCRIPTION:${icsEsc(r.label)}`, 'END:VALARM', 'END:VEVENT');
    }
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
