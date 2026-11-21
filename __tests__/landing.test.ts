/**
 * Integridad de la landing publica (public/landing/index.html) y de su ruta en nginx.
 * Es HTML estatico: no hay componentes que probar, asi que se comprueba lo que se rompe en silencio
 * (imagenes que no existen, iconos sin definir, enlaces a secciones o rutas inexistentes, SEO).
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const html = fs.readFileSync(path.join(PUBLIC, 'landing', 'index.html'), 'utf8');
const nginx = fs.readFileSync(path.join(ROOT, 'nginx.conf'), 'utf8');
const all = (re: RegExp, s = html) => [...s.matchAll(re)].map((m) => m[1]);
const body = html.slice(html.indexOf('</svg>') + 6);

describe('landing: recursos', () => {
  it('todas las imagenes locales existen y llevan tamaño y texto alternativo', () => {
    const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
    expect(imgs.length).toBeGreaterThanOrEqual(9);
    for (const tag of imgs) {
      const src = /src="([^"]+)"/.exec(tag)?.[1] ?? '';
      expect(src).toMatch(/^\/landing\/img\//);
      expect(fs.existsSync(path.join(PUBLIC, src))).toBe(true);
      expect(tag).toMatch(/width="\d+"/);
      expect(tag).toMatch(/height="\d+"/);
      expect(/alt="([^"]{12,})"/.test(tag)).toBe(true);
    }
  });

  it('las capturas pesan poco (carga rapida)', () => {
    const dir = path.join(PUBLIC, 'landing', 'img');
    for (const f of fs.readdirSync(dir)) expect(fs.statSync(path.join(dir, f)).size).toBeLessThan(160 * 1024);
  });

  it('la imagen para redes (og.jpg) existe y las etiquetas la apuntan con URL absoluta', () => {
    expect(fs.existsSync(path.join(PUBLIC, 'landing', 'img', 'og.jpg'))).toBe(true);
    expect(html).toContain('<meta property="og:image" content="https://ticket.danipoal.com/landing/img/og.jpg">');
  });

  it('no carga nada de terceros (ni fuentes, ni scripts, ni estilos): privacidad y velocidad', () => {
    expect(all(/(?:src|href)="(https?:\/\/[^"]+)"/g, body)).toEqual([]);
    expect(html).not.toMatch(/<script[^>]+src=/);
    expect(html).not.toMatch(/<link[^>]+rel="stylesheet"/);
    expect(html).not.toMatch(/@import/);
  });
});

describe('landing: iconos y enlaces', () => {
  it('cada icono usado esta definido en el sprite', () => {
    const defined = new Set(all(/<symbol id="(i-[a-z0-9-]+)"/g));
    const used = new Set(all(/<use href="#(i-[a-z0-9-]+)"/g));
    expect(used.size).toBeGreaterThan(10);
    for (const u of used) expect(defined.has(u)).toBe(true);
    for (const d of defined) expect(used.has(d)).toBe(true); // sin iconos de sobra
  });

  it('los enlaces a secciones (#...) apuntan a ids que existen', () => {
    const ids = new Set(all(/\sid="([^"]+)"/g));
    const anchors = all(/href="#([a-z0-9-]+)"/g).filter((a) => !a.startsWith('i-'));
    expect(anchors.length).toBeGreaterThan(5);
    for (const a of anchors) expect(ids.has(a)).toBe(true);
  });

  it('los enlaces a la aplicacion usan rutas que existen', () => {
    const routes = new Set(['/', '/auth/login', '/auth/signin', '/home', '/subscription']);
    const internal = all(/href="(\/[^"#]*)"/g).filter((h) => !h.startsWith('/landing/') && !/^\/(favicon|apple-touch-icon|site\.webmanifest)/.test(h)); // los iconos se prueban en icons.test.ts
    expect(internal.length).toBeGreaterThan(5);
    for (const r of internal) expect(routes.has(r)).toBe(true);
    for (const r of ['auth/login', 'auth/signin']) expect(fs.existsSync(path.join(ROOT, 'app', `${r}.tsx`))).toBe(true);
    for (const r of ['home', 'subscription']) expect(fs.existsSync(path.join(ROOT, 'app', '(tabs)', `${r}.tsx`))).toBe(true);
  });

  it('los botones que cambian con la sesion van por parejas y [hidden] gana al display de los botones', () => {
    expect(html).toContain('[hidden]{display:none!important}');
    const hide = (html.match(/data-session-hide/g) ?? []).length;
    const show = (html.match(/data-session-show/g) ?? []).length;
    expect(hide).toBeGreaterThan(0);
    expect(show).toBeGreaterThan(0);
    for (const m of html.matchAll(/<a\b[^>]*data-session-show[^>]*>/g)) expect(m[0]).toContain('hidden');
  });
});

describe('landing: contenido, SEO y accesibilidad', () => {
  it('idioma, titulo y descripcion con longitud razonable, canonical y un unico h1', () => {
    expect(html).toContain('<html lang="es">');
    const title = /<title>([^<]+)<\/title>/.exec(html)![1];
    expect(title.length).toBeGreaterThan(20);
    expect(title.length).toBeLessThan(75);
    const desc = /<meta name="description" content="([^"]+)"/.exec(html)![1];
    expect(desc.length).toBeGreaterThan(80);
    expect(desc.length).toBeLessThanOrEqual(160); // Google corta a ~160 caracteres
    expect(html).toContain('<link rel="canonical" href="https://ticket.danipoal.com/">');
    expect((html.match(/<h1[\s>]/g) ?? []).length).toBe(1);
  });

  it('los datos estructurados son JSON valido y reflejan precio y limite', () => {
    const ld = JSON.parse(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/.exec(html)![1]);
    expect(ld['@type']).toBe('SoftwareApplication');
    const prices = ld.offers.map((o: any) => `${o.price}${o.priceCurrency}`);
    expect(prices).toEqual(['0EUR', '2EUR']);
    expect(JSON.stringify(ld)).toContain('50 tickets');
  });

  it('las cifras del negocio coinciden con las de la app: 50 tickets gratis y 2 EUR por trabajador', () => {
    const { FREE_TICKET_LIMIT, PRICE_PER_SEAT_CENTS } = require('../supabase/functions/_shared/stripe');
    expect(FREE_TICKET_LIMIT).toBe(50);
    expect(PRICE_PER_SEAT_CENTS).toBe(200);
    expect(body).toMatch(/<b>50<\/b><span>tickets gratis por empresa/);
    expect(body).toMatch(/<b>2 €<\/b><span>al mes por trabajador/);
    expect(body).toContain('<input id="n" type="range" min="1" max="200"');
    expect(html).toContain('fmt.format(v*2)'); // la calculadora usa 2 EUR por persona
  });

  it('aclara que los borrados cuentan y que el conector ERP es a medida (sin prometer de mas)', () => {
    expect(body).toMatch(/también cuentan: borrarlas no devuelve el cupo/);
    expect(body).toMatch(/el conector concreto se hace a medida/);
    expect(body).not.toMatch(/lorem ipsum|\bTODO\b|XXX/);
  });

  it('accesibilidad: saltar al contenido, landmarks, pestañas con roles y respeto a reduced-motion', () => {
    expect(html).toContain('class="skip" href="#contenido"');
    expect(html).toContain('<main id="contenido">');
    expect(html).toMatch(/<footer>/);
    expect(html).toContain('role="tablist"');
    expect((html.match(/role="tab"\s/g) ?? []).length).toBe(2);
    expect((html.match(/role="tabpanel"/g) ?? []).length).toBe(2);
    expect(html).toContain('prefers-reduced-motion:reduce');
    expect(html).toContain(':focus-visible');
    for (const sec of all(/<section[^>]*aria-labelledby="([^"]+)"/g)) expect(html).toContain(`id="${sec}"`);
  });

  it('REGRESION: en movil el encabezado conserva "Entrar" (antes solo quedaba "Crear cuenta")', () => {
    expect(html).not.toMatch(/max-width:860px\)\{[^}]*\.btn-ghost\{display:none\}/);
    expect(html).toContain('@media (max-width:520px){.nav .actions .btn-primary{display:none}');
  });

  it('sin JavaScript todo el contenido es visible (la animacion solo se activa con la clase js)', () => {
    expect(html).toContain('.js .rv{opacity:0');
    expect(html.replace('.js .rv{opacity:0', '')).not.toContain('.rv{opacity:0');
  });
});

describe('landing: robots, sitemap y nginx', () => {
  it('robots.txt permite la landing, oculta la app y apunta al sitemap', () => {
    const robots = fs.readFileSync(path.join(PUBLIC, 'robots.txt'), 'utf8');
    expect(robots).toContain('Allow: /$');
    for (const p of ['/auth/', '/home', '/tickets', '/approvals', '/settings', '/subscription']) expect(robots).toContain(`Disallow: ${p}`);
    expect(robots).toContain('Sitemap: https://ticket.danipoal.com/sitemap.xml');
  });

  it('sitemap.xml es valido y lista la raiz', () => {
    const xml = fs.readFileSync(path.join(PUBLIC, 'sitemap.xml'), 'utf8');
    expect(xml).toContain('<loc>https://ticket.danipoal.com/</loc>');
    expect(xml.startsWith('<?xml')).toBe(true);
  });

  it('nginx sirve la landing SOLO en la raiz exacta y deja el resto a la app', () => {
    expect(nginx).toMatch(/location = \/ \{[^}]*try_files \/landing\/index\.html =404;/);
    expect(nginx).toMatch(/location \/ \{[^}]*try_files \$uri \$uri\.html \$uri\/index\.html \/index\.html;/);
    expect(nginx).toMatch(/location \/landing\/img\/ \{[^}]*expires 30d;/);
  });
});
