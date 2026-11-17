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

  const real = pageErrors.filter(e => !/favicon|Failed to load resource/i.test(e));
  check('sin errores de JS en consola', real.length === 0, real.slice(0,3).join(' || '));
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})();
