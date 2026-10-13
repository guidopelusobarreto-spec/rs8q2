// Lógica de la app, independiente de la interfaz. Todo registro lleva profileId y se filtra por él.
import { CATALOG, RUO_LABEL } from './catalog.js';
import { COLLECTIONS } from './store.js';

export const ADMIN_STATUS = { realizado: 'Realizado', omitido: 'Omitido', retrasado: 'Retrasado', cancelado: 'Cancelado', pendiente: 'Pendiente de confirmar' };
export const PLAN_MODES = {
  duracion: 'Duración definida por el usuario', fecha_fin: 'Periodo con fecha de finalización', descanso: 'Periodo de descanso documentado',
  continuo: 'Seguimiento continuo', investigacion: 'Calendario de investigación documentado', pendiente: 'Duración pendiente de confirmar',
};
export const PCT_STATUS = { pendiente_revision: 'Pendiente de revisión', documentado: 'Plan documentado', seguimiento: 'En seguimiento', revision_pendiente: 'Revisión pendiente', finalizado: 'Finalizado' };
export const PCT_UNDEFINED = 'Seguimiento postciclo pendiente de definir';
export const END_ALERT_TEXT = 'Se acerca la fecha final del periodo registrado. Revisa el plan y confirma qué corresponde hacer antes de continuar.';
export const EXCEED_TEXT = 'La cantidad registrada supera la cantidad del plan';
export const EXCEED_LABEL = 'Cantidad superior al plan registrado';
export const REVIEW_DAYS = [7, 14, 21, 28];

// ── utilidades de fecha (YYYY-MM-DD, sin husos horarios) ──
const pad = (n) => String(n).padStart(2, '0');
export const toISODate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => toISODate(new Date());
const parse = (s) => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return Date.UTC(y, m - 1, d); };
export const addDays = (s, n) => new Date(parse(s) + n * 86400000).toISOString().slice(0, 10);
export const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 86400000); // b - a
export function addMonths(s, n) {
  const [y, m, d] = s.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(d, last));
  return t.toISOString().slice(0, 10);
}
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parse(s));
export const uid = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
const num = (v) => (v === '' || v == null ? null : Number(v));

export class ValidationError extends Error {}
const must = (cond, msg) => { if (!cond) throw new ValidationError(msg); };

// Fecha final calculada solo a partir de datos introducidos. Sin datos → null (nunca se supone una duración).
export function planEnd(p) {
  if (p.end) return p.end;
  if (!p.start || p.duration == null || p.duration === '') return null;
  const n = Number(p.duration);
  if (!(n > 0)) return null;
  if (p.durationUnit === 'semanas') return addDays(p.start, n * 7 - 1);
  if (p.durationUnit === 'meses') return addDays(addMonths(p.start, n), -1);
  return addDays(p.start, n - 1); // días, contando el día de inicio
}

// Fases escritas por el usuario: {fromWeek, toWeek, amount, unit, frequency, note}. Nada se rellena por defecto.
export function parsePhases(list) {
  if (!Array.isArray(list)) return [];
  return list.map((f) => {
    const x = { fromWeek: Number(f.fromWeek), toWeek: Number(f.toWeek), amount: num(f.amount), unit: (f.unit || '').trim(), frequency: (f.frequency || '').trim(), note: (f.note || '').trim() };
    if (!(x.fromWeek >= 1) || !(x.toWeek >= x.fromWeek)) throw new ValidationError('Cada fase necesita semana inicial ≥ 1 y semana final ≥ inicial');
    return x;
  }).sort((a, b) => a.fromWeek - b.fromWeek);
}
export function phaseFor(plan, date) {
  if (!plan?.phases?.length || !plan.start || date < plan.start) return null;
  const week = Math.floor(diffDays(plan.start, date) / 7) + 1;
  return plan.phases.find((f) => week >= f.fromWeek && week <= f.toWeek) ? { ...plan.phases.find((f) => week >= f.fromWeek && week <= f.toWeek), week } : { none: true, week };
}

