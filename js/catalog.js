// Catálogo importado de tabla_maestra_inteligente_powpills_revision_20261012_1830 (copia en texto).
// Solo datos de presentación declarados en el libro. Ninguna cifra es una cantidad de administración.
// status: plan = plan de compra vigente · historico = plan anterior · alternativa = equivalencia aceptada
//         mercado = presentación vista solo en ofertas · adicional = producto fuera de los 21 (tópico, cosmético, combinación)
export const CATALOG_SOURCE = 'tabla_maestra_inteligente_powpills_revision_20261012_1830.xlsx (copia en texto, auditada 13-oct-2026)';

const RUO = true;
const k = (o) => ({
  brands: [], concentration: null, rx: false, research: false, review: [], confidence: 'media',
  unitLabel: 'vial', unitContentUnit: 'mg', ...o,
});

export const CATALOG = [
  // ── Péptidos (kits de 10 viales) ──
  k({ id: 'reta15', substance: 'Retatrutida', active: 'Retatrutida', category: 'peptido', form: 'Vial liofilizado', unitContent: 15, unitsPerPack: 10, status: 'plan', research: RUO, excelId: 2, source: 'Productos fila 6 (ID 2)', confidence: 'alta', review: ['Algunas fuentes la anuncian con el alias «GLP-3» (Ofertas fila 137)'] }),
  k({ id: 'reta30', substance: 'Retatrutida', active: 'Retatrutida', category: 'peptido', form: 'Vial liofilizado', unitContent: 30, unitsPerPack: 10, status: 'plan', research: RUO, excelId: 3, source: 'Productos fila 7 (ID 3)', confidence: 'alta' }),
  k({ id: 'reta10m', substance: 'Retatrutida', active: 'Retatrutida', category: 'peptido', form: 'Vial liofilizado', unitContent: 10, unitsPerPack: 10, status: 'mercado', research: RUO, source: 'Ofertas filas 22, 130 (no forma parte del plan)', confidence: 'media' }),
  k({ id: 'reta20m', substance: 'Retatrutida', active: 'Retatrutida', category: 'peptido', form: 'Vial liofilizado', unitContent: 20, unitsPerPack: 10, status: 'mercado', research: RUO, source: 'Ofertas filas 45, 131 (no forma parte del plan)', confidence: 'media' }),
  k({ id: 'pt141', substance: 'PT-141', active: 'Bremelanotida', category: 'peptido', form: 'Vial liofilizado', unitContent: 10, unitsPerPack: 10, status: 'plan', research: RUO, excelId: 4, source: 'Productos fila 8 (ID 4)', confidence: 'alta' }),
  k({ id: 'bpc5', substance: 'BPC-157', active: 'BPC-157', category: 'peptido', form: 'Vial liofilizado', unitContent: 5, unitsPerPack: 10, status: 'plan', research: RUO, excelId: 5, source: 'Productos fila 9 (ID 5)', confidence: 'alta' }),
  k({ id: 'bpc10m', substance: 'BPC-157', active: 'BPC-157', category: 'peptido', form: 'Vial liofilizado', unitContent: 10, unitsPerPack: 10, status: 'mercado', research: RUO, source: 'Ofertas filas 43–44 (no forma parte del plan)', confidence: 'media' }),
  k({ id: 'tb5', substance: 'TB-500', active: 'TB-500 (fragmento de timosina β4, según vendedor)', category: 'peptido', form: 'Vial liofilizado', unitContent: 5, unitsPerPack: 10, status: 'plan', research: RUO, excelId: 6, source: 'Productos fila 10 (ID 6)', confidence: 'alta', review: ['La composición exacta de «TB-500» varía entre vendedores; no está estandarizada'] }),
  k({ id: 'bpctb', substance: 'Mezcla BPC-157 + TB-500', active: 'BPC-157 5 mg + TB-500 5 mg por vial', category: 'peptido', form: 'Vial liofilizado (mezcla)', unitContent: null, unitsPerPack: 10, status: 'mercado', research: RUO, source: 'Ofertas fila 132', confidence: 'media', review: ['Mezcla: no equivale a ninguno de los dos productos por separado; contenido por componente, no total'] }),
  k({ id: 'kiss10', substance: 'Kisspeptin-10', active: 'Kisspeptina-10', category: 'peptido', form: 'Vial liofilizado', unitContent: 10, unitsPerPack: 10, status: 'plan', research: RUO, excelId: 7, source: 'Productos fila 11 (ID 7)', confidence: 'alta' }),
  k({ id: 'epi10', substance: 'Epithalon', active: 'Epitalón (tetrapéptido)', category: 'peptido', form: 'Vial liofilizado', unitContent: 10, unitsPerPack: 10, status: 'plan', research: RUO, excelId: 8, source: 'Productos fila 12 (ID 8)', confidence: 'alta' }),
  k({ id: 'epi50m', substance: 'Epithalon', active: 'Epitalón (tetrapéptido)', category: 'peptido', form: 'Vial liofilizado', unitContent: 50, unitsPerPack: 1, status: 'mercado', research: RUO, source: 'Ofertas fila 120 (vial suelto)', confidence: 'media' }),
  k({ id: 'mots10', substance: 'MOTS-c', active: 'MOTS-c', category: 'peptido', form: 'Vial liofilizado', unitContent: 10, unitsPerPack: 10, status: 'plan', research: RUO, excelId: 9, source: 'Productos fila 13 (ID 9)', confidence: 'alta' }),
  k({ id: 'mots40m', substance: 'MOTS-c', active: 'MOTS-c', category: 'peptido', form: 'Vial liofilizado', unitContent: 40, unitsPerPack: 10, status: 'mercado', research: RUO, source: 'Ofertas fila 50 (no forma parte del plan)', confidence: 'media' }),
  k({ id: 'tesa10', substance: 'Tesamorelin', active: 'Tesamorelina', category: 'peptido', form: 'Vial liofilizado', unitContent: 10, unitsPerPack: 10, status: 'plan', research: RUO, excelId: 10, source: 'Productos fila 14 (ID 10)', confidence: 'alta' }),
  k({ id: 'ptd5', substance: 'PTD-DBM', active: 'PTD-DBM', category: 'peptido', form: 'Vial liofilizado', unitContent: 5, unitsPerPack: 10, status: 'plan', research: RUO, excelId: 19, source: 'Productos fila 23 (ID 19)', confidence: 'media', review: ['Los 5 mg/vial solo constan en el título del anuncio (VK Global): confirmar con la etiqueta'] }),
  k({ id: 'testa20', substance: 'Testagen', active: 'Testagen (péptido corto, según vendedor)', category: 'peptido', form: 'Vial liofilizado', unitContent: 20, unitsPerPack: 10, status: 'plan', research: RUO, excelId: 20, source: 'Productos fila 24 (ID 20)', confidence: 'alta' }),
  k({ id: 'testa10m', substance: 'Testagen', active: 'Testagen (péptido corto, según vendedor)', category: 'peptido', form: 'Vial liofilizado', unitContent: 10, unitsPerPack: 10, status: 'mercado', research: RUO, source: 'Ofertas fila 19 (no forma parte del plan)', confidence: 'media' }),
  k({ id: 'amq50', substance: '5-Amino-1MQ', active: '5-Amino-1-metilquinolinio', category: 'peptido', form: 'Vial', unitContent: 50, unitsPerPack: 10, status: 'plan', research: RUO, excelId: 21, source: 'Productos fila 25 (ID 21)', confidence: 'alta', review: ['No es un péptido; el libro lo clasifica con los kits de viales'] }),

  // ── SARM ──
  k({ id: 'osta25', substance: 'Ostarina (MK-2866)', active: 'Enobosarm', category: 'sarm', form: 'Tableta', unitLabel: 'tableta', unitContent: 25, unitsPerPack: 300, status: 'plan', research: RUO, excelId: 1, source: 'Productos fila 5 (ID 1)', confidence: 'alta', review: ['Se compra como 3 envases de 100 tabletas'] }),
  k({ id: 'lgd10', substance: 'Ligandrol (LGD-4033)', active: 'Ligandrol', category: 'sarm', form: 'Tableta', unitLabel: 'tableta', unitContent: 10, unitsPerPack: 100, status: 'plan', research: RUO, excelId: 18, source: 'Productos fila 22 (ID 18)', confidence: 'alta' }),

  // ── Orales (medicamentos con receta en la UE según el libro) ──
  k({ id: 'minox5', substance: 'Minoxidil oral', active: 'Minoxidil', brands: ['Minoxytop 5', 'Lonitab 5', 'Minjuv 5'], category: 'oral', form: 'Tableta', unitLabel: 'tableta', unitContent: 5, unitsPerPack: 100, status: 'plan', rx: true, excelId: 11, source: 'Productos fila 15 (ID 11)', confidence: 'alta' }),
  k({ id: 'iver6', substance: 'Ivermectina', active: 'Ivermectina', brands: ['Iverheal 6'], category: 'oral', form: 'Tableta', unitLabel: 'tableta', unitContent: 6, unitsPerPack: 300, status: 'plan', rx: true, excelId: 12, source: 'Productos fila 16 (ID 12) — equivalencia aceptada 12-oct-2026', confidence: 'alta' }),
  k({ id: 'iver12', substance: 'Ivermectina', active: 'Ivermectina', brands: ['Covimectin 12', 'Iverheal 12'], category: 'oral', form: 'Tableta', unitLabel: 'tableta', unitContent: 12, unitsPerPack: 300, status: 'alternativa', rx: true, excelId: 12, source: 'Productos fila 16 (ID 12) — alternativa 12 mg', confidence: 'alta' }),
  k({ id: 'iver5h', substance: 'Ivermectina', active: 'Ivermectina', category: 'oral', form: 'Tableta', unitLabel: 'tableta', unitContent: 5, unitsPerPack: 300, status: 'historico', rx: true, excelId: 12, source: 'Productos fila 16, presentación QSC original', confidence: 'alta' }),
  k({ id: 'duta05', substance: 'Dutasterida', active: 'Dutasterida', brands: ['Duprost 0,5', 'Dutas 0,5'], category: 'oral', form: 'Cápsula', unitLabel: 'cápsula', unitContent: 0.5, unitsPerPack: 200, status: 'plan', rx: true, excelId: 13, source: 'Productos fila 17 (ID 13) — equivalencia aceptada', confidence: 'alta', review: ['Se compra como 2 envases de 100 cápsulas'] }),
  k({ id: 'duta1h', substance: 'Dutasterida', active: 'Dutasterida', category: 'oral', form: 'Tableta', unitLabel: 'tableta', unitContent: 1, unitsPerPack: 100, status: 'historico', rx: true, excelId: 13, source: 'Productos fila 17, presentación QSC original', confidence: 'alta' }),
  k({ id: 'fina1', substance: 'Finasterida', active: 'Finasterida', brands: ['Finpecia 1', 'Finax 1'], category: 'oral', form: 'Tableta', unitLabel: 'tableta', unitContent: 1, unitsPerPack: 150, status: 'plan', rx: true, excelId: 14, source: 'Productos fila 18 (ID 14) — paquete real de 150', confidence: 'alta' }),
  k({ id: 'fina1h', substance: 'Finasterida', active: 'Finasterida', category: 'oral', form: 'Tableta', unitLabel: 'tableta', unitContent: 1, unitsPerPack: 100, status: 'historico', rx: true, excelId: 14, source: 'Productos fila 18, presentación QSC', confidence: 'alta' }),
  k({ id: 'dapo30', substance: 'Dapoxetina', active: 'Dapoxetina', brands: ['Dapoforce 30', 'Poxet 30', 'Duralast 30'], category: 'oral', form: 'Tableta', unitLabel: 'tableta', unitContent: 30, unitsPerPack: 100, status: 'plan', rx: true, excelId: 15, source: 'Productos fila 19 (ID 15)', confidence: 'alta' }),
  k({ id: 'dapo60m', substance: 'Dapoxetina', active: 'Dapoxetina', category: 'oral', form: 'Tableta', unitLabel: 'tableta', unitContent: 60, unitsPerPack: 150, status: 'mercado', rx: true, source: 'Ofertas fila 189 (no comparable)', confidence: 'media' }),
  k({ id: 'tada40', substance: 'Tadalafilo', active: 'Tadalafilo', brands: ['Vidalista 40', 'Tadarise 40', 'Tadalista 40', 'Actilis Double 40', 'Tadadel 40'], category: 'oral', form: 'Tableta', unitLabel: 'tableta', unitContent: 40, unitsPerPack: 300, status: 'plan', rx: true, excelId: 16, source: 'Productos fila 20 (ID 16) — plan desde 12-oct-2026', confidence: 'alta' }),
  k({ id: 'tada20h', substance: 'Tadalafilo', active: 'Tadalafilo', brands: ['Vidalista 20', 'Tadarise 20', 'Tadagra'], category: 'oral', form: 'Tableta', unitLabel: 'tableta', unitContent: 20, unitsPerPack: 1500, status: 'historico', rx: true, excelId: 16, source: 'Productos fila 20, plan anterior (20 mg × 1.500)', confidence: 'alta' }),
  k({ id: 'clomi50', substance: 'Clomifeno', active: 'Citrato de clomifeno', brands: ['Fertomid 50'], category: 'oral', form: 'Tableta', unitLabel: 'tableta', unitContent: 50, unitsPerPack: 100, status: 'plan', rx: true, excelId: 17, source: 'Productos fila 21 (ID 17)', confidence: 'alta' }),

  // ── Adicionales ──
  k({ id: 'tadadapo', substance: 'Tadalafilo + dapoxetina', active: 'Tadalafilo 10 mg + dapoxetina 30 mg por tableta', category: 'combinacion', form: 'Tableta combinada', unitLabel: 'tableta', unitContent: null, unitsPerPack: 120, status: 'adicional', rx: true, source: 'Ofertas fila 138 (PowPills, «Extra»)', confidence: 'media', review: ['Combinación: contenido por componente, no comparable con las tabletas sueltas'] }),
  k({ id: 'folig5', substance: 'Minoxidil tópico 5 % (Foligain)', active: 'Minoxidil', brands: ['Foligain'], category: 'topico', form: 'Solución tópica', unitLabel: 'frasco', unitContentUnit: 'ml', unitContent: 60, unitsPerPack: 3, concentration: '5 % p/v (declarado)', status: 'adicional', source: 'Cosméticos UE 11-Oct-2026 fila 6 (SKU 30043272)', confidence: 'media', review: ['Clasificación regulatoria del SKU no confirmada (la web lo pone en cosmética)', 'La concentración comercial no es una cantidad de aplicación'] }),
  k({ id: 'folig5la', substance: 'Minoxidil tópico 5 % low alcohol (Foligain)', active: 'Minoxidil', brands: ['Foligain N5'], category: 'topico', form: 'Solución tópica', unitLabel: 'frasco', unitContentUnit: 'ml', unitContent: 60, unitsPerPack: 3, concentration: '5 % p/v (declarado)', status: 'adicional', source: 'Pistas descartadas fila 32; Regulatorio 11-Oct-2026 fila 11', confidence: 'media', review: ['Precio discrepante €36,50 / €36,90', 'Clasificación del SKU no confirmada'] }),
  k({ id: 'foligtri', substance: 'Minoxidil 5 % + trioxidil 5 % (Foligain)', active: 'Minoxidil + trioxidil', brands: ['Foligain'], category: 'topico', form: 'Solución tópica', unitLabel: 'frasco', unitContentUnit: 'ml', unitContent: 59, unitsPerPack: 1, concentration: 'Minoxidil 5 % + trioxidil 5 % (declarado)', status: 'adicional', source: 'Control ronda 11-Oct-2026 C fila 11', confidence: 'media', review: ['Fórmula distinta de los otros Foligain'] }),
  k({ id: 'ghk10', substance: 'GHK-Cu concentrado cosmético 5 %', active: 'Copper Tripeptide-1', brands: ['Ellemental M-1721'], category: 'cosmetico', form: 'Concentrado para formulación', unitLabel: 'envase', unitContentUnit: 'g', unitContent: 10, unitsPerPack: 1, concentration: '5 % (50.000 ppm, declarado)', status: 'adicional', source: 'Cosméticos UE 11-Oct-2026 fila 4', confidence: 'media', review: ['El 5 % se asume masa/masa en el libro; no confirmado', 'Ingrediente para formular, no producto terminado'] }),
  k({ id: 'ghk100', substance: 'GHK-Cu concentrado cosmético 5 %', active: 'Copper Tripeptide-1', brands: ['Ellemental M-1721-0.1'], category: 'cosmetico', form: 'Concentrado para formulación', unitLabel: 'envase', unitContentUnit: 'g', unitContent: 100, unitsPerPack: 1, concentration: '5 % (50.000 ppm, declarado)', status: 'adicional', source: 'Cosméticos UE 11-Oct-2026 fila 5', confidence: 'media', review: ['El 5 % se asume masa/masa en el libro; no confirmado'] }),
  // ── De tu protocolo (13-oct-2026): presentaciones que no están en la tabla maestra ──
  k({ id: 'rad10', substance: 'RAD-140 (testolona)', active: 'Testolona (RAD-140)', category: 'sarm', form: 'Tableta o líquido oral', unitLabel: 'dosis', unitContent: 10, unitsPerPack: null, status: 'protocolo', research: RUO, source: 'Protocolo del usuario, ficha 8', confidence: 'baja', review: ['Presentación según tu texto: «Tabletas o líquido oral, 10 mg/dosis»; envase sin especificar'] }),
  k({ id: 'osta10', substance: 'Ostarina (MK-2866)', active: 'Enobosarm', category: 'sarm', form: 'Tableta', unitLabel: 'tableta', unitContent: 10, unitsPerPack: null, status: 'protocolo', research: RUO, source: 'Protocolo del usuario, ficha 9', confidence: 'baja', review: ['Envase sin especificar en tu texto'] }),
  k({ id: 'ghk50i', substance: 'GHK-Cu inyectable', active: 'Tripéptido de cobre (GHK-Cu)', category: 'peptido', form: 'Vial liofilizado', unitContent: 50, unitsPerPack: 10, status: 'protocolo', research: RUO, source: 'Protocolo del usuario, ficha 16', confidence: 'baja' }),
  k({ id: 'amq50cap', substance: '5-Amino-1MQ', active: '5-Amino-1-metilquinolinio', category: 'peptido', form: 'Cápsula oral', unitLabel: 'cápsula', unitContent: 50, unitsPerPack: null, status: 'protocolo', research: RUO, source: 'Protocolo del usuario, ficha 22', confidence: 'baja', review: ['Envase sin especificar en tu texto'] }),
  k({ id: 'citru500', substance: 'L-Citrulina', active: 'L-Citrulina', category: 'suplemento', form: 'Polvo', unitLabel: 'bote', unitContentUnit: 'g', unitContent: 500, unitsPerPack: 1, status: 'protocolo', source: 'Protocolo del usuario, ficha 12', confidence: 'media', review: ['Tu texto también menciona bote de 1 kg'] }),
  k({ id: 'crea500', substance: 'Creatina monohidrato', active: 'Creatina monohidrato micronizada', category: 'suplemento', form: 'Polvo', unitLabel: 'bote', unitContentUnit: 'g', unitContent: 500, unitsPerPack: 1, status: 'protocolo', source: 'Protocolo del usuario, ficha 13', confidence: 'media' }),
  k({ id: 'd3k2', substance: 'Vitamina D3 + K2 (MK-7)', active: 'Colecalciferol + menaquinona-7', category: 'suplemento', form: 'Cápsula combinada', unitLabel: 'cápsula', unitContent: null, unitsPerPack: null, concentration: '5000 UI D3 + 100 mcg K2 por cápsula (declarado en tu texto)', status: 'protocolo', source: 'Protocolo del usuario, ficha 14', confidence: 'media' }),
  k({ id: 'electro', substance: 'Electrolitos (sodio + potasio + magnesio)', active: 'Sales de sodio, potasio y citrato de magnesio', category: 'suplemento', form: 'Polvo sin azúcar o cápsulas', unitLabel: 'toma', unitContent: null, unitsPerPack: null, concentration: '500 mg Na + 200 mg K + 200 mg citrato de Mg por toma (según tu texto)', status: 'protocolo', source: 'Protocolo del usuario, ficha 15', confidence: 'media' }),
];

