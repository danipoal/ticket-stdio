// Regenera las capturas de public/landing/img/*.webp con los datos de demostracion del Supabase simulado.
//   1) node e2e/mock-supabase.js &
//   2) EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399 EXPO_PUBLIC_SUPABASE_KEY=mock npx expo export --platform web --clear --output-dir /tmp/demo-dist
//   3) servir /tmp/demo-dist con el nginx.conf del repo (docker run ... -p 19556:8081 nginx:alpine)
//   4) mkdir -p /tmp/sp/shots && chmod 777 /tmp/sp/shots && cp scripts/landing-shots.js /tmp/sp/shots.js
//      docker run --rm --network host -e BASE=http://127.0.0.1:19556 -v /tmp/sp:/home/pptruser/sp ghcr.io/puppeteer/puppeteer:latest node /home/pptruser/sp/shots.js
//   5) copiar /tmp/sp/shots/*.webp a public/landing/img/ (equipo y suscripcion se recortan a 1440x600)
// Capturas de demostracion para la landing (datos ficticios del Supabase simulado). Salida: webp.
const puppeteer = require('puppeteer');
const BASE = process.env.BASE;
const MOCK = 'http://127.0.0.1:54399';
const OUT = '/home/pptruser/sp/shots/';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (page, name, opts = {}) => page.screenshot({ path: OUT + name + '.webp', type: 'webp', quality: 84, ...opts });

async function login(browser, email, width, height, dpr = 1) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: dpr });
  page.on('pageerror', (e) => console.log('PAGEERROR', e));
  await page.goto(BASE + '/auth/login', { waitUntil: 'load', timeout: 60000 });
  await page.waitForSelector('[data-testid="login-email"]');
  await page.type('[data-testid="login-email"]', email);
  await page.type('[data-testid="login-password"]', 'x');
  await (await page.$('[data-testid="login-submit"]')).click();
  await page.waitForFunction(() => location.pathname.endsWith('/home'), { timeout: 20000 }).catch(() => {});
  await wait(1500);
  return page;
}

(async () => {
  await fetch(MOCK + '/__mock/billing?mode=free');
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });

  // Empleada: panel, hoja con lineas, formulario de linea
  let page = await login(browser, 'ana@demo.test', 1440, 900);
  await shot(page, 'panel');
  await page.goto(BASE + '/tickets', { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="sheet-open"]');
  await wait(800);
  await (await page.$$('[data-testid="sheet-open"]'))[2].click(); // hoja pendiente
  await page.waitForSelector('[data-testid="lines-table-head"]');
  await wait(900);
  await shot(page, 'tickets');
  await (await page.$('[data-testid="add-line"]')).click();
  await wait(700);
  await shot(page, 'linea');
  await page.close();

  // Administracion: aprobaciones, equipo, suscripcion
  page = await login(browser, 'admin@demo.test', 1440, 900);
  await page.goto(BASE + '/approvals', { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="sheet-open"]');
  await wait(800);
  await (await page.$('[data-testid="sheet-open"]')).click();
  await page.waitForSelector('[data-testid="approve-sheet"]');
  await wait(900);
  await shot(page, 'aprobaciones');
  await page.goto(BASE + '/settings', { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="team-table"]');
  await wait(900);
  await shot(page, 'equipo');
  await page.goto(BASE + '/subscription', { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="plan-card"]');
  await wait(900);
  await shot(page, 'suscripcion');
  await page.close();

  // Movil (2x): lista y detalle
  page = await login(browser, 'ana@demo.test', 390, 844, 2);
  await page.goto(BASE + '/tickets', { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="sheet-open"]');
  await wait(900);
  await shot(page, 'movil-lista');
  await (await page.$$('[data-testid="sheet-open"]'))[2].click();
  await wait(1200);
  await shot(page, 'movil-hoja');
  await page.goto(BASE + '/home', { waitUntil: 'load' });
  await wait(1500);
  await shot(page, 'movil-panel');
  await browser.close();
})();
