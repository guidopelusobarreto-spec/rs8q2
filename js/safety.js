// Información de seguridad verificada el 13-oct-2026. Cada efecto viene de la fuente indicada.
// No hay umbrales de cantidad, dosis ni relación dosis-síntoma: la app no los genera.
export const CONSULTED = '13-oct-2026';

const MEDLINE = (id, name) => ({ name, url: `https://medlineplus.gov/druginfo/meds/${id}.html`, type: 'Ficha para pacientes (NIH MedlinePlus)' });

// verification: 'verificado' = leído en la fuente; 'titulo' = solo título/resumen; 'insuficiente' = no hay datos fiables
export const SAFETY = {
  'Retatrutida': {
    warning: 'Sustancia en investigación: no tiene autorización de comercialización en la UE (la página de la EMA localizada en el libro corresponde a un plan de investigación pediátrica, no a una autorización).',
    context: 'Ensayo de fase 2 en adultos con obesidad (338 participantes, 48 semanas), con producto farmacéutico del fabricante y supervisión médica. No describe productos de investigación comprados a terceros.',
    sources: [
      { name: 'Jastreboff AM et al. Triple-Hormone-Receptor Agonist Retatrutide for Obesity — A Phase 2 Trial. N Engl J Med 2023', url: 'https://doi.org/10.1056/NEJMoa2301972', type: 'Ensayo clínico (resumen leído vía Europe PMC)' },
      { name: 'PACE-CME: resultados del ensayo de fase 2', url: 'https://pace-cme.org/news/results-of-phase-2-trial-with-gip-glp-1-and-glucagon-receptor-agonist-to-treat-obesity/2456473/', type: 'Resumen médico del ensayo' },
    ],
    effects: [
      { name: 'Náuseas', desc: 'Sensación de malestar en el estómago.', freq: null, severity: 'Generalmente leve o moderada en el ensayo', verification: 'verificado' },
      { name: 'Diarrea', desc: 'Deposiciones blandas o frecuentes.', freq: null, severity: 'Generalmente leve o moderada en el ensayo', verification: 'verificado' },
      { name: 'Vómitos', desc: 'Vómitos; vigilar la deshidratación si se repiten.', freq: null, severity: 'Generalmente leve o moderada en el ensayo', verification: 'verificado' },
      { name: 'Estreñimiento', desc: 'Dificultad o menor frecuencia para evacuar.', freq: null, severity: 'Generalmente leve o moderada en el ensayo', verification: 'verificado' },
      { name: 'Aumento de la frecuencia cardiaca', desc: 'El ensayo observó aumentos que llegaron al máximo hacia la semana 24 y luego disminuyeron.', freq: null, severity: 'No calificada en el resumen', verification: 'verificado' },
    ],
    notes: 'El ensayo describe los efectos gastrointestinales como más frecuentes con más dosis, pero eso no permite fijar un umbral individual ni concluir que un síntoma signifique que la cantidad registrada fue excesiva. Los abandonos por efectos adversos fueron del 6 % al 16 % en los grupos de retatrutida (PACE-CME).',
  },
  'PT-141': {
    warning: 'El kit es de investigación. Existe un medicamento autorizado en EE. UU. con este principio activo (bremelanotida, Vyleesi), en otra presentación y con prescripción.',
    context: 'Efectos descritos para el medicamento autorizado (Vyleesi). No se pueden trasladar sin más a un producto de investigación de composición no verificada.',
    sources: [MEDLINE('a619054', 'MedlinePlus — Bremelanotide Injection')],
    effects: [
      { name: 'Náuseas', desc: 'Sobre todo tras la primera administración.', severity: 'Frecuente', verification: 'verificado' },
      { name: 'Vómitos, cefalea, rubor facial, congestión nasal, tos, cansancio, mareo', desc: 'Efectos frecuentes descritos.', severity: 'Frecuentes', verification: 'verificado' },
      { name: 'Reacción en el lugar de inyección', desc: 'Dolor, enrojecimiento, hematoma, picor u hormigueo.', severity: 'Frecuente', verification: 'verificado' },
      { name: 'Subida de la tensión arterial con pulso más lento', desc: 'Puede durar hasta 12 horas.', severity: 'Grave', verification: 'verificado' },
      { name: 'Oscurecimiento de la piel (cara, encías, mamas)', desc: 'Puede ser permanente.', severity: 'Precaución', verification: 'verificado' },
    ],
  },
  'Tesamorelin': {
    warning: 'El kit es de investigación. Existe un medicamento autorizado en EE. UU. (Egrifta) para una indicación concreta en personas con VIH.',
    context: 'Efectos descritos para el medicamento autorizado.',
    sources: [{ name: 'Cigna Knowledge Center — Tesamorelin injection', url: 'https://www.cigna.com/knowledge-center/hw/medications/tesamorelin-injection-fdbm30334-1376', type: 'Ficha para pacientes (aseguradora, contenido Healthwise)' }],
    effects: [
      { name: 'Reacción en el lugar de inyección', desc: 'Dolor, enrojecimiento o hinchazón.', severity: 'Frecuente', verification: 'verificado' },
      { name: 'Hinchazón de piernas, pies o manos', desc: '', severity: 'Grave: consultar', verification: 'verificado' },
      { name: 'Hormigueo o entumecimiento en manos o pies', desc: '', severity: 'Grave: consultar', verification: 'verificado' },
      { name: 'Glucosa alta (sed, orinar más)', desc: '', severity: 'Grave: consultar', verification: 'verificado' },
      { name: 'Dolor articular o muscular, rigidez', desc: '', severity: 'Grave: consultar', verification: 'verificado' },
      { name: 'Reacción alérgica', desc: 'Dificultad para respirar, erupción, picor, hinchazón o mareo intenso.', severity: 'Urgente', verification: 'verificado' },
    ],
  },
  'Ligandrol (LGD-4033)': {
    warning: 'Los SARM no son medicamentos autorizados.',
    context: 'Solo se ha podido confirmar el título de un caso clínico publicado; el texto no pudo leerse en esta sesión (bloqueo HTTP 429).',
    sources: [{ name: 'LGD-4033 and a Case of Drug-Induced Liver Injury (PMC11485217)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11485217/', type: 'Caso clínico — contenido no leído' }],
    effects: [{ name: 'Lesión hepática', desc: 'Descrita en un caso clínico publicado (según su título).', severity: 'Grave', verification: 'titulo' }],
  },
  'Ostarina (MK-2866)': { warning: 'Los SARM no son medicamentos autorizados.', insufficient: 'Sin fuente verificada en esta sesión (la página de la FDA sobre SARM fue bloqueada por exceso de peticiones). Pendiente de completar.', sources: [], effects: [] },
  'Minoxidil oral': {
    context: 'Medicamento autorizado (Loniten, ya no comercializado en EE. UU.); la ficha corresponde al uso para tensión arterial.',
    sources: [MEDLINE('a682608', 'MedlinePlus — Minoxidil (oral)')],
    effects: [
      { name: 'Aviso importante: problemas cardiacos', desc: 'Puede aumentar el dolor torácico (angina) u otros problemas cardiacos.', severity: 'Advertencia destacada', verification: 'verificado' },
      { name: 'Aumento del vello, sensibilidad mamaria, cefalea, náuseas, vómitos', desc: '', severity: 'Frecuentes', verification: 'verificado' },
      { name: 'Latido rápido, tobillos hinchados, aumento de peso sin explicación, dificultad para respirar, mareo, desmayo', desc: '', severity: 'Graves: llamar al médico', verification: 'verificado' },
    ],
  },
  'Minoxidil tópico': {
    sources: [MEDLINE('a689003', 'MedlinePlus — Minoxidil Topical')],
    effects: [
      { name: 'Picor, sequedad, descamación, irritación o quemazón del cuero cabelludo', desc: '', severity: 'Frecuentes', verification: 'verificado' },
      { name: 'Aumento de peso, hinchazón, dificultad para respirar, latido rápido, dolor torácico, aturdimiento', desc: '', severity: 'Graves: llamar al médico', verification: 'verificado' },
    ],
  },
  'Ivermectina': {
    sources: [MEDLINE('a607069', 'MedlinePlus — Ivermectin')],
    effects: [
      { name: 'Mareo, pérdida de apetito, náuseas o vómitos, dolor abdominal, diarrea o estreñimiento, debilidad, temblor', desc: '', severity: 'Frecuentes', verification: 'verificado' },
      { name: 'Ampollas o piel que se pela, erupción, urticaria, picor', desc: '', severity: 'Graves', verification: 'verificado' },
      { name: 'Somnolencia, confusión, desorientación o coma', desc: '', severity: 'Urgente', verification: 'verificado' },
    ],
  },
  'Dutasterida': {
    sources: [MEDLINE('a603001', 'MedlinePlus — Dutasteride')],
    effects: [
      { name: 'Problemas de erección, menor deseo sexual, problemas de eyaculación', desc: '', severity: 'Frecuentes', verification: 'verificado' },
      { name: 'Cambios en las mamas (aumento, bultos, dolor, secreción)', desc: '', severity: 'Grave', verification: 'verificado' },
      { name: 'Hinchazón de cara, lengua o garganta; dificultad para respirar o tragar; piel que se pela', desc: '', severity: 'Urgente', verification: 'verificado' },
      { name: 'Mayor riesgo de cáncer de próstata de alto grado', desc: '', severity: 'Advertencia', verification: 'verificado' },
    ],
  },
  'Finasterida': {
    sources: [MEDLINE('a698016', 'MedlinePlus — Finasteride')],
    effects: [
      { name: 'Problemas de erección, menor deseo sexual, problemas de eyaculación, dolor testicular', desc: '', severity: 'Frecuentes', verification: 'verificado' },
      { name: 'Cambios en las mamas', desc: '', severity: 'Grave', verification: 'verificado' },
      { name: 'Depresión nueva o que empeora, pensamientos de autolesión', desc: 'Avisar al médico enseguida.', severity: 'Grave', verification: 'verificado' },
      { name: 'Reacción alérgica', desc: 'Erupción, picor, hinchazón de cara o labios, dificultad para respirar o tragar.', severity: 'Urgente', verification: 'verificado' },
    ],
  },
  'Dapoxetina': {
    context: 'Resumen de características del producto en la UE (anexo III del arbitraje de la EMA sobre Priligy).',
    sources: [{ name: 'EMA — Priligy, artículo 29, anexo III', url: 'https://www.ema.europa.eu/documents/referral/priligy-article-29-referral-annex-iii_en.pdf', type: 'Información de producto de la UE' }],
    effects: [
      { name: 'Mareo, cefalea, náuseas', desc: '', freq: 'Muy frecuentes (más de 1 de cada 10)', severity: 'Frecuentes', verification: 'verificado' },
      { name: 'Ansiedad, hormigueo, sudoración, diarrea, vómitos, insomnio, somnolencia, tensión alta, visión borrosa, acúfenos', desc: '', freq: 'Frecuentes (1 a 10 de cada 100)', severity: 'Frecuentes', verification: 'verificado' },
      { name: 'Desmayo (síncope) o mareo al ponerse de pie', desc: 'La ficha pide suspender y consultar; más riesgo con deshidratación o alcohol.', severity: 'Grave', verification: 'verificado' },
    ],
  },
  'Tadalafilo': {
    sources: [MEDLINE('a604008', 'MedlinePlus — Tadalafil')],
    effects: [
      { name: 'Cefalea, indigestión, náuseas, diarrea, rubor, dolor de espalda o muscular, tos', desc: '', severity: 'Frecuentes', verification: 'verificado' },
      { name: 'Pérdida repentina de visión o audición, cambios en la visión de colores, zumbido', desc: '', severity: 'Urgente', verification: 'verificado' },
      { name: 'Erección de más de 4 horas', desc: '', severity: 'Urgente', verification: 'verificado' },
      { name: 'Dolor torácico, mareo, erupción grave, dificultad para respirar o hinchazón', desc: '', severity: 'Urgente', verification: 'verificado' },
    ],
  },
  'Tadalafilo + dapoxetina': { insufficient: 'Combinación sin ficha propia verificada. Consultar las fichas de tadalafilo y dapoxetina por separado; la combinación puede sumar riesgos (por ejemplo, mareo y tensión baja).', sources: [], effects: [] },
  'Clomifeno': {
    context: 'La ficha describe el uso autorizado en mujeres para inducir la ovulación; en otros usos los datos pueden ser distintos.',
    sources: [MEDLINE('a682704', 'MedlinePlus — Clomiphene')],
    effects: [
      { name: 'Sofocos, malestar de estómago, vómitos, molestias mamarias, cefalea', desc: '', severity: 'Frecuentes', verification: 'verificado' },
      { name: 'Visión borrosa o doble, manchas o destellos', desc: 'Llamar al médico de inmediato.', severity: 'Grave', verification: 'verificado' },
      { name: 'Dolor o hinchazón abdominal, aumento de peso, falta de aire', desc: '', severity: 'Grave', verification: 'verificado' },
    ],
  },
};
const NO_DATA = 'No se han localizado datos clínicos humanos fiables y verificables sobre efectos adversos. La sección se deja vacía a propósito: no se rellena con suposiciones.';
for (const s of ['BPC-157', 'TB-500', 'Mezcla BPC-157 + TB-500', 'Kisspeptin-10', 'Epithalon', 'MOTS-c', 'PTD-DBM', 'Testagen', '5-Amino-1MQ', 'GHK-Cu concentrado cosmético 5 %', 'Minoxidil 5 % + trioxidil 5 % (Foligain)']) {
  SAFETY[s] = { insufficient: NO_DATA, sources: [], effects: [] };
}
SAFETY['Minoxidil tópico 5 % (Foligain)'] = SAFETY['Minoxidil tópico'];
SAFETY['Minoxidil tópico 5 % low alcohol (Foligain)'] = SAFETY['Minoxidil tópico'];

