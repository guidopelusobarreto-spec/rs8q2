// Lógica de la app, independiente de la interfaz. Todo registro lleva profileId y se filtra por él.
import { CATALOG, RUO_LABEL } from './catalog.js';
import { COLLECTIONS } from './store.js';
import { buildAgenda, amountText } from './schedule.js';

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

// Fases escritas por el usuario: {fromWeek, toWeek (null = hasta el final), amount, amountMax (rango), unit, frequency, note}. Nada se rellena por defecto.
export function parsePhases(list) {
  if (!Array.isArray(list)) return [];
  return list.map((f) => {
    const open = f.toWeek == null || f.toWeek === '' || f.toWeek === 'fin';
    const x = { fromWeek: Number(f.fromWeek), toWeek: open ? null : Number(f.toWeek), amount: num(f.amount), amountMax: num(f.amountMax), unit: (f.unit || '').trim(), frequency: (f.frequency || '').trim(), note: (f.note || '').trim() };
    if (!(x.fromWeek >= 1) || (!open && !(x.toWeek >= x.fromWeek))) throw new ValidationError('Cada fase necesita semana inicial ≥ 1 y semana final ≥ inicial');
    if (x.amountMax != null && (x.amount == null || x.amountMax < x.amount)) throw new ValidationError('En un rango, la cantidad máxima debe ser mayor o igual que la mínima');
    if (x.amountMax === x.amount) x.amountMax = null;
    return x;
  }).sort((a, b) => a.fromWeek - b.fromWeek);
}
// Una línea «semanas 1-4 | 2 | mg | semanal | nota». Semanas «9-fin» = hasta el final. Cantidad «6-8» = rango.
export function parsePhaseLine(line) {
  const [w, amount = '', unit = '', frequency = '', note = ''] = String(line).split('|').map((x) => x.trim());
  const wm = w.match(/(\d+)\s*[-–]\s*(\d+|fin)/i) || w.match(/(\d+)/);
  if (!wm) throw new ValidationError(`Fase «${line}»: indica las semanas, p. ej. «semanas 1-4» o «semanas 9-fin»`);
  const am = amount.match(/^(\d+(?:[.,]\d+)?)(?:\s*[-–]\s*(\d+(?:[.,]\d+)?))?$/);
  if (amount !== '' && !am) throw new ValidationError(`Fase «${line}»: la cantidad debe ser un número o un rango «6-8»`);
  if (amount !== '' && !unit) throw new ValidationError(`Fase «${line}»: falta la unidad`);
  const n = (v) => (v == null ? null : Number(v.replace(',', '.')));
  const to = wm[2] == null ? +wm[1] : /fin/i.test(wm[2]) ? null : +wm[2];
  return { fromWeek: +wm[1], toWeek: to, amount: am ? n(am[1]) : null, amountMax: am ? n(am[2]) : null, unit, frequency, note };
}
export function phaseText(f) {
  const w = f.toWeek == null ? `${f.fromWeek}–fin` : `${f.fromWeek}–${f.toWeek}`;
  const a = f.amount == null ? '—' : f.amountMax != null ? `${f.amount}–${f.amountMax}` : `${f.amount}`;
  return `Semanas ${w}: ${a} ${f.unit || ''} · ${f.frequency || '—'}${f.note ? ' · ' + f.note : ''}`;
}
export function phaseFor(plan, date) {
  if (!plan?.phases?.length || !plan.start || date < plan.start) return null;
  const week = Math.floor(diffDays(plan.start, date) / 7) + 1;
  const f = plan.phases.find((x) => week >= x.fromWeek && week <= (x.toWeek ?? Infinity));
  return f ? { ...f, week } : { none: true, week };
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
      alerts: { d7: true, d2: true, d0: true, overdue: true, afterEnd: true, ...(d.alerts || {}) }, notes: d.notes || '',
      templateId: d.templateId || '', substance: d.substance || '' };
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
    const ref = ph && !ph.none ? { plannedAmount: ph.amountMax ?? ph.amount, plannedUnit: ph.unit } : plan;
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
    const plans = await this.list('plans', profileId), admins = await this.list('administrations', profileId), t = this.today();
    const labels = await this.planLabels(plans), label = async (pl) => labels.get(pl.id);
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const ag = buildAgenda({ plans, admins, date: d });
      for (const s of ag.slots) if (s.status !== 'done' && s.status !== 'omitted') add(d, d >= t ? 'prevista' : 'sinregistro', `${await label(s.plan)} ${amountText(s.phase)}`.trim(), s.plan.id, s.time);
      for (const w of ag.weekly) {
        if (w.count >= w.needed) continue;
        if (d === w.weekStart && w.weekEnd >= t) add(d, 'prevista', `${await label(w.plan)} ${amountText(w.phase)} · ${w.needed} esta semana (${w.count} hechas)`, w.plan.id);
        if (d === w.weekEnd && d < t) add(d, 'sinregistro', `${await label(w.plan)}: ${w.count} de ${w.needed} esa semana`, w.plan.id);
      }
    }
    for (const w of await this.list('weights', profileId)) add(w.date, 'peso', `${w.kg} kg`, w.id);
    for (const e of await this.list('events', profileId)) add(e.date, 'evento', e.title, e.id, e.time);
    for (const i of await this.list('incidents', profileId)) add((i.when || i.createdAt).slice(0, 10), 'incidencia', i.label, i.id);
    for (const a of await this.list('administrations', profileId)) if (a.symptoms || a.adverse) add(a.date, 'sintoma', a.symptoms || a.adverse, a.id, a.time);
    return items.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }

  // Nombre de la sustancia de cada plan: la del plan, la del producto o la del modelo de la biblioteca.
  async planLabels(plans) {
    const products = await this.products(), templates = await this.store.all('templates'), out = new Map();
    for (const p of plans) {
      // los planes antiguos no guardaban el modelo: se reconoce por «Biblioteca: <nombre del modelo>» en la fuente
      const t = templates.find((x) => x.id === p.templateId) || templates.find((x) => (p.source || '').startsWith(`Biblioteca: ${x.name}`));
      const seg = (p.name || '').split(' — ');
      const l = p.substance || (t ? (t.items.length > 1 ? seg.pop() : t.compound || t.items[0]?.substance) : '');
      out.set(p.id, l || products.find((x) => x.id === p.productId)?.substance || p.name || 'Plan sin nombre');
    }
    return out;
  }
  // ── pantalla Hoy ──
  async agenda(profileId, date = this.today()) {
    const sn = await this.store.get('settings', 'snooze-' + profileId);
    return buildAgenda({ plans: await this.list('plans', profileId), admins: await this.list('administrations', profileId), date, snoozes: sn?.map || {}, now: this.now().toISOString() });
  }
  async snooze(profileId, key, minutes) {
    const id = 'snooze-' + profileId, now = this.now().toISOString();
    const cur = (await this.store.get('settings', id)) || { id, map: {} };
    for (const [k, v] of Object.entries(cur.map)) if (v < now) delete cur.map[k];
    cur.map[key] = new Date(this.now().getTime() + minutes * 60000).toISOString();
    await this.store.put('settings', cur);
    return cur.map[key];
  }
  // Corrección de la frecuencia leída, por plan y por texto literal (si el texto cambia, la corrección deja de aplicarse).
  async setFrequency(profileId, planId, text, sched) {
    const p = await this.store.get('plans', planId);
    must(p && p.profileId === profileId, 'Plan inexistente o de otro perfil');
    const map = { ...(p.freqOverrides || {}) };
    if (sched) map[text] = sched; else delete map[text];
    return this._update('plans', planId, { freqOverrides: map }, profileId);
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
      else if (c !== 'customProducts' && c !== 'templates' && profileId) rows = rows.filter((r) => r.profileId === profileId);
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
  // ── Biblioteca de protocolos: modelos escritos por el usuario; aplicar uno crea planes editables por persona ──
  async templates() { return (await this.store.all('templates')).sort((a, b) => (a.compound || '').localeCompare(b.compound || '', 'es') || a.name.localeCompare(b.name, 'es')); }
  async libraryInfo() { return { id: 'library', title: '', compat: [], warnings: [], substances: [], texts: {}, original: '', ...((await this.store.get('settings', 'library')) || {}) }; }
  async importLibrary(data, { replace = false } = {}) {
    const v = validateLibrary(data);
    if (v.errors.length) throw new ValidationError(v.errors.slice(0, 8).join(' · '));
    if (replace) await this.store.clear('templates');
    for (const t of v.templates) await this.store.put('templates', { ...t, importedAt: this.stamp() });
    await this.store.put('settings', { id: 'library', title: data.titulo || '', compat: data.compatibilidad || [], warnings: data.avisos || [],
      substances: data.sustancias || [], texts: data.textos || {}, original: data.textoOriginal || '' });
    return v.templates.length;
  }
  async exportLibrary() {
    const info = await this.libraryInfo();
    return { app: 'registro-sustancias', tipo: 'biblioteca-protocolos', version: 1, titulo: info.title, exportedAt: this.stamp(),
      compatibilidad: info.compat, avisos: info.warnings, sustancias: info.substances, textos: info.texts, textoOriginal: info.original, templates: (await this.templates()).map(({ importedAt, ...t }) => t) };
  }
  // Claves de sustancia (según la biblioteca) de un producto o texto: por código de catálogo o por nombre/alias.
  async substanceKeys({ productId = '', text = '' } = {}, info = null) {
    info ||= await this.libraryInfo();
    const p = productId ? await this.product(productId) : null;
    const hay = normTxt([p?.substance, p?.active, text].filter(Boolean).join(' '));
    return info.substances.filter((s) => s.productIds?.includes(productId) || s.alias?.some((a) => hay.includes(normTxt(a)))).map((s) => s.key);
  }
  // Avisos de combinación según la matriz del usuario. Compara lo nuevo con planes abiertos y tomas del perfil en el periodo.
  async compatCheck(profileId, { items = [], from, to = null, excludePlanIds = [] }) {
    const info = await this.libraryInfo();
    const rules = info.compat.filter((r) => r.tipo && r.tipo !== 'compatible' && r.a?.length && r.b?.length);
    if (!rules.length) return [];
    const name = (k) => info.substances.find((s) => s.key === k)?.nombre || k;
    const newKeys = [];
    for (const it of items) for (const k of await this.substanceKeys(it, info)) newKeys.push({ k, label: it.label || name(k), from: it.from || from, to: it.to === undefined ? to : it.to });
    const existing = [];
    for (const pl of await this.list('plans', profileId)) {
      if (pl.closed || excludePlanIds.includes(pl.id)) continue;
      const w = activeWindow(pl);
      if (!overlaps(w.from, w.to, from, to)) continue;
      for (const k of await this.substanceKeys({ productId: pl.productId, text: pl.name }, info)) existing.push({ k, label: `plan «${pl.name || name(k)}» (uso ${esD(w.from)} → ${w.to ? esD(w.to) : 'sin fin'})`, day: null, from: w.from, to: w.to });
    }
    for (const a of await this.list('administrations', profileId)) {
      if (a.date < from || a.date > (to || '9999-12-31') || ['omitido', 'cancelado'].includes(a.status)) continue;
      for (const k of await this.substanceKeys({ productId: a.productId }, info)) existing.push({ k, label: `toma del ${esD(a.date)}`, day: a.date, from: a.date, to: a.date });
    }
    const out = [], seen = new Set();
    const pair = (x, y, r) => x !== y && ((r.a.includes(x) && r.b.includes(y)) || (r.b.includes(x) && r.a.includes(y)));
    for (const r of rules) {
      for (const [i, n] of newKeys.entries()) {
        for (const e of existing) if (pair(n.k, e.k, r) && overlaps(n.from, n.to, e.from, e.to)) {
          if (r.mismoDia && !(from === to && e.day === from)) continue; // regla «mismo día»: solo tomas de ese día
          const key = r.combinacion + n.label + e.label;
          if (!seen.has(key)) { seen.add(key); out.push({ tipo: r.tipo, combinacion: r.combinacion, nivel: r.nivel, motivo: r.motivo, nuevo: n.label, con: e.label }); }
        }
        if (!r.mismoDia) for (const m of newKeys.slice(i + 1)) if (pair(n.k, m.k, r) && overlaps(n.from, n.to, m.from, m.to)) {
          const key = r.combinacion + n.label + m.label;
          if (!seen.has(key)) { seen.add(key); out.push({ tipo: r.tipo, combinacion: r.combinacion, nivel: r.nivel, motivo: r.motivo, nuevo: n.label, con: m.label }); }
        }
      }
    }
    const order = { prohibida: 0, precaucion: 1, redundante: 2 };
    return out.sort((x, y) => order[x.tipo] - order[y.tipo]);
  }
  async deleteTemplate(id) { await this.store.del('templates', id); }
  async applyTemplate(profileId, templateId, d) {
    const t = await this.store.get('templates', templateId);
    must(t, 'Protocolo no encontrado');
    must(!t.blocked, `No aplicable: ${t.blocked}`);
    must(isDate(d.start), 'Indica una fecha de inicio válida');
    const dur = d.duration === '' || d.duration == null ? null : Number(d.duration);
    if (dur != null) must(dur > 0, 'Duración no válida');
    const unit = t.durationUnit || 'semanas';
    const products = d.products || {};
    const weeks = dur == null ? null : unit === 'dias' ? Math.ceil(dur / 7) : dur;
    if (weeks != null) for (const it of t.items) must(!it.phases.some((f) => (f.toWeek ?? f.fromWeek) > weeks), `«${it.substance}» tiene fases más allá de la semana ${weeks}: alarga la duración`);
    const out = [];
    for (const [i, it] of t.items.entries()) {
      const notes = [t.route && `Vía: ${t.route}`, t.durationText && `Duración del protocolo: ${t.durationText}`, t.restText && `Descanso / después: ${t.restText}`, it.notes, t.notes].filter(Boolean).join('\n');
      out.push(await this.addPlan(profileId, { name: t.items.length > 1 ? `${t.name} — ${it.substance}` : t.name, productId: products[i] ?? it.productId ?? '',
        mode: dur ? 'duracion' : 'pendiente', substance: it.substance, start: d.start, duration: dur, durationUnit: unit, phases: it.phases,
        source: `Biblioteca: ${t.name}${t.source ? ' · ' + t.source : ''}`, enteredBy: 'Biblioteca de protocolos', templateId: t.id, notes }));
    }
    return out;
  }
}