// Comparación con el plan: solo si hay cantidad numérica válida y la unidad es idéntica. Sin conversiones.
export function compareToPlan(amount, unit, plan) {
  if (!plan) return { comparable: false, reason: 'Sin plan asociado' };
  const ref = num(plan.plannedAmount);
  if (ref == null || !(ref > 0)) return { comparable: false, reason: 'El plan no tiene una cantidad numérica válida' };
  if (!unit || !plan.plannedUnit || unit.trim().toLowerCase() !== plan.plannedUnit.trim().toLowerCase())
    return { comparable: false, reason: 'Las unidades no coinciden: no se compara (no se hacen conversiones)' };
  const a = num(amount);
  if (a == null || Number.isNaN(a)) return { comparable: false, reason: 'Cantidad registrada no numérica' };
  return { comparable: true, exceeded: a > ref, registered: a, reference: ref, unit };
}

export function weightChange(initial, current) {
  const i = num(initial), c = num(current);
  if (i == null || c == null || Number.isNaN(i) || Number.isNaN(c)) return null;
  if (!(i > 0)) throw new ValidationError('El peso inicial debe ser mayor que cero');
  const kg = +(c - i).toFixed(2);
  return { kg, pct: +(((c - i) / i) * 100).toFixed(2) };
}

// Ocurrencias de un recordatorio entre dos fechas (incluidas). days: 0=dom … 6=sáb; vacío = todos los días.
export function occurrences(r, from, to) {
  const out = [];
  if (!r.enabled) return out;
  const start = r.startDate && r.startDate > from ? r.startDate : from;
  const end = r.endDate && r.endDate < to ? r.endDate : to;
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const dow = new Date(parse(d)).getUTCDay();
    if (r.days?.length && !r.days.includes(dow)) continue;
    for (const t of r.times || []) out.push({ date: d, time: t, at: `${d}T${t}`, reminder: r });
  }
  return out;
}

export class Model {
  constructor(store, { now = () => new Date() } = {}) { this.store = store; this.now = now; }
  today() { return toISODate(this.now()); }
  stamp() { return this.now().toISOString(); }

  // ── catálogo ──
  async products() {
    const custom = await this.store.all('customProducts');
    return [...CATALOG, ...custom.map((c) => ({ ...c, status: 'custom', category: c.category || 'custom' }))];
  }
  async product(id) { return (await this.products()).find((p) => p.id === id); }
  async addCustomProduct(d) {
    must(d.substance?.trim(), 'Indica el nombre del producto');
    const rec = { id: 'u-' + uid(), substance: d.substance.trim(), active: d.active || d.substance.trim(), brands: [], category: d.category || 'custom',
      form: d.form || '', unitLabel: d.unitLabel || 'unidad', unitContent: num(d.unitContent), unitContentUnit: d.unitContentUnit || 'mg',
      unitsPerPack: num(d.unitsPerPack), concentration: d.concentration || null, research: !!d.research, rx: !!d.rx,
      source: d.source || 'Añadido por el usuario', confidence: 'declarado por el usuario', review: [], createdAt: this.stamp() };
    return this.store.put('customProducts', rec);
  }
  ruoLabel(p) { return p?.research ? RUO_LABEL : null; }

  // ── perfiles ──
  async profiles({ includeArchived = false } = {}) {
    const all = await this.store.all('profiles');
    return all.filter((p) => includeArchived || !p.archived).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }
  async createProfile(d) {
    must(d.name?.trim(), 'El perfil necesita un nombre o identificador');
    const rec = { id: uid(), name: d.name.trim(), sex: d.sex || '', birthDate: d.birthDate || '', age: num(d.age), heightCm: num(d.heightCm),
      initialWeight: num(d.initialWeight), targetWeight: num(d.targetWeight), startDate: d.startDate || this.today(),
      activity: d.activity || '', limitations: d.limitations || '', notes: d.notes || '', symptoms: d.symptoms || '', followUp: d.followUp || '',
      archived: false, createdAt: this.stamp() };
    if (rec.initialWeight != null) must(rec.initialWeight > 0, 'El peso inicial debe ser mayor que cero');
    await this.store.put('profiles', rec);
    if (rec.initialWeight) await this.addWeight(rec.id, { date: rec.startDate, kg: rec.initialWeight, note: 'Peso inicial' });
    await this._audit(rec.id, 'profiles', rec.id, 'creado', null);
    return rec;
  }
  async _profile(id) { const p = await this.store.get('profiles', id); must(p, 'Perfil inexistente'); return p; }
  async updateProfile(id, patch) { return this._update('profiles', id, patch, id); }
  async archiveProfile(id, archived = true) { return this._update('profiles', id, { archived }, id); }
  async deleteProfile(id) {
    await this._profile(id);
    for (const c of COLLECTIONS) {
      if (c === 'profiles' || c === 'settings' || c === 'customProducts') continue;
      for (const r of await this.store.all(c)) if (r.profileId === id) await this.store.del(c, r.id);
    }
    await this.store.del('profiles', id);
  }

