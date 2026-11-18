import * as React from 'react';
import { mount, text } from '../../../test-utils/render';
import { BarChart, Donut, HBars } from '../charts';

describe('BarChart', () => {
  const data = [
    { key: '2026-09', label: 'sep', value: 100 },
    { key: '2026-10', label: 'oct', value: 0 },
    { key: '2026-11', label: 'nov', value: 250.4 },
  ];
  it('pinta una etiqueta por mes y el valor redondeado solo si > 0', async () => {
    const r = await mount(<BarChart data={data} />);
    // react-native-svg no genera nodos de texto "host": se comprueba sobre el arbol serializado
    const t = JSON.stringify(r.toJSON());
    expect(t).toContain('sep');
    expect(t).toContain('oct');
    expect(t).toContain('nov');
    expect(t).toContain('250');
    expect(t).toContain('100');
    expect(t).not.toContain('"0"'); // el mes a 0 no escribe "0" encima de la barra
  });
  it('todo a cero o vacio no revienta (division por 0)', async () => {
    await expect(mount(<BarChart data={data.map((d) => ({ ...d, value: 0 }))} />)).resolves.toBeTruthy();
    await expect(mount(<BarChart data={[]} />)).resolves.toBeTruthy();
  });
});

describe('Donut', () => {
  it('muestra el texto central y un arco por porcion', async () => {
    const r = await mount(
      <Donut slices={[{ id: 'a', label: 'A', value: 3 }, { id: 'b', label: 'B', value: 1 }]} center={{ top: '4', bottom: 'hojas' }} />
    );
    expect(text(r.root)).toContain('hojas');
    const circles = r.root.findAll((n) => (n.type as any)?.displayName === 'Circle' || (n.type as any)?.name === 'Circle');
    expect(circles.length).toBeGreaterThanOrEqual(2);
  });
  it('sin datos (total 0) solo dibuja el aro de fondo', async () => {
    await expect(mount(<Donut slices={[{ id: 'a', label: 'A', value: 0 }]} />)).resolves.toBeTruthy();
  });
});

describe('HBars', () => {
  it('muestra etiqueta, importe formateado y porcentaje', async () => {
    const r = await mount(
      <HBars items={[{ id: '1', label: 'Comidas', value: 1234.5, share: 0.62 }, { id: '2', label: 'Otros', value: 100, share: 0.05 }]} />
    );
    const t = text(r.root).replace(/\s+/g, ' ');
    expect(t).toContain('Comidas');
    expect(t).toContain('1.234,50 €');
    expect(t).toMatch(/62 ?%/);
    expect(t).toMatch(/\b5 ?%/);
  });
  it('lista vacia -> texto', async () => {
    const r = await mount(<HBars items={[]} />);
    expect(text(r.root)).toContain('Sin datos todavía');
    const r2 = await mount(<HBars items={[]} emptyText="Nada" />);
    expect(text(r2.root)).toContain('Nada');
  });
});
