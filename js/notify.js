// Bloqueo con PIN, notificaciones y exportación de recordatorios a calendario (.ics).
import { occurrences, todayISO, addDays } from './model.js';
import { MOMENTS } from './schedule.js';

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
  // Tomas previstas por los protocolos (solo las que tienen hora o momento del día). Texto genérico en la pantalla de bloqueo.
  for (const p of profiles) for (const s of (await model.agenda(p.id, t)).slots) {
    if (s.status !== 'pending' && s.status !== 'snoozed') continue;
    const hhmm = s.time || MOMENTS[s.moment]?.at;
    if (!hhmm) continue;
    const at = s.status === 'snoozed' ? new Date(s.snoozedUntil) : new Date(`${t}T${hhmm}:00`);
    const key = `${s.key}@${at.toISOString()}`, late = now - at;
    if (late >= 0 && late < 15 * 60000 && !keys.has(key)) {
      await reg.showNotification('Tienes una toma pendiente', { body: `${p.name} · ${s.time || MOMENTS[s.moment].label}. Ábrela en «Hoy».`, tag: key, data: { url: './#/' } });
      keys.add(key); n++;
    }
  }
  // Avisos de ciclo (último día, vuelta tras el descanso): una vez al día a partir de las 9:00. Texto genérico en la pantalla de bloqueo.
  if (now.getHours() >= 9) for (const p of profiles) for (const al of await model.alerts(p.id)) {
    if (al.kind !== 'ciclo' || !al.short) continue;
    const key = `ciclo|${p.id}|${t}|${al.text}`;
    if (keys.has(key)) continue;
    await reg.showNotification(al.short, { body: `${p.name}. Ábrelo en la app (Progreso → Avisos).`, tag: key, data: { url: './#/avisos' } });
    keys.add(key); n++;
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
export const icsEsc = (s) => String(s).replace(/[\\;,]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
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

// ── .ics de tus tomas y avisos de ciclo para Fossify Calendar (mismo formato que Guido PRO, comprobado con IcsImporter de Fossify) ──
// · Horas locales sin «Z»: Fossify las guarda tal cual en el huso del móvil.
// · UID estables: al reimportar, Fossify ACTUALIZA el evento si LAST-MODIFIED es mayor que el guardado → marca siempre creciente.
// · Fossify ignora el texto de cada VALARM: toda la información va en el título. Un solo aviso por evento.
// · CATEGORIES:TOMAS → Fossify lo importa en su propio tipo de evento (se puede ocultar).
const pad2 = (n) => String(n).padStart(2, '0');
const local = (d) => `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}T${pad2(d.getHours())}${pad2(d.getMinutes())}00`;
const utcZ = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
// events: [{ uid, start: Date, minutes, title, desc, cancel? }]. cancel = aviso que ya no toca: como en Guido PRO, se vacía y se
// mueve al 01/01/2000 en la categoría PAPELERA (sin alarma), así sale de tu agenda sin tener que borrarlo a mano.
export function eventsToICS(events, lastModified = new Date()) {
  const lm = utcZ(lastModified);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//registro-sustancias//ES', 'CALSCALE:GREGORIAN'];
  for (const e of events) {
    lines.push('BEGIN:VEVENT', `UID:${e.uid}@registro-sustancias`, `DTSTAMP:${lm}`, `LAST-MODIFIED:${lm}`);
    if (e.cancel) {
      lines.push('DTSTART:20000101T000000', 'DTEND:20000101T001000', `SUMMARY:${icsEsc('🗑 Libre — ' + String(e.title || '').replace(/^🗑[^—]*—\s*/, ''))}`,
        'CATEGORIES:PAPELERA', 'X-FOSSIFY-CATEGORY-COLOR:-8355712', 'STATUS:CANCELLED', 'TRANSP:TRANSPARENT', 'END:VEVENT');
      continue;
    }
    const end = new Date(e.start.getTime() + (e.minutes || 15) * 60000);
    lines.push(`DTSTART:${local(e.start)}`, `DTEND:${local(end)}`, `SUMMARY:${icsEsc(e.title)}`, `DESCRIPTION:${icsEsc(e.desc || '')}`,
      'CATEGORIES:TOMAS', 'X-FOSSIFY-CATEGORY-COLOR:-14575885', 'STATUS:CONFIRMED',
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-P0DT0H0M0S', `DESCRIPTION:${icsEsc(e.title)}`, 'END:VALARM', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
// Entrega: compartir el archivo si el navegador lo permite; si no, descarga con nombre único (Android muestra «Descarga completada · Abrir»).
export async function deliverICS(ics, base) {
  const now = new Date(), name = `${base}_${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}.ics`;
  try {
    const file = new File([ics], name, { type: 'text/calendar' });
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: name }); return { shared: true, name }; }
  } catch (e) { if (e?.name === 'AbortError') return null; }
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
  return { shared: false, name };
}