  // ── genéricos con aislamiento por perfil ──
  async _add(c, profileId, data) {
    await this._profile(profileId);
    const rec = { ...data, id: uid(), profileId, createdAt: this.stamp() };
    await this.store.put(c, rec);
    await this._audit(profileId, c, rec.id, 'creado', null);
    return rec;
  }
  async list(c, profileId) {
    must(profileId, 'Falta el perfil');
    return (await this.store.all(c)).filter((r) => r.profileId === profileId);
  }
  async _update(c, id, patch, expectedProfile) {
    const cur = await this.store.get(c, id);
    must(cur, 'Registro inexistente');
    const owner = c === 'profiles' ? cur.id : cur.profileId;
    if (expectedProfile) must(owner === expectedProfile, 'El registro pertenece a otro perfil');
    const changes = [];
    for (const [k, v] of Object.entries(patch)) {
      if (['id', 'profileId', 'history', 'createdAt'].includes(k)) continue;
      if (JSON.stringify(cur[k]) !== JSON.stringify(v)) changes.push({ field: k, from: cur[k] ?? null, to: v });
    }
    if (!changes.length) return cur;
    const next = { ...cur, ...Object.fromEntries(changes.map((x) => [x.field, x.to])), updatedAt: this.stamp() };
    next.history = [...(cur.history || []), { at: this.stamp(), changes }];
    await this.store.put(c, next);
    await this._audit(owner, c, id, 'modificado', changes);
    return next;
  }
  async _audit(profileId, coll, recId, action, changes) {
    await this.store.put('audit', { id: uid(), profileId, coll, recId, action, changes, at: this.stamp() });
  }

  // ── lotes / inventario ──
  async addLot(profileId, d) {
    must(d.productId, 'Elige el producto');
    if (d.expiry) must(isDate(d.expiry), 'Fecha de caducidad no válida');
    return this._add('lots', profileId, { productId: d.productId, lot: d.lot || '', supplier: d.supplier || '', expiry: d.expiry || '',
      opened: d.opened || '', unitsInitial: num(d.unitsInitial), notes: d.notes || '', source: d.source || '', confidence: d.confidence || '' });
  }
  async inventory(profileId) {
    const lots = await this.list('lots', profileId);
    const admins = await this.list('administrations', profileId);
    return lots.map((l) => {
      const used = admins.filter((a) => a.lotId === l.id && a.status === 'realizado').reduce((s, a) => s + (num(a.unitsUsed) || 0), 0);
      return { ...l, unitsUsed: used, unitsLeft: l.unitsInitial == null ? null : +(l.unitsInitial - used).toFixed(3) };
    });
  }

  // ── planes / ciclos ──
  async addPlan(profileId, d) {
    must(PLAN_MODES[d.mode], 'Modalidad no válida');
    must(isDate(d.start), 'Indica una fecha de inicio válida');
    if (d.end) { must(isDate(d.end), 'Fecha final no válida'); must(d.end >= d.start, 'La fecha final es anterior al inicio'); }
    if (d.mode === 'fecha_fin') must(d.end, 'Esta modalidad necesita fecha de finalización');
    if (d.mode === 'duracion') must(num(d.duration) > 0, 'Indica la duración');
    const rec = { productId: d.productId || '', name: d.name || '', mode: d.mode, start: d.start, end: d.end || '',
      duration: num(d.duration), durationUnit: d.durationUnit || 'dias', plannedAmount: num(d.plannedAmount), plannedUnit: d.plannedUnit || '', phases: parsePhases(d.phases),
      scheduleNote: d.scheduleNote || '', reviewEveryDays: num(d.reviewEveryDays), source: d.source || '', enteredBy: d.enteredBy || '',
      alerts: { d7: true, d2: true, d0: true, overdue: true, afterEnd: true, ...(d.alerts || {}) }, notes: d.notes || '' };
    rec.computedEnd = planEnd(rec);
    return this._add('plans', profileId, rec);
  }
  async updatePlan(profileId, id, patch) {
    if (patch.phases !== undefined) patch = { ...patch, phases: parsePhases(patch.phases) };
    const p = await this._update('plans', id, patch, profileId);
    const ce = planEnd(p);
    return ce !== p.computedEnd ? this.store.put('plans', { ...p, computedEnd: ce }) : p;
  }

