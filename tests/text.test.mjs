import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmtDoc, parseFicha, fichaHTML, splitFichas } from '../js/text.js';

// Texto neutro inventado para la prueba (el repositorio es público: nunca protocolos reales).
const FICHA = `1. Sustancia A (Grupo 1)
 * Nombre del protocolo: Sustancia A — Ejemplo de prueba
 * Definición clínica en lenguaje accesible: Texto de definición de ejemplo.
 * Duración total: 6 semanas exactas.
 * Fases:
   * Fase 1 (Semanas 1 a 2 — Inicio): 1 unidad, unidades, 1 vez por semana (ejemplo).
   * Fase 2 (Semanas 3 a 6 — Continuación): 2 unidades, unidades, 1 vez por semana (ejemplo).
 * Descanso o PCT después: Descanso de ejemplo:
   * Semanas 1 y 2 posteriores: texto de ejemplo.
 * Notas y advertencias: Nota de ejemplo literal. Notación NAD^+ y otras.
2. Sustancia B (Grupo 2)
 * Fases:
   * Fase Única (Semanas 1 a 4): 3 unidades (0.3 u), unidades, 3 veces por semana.`;

test('ficha: se maqueta sin cambiar el texto', () => {
  const [a, b] = splitFichas(FICHA);
  assert.match(b, /^2\. Sustancia B/);
  const f = parseFicha(a);
  assert.equal(f.title, '1. Sustancia A (Grupo 1)');
  const fases = f.fields.find((x) => x.key === 'Fases');
  assert.deepEqual(fases.items[0], { label: 'Fase 1 (Semanas 1 a 2 — Inicio)', value: '1 unidad, unidades, 1 vez por semana (ejemplo).' });
  const h = fichaHTML(a);
  for (const s of ['Texto de definición de ejemplo.', '6 semanas exactas.', 'texto de ejemplo.', 'Nota de ejemplo literal.', 'NAD⁺']) assert.ok(h.includes(s), s);
  assert.ok(fichaHTML(b).includes('3 unidades (0.3 u), unidades, 3 veces por semana.'));
});
test('documento: títulos, viñetas anidadas, tablas y notación', () => {
  const doc = `PARTE 2: Cronogramas\n👨 Cronograma de ejemplo\n * Sustancia A: Semanas 1 a 2 (1 u) \\rightarrow Semanas 3 a 6 (2 u)\n| Semana | A |\n|---|---|\n| Semana 1 | 1 u |\nPARTE 3: Reglas\n * Regla de ejemplo:\n   Texto de continuación de la regla.\n` + FICHA;
  const { html, toc } = fmtDoc(doc);
  assert.deepEqual(toc.map((t) => t.level), [2, 3, 2, 3, 3]);
  assert.ok(html.includes('(1 u) → Semanas'));
  assert.ok(html.includes('<th scope="row">Semana 1</th><td>1 u</td>'));
  assert.ok(!html.includes('|---|'));
  assert.ok(html.includes('Texto de continuación de la regla.'));
  assert.equal((html.match(/<ul/g) || []).length, (html.match(/<\/ul>/g) || []).length);
  assert.ok(!/[<>]script/.test(fmtDoc('<script>x</script>').html));
});
