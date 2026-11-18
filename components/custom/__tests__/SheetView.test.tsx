import * as React from 'react';
import { act, create, ReactTestInstance } from 'react-test-renderer';
import { GluestackUIProvider } from '@gluestack-ui/themed';
import { config } from '@gluestack-ui/config';
import { db } from '../../../test-utils/supabaseMock';

jest.mock('@/utils/supabase', () => ({ supabase: require('../../../test-utils/supabaseMock').db.client }));
jest.mock('@/context/useAux', () => () => ({
  // Listas vacias: el formulario cae a inputs de texto (mas facil de manejar en test)
  paymentTypes: [],
  categories: [],
  sheetStatuses: [],
  loading: false,
  refresh: jest.fn(),
}));
jest.mock('expo-file-system', () => ({}));
jest.mock('expo-sharing', () => ({}));
jest.mock('expo-image-picker', () => ({ MediaTypeOptions: { Images: 'Images' } }));
jest.mock('expo-web-browser', () => ({}));
const mockConfirm = jest.fn();
jest.mock('@/utils/confirm', () => ({ confirmAction: (...a: any[]) => mockConfirm(...a) }));

import SheetView from '../SheetView';

const sheet: any = {
  id: 7,
  title: 'Viaje',
  description: '',
  project: 'Alfa',
  total_amount: '10',
  create_date: '2025-03-01',
  approval_date: '',
  id_user: 'emp1',
  status: { id: 1, name: 'Pendiente' },
};

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const text = (root: ReactTestInstance) =>
  root.findAll((n) => typeof n.type === 'string').flatMap((n) => n.children.filter((c) => typeof c === 'string')).join(' ');

async function mount(props: any = {}, sheetOverride: any = {}) {
  let r: any;
  await act(async () => {
    r = create(
      <GluestackUIProvider config={config}>
        <SheetView sheet={{ ...sheet, ...sheetOverride }} {...props} />
      </GluestackUIProvider>
    );
  });
  await flush();
  return r;
}

const find = (root: ReactTestInstance, id: string) =>
  root.findAll((n) => n.props.testID === id && (typeof n.props.onPress === 'function' || typeof n.props.onChangeText === 'function'))[0];
const press = async (root: ReactTestInstance, id: string) => {
  await act(async () => { find(root, id).props.onPress(); });
  await flush();
};
const type = async (root: ReactTestInstance, id: string, value: string) => {
  await act(async () => { find(root, id).props.onChangeText(value); });
};
const fillForm = async (root: ReactTestInstance, v: Partial<Record<string, string>> = {}) => {
  const f = { 'line-title': 'Taxi', 'line-amount': '12,5', 'line-tax': '21', 'line-payment': '1', 'line-category': '2', ...v };
  for (const [id, val] of Object.entries(f)) await type(root, id, val as string);
};

