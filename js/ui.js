// Utilidades de interfaz.
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const fmtNum = (n, d = 2) => (n == null || Number.isNaN(n) ? '—' : Number(n).toLocaleString('es-ES', { maximumFractionDigits: d }));
export const fmtDate = (s) => { if (!s) return '—'; const [y, m, d] = s.slice(0, 10).split('-'); return `${d}/${m}/${y}`; };

export function toast(msg, ms = 3000) {
  const t = document.createElement('div');
  t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
  document.body.append(t); setTimeout(() => t.remove(), ms);
}

// Lee un formulario: name="x" → valor; checkbox → boolean; multiple con data-multi → array.
export function readForm(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.dataset.multi !== undefined) { (out[el.name] ||= []); if (el.checked) out[el.name].push(el.value); continue; }
    if (el.type === 'checkbox') out[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
    else out[el.name] = el.value.trim();
  }
  return out;
}

export function dialog(html, { onSubmit, onOpen } = {}) {
  const d = document.getElementById('dlg');
  d.innerHTML = html;
  const form = d.querySelector('form');
  return new Promise((resolve) => {
    const close = (v) => { d.close(); resolve(v); };
    d.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => close(null)));
    if (form) form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try { const r = onSubmit ? await onSubmit(readForm(form), form) : readForm(form); if (r !== false) close(r ?? true); }
      catch (err) { showErr(form, err); }
    });
    d.addEventListener('cancel', () => resolve(null), { once: true });
    d.showModal();
    onOpen?.(d);
  });
}

export function showErr(form, err) {
  let e = form.querySelector('.err');
  if (!e) { e = document.createElement('p'); e.className = 'err'; e.setAttribute('role', 'alert'); form.prepend(e); }
  e.textContent = err.message || String(err);
  e.scrollIntoView({ block: 'center' });
}

export function download(name, content, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export const opt = (value, label, sel) => `<option value="${esc(value)}"${String(sel) === String(value) ? ' selected' : ''}>${esc(label)}</option>`;
export const field = (label, input, req = false) => `<label>${esc(label)}${req ? '<span class="req-mark" aria-hidden="true"> *</span>' : ''}${input}</label>`;
export const inp = (name, value = '', attrs = '') => `<input name="${name}" value="${esc(value)}" ${attrs}>`;

// Gráfico de líneas sencillo (SVG) para el peso.
export function lineChart(points, { unit = 'kg', height = 180 } = {}) {
  if (points.length < 2) return '<p class="muted">Hacen falta al menos dos pesajes para el gráfico.</p>';
  const W = 600, H = height, P = 34;
  const xs = points.map((p) => Date.parse(p.date)), ys = points.map((p) => p.value);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const sx = (x) => P + ((x - x0) / (x1 - x0 || 1)) * (W - 2 * P);
  const sy = (y) => H - P + 10 - ((y - y0) / (y1 - y0 || 1)) * (H - 2 * P);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${sx(Date.parse(p.date)).toFixed(1)},${sy(p.value).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolución del peso">
    <line x1="${P}" y1="${H - P + 10}" x2="${W - P}" y2="${H - P + 10}" stroke="currentColor" opacity=".3"/>
    <text x="4" y="${sy(y1) + 4}" font-size="13" fill="currentColor">${fmtNum(y1, 1)}</text>
    <text x="4" y="${sy(y0) + 4}" font-size="13" fill="currentColor">${fmtNum(y0, 1)}</text>
    <path d="${d}" fill="none" stroke="var(--accent)" stroke-width="3"/>
    ${points.map((p) => `<circle cx="${sx(Date.parse(p.date))}" cy="${sy(p.value)}" r="4" fill="var(--accent)"><title>${fmtDate(p.date)}: ${fmtNum(p.value, 1)} ${unit}</title></circle>`).join('')}
    <text x="${P}" y="${H - 2}" font-size="13" fill="currentColor">${fmtDate(points[0].date)}</text>
    <text x="${W - P}" y="${H - 2}" font-size="13" fill="currentColor" text-anchor="end">${fmtDate(points[points.length - 1].date)}</text>
  </svg>`;
}
