import * as React from 'react';
import { mount, press, text } from '../../../test-utils/render';
import { Avatar, Chip, StatusBadge } from '../ui';
import { statusStyle } from '@/constants/theme';

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