export function safetyFor(substance) {
  return SAFETY[substance] || { insufficient: 'Sin información de seguridad registrada para este producto.', sources: [], effects: [] };
}

// Ayuda urgente en Bulgaria
export const EMERGENCY = {
  general: { label: 'Emergencias (UE)', phone: '112' },
  toxicology: { label: 'Centro Nacional de Toxicología — Hospital «N. I. Pirogov», Sofía', phone: '+359 2 9154 233', source: 'https://www.moew.government.bg/en/prevention/chemicals/classification-clp/emergency-number/', note: 'Número publicado por el Ministerio de Medio Ambiente y Aguas de Bulgaria (consultado 13-oct-2026).' },
};
export const SEVERE_SYMPTOMS = [
  'Vómitos persistentes', 'Deshidratación importante', 'Dolor abdominal intenso', 'Desmayo', 'Confusión',
  'Dificultad para respirar', 'Signos de reacción alérgica grave (hinchazón de cara o garganta, urticaria extensa)',
  'Dolor torácico', 'Pérdida repentina de visión o audición', 'Erección de más de 4 horas',
];
export const SEVERE_SOURCE = 'Signos de alarma tomados de las fichas citadas en cada sustancia (MedlinePlus, EMA) y de la lista del proyecto.';

export const WHO_ACTIVITY = {
  text: 'Orientación general de la OMS para adultos de 18 a 64 años: 150–300 minutos semanales de actividad aeróbica moderada (o 75–150 de intensa) y actividades de fortalecimiento muscular de intensidad moderada o mayor, que trabajen los grandes grupos musculares, 2 o más días por semana. Es una referencia general, no una obligación: adapta según tu edad, salud y limitaciones.',
  source: 'https://www.ncbi.nlm.nih.gov/books/NBK566048/',
  sourceName: 'WHO Guidelines on Physical Activity and Sedentary Behaviour (2020)',
};
