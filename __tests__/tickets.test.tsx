import * as React from 'react';
import { flush, mount, press, text, type } from '../test-utils/render';
import { db } from '../test-utils/supabaseMock';

jest.mock('@/utils/supabase', () => ({ supabase: require('../test-utils/supabaseMock').db.client }));
let mockEmployee: any = { id: 'e1', is_admin: false };
jest.mock('@/context/useAuth', () => () => ({ employee: mockEmployee }));
jest.mock('@/context/useAux', () => () => ({ paymentTypes: [], categories: [], sheetStatuses: [] }));
const mockConfirm = jest.fn();
jest.mock('@/utils/confirm', () => ({ confirmAction: (...a: any[]) => mockConfirm(...a) }));
jest.mock('expo-file-system', () => ({}));
jest.mock('expo-sharing', () => ({}));
jest.mock('expo-image-picker', () => ({ MediaTypeOptions: { Images: 'Images' } }));
jest.mock('expo-web-browser', () => ({}));

import TicketsScreen from '@/app/(tabs)/tickets';

const sheetRow = (id: number, title: string, statusId = 1): any => ({
  id, title, description: '', project: 'P', total_amount: '10', create_date: '2025-03-0' + id,
  approval_date: '', id_user: 'e1', status: { id: statusId, name: statusId === 1 ? 'Pendiente' : 'Aprobado' },
});

const sheetsQuery = () => db.calls.filter((c) => c.table === 'expense_sheet_with_total');

