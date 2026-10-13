# Registro de sustancias (PWA)

Aplicación web instalable para registrar, por persona, tomas o aplicaciones declaradas, ciclos y periodos, seguimiento postciclo, calendario, recordatorios, peso, hábitos e incidencias. **Los datos se guardan solo en el dispositivo** (IndexedDB del navegador). El repositorio no contiene datos personales.

No es un dispositivo médico. No propone cantidades, pautas, protocolos postciclo, reconstitución ni conversiones de unidades. Registrar algo no demuestra que un producto sea seguro, puro o adecuado.

## Instalar en Android
1. Abre la dirección de la app en **Chrome**.
2. Menú ⋮ → **Instalar aplicación** (o «Añadir a pantalla de inicio»).
3. Abre la app instalada → **Recordatorios → Activar notificaciones**.
4. Para avisos con la app cerrada: **Recordatorios → Exportar a calendario (.ics)** y abre el archivo con Google Calendar.
5. **Ajustes → Bloqueo con PIN** y haz copias periódicas en **Ajustes → Copia de seguridad**.

## Estructura
- `index.html`, `styles.css`, `manifest.webmanifest`, `sw.js` (funcionamiento sin conexión y avisos), `icons/`
- `js/catalog.js` — catálogo auditado de la tabla maestra (40 presentaciones; 21 del plan actual)
- `js/safety.js` — efectos adversos con fuente y fecha de consulta; teléfonos de urgencias; recomendación OMS
- `js/model.js` — lógica (aislamiento por perfil, ciclos, alertas, informes, exportación)
- `js/store.js` — IndexedDB / memoria
- `js/views1.js`, `js/views2.js`, `js/ui.js`, `js/notify.js` — interfaz, PIN, notificaciones, .ics

## Pruebas
- `npm test` — 23 pruebas de la lógica (Node 22, sin dependencias).
- `python3 -I tests/e2e.py http://localhost:8765/` — 46 comprobaciones de aceptación en Chromium (Playwright), a 320 y 360 px.

## Limitaciones conocidas
- **Sin cifrado**: el PIN impide abrir la app, pero los datos del navegador no están cifrados.
- **Sin sincronización** entre dispositivos (decisión: solo local). Para pasar datos, usa copia/restauración .json.
- **Notificaciones**: con la app abierta, avisos fiables; con la app cerrada, el navegador no garantiza la hora (la sincronización periódica solo existe en Chrome con la app instalada y el navegador decide la frecuencia). La alternativa fiable es el .ics.
- Un único administrador por dispositivo; no hay cuentas por persona.
- PDF: mediante «Imprimir → Guardar como PDF» del navegador.
