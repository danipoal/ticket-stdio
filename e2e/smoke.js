// Smoke test e2e: ejecutar con e2e/run.sh
const puppeteer = require('puppeteer');
const BASE = process.env.BASE;
const fails = [];
const check = (name, ok, extra='') => { console.log((ok?'PASS ':'FAIL ')+name+(extra?' -> '+extra:'')); if(!ok) fails.push(name); };

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e)));
  page.on('console', m => { if (m.type()==='error') pageErrors.push('console: '+m.text()); });
  const bodyText = () => page.evaluate(() => document.body.innerText);
  const waitText = async (t, ms=8000) => { try { await page.waitForFunction(x => document.body.innerText.includes(x), {timeout: ms}, t); return true; } catch { return false; } };

  // ---- Landing publica en la raiz ----
  await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
  const land = await bodyText();
  check('/ es la landing publica (no redirige a la app)', land.includes('sin tickets perdidos') && !page.url().includes('/auth/'), page.url());
  check('landing: limite de 50 tickets y 2 euros por trabajador', land.includes('50 tickets') && land.includes('2 €') && land.includes('Tickets ilimitados'));
  check('landing: sin sesion solo se ve "Empezar gratis" (no "Ir a mi panel")',
    await page.$eval('a[href="/auth/signin"].btn-lg', (el) => el.offsetParent !== null) && await page.$eval('a[href="/home"].btn-lg', (el) => el.offsetParent === null));
  check('landing: todas las imagenes cargan', await page.evaluate(() => [...document.images].filter((i) => i.loading !== 'lazy').every((i) => i.complete && i.naturalWidth > 0)));
  check('landing: sin scroll horizontal', (await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0);
  await page.evaluate(() => { const n = document.getElementById('n'); n.value = '25'; n.dispatchEvent(new Event('input')); });
  check('landing: la calculadora da 2 EUR por trabajador (25 -> 50,00 €)', (await page.$eval('#out', (e) => e.textContent)).includes('50,00 €'), await page.$eval('#out', (e) => e.textContent));
  await page.click('#tab-sub');
  check('landing: las pestañas cambian de captura', await page.$eval('#p-sub', (e) => !e.hidden) && await page.$eval('#p-equipo', (e) => e.hidden));
  await page.click('details summary');
  check('landing: las preguntas se despliegan', await page.$eval('details', (e) => e.open));
  await page.click('header.top a[href="/auth/login"]');
  check('landing: "Entrar" lleva al login de la app', await waitText('Inicio sesión') && page.url().includes('/auth/login'), page.url());

  await page.goto(BASE + '/tickets', { waitUntil: 'networkidle0' });
  check('/tickets sin sesion redirige a login', await waitText('Inicio sesión'), page.url());
  check('url termina en /auth/login', page.url().includes('/auth/login'), page.url());

  await page.goto(BASE + '/auth/signin', { waitUntil: 'networkidle0' });
  check('/auth/signin se mantiene en registro', await waitText('Crear cuenta') && page.url().includes('/auth/signin'), page.url());

  await (await page.$('[data-testid="signin-submit"]')).click();
  check('registro vacio muestra errores', await waitText('El email es obligatorio'));
  await page.type('[data-testid="signin-email"]', 'no-es-email');
  await page.type('[data-testid="signin-password"]', '123');
  await (await page.$('[data-testid="signin-submit"]')).click();
  check('email invalido se avisa', await waitText('El email no es válido'));

  await page.goto(BASE + '/auth/login', { waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-testid="login-email"]');
  await page.type('[data-testid="login-email"]', 'smoke-test-no-existe@example.invalid');
  await page.type('[data-testid="login-password"]', 'clave-incorrecta-123');
  await (await page.$('[data-testid="login-submit"]')).click();
  if (process.env.SMOKE_ONLINE === '1') {
    // Necesita el Supabase real (build con .env.local): comprueba que el error se VE en la web.
    check('login incorrecto muestra mensaje visible', await waitText('Email o contraseña incorrectos', 15000), (await bodyText()).slice(0,120).replace(/\n/g,' | '));
  } else {
    // Sin backend real: al menos debe mostrarse algun aviso, no quedarse mudo.
    check('login fallido muestra algun aviso', await waitText('No se pudo iniciar sesión', 15000));
  }

  for (const p of ['/page', '/layout', '/auth/context/useAuth']) {
    await page.goto(BASE + p, { waitUntil: 'networkidle0' });
    const t = await bodyText();
    check(`${p} ya no es una pagina propia`, /Inicio sesión|Unmatched|not exist|Not Found|404/i.test(t) || page.url().includes('/auth/login'), page.url());
  }

  // Sin backend real (CI) el login fallido provoca un "Failed to fetch" esperado.
  const ignore = process.env.SMOKE_ONLINE === '1' ? /favicon|Failed to load resource/i : /favicon|Failed to load resource|Failed to fetch/i;
  const real = pageErrors.filter(e => !ignore.test(e));
  check('sin errores de JS en consola', real.length === 0, real.slice(0,3).join(' || '));
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})();
