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

async function mount() {
  let r: any;
  await act(async () => {
    r = create(
      <GluestackUIProvider config={config}>
        <SheetView sheet={sheet} />
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
});