describe('TicketsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.reset();
    mockEmployee = { id: 'e1', is_admin: false };
    mockConfirm.mockResolvedValue(true);
    db.on('Expense_line', 'select', { data: [] });
  });

  it('lista las hojas del empleado', async () => {
    db.on('expense_sheet_with_total', 'select', { data: [sheetRow(1, 'Hoja uno'), sheetRow(2, 'Hoja dos')] });
    const r = await mount(<TicketsScreen />);
    expect(text(r.root)).toContain('Hoja uno');
    expect(text(r.root)).toContain('Hoja dos');
    expect(sheetsQuery()[0].filters).toEqual([['id_user', 'e1']]);
  });

  it('REGRESION: sin ficha de empleado no se queda en "Cargando tickets..."', async () => {
    mockEmployee = null;
    const r = await mount(<TicketsScreen />);
    expect(text(r.root)).not.toContain('Cargando tickets');
    expect(sheetsQuery()).toHaveLength(0);
  });

  it('lista vacia -> mensaje', async () => {
    db.on('expense_sheet_with_total', 'select', { data: [] });
    const r = await mount(<TicketsScreen />);
    expect(text(r.root)).toContain('No tienes tickets todavía');
  });

  it('error de carga -> mensaje de error', async () => {
    db.on('expense_sheet_with_total', 'select', { error: { message: 'x' } });
    const r = await mount(<TicketsScreen />);
    expect(text(r.root)).toContain('Error cargando tickets');
  });

  it('REGRESION: eliminar pide confirmacion y si se cancela NO borra', async () => {
    db.on('expense_sheet_with_total', 'select', { data: [sheetRow(1, 'Hoja uno')] });
    mockConfirm.mockResolvedValue(false);
    const r = await mount(<TicketsScreen />);
    await press(r.root, 'sheet-delete');
    expect(mockConfirm).toHaveBeenCalledTimes(1);
    expect(mockConfirm.mock.calls[0][1]).toContain('Hoja uno');
    expect(db.calls.some((c) => c.op === 'delete')).toBe(false);
  });

  it('confirmando, borra la hoja por id y recarga la lista', async () => {
    db.on('expense_sheet_with_total', 'select', { data: [sheetRow(1, 'Hoja uno')] });
    db.on('Expense_sheet', 'delete', { data: [{ id: 1 }] });
    const r = await mount(<TicketsScreen />);
    await press(r.root, 'sheet-delete');
    const del = db.calls.find((c) => c.op === 'delete');
    expect(del?.table).toBe('Expense_sheet');
    expect(del?.filters).toEqual([['id', 1]]);
    expect(sheetsQuery().length).toBeGreaterThanOrEqual(2); // recargó
  });

  it('REGRESION: si falla el borrado se avisa y la lista NO desaparece', async () => {
    db.on('expense_sheet_with_total', 'select', { data: [sheetRow(1, 'Hoja uno')] });
    db.on('Expense_sheet', 'delete', { error: { message: 'rls' } });
    const r = await mount(<TicketsScreen />);
    await press(r.root, 'sheet-delete');
    expect(text(r.root)).toContain('No se pudo eliminar la hoja');
    expect(text(r.root)).toContain('Hoja uno');
  });

  it('pide las hojas ordenadas por fecha de creacion descendente (orden estable)', async () => {
    db.on('expense_sheet_with_total', 'select', { data: [] });
    await mount(<TicketsScreen />);
    expect(sheetsQuery()[0].order).toEqual(['create_date', { ascending: false }]);
  });

  describe('crear hoja', () => {
    const openForm = async (r: any) => {
      await press(r.root, 'add-button');
      await type(r.root, 'sheet-title', 'Nueva');
      await type(r.root, 'sheet-project', 'Beta');
    };

    it('crea con estado pendiente, cierra el formulario y recarga', async () => {
      db.on('expense_sheet_with_total', 'select', { data: [] });
      db.on('Expense_sheet', 'insert', { data: { id: 9 } });
      const r = await mount(<TicketsScreen />);
      await openForm(r);
      await press(r.root, 'sheet-create');
      const ins = db.calls.find((c) => c.op === 'insert');
      expect(ins?.payload).toMatchObject({ title: 'Nueva', project: 'Beta', id_user: 'e1', id_status: '1', approval_date: null });
      expect(text(r.root)).not.toContain('Nueva hoja de gastos');
      expect(sheetsQuery().length).toBeGreaterThanOrEqual(2);
    });

    it('REGRESION: si el insert falla el formulario sigue abierto con aviso (antes se cerraba y se perdia todo)', async () => {
      db.on('expense_sheet_with_total', 'select', { data: [] });
      db.on('Expense_sheet', 'insert', { error: { message: 'rls' } });
      const r = await mount(<TicketsScreen />);
      await openForm(r);
      await press(r.root, 'sheet-create');
      expect(text(r.root)).toContain('Nueva hoja de gastos');
      expect(text(r.root)).toContain('No se pudo crear la hoja');
    });

    it('con el formulario abierto no se muestra "No tienes tickets" (regresion)', async () => {
      db.on('expense_sheet_with_total', 'select', { data: [] });
      const r = await mount(<TicketsScreen />);
      expect(text(r.root)).toContain('No tienes tickets');
      await press(r.root, 'add-button');
      expect(text(r.root)).not.toContain('No tienes tickets');
    });
  });

  describe('detalle (propietario)', () => {
    it('REGRESION: el propietario NO ve botones de aprobar/rechazar (ya no se aprueba a si mismo)', async () => {
      db.on('expense_sheet_with_total', 'select', { data: [sheetRow(1, 'Hoja uno', 1)] });
      const r = await mount(<TicketsScreen />);
      await press(r.root, 'sheet-open');
      expect(r.root.findAll((n) => n.props.testID === 'approve-sheet')).toHaveLength(0);
      expect(r.root.findAll((n) => n.props.testID === 'reject-sheet')).toHaveLength(0);
      expect(text(r.root)).toContain('Pendiente de aprobación');
    });

    it('hoja rechazada: aviso y "Reenviar a aprobacion" pasa a pendiente (3 -> 1) y refresca la lista', async () => {
      let resubmitted = false;
      db.on('expense_sheet_with_total', 'select', () => ({ data: [sheetRow(1, 'Hoja uno', resubmitted ? 1 : 3)] }));
      db.on('Expense_sheet', 'update', () => ((resubmitted = true), { data: null }));
      const r = await mount(<TicketsScreen />);
      await press(r.root, 'sheet-open');
      expect(text(r.root)).toContain('Hoja rechazada');
      expect(r.root.findAll((n) => n.props.testID === 'add-line')).toHaveLength(0);
      const before = sheetsQuery().length;
      await press(r.root, 'resubmit-sheet');
      await flush();
      expect(db.calls.find((c) => c.op === 'update')?.payload).toEqual({ id_status: '1' });
      expect(sheetsQuery().length).toBeGreaterThan(before);
      expect(text(r.root)).toContain('Pendiente de aprobación');
      expect(r.root.findAll((n) => n.props.testID === 'resubmit-sheet')).toHaveLength(0);
    });
  });

  describe('correcciones de las pruebas reales en produccion', () => {
    it('REGRESION: una hoja APROBADA no ofrece papelera (la base de datos no deja borrarla y no avisaba)', async () => {
      db.on('expense_sheet_with_total', 'select', { data: [sheetRow(1, 'Pendiente uno', 1), sheetRow(2, 'Aprobada dos', 2), sheetRow(3, 'Rechazada tres', 3)] });
      const r = await mount(<TicketsScreen />);
      const trashes = r.root.findAll((n) => n.props.testID === 'sheet-delete' && typeof n.type === 'string'); // solo nodos reales
      expect(trashes).toHaveLength(2); // pendiente y rechazada; la aprobada no
    });

    it('REGRESION: si el DELETE devuelve 0 filas (RLS) se avisa y la hoja sigue en la lista', async () => {
      db.on('expense_sheet_with_total', 'select', { data: [sheetRow(1, 'Hoja uno', 1)] });
      db.on('Expense_sheet', 'delete', { data: [] });
      const r = await mount(<TicketsScreen />);
      await press(r.root, 'sheet-delete');
      expect(text(r.root)).toContain('No se puede eliminar esta hoja');
      expect(text(r.root)).toContain('Hoja uno');
    });

    it('al borrar una hoja se eliminan antes sus adjuntos del bucket privado', async () => {
      db.on('expense_sheet_with_total', 'select', { data: [sheetRow(1, 'Hoja uno', 1)] });
      db.on('Expense_line', 'select', { data: [{ foto_path: 'expense-lines/1/a.png' }, { foto_path: null }, { foto_path: 'expense-lines/1/b.png' }] });
      db.on('Expense_sheet', 'delete', { data: [{ id: 1 }] });
      const r = await mount(<TicketsScreen />);
      await press(r.root, 'sheet-delete');
      expect(db.storageRemove).toHaveBeenCalledWith(['expense-lines/1/a.png', 'expense-lines/1/b.png']);
      // antes de borrar la fila: despues la politica de storage ya no ve la hoja
      const order = db.calls.map((c) => c.op);
      expect(order.indexOf('delete')).toBeGreaterThan(order.indexOf('select', 1));
    });

    it('sin adjuntos no llama a Storage; y si Storage falla igualmente se borra la hoja', async () => {
      db.on('expense_sheet_with_total', 'select', { data: [sheetRow(1, 'Hoja uno', 1)] });
      db.on('Expense_line', 'select', { data: [{ foto_path: null }] });
      db.on('Expense_sheet', 'delete', { data: [{ id: 1 }] });
      let r = await mount(<TicketsScreen />);
      await press(r.root, 'sheet-delete');
      expect(db.storageRemove).not.toHaveBeenCalled();

      db.reset();
      mockConfirm.mockResolvedValue(true);
      db.on('expense_sheet_with_total', 'select', { data: [sheetRow(1, 'Hoja uno', 1)] });
      db.on('Expense_line', 'select', { data: [{ foto_path: 'x.png' }] });
      db.on('Expense_sheet', 'delete', { data: [{ id: 1 }] });
      db.storageRemove.mockRejectedValueOnce(new Error('boom'));
      r = await mount(<TicketsScreen />);
      await press(r.root, 'sheet-delete');
      expect(db.calls.some((c) => c.op === 'delete')).toBe(true);
    });

    it('al crear una hoja se abre sola para poder anadir lineas', async () => {
      let created = false;
      db.on('expense_sheet_with_total', 'select', () => ({ data: created ? [sheetRow(9, 'Nueva hoja', 1)] : [] }));
      db.on('Expense_sheet', 'insert', () => ((created = true), { data: { id: 9 } }));
      const r = await mount(<TicketsScreen />);
      await press(r.root, 'add-button');
      await type(r.root, 'sheet-title', 'Nueva hoja');
      await type(r.root, 'sheet-project', 'P');
      await press(r.root, 'sheet-create');
      // detalle abierto (referencia/estado de la hoja nueva) en lugar del formulario o del panel vacio
      expect(text(r.root)).toContain('Líneas de gasto');
      expect(r.root.findAll((n) => n.props.testID === 'add-line').length).toBeGreaterThan(0);
    });

    it('al anadir o borrar una linea la lista de hojas se vuelve a pedir (totales al dia)', async () => {
      db.on('expense_sheet_with_total', 'select', { data: [sheetRow(1, 'Hoja uno', 1)] });
      db.on('Expense_line', 'select', { data: [{ id: 5, title: 'L', amount: 5, tax: 21, date: '2026-03-01', id_category: '2', id_payment_type: '1' }] });
      db.on('Expense_line', 'delete', { data: null });
      const r = await mount(<TicketsScreen />);
      await press(r.root, 'sheet-open');
      const before = sheetsQuery().length;
      await press(r.root, 'delete-line-5');
      expect(sheetsQuery().length).toBeGreaterThan(before);
    });
  });
});