describe('SheetView', () => {
  beforeEach(() => db.reset());

  it('muestra las lineas cargadas', async () => {
    db.on('Expense_line', 'select', {
      data: [{ id: 1, title: 'Taxi aeropuerto', amount: 12.5, tax: 21, date: '2025-03-02' }],
    });
    const r = await mount();
    expect(text(r.root)).toContain('Taxi aeropuerto');
  });

  describe('formulario de linea', () => {
    beforeEach(() => {
      db.on('Expense_line', 'select', { data: [{ id: 1, title: 'Existente', amount: 5, tax: 21, date: '2025-03-02' }] });
    });

    it('formulario vacio: no inserta, muestra errores y NO oculta la lista (regresion)', async () => {
      const r = await mount();
      await press(r.root, 'add-line');
      await type(r.root, 'line-tax', '21');
      await press(r.root, 'save-line');
      expect(db.calls.filter((c) => c.op === 'insert')).toHaveLength(0);
      const t = text(r.root);
      expect(t).toContain('El título es obligatorio');
      expect(t).toContain('importe');
      expect(t).toContain('Existente'); // la lista sigue visible
    });

    it('importe con coma se envia como numero (regresion NaN -> null)', async () => {
      db.on('Expense_line', 'insert', { data: [{}] });
      const r = await mount();
      await press(r.root, 'add-line');
      await fillForm(r.root, { 'line-amount': '12,5' });
      await press(r.root, 'save-line');
      const ins = db.calls.find((c) => c.op === 'insert');
      expect(ins?.payload).toMatchObject({
        title: 'Taxi', amount: 12.5, tax: 21, id_payment_type: '1', id_category: '2', id_sheet: '7',
      });
    });

    it('importe invalido no se envia', async () => {
      const r = await mount();
      await press(r.root, 'add-line');
      await fillForm(r.root, { 'line-amount': 'doce' });
      await press(r.root, 'save-line');
      expect(db.calls.some((c) => c.op === 'insert')).toBe(false);
      expect(text(r.root)).toContain('importe válido');
    });

    it('fecha inexistente no se envia', async () => {
      const r = await mount();
      await press(r.root, 'add-line');
      await fillForm(r.root, { 'line-date': '2025-02-30' });
      await press(r.root, 'save-line');
      expect(db.calls.some((c) => c.op === 'insert')).toBe(false);
      expect(text(r.root)).toContain('Fecha no válida');
    });

    it('si falla el insert muestra aviso y mantiene la lista', async () => {
      db.on('Expense_line', 'insert', { error: { message: 'boom' } });
      const r = await mount();
      await press(r.root, 'add-line');
      await fillForm(r.root);
      await press(r.root, 'save-line');
      const t = text(r.root);
      expect(t).toContain('Error creando la línea de gasto');
      expect(t).toContain('Existente');
    });
  });

  describe('fotos', () => {
    const { Platform } = require('react-native');
    const origOS = Platform.OS;
    let picked: any;
    beforeEach(() => {
      picked = null;
      (global as any).URL.createObjectURL = jest.fn(() => 'blob:x');
      db.on('Expense_line', 'select', { data: [] });
      db.on('Expense_line', 'insert', { data: [{}] });
    });
    afterEach(() => {
      Platform.OS = origOS;
      delete (global as any).document;
    });

    // Solo pasamos a "web" (y con un document falso) cuando ya esta montado el
    // arbol: el provider de gluestack en modo web exige un DOM real.
    const attach = async (r: any, file: any) => {
      picked = file;
      Platform.OS = 'web';
      (global as any).document = {
        createElement: () => {
          const input: any = { click: () => input.onchange({ target: { files: [picked] } }) };
          return input;
        },
      };
      await press(r.root, 'attach-photo');
    };

    it('REGRESION: si la subida falla NO se guarda la linea con la URL de una foto inexistente', async () => {
      db.storageUpload.mockResolvedValueOnce({ data: null, error: { message: 'Invalid key' } } as any);
      const r = await mount();
      await press(r.root, 'add-line');
      await fillForm(r.root);
      await attach(r, { name: 'ticket.jpg', type: 'image/jpeg', size: 1000 });
      await press(r.root, 'save-line');
      expect(db.calls.some((c) => c.op === 'insert')).toBe(false);
      expect(text(r.root)).toContain('No se pudo subir la foto');
    });

    it('subida correcta: la linea guarda la URL publica y el nombre va saneado', async () => {
      const r = await mount();
      await press(r.root, 'add-line');
      await fillForm(r.root);
      await attach(r, { name: 'Café ñandú 1.JPG', type: 'image/jpeg', size: 1000 });
      await press(r.root, 'save-line');
      const path = (db.storageUpload.mock.calls[0] as any)[0] as string;
      expect(path).toMatch(/^expense-lines\/7\/\d+_Cafe_nandu_1\.jpg$/);
      const ins = db.calls.find((c) => c.op === 'insert');
      expect(ins?.payload.foto).toBe('https://cdn.test/' + path);
    });

    it('REGRESION: la foto de una linea no se adjunta a la siguiente', async () => {
      const r = await mount();
      await press(r.root, 'add-line');
      await fillForm(r.root);
      await attach(r, { name: 'a.jpg', type: 'image/jpeg', size: 1000 });
      await press(r.root, 'save-line');
      expect(db.storageUpload).toHaveBeenCalledTimes(1);
      // segunda linea, sin foto
      await press(r.root, 'add-line');
      await fillForm(r.root, { 'line-title': 'Otra' });
      await press(r.root, 'save-line');
      expect(db.storageUpload).toHaveBeenCalledTimes(1);
      const inserts = db.calls.filter((c) => c.op === 'insert');
      expect(inserts).toHaveLength(2);
      expect(inserts[1].payload.foto).toBeUndefined();
    });

    it('rechaza ficheros que no son imagen o pesan mas de 10 MB', async () => {
      const r = await mount();
      await press(r.root, 'add-line');
      await attach(r, { name: 'x.pdf', type: 'application/pdf', size: 10 });
      expect(text(r.root)).toContain('imagen');
      await attach(r, { name: 'big.png', type: 'image/png', size: 11 * 1024 * 1024 });
      expect(text(r.root)).toContain('10 MB');
    });
  });

  describe('estado y borrado de lineas', () => {
    const line = { id: 5, title: 'Linea cinco', amount: 5, tax: 21, date: '2025-03-02' };
    beforeEach(() => {
      mockConfirm.mockResolvedValue(true);
      db.on('Expense_line', 'select', { data: [line] });
    });

    it('REGRESION: en una hoja aprobada no se pueden borrar lineas ni anadir', async () => {
      const r = await mount({}, { status: { id: 2, name: 'Aprobado' } });
      expect(text(r.root)).toContain('Linea cinco');
      expect(r.root.findAll((n: ReactTestInstance) => n.props.testID === 'delete-line-5')).toHaveLength(0);
      expect(r.root.findAll((n: ReactTestInstance) => n.props.testID === 'add-line')).toHaveLength(0);
    });

    it('en una hoja pendiente se borra la linea tras confirmar', async () => {
      db.on('Expense_line', 'delete', { data: null });
      const r = await mount();
      await press(r.root, 'delete-line-5');
      expect(mockConfirm).toHaveBeenCalled();
      expect(db.calls.find((c) => c.op === 'delete')?.filters).toEqual([['id', 5]]);
    });

    it('si se cancela la confirmacion no se borra', async () => {
      mockConfirm.mockResolvedValue(false);
      const r = await mount();
      await press(r.root, 'delete-line-5');
      expect(db.calls.some((c) => c.op === 'delete')).toBe(false);
    });

    it('cambiar el estado avisa al padre con el nuevo estado', async () => {
      db.on('Expense_sheet', 'update', { data: null });
      const onStatusChange = jest.fn();
      const r = await mount({ onStatusChange, mode: 'approver' });
      await press(r.root, 'reject-sheet');
      expect(onStatusChange).toHaveBeenCalledWith(3);
    });

    it('si falla el cambio de estado no avisa al padre y muestra el error', async () => {
      db.on('Expense_sheet', 'update', { error: { message: 'rls' } });
      const onStatusChange = jest.fn();
      const r = await mount({ onStatusChange, mode: 'approver' });
      await press(r.root, 'approve-sheet');
      expect(onStatusChange).not.toHaveBeenCalled();
      expect(text(r.root)).toContain('No se pudo actualizar el estado');
      expect(text(r.root)).toContain('Linea cinco');
    });
  });
});
