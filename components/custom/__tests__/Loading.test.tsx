import * as React from 'react';
import { mount, text } from '../../../test-utils/render';
import { LoadingState, Skeleton, SheetListSkeleton } from '../Loading';

const find = (r: any, id: string) => r.root.findAll((n: any) => typeof n.type === 'string' && n.props.testID === id);

describe('LoadingState', () => {
  it('indicador + texto, accesible como barra de progreso con el mismo texto', async () => {
    const r = await mount(<LoadingState label="Cargando tickets..." />);
    expect(text(r.root)).toContain('Cargando tickets...');
    const node = find(r, 'loading-state')[0];
    expect(node.props.accessibilityRole).toBe('progressbar');
    expect(node.props.accessibilityLabel).toBe('Cargando tickets...');
    expect(r.root.findAll((n: any) => n.type === 'ActivityIndicator').length).toBeGreaterThan(0);
  });
  it('admite testID propio y modo compacto', async () => {
    const r = await mount(<LoadingState label="x" testID="mi-carga" compact />);
    expect(find(r, 'mi-carga')).toHaveLength(1);
  });
});

describe('SheetListSkeleton / Skeleton', () => {
  it('pinta tantos marcadores como se pide y lleva su texto accesible (no hay texto visible)', async () => {
    const r = await mount(<SheetListSkeleton count={3} label="Cargando tickets..." />);
    const root = find(r, 'sheet-list-skeleton')[0];
    expect(root.props.accessibilityLabel).toBe('Cargando tickets...');
    expect(root.props.accessibilityRole).toBe('progressbar');
    expect(text(r.root)).toBe('');
  });
  it('por defecto cuatro tarjetas', async () => {
    const r = await mount(<SheetListSkeleton />);
    const cards = find(r, 'sheet-list-skeleton')[0].children.length;
    expect(cards).toBe(4);
  });
  it('un Skeleton suelto se monta sin romper', async () => {
    await expect(mount(<Skeleton style={{ height: 10, width: 40 }} />)).resolves.toBeTruthy();
  });
});
