import * as React from 'react';
import { mount, press, text } from '../../../test-utils/render';
import { Avatar, Banner, CategoryPill, Chip, EmptyState, IconButton, StatTile, StatusBadge, categoryColor } from '../ui';
import { chartColors, statusStyle } from '@/constants/theme';

describe('StatusBadge / statusStyle', () => {
  it.each([[1, 'Pendiente'], [2, 'Aprobado'], [3, 'Rechazado'], [undefined, 'Sin estado'], [null, 'Sin estado'], [99, 'Sin estado']])(
    'estado %p -> %s', async (id, label) => {
      expect(statusStyle(id as any).label).toBe(label);
      const r = await mount(<StatusBadge statusId={id as any} />);
      expect(text(r.root)).toContain(label);
    }
  );
  it('usa la etiqueta que llegue del backend si existe', async () => {
    const r = await mount(<StatusBadge statusId={2} label="Validada" />);
    expect(text(r.root)).toContain('Validada');
  });
  it('cada estado tiene colores distintos', () => {
    const c = [1, 2, 3].map((i) => statusStyle(i).fg);
    expect(new Set(c).size).toBe(3);
  });
});

describe('CategoryPill / categoryColor', () => {
  it('mismo id, mismo color; ids distintos reparten colores y lo desconocido es gris', () => {
    expect(categoryColor(3)).toBe(categoryColor('3'));
    expect(categoryColor(1)).not.toBe(categoryColor(2));
    expect(categoryColor(null)).toBe(chartColors[chartColors.length - 1]);
    expect(categoryColor('x')).toBe(chartColors[chartColors.length - 1]);
  });
  it('muestra el nombre; sin nombre pinta un guion', async () => {
    const a = await mount(<CategoryPill name="Transporte" colorKey={1} />);
    expect(text(a.root)).toContain('Transporte');
    const b = await mount(<CategoryPill name={undefined} />);
    expect(text(b.root)).toBe('-');
  });
});

describe('StatTile / Banner / EmptyState / IconButton', () => {
  it('StatTile muestra etiqueta y valor', async () => {
    const r = await mount(<StatTile label="Total" value="10,00 €" highlight testID="t" />);
    expect(text(r.root)).toContain('Total');
    expect(text(r.root)).toContain('10,00 €');
  });
  it('Banner muestra su texto y los de peligro se anuncian como alerta', async () => {
    const r = await mount(<Banner tone="danger" testID="b">Algo falló</Banner>);
    expect(text(r.root)).toContain('Algo falló');
    const host = (root: any, id: string) => root.findAll((n: any) => typeof n.type === 'string' && n.props.testID === id)[0];
    expect(host(r.root, 'b').props.accessibilityRole).toBe('alert');
    const info = await mount(<Banner testID="i">Ojo</Banner>);
    expect(host(info.root, 'i').props.accessibilityRole).toBeUndefined();
  });
  it('EmptyState muestra titulo y pista opcional', async () => {
    const a = await mount(<EmptyState title="Vacío" hint="Haz esto" />);
    expect(text(a.root)).toContain('Vacío');
    expect(text(a.root)).toContain('Haz esto');
    const b = await mount(<EmptyState title="Solo título" />);
    expect(text(b.root)).toBe('Solo título');
  });
  it('IconButton es un boton accesible que responde al toque', async () => {
    const onPress = jest.fn();
    const r = await mount(<IconButton testID="ib" label="Borrar" onPress={onPress}><></></IconButton>);
    const el = r.root.findAll((n) => typeof n.type === 'string' && n.props.testID === 'ib')[0];
    expect(el.props.accessibilityLabel).toBe('Borrar');
    await press(r.root, 'ib');
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('Chip / Avatar', () => {
  it('Chip muestra contador y responde al toque', async () => {
    const onPress = jest.fn();
    const r = await mount(<Chip testID="c" label="Pendientes" count={4} onPress={onPress} />);
    expect(text(r.root)).toMatch(/Pendientes\s*4/);
    await press(r.root, 'c');
    expect(onPress).toHaveBeenCalledTimes(1);
  });
  it('Avatar pinta las iniciales', async () => {
    const r = await mount(<Avatar text="AP" />);
    expect(text(r.root)).toContain('AP');
  });
});
