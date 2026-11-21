import * as React from 'react';

jest.mock('expo-router/html', () => ({ ScrollViewStyleReset: () => null }));

import Root from '@/app/+html';

/** HTML de arranque (app/+html.tsx): lo que se ve antes de que cargue el JavaScript. */
describe('HTML de arranque', () => {
  let html: string;
  beforeAll(() => {
    const { renderToStaticMarkup } = require('react-dom/server');
    html = renderToStaticMarkup(<Root><div id="root" /></Root>);
  });

  it('declara el idioma, el titulo de marca y el viewport', () => {
    expect(html).toContain('<html lang="es">');
    // El titulo lo pone <Head> en app/_layout.tsx: aqui no puede haber otro <title> (Helmet inserta uno vacio delante y gana el primero)
    expect(html).not.toContain('<title');
    expect(html).toContain('name="viewport"');
    expect(html).toContain('name="theme-color"');
  });

  it('lleva la pantalla de carga de marca (#boot) accesible, con el logo, el nombre y el estado', () => {
    expect(html).toContain('id="boot"');
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-label="Cargando Ticket Stdio"');
    expect(html).toContain('Ticket Stdio</b>');
    expect(html).toContain('Cargando…');
    expect(html).toContain('<svg'); // el logo (icono de ticket)
  });

  it('el splash va DESPUES del contenedor de la app y la app lo retira (BootSplash busca #boot)', () => {
    expect(html.indexOf('id="root"')).toBeLessThan(html.indexOf('id="boot"'));
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'components', 'custom', 'BootSplash.tsx'), 'utf8');
    expect(src).toContain("getElementById('boot')?.remove()");
  });

  it('mismos colores de marca que la pantalla de la app (navy, indigo y turquesa) para que el relevo no se note', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'components', 'custom', 'BootSplash.tsx'), 'utf8');
    for (const c of ['#111827', '#4f46e5', '#0891b2']) {
      expect(html.toLowerCase()).toContain(c);
      expect(src.toLowerCase()).toContain(c);
    }
  });

  it('respeta prefers-reduced-motion y avisa si no hay JavaScript', () => {
    expect(html).toContain('prefers-reduced-motion:reduce');
    expect(html).toContain('necesita JavaScript');
    expect(html).toContain('<noscript>');
  });

  it('no carga nada de terceros', () => {
    expect(html).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
  });
});
