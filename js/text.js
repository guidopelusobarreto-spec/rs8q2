// Presentación del texto literal del usuario: no se resume ni se cambia ninguna palabra; solo se maqueta.
import { esc } from './ui.js';

// Notación tipo LaTeX/markdown que aparece en el texto pegado.
export function cleanInline(s) {
  return esc(s)
    .replace(/\\rightarrow|\\to\b/g, '→').replace(/\\leftarrow/g, '←')
    .replace(/\^\+/g, '⁺').replace(/\^-/g, '⁻').replace(/\^2\b/g, '²').replace(/\^3\b/g, '³')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}
// «Clave: valor» al inicio de una viñeta → clave en negrita (solo claves cortas).
const keyed = (s) => {
  const m = s.match(/^([^:]{2,60}?):\s+(.*)$/s);
  return m && !/[.;]/.test(m[1]) ? `<strong>${cleanInline(m[1])}:</strong> ${cleanInline(m[2])}` : cleanInline(s);
};
const slug = (s, i) => 'sec-' + i + '-' + String(s).toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').slice(0, 30);

// Documento completo: títulos, viñetas anidadas, tablas «| a | b |». Devuelve el HTML y el índice.
export function fmtDoc(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const out = [], toc = [];
  let list = [], para = null; // pila de niveles de lista abiertos
  const closeLists = (to = 0) => { while (list.length > to) { out.push('</li></ul>'); list.pop(); } };
  const flushPara = () => { if (para) { out.push(`<p>${para.join(' ')}</p>`); para = null; } };
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i], line = raw.trim();
    if (!line) { flushPara(); continue; }
    if (/^\|/.test(line)) {
      flushPara(); closeLists();
      const rows = [];
      for (; i < lines.length && /^\s*\|/.test(lines[i]); i++) if (!/^\s*\|[\s\-:|]+\|\s*$/.test(lines[i])) rows.push(lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
      i--;
      out.push(`<div class="table-wrap doc-table"><table><thead><tr>${rows[0].map((c) => `<th>${cleanInline(c)}</th>`).join('')}</tr></thead><tbody>${rows.slice(1).map((r) => `<tr>${r.map((c, k) => (k ? `<td>${cleanInline(c)}</td>` : `<th scope="row">${cleanInline(c)}</th>`)).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    const h2 = /^PARTE\s+\d+\s*[:.]/i.test(line);
    const h3 = !h2 && (/^\d+\.\s+\S/.test(raw) || /^\p{Extended_Pictographic}/u.test(line));
    if (h2 || h3) {
      flushPara(); closeLists();
      const id = slug(line, toc.length);
      toc.push({ id, level: h2 ? 2 : 3, text: line });
      out.push(`<h${h2 ? 2 : 3} id="${id}" class="doc-h">${cleanInline(line)}</h${h2 ? 2 : 3}>`);
      continue;
    }
    const b = raw.match(/^(\s*)\*\s+(.*)$/);
    if (b) {
      flushPara();
      const lvl = b[1].length <= 1 ? 1 : b[1].length <= 4 ? 2 : 3;
      if (list.length >= lvl) { closeLists(lvl); out.push('</li><li>'); }
      else while (list.length < lvl) { out.push(list.length ? '<ul><li>' : '<ul class="doc-list"><li>'); list.push(lvl); }
      out.push(keyed(b[2]));
      continue;
    }
    if (list.length && /^\s+\S/.test(raw)) { out.push(`<span class="cont">${cleanInline(line)}</span>`); continue; } // continuación de viñeta
    closeLists();
    (para ||= []).push(cleanInline(line));
  }
  flushPara(); closeLists();
  return { html: out.join(''), toc };
}

// Una ficha numerada («3. Kisspeptin-10 (Hombres)» + « * Clave: valor» + sub-viñetas).
export function parseFicha(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const f = { title: '', fields: [] };
  for (const raw of lines) {
    if (!raw.trim()) continue;
    const top = raw.match(/^\s?\*\s+(.*)$/), sub = raw.match(/^\s{2,}\*\s+(.*)$/);
    if (!f.title && !top && !sub) { f.title = raw.trim(); continue; }
    if (sub && f.fields.length) {
      const m = sub[1].match(/^(.*?):\s+(.*)$/s);
      f.fields[f.fields.length - 1].items.push(m ? { label: m[1], value: m[2] } : { label: '', value: sub[1] });
    } else if (top) {
      const m = top[1].match(/^([^:]{2,80}?):\s*(.*)$/s);
      f.fields.push({ key: m ? m[1].trim() : '', value: m ? m[2] : top[1], items: [] });
    } else if (f.fields.length) f.fields[f.fields.length - 1].value += ' ' + raw.trim();
  }
  return f;
}
export const splitFichas = (t) => String(t || '').split(/\n+(?=\d+\.\s)/).map((x) => x.trim()).filter(Boolean);

// Ficha maquetada: definición visible, fases en tabla con la línea literal, descanso/PCT y advertencias en recuadros.
export function fichaHTML(text) {
  const f = parseFicha(text);
  const get = (re) => f.fields.filter((x) => re.test(x.key));
  const used = new Set();
  const take = (re) => { const r = get(re); r.forEach((x) => used.add(x)); return r; };
  const val = (x) => cleanInline(x.value);
  const items = (x) => (x.items.length ? `<ul class="doc-list">${x.items.map((it) => `<li>${it.label ? `<strong>${cleanInline(it.label)}:</strong> ` : ''}${cleanInline(it.value)}</li>`).join('')}</ul>` : '');
  const name = take(/^Nombre del protocolo/i)[0];
  const pres = take(/^Sustancia y presentaci/i)[0];
  const def = take(/^Definici/i)[0];
  const dur = take(/^Duraci/i)[0];
  const fases = take(/^Fases/i)[0];
  const rest = take(/^Descanso|PCT/i)[0];
  const notes = take(/^Notas/i);
  const others = f.fields.filter((x) => !used.has(x));
  return `<article class="ficha">
    <h2 class="ficha-t">${cleanInline(f.title)}</h2>
    ${name ? `<p class="ficha-name">${val(name)}</p>` : ''}
    ${pres ? `<p class="small"><strong>${cleanInline(pres.key)}:</strong> ${val(pres)}</p>` : ''}
    ${dur ? `<p><span class="chip">${cleanInline(dur.key)}: ${val(dur)}</span></p>` : ''}
    ${def ? `<section class="box"><h3>${cleanInline(def.key)}</h3><p>${val(def)}</p></section>` : ''}
    ${fases ? `<section class="box"><h3>${cleanInline(fases.key)}</h3>${fases.value ? `<p>${val(fases)}</p>` : ''}
      <div class="table-wrap"><table class="phases"><tbody>${fases.items.map((it) => `<tr><th scope="row">${cleanInline(it.label)}</th><td>${cleanInline(it.value)}</td></tr>`).join('')}</tbody></table></div></section>` : ''}
    ${rest ? `<section class="box info"><h3>${cleanInline(rest.key)}</h3><p>${val(rest)}</p>${items(rest)}</section>` : ''}
    ${notes.map((n) => `<section class="box warn"><h3>${cleanInline(n.key)}</h3><p>${val(n)}</p>${items(n)}</section>`).join('')}
    ${others.map((o) => `<section class="box"><h3>${cleanInline(o.key || 'Nota')}</h3><p>${val(o)}</p>${items(o)}</section>`).join('')}
  </article>`;
}
