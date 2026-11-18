import * as React from 'react';
import { mount, text } from '../test-utils/render';
import { db } from '../test-utils/supabaseMock';

jest.mock('@/utils/supabase', () => ({ supabase: require('../test-utils/supabaseMock').db.client }));
let mockEmployee: any = { id: 'admin1', is_admin: true };
jest.mock('@/context/useAuth', () => () => ({ employee: mockEmployee, loading: false }));

let mockWidth = 1440;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 900, scale: 1, fontScale: 1 }),
}));

import SettingsScreen from '@/app/(tabs)/settings';

const stat = (id_user: string, name: string) => ({
  id_user, name, id_admin: 'admin1', total_expense_sheets: 2, approved_sheets: 1,
  pending_sheets: 1, denied_sheets: 0, total_expense_lines: 4, total_amount: 100,
});

describe('SettingsScreen', () => {
  beforeEach(() => {
    db.reset();
    mockWidth = 1440;
    mockEmployee = { id: 'admin1', is_admin: true };
  });

  it('un no-admin ve el area restringida y no consulta nada', async () => {
    mockEmployee = { id: 'e1', is_admin: false };
    const r = await mount(<SettingsScreen />);
    expect(text(r.root)).toContain('Área restringida');
    expect(db.calls).toHaveLength(0);
  });

  it('admin: consulta las estadisticas de sus administrados', async () => {
    db.on('expense_dashboard_stats', 'select', { data: [stat('u1', 'u1-view-name')] });
    db.on('employees', 'select', { data: [{ id_user: 'u1', name: 'Ana Pérez' }] });
    await mount(<SettingsScreen />);
    expect(db.calls[0].filters).toEqual([['id_admin', 'admin1']]);
  });

  it('REGRESION: muestra el nombre del empleado (se buscaba por r.name en vez de r.id_user)', async () => {
    db.on('expense_dashboard_stats', 'select', { data: [stat('u1', 'nombre-de-la-vista')] });
    db.on('employees', 'select', { data: [{ id_user: 'u1', name: 'Ana Pérez' }] });
    const r = await mount(<SettingsScreen />);
    expect(text(r.root)).toContain('Ana Pérez');
  });

  it('sin filas -> mensaje', async () => {
    db.on('expense_dashboard_stats', 'select', { data: [] });
    const r = await mount(<SettingsScreen />);
    expect(text(r.root)).toContain('No hay estadísticas');
  });

  it('error -> mensaje', async () => {
    db.on('expense_dashboard_stats', 'select', { error: { message: 'x' } });
    const r = await mount(<SettingsScreen />);
    expect(text(r.root)).toContain('Error cargando estadísticas');
  });

  it('KPIs de equipo: personas, hojas, pendientes e importe total con miles', async () => {
    db.on('expense_dashboard_stats', 'select', {
      data: [{ ...stat('u1', 'A'), total_amount: 1500.5, pending_sheets: 3, total_expense_sheets: 4 }, { ...stat('u2', 'B'), total_amount: 2000, pending_sheets: 1, total_expense_sheets: 5 }],
    });
    db.on('employees', 'select', { data: [] });
    const r = await mount(<SettingsScreen />);
    const t = text(r.root).replace(/\s+/g, ' ');
    expect(t).toContain('3.500,50 €');
    expect(t).toMatch(/Personas\s*2/);
    expect(t).toMatch(/Pendientes\s*4/);
    expect(t).toMatch(/Hojas de gasto\s*9/);
  });

  it('escritorio muestra las columnas de detalle; movil solo persona y total', async () => {
    db.on('expense_dashboard_stats', 'select', { data: [stat('u1', 'Ana')] });
    db.on('employees', 'select', { data: [] });
    let r = await mount(<SettingsScreen />);
    expect(text(r.root)).toContain('Aprob.');
    mockWidth = 390;
    r = await mount(<SettingsScreen />);
    expect(text(r.root)).not.toContain('Aprob.');
    expect(text(r.root)).toContain('Ana');
  });

  it('avatar con iniciales del empleado', async () => {
    db.on('expense_dashboard_stats', 'select', { data: [stat('u1', 'x')] });
    db.on('employees', 'select', { data: [{ id_user: 'u1', name: 'Luis Gómez' }] });
    const r = await mount(<SettingsScreen />);
    expect(text(r.root)).toContain('LG');
  });
});
