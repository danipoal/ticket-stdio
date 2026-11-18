// Flujos e2e con el Supabase simulado (e2e/mock-supabase.js): el build debe haberse
// generado con EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321. Ver e2e/run.sh.
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
    await (await page.$('[data-testid="nav-settings"]')).click();
    await page.waitForSelector('[data-testid="team-table"]');
    await wait(800);
    const t = await textOf(page);
    check('equipo: tabla con personas y total', t.includes('Ana Pérez') && t.includes('Luis Gómez') && t.includes('3.892,07 €'), t.slice(0, 60).replace(/\n/g, ' '));
    check('sin errores de JS (admin)', bad(errors).length === 0, bad(errors).slice(0, 2).join(' || '));
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
