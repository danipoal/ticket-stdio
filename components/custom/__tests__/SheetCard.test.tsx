import * as React from 'react';
import { mount, press, text } from '../../../test-utils/render';
import SheetCard from '../SheetCard';
import { palette } from '@/constants/theme';

const base: any = {
  id: 1, title: 'Viaje', description: 'Reunión', project: 'Alfa', total_amount: '1234.5',
  create_date: '2025-03-04', approval_date: '', id_user: 'e1', status: { id: 1, name: 'Pendiente' },
};

describe('SheetCard', () => {
  it('muestra titulo, proyecto e importe con 2 decimales', async () => {
    const r = await mount(<SheetCard sheet={base} />);
    const t = text(r.root);
    expect(t).toContain('Viaje');
    expect(t).toContain('Alfa');
    expect(t).toMatch(/1\.?234,50/);
  });

  it('REGRESION: create_date null/invalida no pinta "Invalid Date"', async () => {
    for (const create_date of [null, '', 'basura', undefined]) {
      const r = await mount(<SheetCard sheet={{ ...base, create_date }} />);
      expect(text(r.root)).not.toContain('Invalid Date');
    }
  });

  it('importe ausente no pinta undefined ni NaN', async () => {
    const r = await mount(<SheetCard sheet={{ ...base, total_amount: undefined }} />);
    expect(text(r.root)).not.toMatch(/undefined|NaN/);
    expect(text(r.root)).toContain('0,00');
  });

  it('estado ausente no rompe (status null)', async () => {
    await expect(mount(<SheetCard sheet={{ ...base, status: null }} />)).resolves.toBeTruthy();
  });

  it('pulsar abre y pulsar la papelera elimina, cada uno con su callback', async () => {
    const onPress = jest.fn();
    const onDelete = jest.fn();
    const r = await mount(<SheetCard sheet={base} onPress={onPress} onDelete={onDelete} />);
    await press(r.root, 'sheet-open');
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();
    await press(r.root, 'sheet-delete');
    expect(onDelete).toHaveBeenCalledWith(base);
  });

  it('barra de color por estado: aprobado verde, rechazado rojo, pendiente ambar (mismo diseno que escritorio)', async () => {
    const accent = async (id: number) => {
      const r = await mount(<SheetCard sheet={{ ...base, status: { id, name: 'x' } }} />);
      const bar = r.root.findAll((n: any) => typeof n.type === 'string' && JSON.stringify(n.props.style ?? '').includes('"width":4'))[0];
      return JSON.stringify(bar.props.style);
    };
    expect(await accent(2)).toContain(palette.success);
    expect(await accent(3)).toContain(palette.danger);
    expect(await accent(1)).toContain(palette.warning);
  });

  it('muestra la referencia y el proyecto con iconos; sin proyecto dice "Sin proyecto"', async () => {
    const r = await mount(<SheetCard sheet={{ ...base, reference: 'HG-000007', project: '' }} />);
    expect(text(r.root)).toContain('HG-000007');
    expect(text(r.root)).toContain('Sin proyecto');
  });

  it('REGRESION: sin onDelete no hay papelera (hojas aprobadas)', async () => {
    const r = await mount(<SheetCard sheet={base} onPress={jest.fn()} />);
    expect(r.root.findAll((n) => n.props.testID === 'sheet-delete')).toHaveLength(0);
  });
});
