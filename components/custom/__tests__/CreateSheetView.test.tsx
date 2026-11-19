import * as React from 'react';
import { mount, press, text, type } from '../../../test-utils/render';

let mockEmployee: any = { id: 'e1', is_admin: false };
jest.mock('@/context/useAuth', () => () => ({ employee: mockEmployee }));
jest.mock('@/context/useAux', () => () => ({
  // orden alfabetico, como en AuxContext: el primero es "Aprobado"
  sheetStatuses: [{ id: 2, name: 'Aprobado' }, { id: 3, name: 'Rechazado' }, { id: 1, name: 'Pendiente' }],
}));

import CreateSheetView from '../CreateSheetView';

const fill = async (r: any, title = 'Viaje', project = 'Alfa') => {
  await type(r.root, 'sheet-title', title);
  await type(r.root, 'sheet-project', project);
};

describe('CreateSheetView', () => {
  beforeEach(() => {
    mockEmployee = { id: 'e1', is_admin: false };
  });

  it('REGRESION: no deja crear una hoja sin titulo ni proyecto', async () => {
    const onCreate = jest.fn();
    const r = await mount(<CreateSheetView onCreate={onCreate} />);
    await press(r.root, 'sheet-create');
    expect(onCreate).not.toHaveBeenCalled();
    expect(text(r.root)).toContain('El título es obligatorio');
    expect(text(r.root)).toContain('El proyecto es obligatorio');
  });

  it('REGRESION: un empleado normal siempre crea la hoja en estado Pendiente (1), no Aprobado', async () => {
    const onCreate = jest.fn().mockResolvedValue(null);
    const r = await mount(<CreateSheetView onCreate={onCreate} />);
    await fill(r);
    await press(r.root, 'sheet-create');
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate.mock.calls[0][0]).toEqual({
      title: 'Viaje', description: '', project: 'Alfa', approval_date: null, id_user: 'e1', id_status: '1',
    });
  });

  it('nadie ve selector de estado ni fecha de aprobacion: la hoja siempre nace pendiente (admin incluido)', async () => {
    for (const is_admin of [false, true]) {
      mockEmployee = { id: 'e1', is_admin };
      const r = await mount(<CreateSheetView />);
      expect(text(r.root)).not.toContain('Estado');
      expect(text(r.root)).not.toContain('aprobación');
    }
  });

  it('un admin tambien crea la hoja en estado Pendiente (1)', async () => {
    mockEmployee = { id: 'e1', is_admin: true };
    const onCreate = jest.fn().mockResolvedValue(null);
    const r = await mount(<CreateSheetView onCreate={onCreate} />);
    await fill(r);
    await press(r.root, 'sheet-create');
    expect(onCreate.mock.calls[0][0]).toMatchObject({ id_status: '1', approval_date: null });
  });

  it('si onCreate devuelve error se muestra y el formulario conserva los datos', async () => {
    const onCreate = jest.fn().mockResolvedValue('No se pudo crear la hoja. Inténtalo de nuevo');
    const r = await mount(<CreateSheetView onCreate={onCreate} />);
    await fill(r);
    await press(r.root, 'sheet-create');
    expect(text(r.root)).toContain('No se pudo crear la hoja');
    const title = r.root.findAll((n) => n.props.testID === 'sheet-title' && 'value' in n.props)[0];
    expect(title.props.value).toBe('Viaje');
  });

  it('titulo con solo espacios cuenta como vacio', async () => {
    const onCreate = jest.fn();
    const r = await mount(<CreateSheetView onCreate={onCreate} />);
    await fill(r, '    ', 'Alfa');
    await press(r.root, 'sheet-create');
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('sin empleado no se puede crear (id_user vacio)', async () => {
    mockEmployee = null;
    const onCreate = jest.fn();
    const r = await mount(<CreateSheetView onCreate={onCreate} />);
    await fill(r);
    await press(r.root, 'sheet-create');
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('doble pulsacion mientras se crea solo envia una vez', async () => {
    let done: (v: null) => void = () => {};
    const onCreate = jest.fn(() => new Promise<null>((res) => (done = res)));
    const r = await mount(<CreateSheetView onCreate={onCreate} />);
    await fill(r);
    const { act } = require('react-test-renderer');
    const tap = () => r.root.findAll((n) => n.props.testID === 'sheet-create' && typeof n.props.onPress === 'function')[0].props.onPress();
    await act(async () => { void tap(); });
    await act(async () => { void tap(); });
    expect(onCreate).toHaveBeenCalledTimes(1);
    await act(async () => { done(null); });
  });

  it('REGRESION: el aviso de un campo desaparece en cuanto se corrige (no hay que volver a pulsar Crear)', async () => {
    const r = await mount(<CreateSheetView onCreate={jest.fn()} />);
    await press(r.root, 'sheet-create');
    expect(text(r.root)).toContain('El título es obligatorio');
    expect(text(r.root)).toContain('El proyecto es obligatorio');
    await type(r.root, 'sheet-title', 'Viaje');
    expect(text(r.root)).not.toContain('El título es obligatorio');
    expect(text(r.root)).toContain('El proyecto es obligatorio'); // el otro sigue hasta que se corrija
    await type(r.root, 'sheet-project', 'Alfa');
    expect(text(r.root)).not.toContain('El proyecto es obligatorio');
  });
});