const SEXES = ['hombre', 'mujer', 'ambos'];
// Periodo de uso real de un plan: si sus fases tienen semanas cerradas, solo esas semanas; si no, inicio → fin del plan.
export function activeWindow(pl) {
  const end = planEnd(pl) || null;
  const ph = pl.phases || [];
  if (!ph.length) return { from: pl.start, to: end };
  const a = Math.min(...ph.map((f) => f.fromWeek)), open = ph.some((f) => f.toWeek == null);
  const b = Math.max(...ph.map((f) => f.toWeek ?? 0));
  return { from: addDays(pl.start, (a - 1) * 7), to: open ? end : addDays(pl.start, b * 7 - 1) };
}
export function phasesWindow(start, phases, end) { return activeWindow({ start, phases, end }); }
const overlaps = (a1, b1, a2, b2) => a1 <= (b2 || '9999-12-31') && a2 <= (b1 || '9999-12-31');
const esD = (d) => d.split('-').reverse().join('/');
const normTxt = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export function validateLibrary(data) {
  const errors = [], templates = [];
  if (!data || data.tipo !== 'biblioteca-protocolos') return { errors: ['El archivo no es una biblioteca de protocolos'], templates };
  if (!Array.isArray(data.templates) || !data.templates.length) return { errors: ['La biblioteca no contiene protocolos'], templates };
  const ids = new Set();
  for (const [i, t] of data.templates.entries()) {
    const where = `Protocolo ${i + 1} (${t?.name || 'sin nombre'})`;
    if (!t?.id || ids.has(t.id)) { errors.push(`${where}: identificador vacío o repetido`); continue; }
    ids.add(t.id);
    if (!t.name) errors.push(`${where}: falta el nombre`);
    if (!SEXES.includes(t.sex)) errors.push(`${where}: sexo debe ser hombre, mujer o ambos`);
    if (t.durationUnit && !['dias', 'semanas'].includes(t.durationUnit)) errors.push(`${where}: unidad de duración no válida`);
    if (!Array.isArray(t.items) || !t.items.length) { errors.push(`${where}: no tiene sustancias`); continue; }
    const items = [];
    for (const it of t.items) {
      if (!it.substance) errors.push(`${where}: sustancia sin nombre`);
      try { items.push({ substance: it.substance || '', productId: it.productId || '', notes: it.notes || '', phases: parsePhases(it.phases || []) }); }
      catch (e) { errors.push(`${where} · ${it.substance}: ${e.message}`); }
    }
    templates.push({ id: t.id, name: t.name, compound: t.compound || '', sex: t.sex, kind: t.items.length > 1 ? 'combinado' : 'sustancia', route: t.route || '',
      durationText: t.durationText || '', durationMin: num(t.durationMin), durationMax: num(t.durationMax), durationUnit: t.durationUnit || 'semanas',
      restText: t.restText || '', notes: t.notes || '', source: t.source || '', blocked: t.blocked || null, items });
  }
  return { errors, templates };
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

// ── Importación de planes desde texto con plantilla ──
// No interpreta texto libre: solo reconoce las claves de la plantilla y marca como error todo lo demás.
const MODE_ALIASES = { duracion: 'duracion', 'fecha fin': 'fecha_fin', fecha_fin: 'fecha_fin', continuo: 'continuo', pendiente: 'pendiente', descanso: 'descanso', investigacion: 'investigacion' };
export function parseImportText(text, { profiles, products }) {
  const blocks = String(text || '').split(/^\s*-{3,}\s*$/m).map((b) => b.trim()).filter(Boolean);
  const norm = (x) => String(x || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return blocks.map((block, bi) => {
    const errors = [], plan = { phases: [] };
    let profile = null, product = null;
    block.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).forEach((line, li) => {
      const m = line.match(/^([A-Za-zÁÉÍÓÚáéíóúÑñ ]+):\s*(.*)$/);
      if (!m) { errors.push(`Línea ${li + 1} no reconocida: «${line}»`); return; }
      const key = norm(m[1]), val = m[2].trim();
      if (key === 'plan') plan.name = val;
      else if (key === 'persona') { profile = profiles.find((p) => norm(p.name) === norm(val)); if (!profile) errors.push(`Persona «${val}» no existe: créala antes en Perfiles`); }
      else if (key === 'sustancia') {
        const byId = products.find((p) => p.id === val);
        const byName = products.filter((p) => norm(p.substance) === norm(val) && p.status === 'plan');
        product = byId || (byName.length === 1 ? byName[0] : null);
        if (!product) errors.push(byName.length > 1 ? `«${val}» tiene varias presentaciones: usa su código (${byName.map((p) => p.id).join(', ')})` : `Sustancia «${val}» no encontrada: usa el código que aparece en Catálogo`);
      }
      else if (key === 'inicio') plan.start = val;
      else if (key === 'fin') plan.end = val;
      else if (key === 'duracion') { const d = val.match(/^(\d+)\s*(dias?|semanas?|meses?)$/i); if (d) { plan.duration = +d[1]; plan.durationUnit = norm(d[2]).startsWith('sem') ? 'semanas' : norm(d[2]).startsWith('mes') ? 'meses' : 'dias'; } else errors.push(`Duración «${val}»: escribe p. ej. «8 semanas»`); }
      else if (key === 'modalidad') { plan.mode = MODE_ALIASES[norm(val)]; if (!plan.mode) errors.push(`Modalidad «${val}» no válida`); }
      else if (key === 'fuente') plan.source = val;
      else if (key === 'nota' || key === 'notas') plan.notes = val;
      else if (key === 'revision cada') { const n = parseInt(val, 10); if (n > 0) plan.reviewEveryDays = n; else errors.push('«Revisión cada» debe ser un número de días'); }
      else if (key === 'fase') {
        try { plan.phases.push(parsePhaseLine(val)); } catch (e) { errors.push(e.message); }
      } else errors.push(`Clave «${m[1]}» desconocida`);
    });
    if (!profile && !errors.some((e) => e.startsWith('Persona'))) errors.push('Falta «PERSONA:»');
    if (!plan.start) errors.push('Falta «INICIO:» (AAAA-MM-DD)');
    else if (!isDate(plan.start)) errors.push(`Fecha de inicio «${plan.start}» no válida (AAAA-MM-DD)`);
    if (plan.end && !isDate(plan.end)) errors.push(`Fecha final «${plan.end}» no válida`);
    plan.mode ||= plan.end ? 'fecha_fin' : plan.duration ? 'duracion' : 'pendiente';
    try { plan.phases = parsePhases(plan.phases); } catch (e) { errors.push(e.message); }
    if (plan.phases.length && (plan.duration || plan.end)) {
      const end = planEnd({ ...plan }); const weeks = Math.ceil((diffDays(plan.start, end) + 1) / 7);
      if (plan.phases.some((f) => (f.toWeek ?? f.fromWeek) > weeks)) errors.push(`Hay fases que pasan de la semana ${weeks}, donde termina el plan`);
    }
    return { index: bi + 1, profile, product, plan: { ...plan, productId: product?.id || '' }, errors };
  });
}
export async function importPlans(model, parsed) {
  if (parsed.some((p) => p.errors.length)) throw new ValidationError('Corrige los errores antes de importar');
  const out = [];
  for (const p of parsed) out.push(await model.addPlan(p.profile.id, { ...p.plan, enteredBy: 'Importación de texto', source: p.plan.source || 'Importación de texto' }));
  return out;
}