  async markReviewDone(profileId, planId, date) {
    const p = await this.store.get('plans', planId);
    must(p && p.profileId === profileId, 'Plan inexistente o de otro perfil');
    return this._update('plans', planId, { reviewsDone: [...new Set([...(p.reviewsDone || []), date])] }, profileId);
  }
  async closePlan(profileId, planId, closed = true) { return this._update('plans', planId, { closed }, profileId); }

  // ── administraciones ──
  async addAdministration(profileId, d) {
    must(d.productId, 'Elige la sustancia');
    must(isDate(d.date), 'Fecha no válida');
    must(/^\d{2}:\d{2}$/.test(d.time || ''), 'Hora no válida');
    const status = d.status || 'pendiente';
    must(ADMIN_STATUS[status], 'Estado no válido');
    if (d.amount !== '' && d.amount != null) must(!Number.isNaN(Number(d.amount)) && Number(d.amount) >= 0, 'Cantidad no válida');
    const plan = d.planId ? await this.store.get('plans', d.planId) : null;
    if (plan) must(plan.profileId === profileId, 'El plan pertenece a otro perfil');
    if (d.lotId) { const lot = await this.store.get('lots', d.lotId); must(lot && lot.profileId === profileId, 'El lote pertenece a otro perfil'); }
    const rec = await this._add('administrations', profileId, { productId: d.productId, planId: d.planId || '', date: d.date, time: d.time,
      amount: num(d.amount), unit: d.unit || '', route: d.route || '', lotId: d.lotId || '', lotText: d.lotText || '', unitsUsed: num(d.unitsUsed),
      notes: d.notes || '', symptoms: d.symptoms || '', adverse: d.adverse || '', status, weightKg: num(d.weightKg), source: d.source || '' });
    if (rec.weightKg) await this.addWeight(profileId, { date: d.date, kg: rec.weightKg, note: 'Anotado con un registro' });
    return { admin: rec, check: this.checkAdministration(rec, plan) };
  }
  checkAdministration(a, plan) {
    const ph = phaseFor(plan, a.date);
    const ref = ph && !ph.none ? { plannedAmount: ph.amount, plannedUnit: ph.unit } : plan;
    const cmp = { ...compareToPlan(a.amount, a.unit, ph?.none ? null : ref), phase: ph };
    if (ph?.none) cmp.outsidePhases = true;
    const end = plan ? planEnd(plan) : null;
    const afterEnd = !!(end && a.date > end && plan.alerts?.afterEnd !== false);
    return { ...cmp, afterEnd, planEnd: end };
  }
  // Confirmar o corregir conserva el historial de cambios.
  async updateAdministration(profileId, id, patch) {
    if (patch.status) must(ADMIN_STATUS[patch.status], 'Estado no válido');
    return this._update('administrations', id, patch, profileId);
  }
  async history(profileId, { productId, from, to, status } = {}) {
    return (await this.list('administrations', profileId))
      .filter((a) => (!productId || a.productId === productId) && (!from || a.date >= from) && (!to || a.date <= to) && (!status || a.status === status))
      .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  }

  // ── incidencias (registro separado) ──
  async addIncident(profileId, d) {
    return this._add('incidents', profileId, { label: EXCEED_LABEL, adminId: d.adminId || '', productId: d.productId || '',
      registered: num(d.registered), reference: num(d.reference), unit: d.unit || '', when: d.when || '', symptoms: d.symptoms || [],
      severe: !!d.severe, others: d.others || '', notes: d.notes || '', status: 'abierta' });
  }

