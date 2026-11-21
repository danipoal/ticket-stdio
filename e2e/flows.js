// Flujos e2e con el Supabase simulado (e2e/mock-supabase.js): el build debe haberse
// generado con EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399. Ver e2e/run.sh.
const puppeteer = require('puppeteer');
const BASE = process.env.BASE;
const fails = [];
const check = (name, ok, extra = '') => {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? ' -> ' + extra : ''));
  if (!ok) fails.push(name);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function session(browser, { email, width, height }) {
  const ctx = await browser.createBrowserContext(); // contexto limpio: sin sesion previa
  const page = await ctx.newPage();
  await page.setViewport({ width, height });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(BASE + '/auth/login', { waitUntil: 'load', timeout: 60000 });
  await page.waitForSelector('[data-testid="login-email"]');
  await page.type('[data-testid="login-email"]', email);
  await page.type('[data-testid="login-password"]', 'x');
  await (await page.$('[data-testid="login-submit"]')).click();
  await page.waitForFunction(() => location.pathname.endsWith('/home'), { timeout: 20000 }).catch(() => {});
  await wait(1500);
  return { page, ctx, errors };
}
const has = (page, id) => page.$(`[data-testid="${id}"]`).then(Boolean);
const textOf = (page) => page.evaluate(() => document.body.innerText);
const overflowX = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const bad = (errors) => errors.filter((e) => !/favicon|Failed to load resource/i.test(e));

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });

  // ---- Escritorio, empleada ----
  {
    const { page, ctx, errors } = await session(browser, { email: 'ana@demo.test', width: 1440, height: 900 });
    check('login lleva a /home', page.url().endsWith('/home'), page.url());
    check('escritorio: barra lateral visible', await has(page, 'sidebar'));
    check('escritorio: empleada no ve la pestaña Equipo', !(await has(page, 'nav-settings')));
    check('escritorio: empleada no ve la pestaña Aprobaciones', !(await has(page, 'nav-approvals')));
    let t = await textOf(page);
    check('dashboard: saludo y KPI de importe total con miles', t.includes('Hola, Ana') && t.includes('2.662,34 €'), t.slice(0, 80).replace(/\n/g, ' '));
    check('dashboard: graficos y tarjetas presentes', (await has(page, 'bar-chart')) && (await has(page, 'card-category')) && (await has(page, 'card-recent')));
    check('escritorio: sin scroll horizontal', (await overflowX(page)) <= 0, String(await overflowX(page)));

    await (await page.$('[data-testid="nav-tickets"]')).click();
    await page.waitForSelector('[data-testid="sheet-open"]');
    await wait(500);
    const count = async () => (await page.$$('[data-testid="sheet-open"]')).length;
    check('tickets: lista con 9 hojas', (await count()) === 9, String(await count()));
    check('tickets: panel vacio de seleccion', (await textOf(page)).includes('Selecciona una hoja'));
    await (await page.$('[data-testid="sheet-open"]')).click();
    await page.waitForSelector('[data-testid="lines-table-head"]');
    t = await textOf(page);
    check('tickets: detalle con tabla de lineas y nombres de categoria', t.includes('CONCEPTO') && /Transporte|Comidas|Material|Alojamiento|Formación/.test(t));
    check('tickets: el propietario NO ve Aprobar/Rechazar', !(await has(page, 'approve-sheet')) && !(await has(page, 'reject-sheet')));
    t = await textOf(page);
    check('tickets: referencia HG-… e historial de la hoja', (await has(page, 'sheet-reference')) && /HG-\d{6}/.test(t) && t.includes('Historial'));
    await page.type('[data-testid="sheet-search"]', 'feria');
    await wait(400);
    check('tickets: la busqueda filtra a 1 hoja', (await count()) === 1, String(await count()));
    await page.click('[data-testid="filter-2"]');
    await wait(300);
    check('tickets: filtro por estado combinado con busqueda', (await count()) === 1);
    check('tickets: sin scroll horizontal', (await overflowX(page)) <= 0);

    await (await page.$('[data-testid="nav-user"]')).click();
    await wait(800);
    t = await textOf(page);
    check('usuario: perfil y organizacion', t.includes('Ana Pérez') && t.includes('Acme Consulting S.L.'));

    await (await page.$('[data-testid="nav-logout"]')).click();
    await page.waitForFunction(() => location.pathname.includes('/auth/login'), { timeout: 15000 }).catch(() => {});
    check('cerrar sesion desde la barra lateral vuelve a login', page.url().includes('/auth/login'), page.url());
    check('sin errores de JS (escritorio, empleada)', bad(errors).length === 0, bad(errors).slice(0, 2).join(' || '));
    await ctx.close();
  }

  // ---- Escritorio, administradora ----
  {
    const { page, ctx, errors } = await session(browser, { email: 'admin@demo.test', width: 1440, height: 900 });
    check('admin: ve la pestaña Equipo', await has(page, 'nav-settings'));
    await (await page.$('[data-testid="nav-user"]')).click();
    await page.waitForSelector('[data-testid="invite-code"]', { timeout: 15000 }).catch(() => {});
    check('admin: ve el codigo de invitacion de su organizacion', (await textOf(page)).includes('ACME1234'));
    check('admin: ve la pestaña Aprobaciones', await has(page, 'nav-approvals'));
    await (await page.$('[data-testid="nav-approvals"]')).click();
    await page.waitForSelector('[data-testid="sheet-open"]', { timeout: 15000 }).catch(() => {});
    await wait(500);
    let ta = await textOf(page);
    check('aprobaciones: pendientes con el nombre de la persona', ta.includes('Pendientes') && /Ana Pérez|Luis Gómez|Sara Vidal/.test(ta), ta.slice(0, 80).replace(/\n/g, ' '));
    check('aprobaciones: no hay boton de borrar hojas ajenas', !(await has(page, 'sheet-delete')));
    await (await page.$('[data-testid="sheet-open"]')).click();
    await page.waitForSelector('[data-testid="approve-sheet"]', { timeout: 15000 }).catch(() => {});
    ta = await textOf(page);
    check('aprobaciones: detalle en solo lectura con Aprobar y Rechazar', (await has(page, 'approve-sheet')) && (await has(page, 'reject-sheet')) && !(await has(page, 'add-line')) && ta.includes('Aprobar') && ta.includes('Rechazar'));
    check('aprobaciones: sin scroll horizontal', (await overflowX(page)) <= 0);
    await (await page.$('[data-testid="nav-settings"]')).click();
    await page.waitForSelector('[data-testid="team-table"]');
    await wait(800);
    const t = await textOf(page);
    check('equipo: tabla con personas y total', t.includes('Ana Pérez') && t.includes('Luis Gómez') && t.includes('3.892,07 €'), t.slice(0, 60).replace(/\n/g, ' '));
    check('sin errores de JS (admin)', bad(errors).length === 0, bad(errors).slice(0, 2).join(' || '));
    await ctx.close();
  }

  // ---- Pantalla de carga (sesion y empresa) ----
  {
    // 1) Antes de que llegue el JavaScript solo se ve el HTML de arranque: marca y "Cargando…", no una pantalla en blanco
    const ctx0 = await browser.createBrowserContext();
    const pre = await ctx0.newPage();
    await pre.setViewport({ width: 1440, height: 900 });
    await pre.setRequestInterception(true);
    pre.on('request', (r) => (r.url().includes('/_expo/static/js') ? r.abort() : r.continue()));
    await pre.goto(BASE + '/home', { waitUntil: 'domcontentloaded' });
    await wait(500);
    const bootBox = await pre.$eval('#boot', (el) => { const b = el.getBoundingClientRect(); return { w: b.width, h: b.height, t: el.innerText, bg: getComputedStyle(el).backgroundColor }; }).catch(() => null);
    check('carga: sin JavaScript se ve el splash de marca a pantalla completa', !!bootBox && bootBox.w >= 1440 && bootBox.h >= 900 && bootBox.t.includes('Ticket Stdio') && bootBox.t.includes('Cargando'), JSON.stringify(bootBox));
    check('carga: el HTML declara castellano y el titulo de marca', (await pre.evaluate(() => document.documentElement.lang)) === 'es' && (await pre.title()) === 'Ticket Stdio');
    await ctx0.close();

    // 2) Con sesion: al entrar no queda ningun splash (ni el del HTML ni el de la app)
    const { page, ctx, errors } = await session(browser, { email: 'ana@demo.test', width: 1440, height: 900 });
    await wait(800);
    check('carga: tras entrar no queda ni el splash del HTML ni el de la app', !(await page.$('#boot')) && !(await has(page, 'boot-splash')) && (await textOf(page)).includes('Hola, Ana'));
    check('sin errores de JS (carga)', bad(errors).length === 0, bad(errors).slice(0, 2).join(' || '));

    // 3) Fallo de red al cargar la empresa: aviso claro, no se confunde con "sin ficha" y se puede reintentar
    await page.setRequestInterception(true);
    let down = true;
    page.on('request', (r) => {
      if (down && r.url().includes('/rest/v1/employees')) {
        return r.respond({ status: 503, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ message: 'down' }) });
      }
      r.continue().catch(() => {});
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="boot-retry"]', { timeout: 20000 });
    const te = await textOf(page);
    check('carga: sin red -> "No hemos podido cargar tu empresa" con Reintentar y Cerrar sesion', te.includes('No hemos podido cargar tu empresa') && (await has(page, 'boot-signout')), te.slice(0, 120).replace(/\n/g, ' '));
    check('carga: el fallo NO manda a completar perfil (sigue en /home)', page.url().endsWith('/home'), page.url());
    down = false;
    await page.click('[data-testid="boot-retry"]');
    await page.waitForFunction(() => !document.querySelector('[data-testid="boot-splash"]'), { timeout: 15000 }).catch(() => {});
    check('carga: Reintentar entra en la app cuando vuelve la red', (await textOf(page)).includes('Hola, Ana') && page.url().endsWith('/home'), page.url());
    await ctx.close();
  }

  // ---- Suscripcion (Stripe simulado) y cupo de 50 tickets ----
  const MOCK = process.env.MOCK_URL || 'http://127.0.0.1:54399';
  const setBilling = (mode) => fetch(MOCK + '/__mock/billing?mode=' + mode);
  const disabledAttr = (page, id) => page.$eval(`[data-testid="${id}"]`, (el) => el.getAttribute('aria-disabled')).catch(() => null);
  {
    await setBilling('free');
    const { page, ctx, errors } = await session(browser, { email: 'ana@demo.test', width: 1440, height: 900 });
    check('suscripcion: la empleada NO ve la pestaña', !(await has(page, 'nav-subscription')));
    await page.goto(BASE + '/subscription', { waitUntil: 'load' });
    await wait(1500);
    let t = await textOf(page);
    check('suscripcion: la empleada que entra por URL ve el area restringida y ningun boton de pago', t.includes('Área restringida') && !(await has(page, 'sub-checkout')), t.slice(0, 80).replace(/\n/g, ' '));

    await setBilling('low');
    await page.goto(BASE + '/tickets', { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="add-button"]', { timeout: 15000 });
    await wait(1000);
    check('cupo: quedan pocos -> aviso amarillo y boton activo', (await has(page, 'quota-low')) && (await disabledAttr(page, 'add-button')) !== 'true');

    await setBilling('blocked');
    await page.goto(BASE + '/tickets', { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="add-button"]', { timeout: 15000 });
    await wait(1000);
    t = await textOf(page);
    check('cupo agotado: la empleada ve el aviso y "Nueva hoja" desactivado', (await has(page, 'quota-blocked')) && (await disabledAttr(page, 'add-button')) === 'true' && t.includes('no se pueden crear más'), t.slice(0, 120).replace(/\n/g, ' '));
    check('cupo agotado: la empleada NO ve el enlace a Suscripcion', !(await has(page, 'quota-manage')));
    check('cupo agotado: puede seguir consultando sus hojas', (await page.$$('[data-testid="sheet-open"]')).length > 0);
    check('cupo agotado: sin scroll horizontal', (await overflowX(page)) <= 0);
    check('sin errores de JS (cupo, empleada)', bad(errors).length === 0, bad(errors).slice(0, 2).join(' || '));
    await ctx.close();
  }
  {
    await setBilling('free');
    const { page, ctx, errors } = await session(browser, { email: 'admin@demo.test', width: 1440, height: 900 });
    // Landing con sesion iniciada: los botones llevan al panel en vez de a registrarse
    await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
    await wait(500);
    check('landing con sesion: se ve "Ir a mi panel" y no "Empezar gratis"',
      await page.$eval('a[href="/home"].btn-lg', (el) => el.offsetParent !== null) && await page.$eval('a[href="/auth/signin"].btn-lg', (el) => el.offsetParent === null));
    await page.click('a[href="/home"].btn-lg');
    await page.waitForFunction(() => location.pathname.endsWith('/home'), { timeout: 15000 }).catch(() => {});
    check('landing con sesion: "Ir a mi panel" abre la app', page.url().endsWith('/home') && (await has(page, 'sidebar')), page.url());
    check('suscripcion: la administracion ve la pestaña', await has(page, 'nav-subscription'));
    await (await page.$('[data-testid="nav-subscription"]')).click();
    await page.waitForSelector('[data-testid="plan-card"]', { timeout: 15000 });
    await wait(500);
    let t = await textOf(page);
    check('suscripcion: plan gratuito, uso 12 de 50 y cuota 4 trabajadores x 2 EUR', t.includes('Plan gratuito') && /12\s+de\s+50\s+gratuitos/.test(t) && t.includes('4 trabajadores × 2,00 € = 8,00 € al mes'), t.slice(0, 160).replace(/\n/g, ' '));
    check('suscripcion: sin scroll horizontal', (await overflowX(page)) <= 0);

    // Contratar: Stripe (simulado) devuelve a la app con ?checkout=success&session_id=...
    await (await page.$('[data-testid="sub-checkout"]')).click();
    await page.waitForFunction(() => document.body.innerText.includes('Suscripción activada'), { timeout: 20000 }).catch(() => {});
    t = await textOf(page);
    check('suscripcion: al volver del pago se confirma y se activa', t.includes('Suscripción activada') && t.includes('Suscripción activa') && t.includes('sin límite'), t.slice(0, 160).replace(/\n/g, ' '));
    check('suscripcion: la URL queda limpia (sin session_id)', page.url().endsWith('/subscription'), page.url());
    check('suscripcion: con plan activo se ofrece gestionar pago y facturas, no contratar', (await has(page, 'sub-portal')) && !(await has(page, 'sub-checkout')));

    // Cupo agotado visto por la administracion: enlace directo a Suscripcion
    await setBilling('blocked');
    await page.goto(BASE + '/tickets', { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="quota-blocked"]', { timeout: 15000 }).catch(() => {});
    check('cupo agotado: la administracion ve el enlace a Suscripcion', await has(page, 'quota-manage'));
    await (await page.$('[data-testid="quota-manage"]')).click();
    await page.waitForSelector('[data-testid="billing-blocked"]', { timeout: 15000 }).catch(() => {});
    t = await textOf(page);
    check('cupo agotado: Suscripcion avisa en rojo y ofrece contratar', page.url().endsWith('/subscription') && (await has(page, 'billing-blocked')) && (await has(page, 'sub-checkout')) && t.includes('Plan gratuito agotado'), page.url());
    check('sin errores de JS (suscripcion, admin)', bad(errors).length === 0, bad(errors).slice(0, 2).join(' || '));
    await ctx.close();
  }
  {
    await setBilling('blocked');
    const { page, ctx, errors } = await session(browser, { email: 'ana@demo.test', width: 390, height: 800 });
    await page.goto(BASE + '/tickets', { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="add-button"]', { timeout: 15000 });
    await wait(1000);
    check('movil: cupo agotado -> aviso y boton + desactivado', (await has(page, 'quota-blocked')) && (await disabledAttr(page, 'add-button')) === 'true');
    check('movil: cupo agotado sin scroll horizontal', (await overflowX(page)) <= 0, String(await overflowX(page)));
    check('sin errores de JS (cupo, movil)', bad(errors).length === 0, bad(errors).slice(0, 2).join(' || '));
    await ctx.close();
    await setBilling('free');
  }

  // ---- Usuario nuevo: alta con codigo de invitacion ----
  {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto(BASE + '/auth/login', { waitUntil: 'load', timeout: 60000 });
    await page.waitForSelector('[data-testid="login-email"]');
    await page.type('[data-testid="login-email"]', 'nuevo@demo.test');
    await page.type('[data-testid="login-password"]', 'x');
    await (await page.$('[data-testid="login-submit"]')).click();
    await page.waitForSelector('[data-testid="profile-code"]', { timeout: 20000 }).catch(() => {});
    check('sin ficha de empleado se va a completar el perfil', page.url().includes('/auth/completeProfile'), page.url());
    await page.type('[data-testid="profile-code"]', 'ZZZZZZZZ');
    await (await page.$('[data-testid="profile-validate"]')).click();
    await page.waitForFunction(() => document.body.innerText.includes('No se encontró organización'), { timeout: 10000 }).catch(() => {});
    check('codigo incorrecto: aviso visible', (await textOf(page)).includes('No se encontró organización'));
    await page.focus('[data-testid="profile-code"]');
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await page.type('[data-testid="profile-code"]', ' acme1234 ');
    await (await page.$('[data-testid="profile-validate"]')).click();
    await page.waitForSelector('[data-testid="profile-name"]', { timeout: 10000 }).catch(() => {});
    check('codigo valido (minusculas y espacios): muestra la organizacion', (await textOf(page)).includes('Acme Consulting S.L.'));
    await page.type('[data-testid="profile-name"]', 'Nuevo Empleado');
    await (await page.$('[data-testid="profile-save"]')).click();
    await page.waitForFunction(() => location.pathname.endsWith('/home'), { timeout: 20000 }).catch(() => {});
    await wait(1000);
    check('tras el alta se llega a la home con la barra lateral', page.url().endsWith('/home') && (await has(page, 'sidebar')), page.url());
    check('el nuevo empleado no es admin: sin Equipo ni Aprobaciones', !(await has(page, 'nav-settings')) && !(await has(page, 'nav-approvals')));
    check('sin errores de JS (alta)', bad(errors).length === 0, bad(errors).slice(0, 2).join(' || '));
    await ctx.close();
  }

  // ---- Recuperar contraseña ----
  {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto(BASE + '/auth/login', { waitUntil: 'load', timeout: 60000 });
    await page.waitForSelector('[data-testid="login-forgot"]');
    await page.click('[data-testid="login-forgot"]');
    await page.waitForSelector('[data-testid="forgot-email"]', { timeout: 10000 });
    check('el login enlaza a "¿Olvidaste tu contraseña?"', page.url().includes('/auth/forgot'), page.url());
    await page.type('[data-testid="forgot-email"]', 'ana@demo.test');
    await page.click('[data-testid="forgot-submit"]');
    await page.waitForFunction(() => document.body.innerText.includes('Si existe una cuenta con ese correo'), { timeout: 10000 }).catch(() => {});
    check('recuperar: mensaje generico tras enviar', (await textOf(page)).includes('Si existe una cuenta con ese correo'));

    // enlace caducado
    await page.goto(BASE + '/auth/reset#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired', { waitUntil: 'load' });
    await page.waitForFunction(() => document.body.innerText.includes('caducado'), { timeout: 10000 }).catch(() => {});
    check('enlace caducado: aviso y opcion de pedir otro', (await textOf(page)).includes('caducado') && (await has(page, 'reset-request-new')));

    // enlace valido: los tokens llegan en el fragmento, como hace Supabase
    const MOCK = process.env.MOCK_URL || 'http://127.0.0.1:54399';
    const tok = await (await fetch(MOCK + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ana@demo.test', password: 'x' }) })).json();
    await page.goto(BASE + '/auth/reset#access_token=' + tok.access_token + '&refresh_token=' + tok.refresh_token + '&type=recovery', { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="reset-password"]', { timeout: 15000 }).catch(() => {});
    check('enlace valido: formulario de nueva contraseña (no se redirige a la home)', (await has(page, 'reset-password')) && page.url().includes('/auth/reset'), page.url());
    check('los tokens desaparecen de la barra de direcciones', !page.url().includes('access_token'), page.url());
    await page.type('[data-testid="reset-password"]', 'clave-nueva-1');
    await page.type('[data-testid="reset-confirm"]', 'otra-distinta');
    await page.click('[data-testid="reset-submit"]');
    await page.waitForFunction(() => document.body.innerText.includes('no coinciden'), { timeout: 10000 }).catch(() => {});
    check('contraseñas distintas: aviso', (await textOf(page)).includes('no coinciden'));
    await page.focus('[data-testid="reset-confirm"]');
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await page.type('[data-testid="reset-confirm"]', 'clave-nueva-1');
    await page.click('[data-testid="reset-submit"]');
    await page.waitForFunction(() => document.body.innerText.includes('Contraseña actualizada'), { timeout: 10000 }).catch(() => {});
    check('guardada: "Contraseña actualizada"', (await textOf(page)).includes('Contraseña actualizada'));
    await page.click('[data-testid="reset-continue"]');
    await page.waitForFunction(() => location.pathname.endsWith('/home'), { timeout: 15000 }).catch(() => {});
    check('"Continuar" lleva a la home con la sesion abierta', page.url().endsWith('/home') && (await has(page, 'sidebar')), page.url());

    // correo confirmado
    const ctx2 = await browser.createBrowserContext();
    const p2 = await ctx2.newPage();
    await p2.goto(BASE + '/auth/confirmed', { waitUntil: 'load' });
    await p2.waitForFunction(() => document.body.innerText.includes('Correo confirmado'), { timeout: 10000 }).catch(() => {});
    check('/auth/confirmed: "Correo confirmado" y acceso al login', (await textOf(p2)).includes('Correo confirmado') && (await has(p2, 'confirmed-login')));
    await ctx2.close();
    check('sin errores de JS (recuperacion)', bad(errors).length === 0, bad(errors).slice(0, 2).join(' || '));
    await ctx.close();
  }

  // ---- Movil ----
  {
    const { page, ctx, errors } = await session(browser, { email: 'ana@demo.test', width: 390, height: 800 });
    check('movil: sin barra lateral', !(await has(page, 'sidebar')));
    check('movil: sin scroll horizontal', (await overflowX(page)) <= 0, String(await overflowX(page)));
    const t = await textOf(page);
    check('movil: dashboard con KPIs', t.includes('Hola, Ana') && t.includes('2.662,34 €'));
    check('sin errores de JS (movil)', bad(errors).length === 0, bad(errors).slice(0, 2).join(' || '));
    await ctx.close();
  }

  // ---- Login en escritorio ----
  {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(BASE + '/auth/login', { waitUntil: 'load', timeout: 60000 });
    await page.waitForSelector('[data-testid="login-email"]');
    check('login escritorio: panel de marca y formulario', (await has(page, 'auth-brand')) && (await has(page, 'login-email')));
    await ctx.close();
  }

  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => {
  console.log('ERR', e.message);
  process.exit(1);
});
