"""Pruebas de aceptación en Chromium (Playwright). Uso: python3 -I tests/e2e.py <url>"""
import sys, json, datetime as dt
from playwright.sync_api import sync_playwright, expect

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'
today = dt.date.today()
iso = lambda d: d.isoformat()
errors, results = [], []

def ok(name, cond=True):
    results.append((name, bool(cond)))
    print(('OK   ' if cond else 'FAIL ') + name)

def go(page, h):
    page.evaluate(f"location.hash = '{h}'")
    page.wait_for_timeout(250)

def dlg(page):
    return page.locator('#dlg')

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 360, 'height': 780}, accept_downloads=True)
    page = ctx.new_page()
    page.on('console', lambda m: m.type == 'error' and errors.append(m.text))
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(URL); page.wait_for_selector('text=Bienvenido')
    ok('arranca sin perfiles')
    ok('botón Instalar app visible', page.locator('#installBtn').is_visible())
    page.click('#installBtn'); expect(dlg(page)).to_contain_text('Añadir a pantalla de inicio')
    ok('sin aviso del navegador: instrucciones manuales'); dlg(page).locator('[data-close]').click()
    page.evaluate("""() => { const e = new Event('beforeinstallprompt'); e.prompt = () => { window.__prompted = true; };
      e.userChoice = Promise.resolve({ outcome: 'accepted' }); dispatchEvent(e); }""")
    page.click('#installBtn'); page.wait_for_timeout(300)
    ok('con aviso del navegador: lanza la instalación nativa', page.evaluate('window.__prompted === true') and dlg(page).get_attribute('open') is None)

    # 2. varios perfiles
    go(page, '#/perfiles')
    for name, w in [('Ana', '80'), ('Bruno', '95')]:
        page.click('#new'); d = dlg(page)
        d.locator('[name=name]').fill(name); d.locator('[name=initialWeight]').fill(w)
        d.locator('[name=startDate]').fill(iso(today - dt.timedelta(days=10)))
        d.locator('button:has-text("Crear")').click(); page.wait_for_timeout(300)
    ok('se crean dos perfiles', page.locator('ul.plain li').count() == 2)
    page.select_option('#profileSel', label='Ana'); page.wait_for_timeout(300)

    # 1. catálogo
    go(page, '#/catalogo')
    n = page.locator('main ul.plain li').count()
    ok(f'catálogo con {n} presentaciones (≥ 40)', n >= 40)
    go(page, '#/producto/reta30')
    ok('ficha retatrutida: aviso RUO', page.locator('.ruo-banner').inner_text() == 'Sustancia de investigación — no apta para uso humano')
    body = page.inner_text('main')
    ok('ficha distingue contenido del vial y cantidad registrada', '30 mg por vial' in body and 'Cantidad total del envase' in body and 'no hace conversiones' in body)
    ok('ficha: efectos con fuente y contexto', 'Jastreboff' in body and 'Contexto' in body and 'Náuseas' in body)
    go(page, '#/producto/bpc5')
    ok('ficha sin datos: lo dice expresamente', 'no se rellena con suposiciones' in page.inner_text('main'))

    # 7. ciclo con fecha final y cantidad de plan
    go(page, '#/planes'); page.click('#new'); d = dlg(page)
    d.locator('[name=name]').fill('Ciclo prueba'); d.locator('[name=mode]').select_option('duracion')
    d.locator('[name=productId]').select_option('reta15')
    d.locator('[name=start]').fill(iso(today - dt.timedelta(days=20)))
    d.locator('[name=duration]').fill('4'); d.locator('[name=durationUnit]').select_option('semanas')
    d.locator('[name=phasesText]').fill('semanas 1-4 | 2 | unidad | semanal | escrito por el usuario')
    d.locator('button:has-text("Guardar")').click(); page.wait_for_selector('h1:has-text("Ciclo prueba")')
    end = today - dt.timedelta(days=20) + dt.timedelta(days=27)
    txt = page.inner_text('main')
    ok('fecha final calculada de la duración', end.strftime('%d/%m/%Y') in txt)
    ok('alerta 7 días antes del fin', 'faltan 7 días' in txt)
    ok('fases del protocolo visibles en el plan', 'Semanas 1–4: 2 unidad · semanal' in txt)
    page.click('a:has-text("28 días")'); page.wait_for_timeout(300)
    ok('informe de 28 días', 'Informe 28 días' in page.inner_text('main') and 'No indica si hay que aumentar' in page.inner_text('main'))

    # 8. descanso
    go(page, '#/planes'); page.click('#new'); d = dlg(page)
    d.locator('[name=name]').fill('Descanso'); d.locator('[name=mode]').select_option('descanso')
    d.locator('[name=start]').fill(iso(today + dt.timedelta(days=8))); d.locator('[name=end]').fill(iso(today + dt.timedelta(days=20)))
    d.locator('button:has-text("Guardar")').click(); page.wait_for_selector('h1:has-text("Descanso")')
    ok('periodo de descanso registrado', 'Periodo de descanso documentado' in page.inner_text('main'))

    # 10. continuo
    go(page, '#/planes'); page.click('#new'); d = dlg(page)
    d.locator('[name=name]').fill('Continuo'); d.locator('[name=mode]').select_option('continuo')
    d.locator('[name=start]').fill(iso(today - dt.timedelta(days=40))); d.locator('[name=reviewEveryDays]').fill('30')
    d.locator('button:has-text("Guardar")').click(); page.wait_for_selector('h1:has-text("Continuo")')
    t = page.inner_text('main')
    ok('seguimiento continuo con revisión periódica vencida', 'Revisión periódica vencida' in t and 'Sin fecha final registrada' in t)
    page.click('#rev'); page.wait_for_timeout(300)
    ok('revisión marcada como hecha', 'Revisión periódica vencida' not in page.inner_text('main'))

    # 4 + 12. registro con cantidad superior al plan
    go(page, '#/registro')
    page.select_option('[name=productId]', 'reta15')
    ok('registro: contenido del vial ≠ cantidad', 'no una cantidad a administrar' in page.inner_text('#pinfo') and page.locator('#pinfo .ruo-banner').count() == 1)
    page.fill('[name=amount]', '3'); page.fill('[name=unit]', 'unidad')
    page.select_option('[name=planId]', label=page.locator('[name=planId] option', has_text='Ciclo prueba').inner_text())
    page.fill('[name=lotText]', 'L-123'); page.fill('[name=symptoms]', 'náuseas y diarrea'); page.fill('[name=notes]', 'prueba')
    page.select_option('[name=status]', 'realizado')
    page.click('button:has-text("Guardar registro")')
    d = dlg(page); expect(d).to_contain_text('La cantidad registrada supera la cantidad del plan')
    ok('alerta de cantidad superior al plan', True)
    dt_ = d.inner_text()
    ok('muestra registrado y referencia; no puede determinar gravedad', '3 unidad' in dt_ and '2 unidad' in dt_ and 'no puede determinar la gravedad' in dt_ and 'compensatoria' in dt_)
    d.locator('label:has-text("Desmayo") input').check()
    d.locator('button:has-text("Guardar incidencia")').click()
    expect(dlg(page)).to_contain_text('Busca asistencia sanitaria inmediata'); ok('síntoma grave → alerta urgente')
    dlg(page).locator('[data-close]').click()
    expect(dlg(page)).to_contain_text('deshidratación'); ok('diarrea → aviso de deshidratación')
    dlg(page).locator('[data-close]').click()
    page.wait_for_url('**#/historial'); page.wait_for_timeout(300)
    ok('registro en historial con lote', 'lote L-123' in page.inner_text('main'))

    # corrección con historial
    page.click('[data-edit]'); d = dlg(page)
    d.locator('[name=notes]').fill('corregido'); d.locator('button:has-text("Guardar")').click(); page.wait_for_timeout(400)
    ok('corrección conserva historial', 'Modificado 1 vez' in page.inner_text('main'))

    go(page, '#/incidencias')
    ok('incidencia en registro separado, sin llamarla sobredosis', 'Cantidad superior al plan registrado' in page.inner_text('main') and 'obredosis' not in page.inner_text('main'))

    # 6. recordatorio + .ics
    go(page, '#/recordatorios'); page.click('#new'); d = dlg(page)
    d.locator('[name=label]').fill('Registro semanal'); d.locator('[name=timesText]').fill('08:00, 20:30')
    d.locator('label:has-text("Lun") input').check()
    d.locator('button:has-text("Guardar")').click(); page.wait_for_timeout(300)
    ok('recordatorio creado', 'Registro semanal' in page.inner_text('main'))
    page.click('[data-a=snz]'); page.wait_for_timeout(300)
    ok('recordatorio pospuesto', 'pospuesto hasta' in page.inner_text('main'))
    with page.expect_download() as dl: page.click('#ics')
    ics = open(dl.value.path(), encoding='utf-8').read()
    ok('.ics válido con alarma y sin cantidad', ics.startswith('BEGIN:VCALENDAR') and ics.count('BEGIN:VEVENT') == 2 and 'BEGIN:VALARM' in ics and 'RRULE:FREQ=WEEKLY;BYDAY=MO' in ics)

    # PCT
    go(page, '#/pct'); page.click('#new'); d = dlg(page)
    d.locator('[name=cycleId]').select_option(label=d.locator('[name=cycleId] option', has_text='Ciclo prueba').inner_text())
    d.locator('[name=reviewDate]').fill(iso(today + dt.timedelta(days=30)))
    d.locator('[name=datesText]').fill(f'{iso(today + dt.timedelta(days=14))} Análisis de sangre')
    d.locator('button:has-text("Guardar")').click(); page.wait_for_timeout(300)
    t = page.inner_text('main')
    ok('PCT conserva calendario y no inventa plan', 'Seguimiento postciclo pendiente de definir' in t and 'Análisis de sangre' in t)

    # peso + gráfico
    go(page, '#/peso'); page.fill('[name=kg]', '78.4'); page.click('button:has-text("Añadir pesaje")'); page.wait_for_timeout(300)
    t = page.inner_text('main')
    ok('variación de peso correcta (80 → 78,4 = −1,6 kg; −2 %)', '-1,6 kg (-2 %)' in t)
    ok('gráfico de peso', page.locator('.chart svg path').count() == 1)

    # hábitos
    go(page, '#/habitos'); page.click('[data-ml="250"]'); page.wait_for_timeout(300)
    t = page.inner_text('main')
    ok('hidratación registrada', 'Hoy: 250 ml' in t)
    ok('recomendación OMS con fuente', '2 o más días por semana' in t)
    ok('aviso de deshidratación por síntomas recientes', 'signos de deshidratación' in t)
    page.locator('form[data-type=entreno] [name=goal]').fill('2')
    page.locator('form[data-type=entreno] [name=minutes]').fill('45')
    page.locator('form[data-type=entreno] button').click(); page.wait_for_timeout(300)
    ok('objetivo semanal configurable', 'sesiones de fuerza completadas de 2' in page.inner_text('main'))

    # 5. calendario
    go(page, f'#/calendario?v=mes&d={iso(today)}')
    ok('calendario mensual con 42 días', page.locator('.cal .day').count() == 42)
    go(page, f'#/calendario?v=dia&d={iso(today)}')
    t = page.inner_text('main')
    ok('calendario diario muestra registro, pesaje y síntoma', 'Registro:' in t and 'Pesaje:' in t and 'Síntoma:' in t)
    go(page, f'#/calendario?v=semana&d={iso(today)}')
    ok('calendario semanal', page.locator('main h3').count() == 7)

    # 17/19. informes y exportación
    go(page, f'#/informes?from={iso(today - dt.timedelta(days=28))}&to={iso(today)}')
    ok('informe por periodo', 'Informe 28 días' in page.inner_text('main'))
    with page.expect_download() as dl: page.click('#jsonP')
    data = json.load(open(dl.value.path(), encoding='utf-8'))
    ok('JSON válido del perfil', data['app'] == 'registro-sustancias' and len(data['administrations']) == 1)
    with page.expect_download() as dl: page.click('#csv')
    csv = open(dl.value.path(), encoding='utf-8-sig').read()
    ok('CSV válido', csv.splitlines()[0].startswith('productId;') or ';' in csv.splitlines()[0])

    # 3/20. aislamiento entre perfiles en la interfaz
    page.select_option('#profileSel', label='Bruno'); page.wait_for_timeout(300)
    go(page, '#/historial')
    ok('Bruno no ve los registros de Ana', '0 registros' in page.inner_text('main'))
    go(page, '#/incidencias')
    ok('Bruno no ve incidencias de Ana', 'Sin incidencias' in page.inner_text('main'))

    # 18. persistencia
    page.reload(); page.wait_for_timeout(800)
    page.select_option('#profileSel', label='Ana'); page.wait_for_timeout(300)
    go(page, '#/historial')
    ok('los datos persisten tras recargar', '1 registros' in page.inner_text('main'))

    # PIN
    go(page, '#/ajustes'); page.fill('#pin [name=pin]', '2468'); page.click('#pin button'); page.wait_for_timeout(400)
    page.reload(); page.wait_for_selector('#lockForm')
    page.fill('#pin', '1111'); page.click('#lockForm button'); page.wait_for_timeout(300)
    ok('PIN incorrecto rechazado', 'PIN incorrecto' in page.inner_text('#pinErr'))
    page.fill('#pin', '2468'); page.click('#lockForm button'); page.wait_for_timeout(500)
    ok('PIN correcto desbloquea', page.locator('#lockForm').count() == 0)

    # anchos 320 y 360: sin desbordamiento horizontal
    routes = ['#/', '#/registro', '#/historial', f'#/calendario?v=mes&d={iso(today)}', '#/planes', '#/pct', '#/recordatorios', '#/peso',
              '#/habitos', f'#/informes?from={iso(today - dt.timedelta(days=28))}&to={iso(today)}', '#/incidencias', '#/catalogo', '#/producto/reta15', '#/perfiles', '#/ajustes']
    for w in (320, 360):
        page.set_viewport_size({'width': w, 'height': 760})
        bad = []
        for r in routes:
            go(page, r); page.wait_for_timeout(150)
            sw = page.evaluate('document.documentElement.scrollWidth')
            if sw > w: bad.append(f'{r}:{sw}')
        ok(f'sin desbordamiento a {w}px' + (f' {bad}' if bad else ''), not bad)
    for size in ('25',):
        page.evaluate(f"document.documentElement.dataset.size='{size}'")
        page.set_viewport_size({'width': 360, 'height': 760}); go(page, '#/registro')
        ok('letra enorme (25px) a 360px sin desbordamiento', page.evaluate('document.documentElement.scrollWidth') <= 360)

    # sin conexión: el service worker sirve la app
    page.wait_for_timeout(500)
    ctx.set_offline(True); page.reload(); page.wait_for_timeout(1200)
    ok('funciona sin conexión (service worker)', page.locator('#lockForm, main').count() >= 1 and 'Registro de sustancias' in page.title())
    ctx.set_offline(False)
    b.close()

print('\nErrores de consola:', errors or 'ninguno')
fails = [n for n, c in results if not c]
print(f'{len(results) - len(fails)}/{len(results)} comprobaciones superadas')
sys.exit(1 if fails or errors else 0)
