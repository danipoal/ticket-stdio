import * as React from 'react';
import { act } from 'react-test-renderer';
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
    db.on('Expense_sheet', 'delete', { data: null });
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

  describe('detalle', () => {
    it('REGRESION: al aprobar una hoja la lista se refresca (antes la tarjeta quedaba con el estado viejo)', async () => {
      let approved = false;
      db.on('expense_sheet_with_total', 'select', () => ({
        data: [sheetRow(1, 'Hoja uno', approved ? 2 : 1)],
      }));
      db.on('Expense_sheet', 'update', () => {
        approved = true;
        return { data: null };
      });
      const r = await mount(<TicketsScreen />);
      await press(r.root, 'sheet-open');
      const before = sheetsQuery().length;
      await press(r.root, 'approve-sheet');
      await flush();
      expect(db.calls.find((c) => c.op === 'update')?.payload).toEqual({ id_status: '2' });
      expect(sheetsQuery().length).toBeGreaterThan(before);
      // la cabecera del detalle muestra ya el nuevo estado
      expect(text(r.root)).toContain('Aprobado');
    });
  });
});