export const CATEGORY_LABEL = {
  peptido: 'Péptido / vial de investigación', sarm: 'SARM (investigación)', oral: 'Oral', combinacion: 'Combinación oral',
  topico: 'Tópico', cosmetico: 'Cosmético', suplemento: 'Suplemento / nutriente', custom: 'Añadido por el usuario',
};
export const STATUS_LABEL = { plan: 'Plan actual', alternativa: 'Alternativa aceptada', historico: 'Plan anterior', mercado: 'Vista en ofertas', adicional: 'Producto adicional', protocolo: 'De tu protocolo', custom: 'Añadido por el usuario' };
export const RUO_LABEL = 'Sustancia de investigación — no apta para uso humano';

// Entradas del libro que NO se importan como presentación (registradas en la auditoría):
export const NOT_IMPORTED = [
  'API/materia prima a granel (dutasterida 5 g, finasterida 1 kg, tadalafilo 1 kg, minoxidil 1 kg; PT-141 y PTD-DBM en polvo por gramo): no son presentaciones de uso personal.',
  'Viales sueltos minoristas de la misma potencia que el plan (Crystal Peptides, Peptnova, Peptides Direct): misma sustancia y potencia ya catalogadas.',
  'Anuncios con potencia o número de viales sin especificar (Huaian Banting, Yiwu, Hebei Jiafan…): datos insuficientes.',
  'Combinación minoxidil + finasterida: no aparece en ninguna hoja del libro.',
];

export function totalActive(p) {
  return (typeof p.unitContent === 'number' && typeof p.unitsPerPack === 'number' && p.unitContentUnit === 'mg')
    ? +(p.unitContent * p.unitsPerPack).toFixed(3) : null;
}
export function presentation(p) {
  const fmt = (n) => String(n).replace('.', ',');
  if (p.unitContent == null) return `${p.unitsPerPack != null ? p.unitsPerPack + ' ' + (p.unitLabel === 'vial' ? 'viales' : p.unitLabel + 's') + ' — ' : ''}${p.concentration || p.active}`;
  if (p.unitsPerPack == null) return `${fmt(p.unitContent)} ${p.unitContentUnit}/${p.unitLabel} · envase sin especificar`;
  return `${fmt(p.unitContent)} ${p.unitContentUnit}/${p.unitLabel} × ${p.unitsPerPack}${p.concentration ? ' · ' + p.concentration : ''}`;
}
