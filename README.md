# Registro de sustancias (PWA)

Aplicación web instalable para registrar, por persona, tomas o aplicaciones declaradas, ciclos y periodos, seguimiento postciclo, calendario, recordatorios, peso, hábitos e incidencias. **Los datos se guardan solo en el dispositivo** (IndexedDB del navegador). El repositorio no contiene datos personales.

No es un dispositivo médico. No propone cantidades, pautas, protocolos postciclo, reconstitución ni conversiones de unidades. Registrar algo no demuestra que un producto sea seguro, puro o adecuado.

## Instalar en Android
1. Abre la dirección de la app en **Chrome**.
2. Menú ⋮ → **Instalar aplicación** (o «Añadir a pantalla de inicio»).
3. Abre la app instalada → **Recordatorios → Activar notificaciones**.
4. Para avisos con la app cerrada: **Recordatorios → Exportar a calendario (.ics)** y abre el archivo con Google Calendar.
5. **Ajustes → Bloqueo con PIN** y haz copias periódicas en **Ajustes → Copia de seguridad**.

## Pantallas
Barra inferior con 5 pestañas: **Hoy** (tomas del día según los protocolos, con Hecho / Más tarde / Omitir / Otra cantidad), **Calendario** (tomas previstas, registradas y sin registro), **Protocolos** (cronograma por semanas con cumplimiento, planes, biblioteca con fichas maquetadas y texto original como documento, postciclo), **Progreso** (historial, peso, hábitos, informes, incidencias, avisos) y **Más**.

La frecuencia de cada fase se lee del texto escrito por el usuario («3 veces por semana (lunes, miércoles y viernes)») y se muestra al lado; si se entiende mal, se corrige en el plan sin cambiar el texto.

**Pausas**: un plan (o todo un protocolo aplicado junto) se puede pausar desde el plan o desde el Cronograma, con fecha de vuelta o sin ella («Reanudar» al volver). Los días en pausa no cuentan: las fases siguientes, las semanas y el fin se retrasan esos días.

**Ajustes personales**: «Cambiar cantidad» de una fase desde una semana (lo anterior queda igual y se anota «Ajustado por ti»); si registras más que tu plan, la app pregunta si ha sido un ajuste tuyo antes de abrir la ventana de seguridad; en cada toma puedes marcar cómo te sentó (bien / regular / efectos secundarios) y el plan resume tus marcas por cantidad, sin recomendar nada; notas-guía escritas por ti que salen en Hoy siempre, en unas semanas o durante una pausa; «Tu protocolo»: en cada toma de Hoy (plegado) y en el plan, el texto literal de la ficha de esa sustancia de tu biblioteca (fases, descanso o PCT, notas y advertencias), elegida por la ficha que cita el plan o por sexo; «Fecha de inicio» de todo un protocolo (para ciclos que ya llevabas) con la opción de registrar como hechas las tomas anteriores o de contar el cumplimiento desde hoy; pausas editables.

**Cambiar de protocolo** (Cronograma o plan): el nuevo empieza en la misma fecha (las semanas que llevas cuentan); las tomas, pausas, notas y correcciones de frecuencia de cada sustancia pasan al plan nuevo; eliges qué se cierra. **Frecuencias**: «cada 10 a 14 días» (ventana desde tu última toma) y «1 a 2 veces al día» (la segunda es opcional). **Revisiones**: el informe cuenta también las tomas sin plan, incluye cómo te sentó, y las fechas y avisos (también los periódicos, en cualquier plan) no cuentan los días en pausa.

**Sin cobertura o con mala señal**: el service worker espera a la red como máximo 3 s si ya hay copia; después abre desde la caché y actualiza en segundo plano.

## Estructura
- `index.html`, `styles.css`, `manifest.webmanifest`, `sw.js` (funcionamiento sin conexión y avisos), `icons/`, `fonts/` (Atkinson Hyperlegible, OFL)
- `js/schedule.js` — lectura de frecuencias, agenda del día y cumplimiento
- `js/text.js` — maquetación del texto literal (fichas, viñetas, tablas)
- `js/hoy.js` — Hoy, cronograma, fichas, texto original y menú «Más»
- `js/pausas.js` — pausar, reanudar, editar y borrar pausas de un plan o de un protocolo
- `js/ajustes.js` — cómo sienta, notas-guía, cambiar cantidad, fecha de inicio y días anteriores
- `js/catalog.js` — catálogo auditado de la tabla maestra (40 presentaciones; 21 del plan actual)
- `js/safety.js` — efectos adversos con fuente y fecha de consulta; teléfonos de urgencias; recomendación OMS
- `js/model.js` — lógica (aislamiento por perfil, ciclos, alertas, informes, exportación)
- `js/store.js` — IndexedDB / memoria
- `js/views1.js`, `js/views2.js`, `js/ui.js`, `js/notify.js` — interfaz, PIN, notificaciones, .ics

## Pruebas
- `npm test` — 58 pruebas de la lógica (Node 22, sin dependencias); 2 necesitan `LIB_FILE=<biblioteca.json>`.
- `LIB_FILE=<biblioteca.json> python3 -I tests/e2e.py http://localhost:8765/` — 135 comprobaciones de aceptación (con la biblioteca v4) en Chromium (Playwright), a 320 y 360 px.
- `python3 -I tests/e2e_red_lenta.py .` — arranque con la red a 8 s (debe abrir en menos de 6 s).
- `python3 -I tests/e2e_actualizacion.py .` — con «Cache-Control: max-age=600» (como GitHub Pages), una versión nueva se ve al volver a abrir la app.

Al publicar una versión: subir `CACHE` en `sw.js` y `APP_VERSION` en `js/app.js` (se ve en Más).

## Limitaciones conocidas
- **Sin cifrado**: el PIN impide abrir la app, pero los datos del navegador no están cifrados.
- **Sin sincronización** entre dispositivos (decisión: solo local). Para pasar datos, usa copia/restauración .json.
- **Notificaciones**: con la app abierta, avisos fiables; con la app cerrada, el navegador no garantiza la hora (la sincronización periódica solo existe en Chrome con la app instalada y el navegador decide la frecuencia). La alternativa fiable es el .ics.
- Un único administrador por dispositivo; no hay cuentas por persona.
- PDF: mediante «Imprimir → Guardar como PDF» del navegador.