  // ── seguimiento postciclo ──
  async addPCT(profileId, d) {
    const cycle = d.cycleId ? await this.store.get('plans', d.cycleId) : null;
    if (cycle) must(cycle.profileId === profileId, 'El ciclo pertenece a otro perfil');
    for (const x of d.dates || []) must(isDate(x.date), 'Fecha no válida en el calendario postciclo');
    return this._add('pct', profileId, { cycleId: d.cycleId || '', plannedEnd: d.plannedEnd || (cycle ? planEnd(cycle) || '' : ''),
      actualEnd: d.actualEnd || '', reviewDate: d.reviewDate || '', planText: d.planText || '', planSource: d.planSource || '',
      products: d.products || '', amounts: d.amounts || '', dates: d.dates || [], notes: d.notes || '', symptoms: d.symptoms || '',
      labResults: d.labResults || '', status: d.status || (d.planText ? 'documentado' : 'pendiente_revision') });
  }
  pctPlanLabel(p) { return p.planText?.trim() ? p.planText : PCT_UNDEFINED; }

  // ── recordatorios, pesos, hábitos, eventos ──
  async addReminder(profileId, d) {
    must(d.label?.trim(), 'El recordatorio necesita un texto');
    must(Array.isArray(d.times) && d.times.length && d.times.every((t) => /^\d{2}:\d{2}$/.test(t)), 'Indica al menos una hora (HH:MM)');
    return this._add('reminders', profileId, { kind: d.kind || 'administracion', label: d.label.trim(), productId: d.productId || '',
      planId: d.planId || '', times: d.times, days: d.days || [], startDate: d.startDate || this.today(), endDate: d.endDate || '',
      enabled: d.enabled !== false, snoozedUntil: '' });
  }
  async snoozeReminder(profileId, id, minutes) {
    const until = new Date(this.now().getTime() + minutes * 60000).toISOString();
    return this._update('reminders', id, { snoozedUntil: until }, profileId);
  }
  async addWeight(profileId, d) {
    must(isDate(d.date), 'Fecha no válida');
    const kg = num(d.kg);
    must(kg > 0 && kg < 700, 'Peso no válido (kg)');
    return this._add('weights', profileId, { date: d.date, kg, note: d.note || '' });
  }
  async weights(profileId) { return (await this.list('weights', profileId)).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)); }
  async addHabit(profileId, d) {
    must(isDate(d.date), 'Fecha no válida');
    must(['agua', 'comida', 'entreno', 'sueno', 'general'].includes(d.type), 'Tipo de hábito no válido');
    return this._add('habits', profileId, { ...d, date: d.date, type: d.type });
  }
  async addEvent(profileId, d) {
    must(isDate(d.date), 'Fecha no válida'); must(d.title?.trim(), 'Indica un título');
    return this._add('events', profileId, { date: d.date, time: d.time || '', title: d.title.trim(), type: d.type || 'cita', notes: d.notes || '' });
  }

  // ── alertas ──
  async alerts(profileId) {
    const t = this.today();
    const out = [];
    const push = (level, text, ref) => out.push({ level, text, ref, profileId });
    for (const p of await this.list('plans', profileId)) {
      const end = planEnd(p);
      if (p.mode === 'pendiente') push('aviso', `Plan «${p.name || 'sin nombre'}»: duración pendiente de confirmar`, p.id);
      if (end && !p.closed) {
        const left = diffDays(t, end);
        if (p.alerts.d7 && left === 7) push('aviso', `${END_ALERT_TEXT} (faltan 7 días: ${end})`, p.id);
        if (p.alerts.d2 && left === 2) push('aviso', `${END_ALERT_TEXT} (faltan 2 días: ${end})`, p.id);
        if (p.alerts.d0 && left === 0) push('aviso', `${END_ALERT_TEXT} (termina hoy)`, p.id);
        if (p.alerts.overdue && left < 0) push('seguridad', `Fecha final vencida el ${end} en «${p.name || 'plan'}». Revisa el plan.`, p.id);
      }
      if (p.mode === 'continuo' && p.reviewEveryDays > 0 && !p.closed) {
        const n = Math.floor(diffDays(p.start, t) / p.reviewEveryDays);
        const next = addDays(p.start, (n + 1) * p.reviewEveryDays);
        const last = n > 0 ? addDays(p.start, n * p.reviewEveryDays) : null;
        const done = (p.reviewsDone || []).includes(last);
        if (last && !done) push('aviso', `Revisión periódica vencida (${last}) en «${p.name || 'seguimiento continuo'}»`, p.id);
        else if (diffDays(t, next) <= 2) push('info', `Próxima revisión periódica: ${next}`, p.id);
      }
      for (const d of REVIEW_DAYS) if (addDays(p.start, d) === t) push('info', `Revisión de ${d} días disponible para «${p.name || 'plan'}»`, p.id);
    }
    for (const a of await this.list('administrations', profileId)) {
      if (a.status === 'pendiente' && a.date <= t) push('aviso', `Registro pendiente de confirmar: ${a.date} ${a.time}`, a.id);
      const plan = a.planId ? await this.store.get('plans', a.planId) : null;
      if (plan && a.status !== 'cancelado' && this.checkAdministration(a, plan).afterEnd)
        push('seguridad', `Registro del ${a.date} posterior a la fecha final prevista del plan (${planEnd(plan)})`, a.id);
    }
    for (const x of await this.list('pct', profileId)) {
      if (x.status !== 'finalizado') {
        if (x.reviewDate && x.reviewDate < t) push('seguridad', `Revisión postciclo prevista el ${x.reviewDate} sin registrar`, x.id);
        for (const d of x.dates || []) if (d.date === t) push('aviso', `Postciclo: ${d.label || 'fecha del plan'} hoy`, x.id);
        if (!x.planText) push('info', PCT_UNDEFINED, x.id);
      }
    }
    for (const i of await this.list('incidents', profileId)) if (i.status === 'abierta') push('seguridad', `${i.label}${i.severe ? ' — con síntomas graves' : ''} (sin revisar)`, i.id);
    for (const l of await this.list('lots', profileId)) if (l.expiry && l.expiry < t) push('aviso', `Lote ${l.lot || ''} caducado el ${l.expiry}`, l.id);
    return out;
  }

  // ── calendario ──
  async calendar(profileId, from, to) {
    const items = [];
    const add = (date, type, text, ref, time = '') => { if (date >= from && date <= to) items.push({ date, time, type, text, ref }); };
    const name = async (id) => (await this.product(id))?.substance || '';
    for (const r of await this.list('reminders', profileId)) for (const o of occurrences(r, from, to)) add(o.date, 'recordatorio', r.label, r.id, o.time);
    for (const a of await this.list('administrations', profileId)) add(a.date, 'registro', `${await name(a.productId)} — ${ADMIN_STATUS[a.status]}${a.amount != null ? ` (${a.amount} ${a.unit})` : ''}`, a.id, a.time);
    for (const p of await this.list('plans', profileId)) {
      const end = planEnd(p);
      add(p.start, p.mode === 'descanso' ? 'descanso' : 'ciclo', `Inicio: ${p.name || PLAN_MODES[p.mode]}`, p.id);
      if (end) add(end, p.mode === 'descanso' ? 'descanso' : 'ciclo', `Fin: ${p.name || PLAN_MODES[p.mode]}`, p.id);
      for (const d of REVIEW_DAYS) add(addDays(p.start, d), 'revision', `Revisión ${d} días`, p.id);
      if (p.reviewEveryDays > 0) for (let k = 1; addDays(p.start, k * p.reviewEveryDays) <= to; k++) add(addDays(p.start, k * p.reviewEveryDays), 'revision', 'Revisión periódica', p.id);
    }
    for (const x of await this.list('pct', profileId)) {
      if (x.reviewDate) add(x.reviewDate, 'pct', 'Revisión postciclo', x.id);
      for (const d of x.dates || []) add(d.date, 'pct', d.label || 'Fecha postciclo', x.id);
    }
    for (const w of await this.list('weights', profileId)) add(w.date, 'peso', `${w.kg} kg`, w.id);
    for (const e of await this.list('events', profileId)) add(e.date, 'evento', e.title, e.id, e.time);
    for (const i of await this.list('incidents', profileId)) add((i.when || i.createdAt).slice(0, 10), 'incidencia', i.label, i.id);
    for (const a of await this.list('administrations', profileId)) if (a.symptoms || a.adverse) add(a.date, 'sintoma', a.symptoms || a.adverse, a.id, a.time);
    return items.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }

  // ── informe 7/14/21/28 días (o cualquier periodo) ──
  async report(profileId, { start, days, planId }) {
    const profile = await this._profile(profileId);
    const plan = planId ? await this.store.get('plans', planId) : null;
    if (plan) must(plan.profileId === profileId, 'El plan pertenece a otro perfil');
    const s = start || plan?.start;
    must(isDate(s), 'Falta la fecha de inicio del periodo');
    const end = addDays(s, days);
    const weights = (await this.weights(profileId)).filter((w) => w.date <= end);
    const before = weights.filter((w) => w.date <= s);
    const initial = before.length ? before[before.length - 1].kg : (weights[0]?.kg ?? profile.initialWeight ?? null);
    const inWin = weights.filter((w) => w.date > s);
    const current = inWin.length ? inWin[inWin.length - 1].kg : null;
    const change = initial != null && current != null ? weightChange(initial, current) : null;
    const admins = (await this.list('administrations', profileId)).filter((a) => a.date >= s && a.date <= end && (!planId || a.planId === planId))
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const count = (st) => admins.filter((a) => a.status === st).length;
    const habits = (await this.list('habits', profileId)).filter((h) => h.date >= s && h.date <= end);
    const incidents = (await this.list('incidents', profileId)).filter((i) => (i.when || i.createdAt).slice(0, 10) >= s && (i.when || i.createdAt).slice(0, 10) <= end);
    const missing = [];
    if (initial == null) missing.push('Peso inicial');
    if (current == null) missing.push('Peso dentro del periodo');
    if (!admins.length) missing.push('Registros de administración');
    if (admins.some((a) => a.amount == null && a.status === 'realizado')) missing.push('Cantidad en algún registro realizado');
    if (!habits.length) missing.push('Hábitos');
    const nextReview = REVIEW_DAYS.map((d) => addDays(s, d)).find((d) => d > this.today()) || null;
    return { profile: profile.name, start: s, end, days, initial, current, change, admins,
      counts: { realizado: count('realizado'), omitido: count('omitido'), retrasado: count('retrasado'), cancelado: count('cancelado'), pendiente: count('pendiente') },
      symptoms: admins.filter((a) => a.symptoms || a.adverse).map((a) => ({ date: a.date, symptoms: a.symptoms, adverse: a.adverse })),
      incidents, habits, missing, nextReview,
      disclaimer: 'Resumen de datos registrados. No indica si hay que aumentar, reducir, interrumpir o continuar nada; esa decisión corresponde a un profesional sanitario.' };
  }

  // ── panel ──
  async dashboard() {
    const profiles = await this.profiles();
    const t = this.today();
    const rows = [];
    for (const p of profiles) {
      const w = await this.weights(p.id);
      const rem = (await this.list('reminders', p.id)).flatMap((r) => occurrences(r, t, addDays(t, 1))).sort((a, b) => a.at.localeCompare(b.at));
      rows.push({ profile: p, lastWeight: w[w.length - 1] || null, alerts: await this.alerts(p.id),
        upcoming: rem.slice(0, 5), recent: (await this.history(p.id)).slice(0, 3) });
    }
    return rows;
  }

  // ── exportación / copia de seguridad ──
  async exportJSON(profileId = null) {
    const out = { app: 'registro-sustancias', version: 1, exportedAt: this.stamp(), profileId };
    for (const c of COLLECTIONS) {
      let rows = await this.store.all(c);
      if (c === 'settings') rows = profileId ? [] : rows.filter((r) => r.id !== 'pin');
      else if (c === 'profiles') rows = profileId ? rows.filter((r) => r.id === profileId) : rows;
      else if (c !== 'customProducts' && profileId) rows = rows.filter((r) => r.profileId === profileId);
      out[c] = rows;
    }
    return out;
  }
  async importJSON(data, { replace = false } = {}) {
    must(data && data.app === 'registro-sustancias', 'El archivo no es una copia de esta app');
    if (replace) for (const c of COLLECTIONS) if (c !== 'settings') await this.store.clear(c);
    let n = 0;
    for (const c of COLLECTIONS) for (const r of data[c] || []) { if (c === 'settings') continue; must(r.id, 'Registro sin identificador'); await this.store.put(c, r); n++; }
    return n;
  }
  async exportCSV(collection, profileId) {
    const all = await this.store.all(collection);
    const rows = !profileId ? all : collection === 'profiles' ? all.filter((r) => r.id === profileId) : collection === 'customProducts' ? all : all.filter((r) => r.profileId === profileId);
    return toCSV(rows.map(({ history, ...r }) => r));
  }
}

export function toCSV(rows) {
  if (!rows.length) return '';
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const cell = (v) => {
    if (v == null) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // separador «;» para que Excel en español lo abra en columnas
  return '﻿' + [cols.join(';'), ...rows.map((r) => cols.map((c) => cell(r[c])).join(';'))].join('\r\n');
}
