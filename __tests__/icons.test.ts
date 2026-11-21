/**
 * Iconos de marca (pestaña del navegador, iOS, Android/PWA y Expo): existen, tienen el tamaño y el tipo correctos,
 * estan enlazados desde la app y la landing y el manifest los describe bien.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const ASSETS = path.join(ROOT, 'assets', 'images');
const read = (p: string) => fs.readFileSync(p);

/** Cabecera PNG: ancho, alto y tipo de color (2 = RGB, 6 = RGBA, 3 = paleta). */
function png(p: string) {
  const b = read(p);
  expect(b.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a'); // firma PNG
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), colorType: b[25] };
}

describe('iconos web (public/)', () => {
  it.each([
    ['icon-192.png', 192, 6],
    ['icon-512.png', 512, 6],
    ['icon-maskable-512.png', 512, 6],
    ['apple-touch-icon.png', 180, 2], // iOS no admite transparencia: RGB
  ])('%s es un PNG de %ipx', (file, size, colorType) => {
    const h = png(path.join(PUBLIC, file));
    expect([h.w, h.h]).toEqual([size, size]);
    expect(h.colorType).toBe(colorType);
  });

  it('favicon.ico es un ICO real con 16, 32 y 48 px (no un PNG renombrado)', () => {
    const b = read(path.join(PUBLIC, 'favicon.ico'));
    expect(b.readUInt16LE(0)).toBe(0); // reservado
    expect(b.readUInt16LE(2)).toBe(1); // tipo icono
    const n = b.readUInt16LE(4);
    expect(n).toBe(3);
    const sizes = Array.from({ length: n }, (_, i) => b[6 + i * 16] || 256).sort((a, c) => a - c);
    expect(sizes).toEqual([16, 32, 48]);
  });

  it('favicon.svg es un SVG cuadrado con la marca (indigo y ticket blanco)', () => {
    const svg = read(path.join(PUBLIC, 'favicon.svg')).toString('utf8');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('viewBox="0 0 512 512"');
    expect(svg).toMatch(/#6366f1/i);
    expect(svg).toMatch(/#4338ca/i);
    expect(svg).toContain('fill="#fff"');
    expect(svg).not.toMatch(/<script|href="http/i);
  });

  it('todos pesan poco', () => {
    for (const f of ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'icon-192.png']) expect(fs.statSync(path.join(PUBLIC, f)).size).toBeLessThan(30 * 1024);
    for (const f of ['icon-512.png', 'icon-maskable-512.png']) expect(fs.statSync(path.join(PUBLIC, f)).size).toBeLessThan(100 * 1024);
  });
});

describe('iconos de Expo (assets/images)', () => {
  it('icono, adaptativo y splash de 1024 px; favicon de 48 px', () => {
    for (const f of ['icon.png', 'adaptive-icon.png', 'splash-icon.png']) {
      const h = png(path.join(ASSETS, f));
      expect([h.w, h.h]).toEqual([1024, 1024]);
    }
    const fav = png(path.join(ASSETS, 'favicon.png'));
    expect([fav.w, fav.h]).toEqual([48, 48]);
  });

  it('el icono de la tienda va a sangre y sin transparencia (RGB), como exigen iOS y Android', () => {
    expect(png(path.join(ASSETS, 'icon.png')).colorType).toBe(2);
  });

  it('el primer plano adaptativo y la splash conservan la transparencia (RGBA)', () => {
    expect(png(path.join(ASSETS, 'adaptive-icon.png')).colorType).toBe(6);
    expect(png(path.join(ASSETS, 'splash-icon.png')).colorType).toBe(6);
  });

  it('app.json usa los colores de marca en la splash y el fondo adaptativo (los de la pantalla de carga)', () => {
    const app = JSON.parse(read(path.join(ROOT, 'app.json')).toString('utf8')).expo;
    expect(app.android.adaptiveIcon.backgroundColor).toBe('#4f46e5');
    const splash = app.plugins.find((p: any) => Array.isArray(p) && p[0] === 'expo-splash-screen')[1];
    expect(splash.backgroundColor).toBe('#111827');
    expect(app.web.favicon).toBe('./assets/images/favicon.png');
    for (const f of [app.icon, app.android.adaptiveIcon.foregroundImage, splash.image, app.web.favicon]) expect(fs.existsSync(path.join(ROOT, f))).toBe(true);
  });
});

describe('manifest', () => {
  const manifest = JSON.parse(read(path.join(PUBLIC, 'site.webmanifest')).toString('utf8'));

  it('describe la app en castellano y se abre en el panel, instalable (standalone)', () => {
    expect(manifest.name).toBe('Ticket Stdio');
    expect(manifest.lang).toBe('es');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/home');
    expect(fs.existsSync(path.join(ROOT, 'app', '(tabs)', 'home.tsx'))).toBe(true);
    expect(manifest.scope).toBe('/');
  });

  it('colores de marca: tema indigo y fondo del splash', () => {
    expect(manifest.theme_color).toBe('#4f46e5');
    expect(manifest.background_color).toBe('#111827');
  });

  it('cada icono declarado existe, con el tamaño y el tipo que dice', () => {
    expect(manifest.icons.length).toBeGreaterThanOrEqual(3);
    for (const i of manifest.icons) {
      const file = path.join(PUBLIC, i.src.replace(/^\//, ''));
      expect(fs.existsSync(file)).toBe(true);
      const h = png(file);
      expect(i.sizes).toBe(`${h.w}x${h.h}`);
      expect(i.type).toBe('image/png');
    }
    const purposes = manifest.icons.map((i: any) => i.purpose);
    expect(purposes).toContain('any');
    expect(purposes).toContain('maskable'); // Android recorta el icono: necesita la variante con zona segura
    expect(manifest.icons.some((i: any) => i.sizes === '512x512')).toBe(true);
    expect(manifest.icons.some((i: any) => i.sizes === '192x192')).toBe(true);
  });
});

describe('enlaces en el HTML', () => {
  const html = read(path.join(ROOT, 'app', '+html.tsx')).toString('utf8');
  const landing = read(path.join(PUBLIC, 'landing', 'index.html')).toString('utf8');

  it.each([
    ['app (+html.tsx)', html],
    ['landing', landing],
  ])('%s enlaza ico, svg, apple-touch-icon y manifest, y los ficheros existen', (_n, src) => {
    for (const href of ['/favicon.ico', '/favicon.svg', '/apple-touch-icon.png', '/site.webmanifest']) {
      expect(src).toContain(`href="${href}"`);
      expect(fs.existsSync(path.join(PUBLIC, href.slice(1)))).toBe(true);
    }
    expect(src).toMatch(/type="image\/svg\+xml"/);
    expect(src).toMatch(/rel="manifest"/);
  });

  it('el orden es ico (compatibilidad) y luego svg (navegadores modernos)', () => {
    expect(html.indexOf('/favicon.ico')).toBeLessThan(html.indexOf('/favicon.svg'));
    expect(landing.indexOf('/favicon.ico')).toBeLessThan(landing.indexOf('/favicon.svg'));
  });

  it('el color del tema coincide con el del manifest', () => {
    expect(html).toContain('name="theme-color" content="#4f46e5"');
    expect(landing).toContain('name="theme-color" content="#4f46e5"');
  });
});

describe('nginx', () => {
  const nginx = read(path.join(ROOT, 'nginx.conf')).toString('utf8');
  const m = /location ~ (\^[^ ]+\$) \{[^}]*expires 7d;/.exec(nginx);

  it('cachea los iconos de la raiz una semana', () => {
    expect(m).not.toBeNull();
  });

  it('la expresion cubre todos los iconos y solo esos', () => {
    const re = new RegExp(m![1].replace(/\\\\/g, '\\'));
    for (const f of ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png']) expect(re.test('/' + f)).toBe(true);
    for (const f of ['home', 'robots.txt', 'favicon.ico.html', 'icon-192.png/x', 'landing/index.html', 'site.webmanifest']) expect(re.test('/' + f)).toBe(false);
  });

  it('REGRESION: el manifest se sirve como application/manifest+json (nginx:alpine lo daba como octet-stream)', () => {
    expect(nginx).toMatch(/location = \/site\.webmanifest \{[^}]*types \{ \}[^}]*default_type application\/manifest\+json;/);
  });
});
