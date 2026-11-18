import * as React from 'react';
import { act } from 'react-test-renderer';
import { mount, press, text } from '../../../test-utils/render';
import { db } from '../../../test-utils/supabaseMock';

jest.mock('@/utils/supabase', () => ({ supabase: require('../../../test-utils/supabaseMock').db.client }));
let mockEmployee: any = { id: 'e1', name: 'Ana Pérez', is_admin: false };
jest.mock('@/context/useAuth', () => () => ({ employee: mockEmployee, user: { email: 'ana@demo.test' } }));

import Sidebar from '../Sidebar';

const route = (name: string) => ({ key: `${name}-key`, name });
function props(index = 0, hidden: string[] = []) {
  const routes = ['home', 'tickets', 'settings', 'user'].map(route);
  const titles: any = { home: 'Inicio', tickets: 'Mis Tickets', settings: 'Equipo', user: 'Usuario' };
  const navigation = { emit: jest.fn(() => ({ defaultPrevented: false })), navigate: jest.fn() };
  const descriptors: any = Object.fromEntries(
    // asi llegan las opciones reales: expo-router quita `href` y deja display:none
    routes.map((r) => [r.key, { options: { title: titles[r.name], tabBarItemStyle: hidden.includes(r.name) ? { display: 'none' } : undefined } }])
  );
  return { state: { index, routes }, descriptors, navigation } as any;
}

describe('Sidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEmployee = { id: 'e1', name: 'Ana Pérez', is_admin: false };
  });

  it('muestra marca, entradas de navegacion y datos del usuario', async () => {
    const r = await mount(<Sidebar {...props()} />);
    const t = text(r.root);
    expect(t).toContain('Ticket Stdio');
    for (const label of ['Inicio', 'Mis Tickets', 'Equipo', 'Usuario']) expect(t).toContain(label);
    expect(t).toContain('Ana Pérez');
    expect(t).toContain('ana@demo.test');
    expect(t).toContain('AP'); // iniciales del avatar
  });

  it('oculta las pestañas con display none (Equipo para no admins)', async () => {
    const r = await mount(<Sidebar {...props(0, ['settings'])} />);
    expect(text(r.root)).not.toContain('Equipo');
    expect(r.root.findAll((n) => n.props.testID === 'nav-settings')).toHaveLength(0);
  });

  it('marca como seleccionada solo la pestaña activa', async () => {
    const r = await mount(<Sidebar {...props(1)} />);
    const sel = (id: string) => r.root.findAll((n) => n.props.testID === id && n.props.accessibilityState)[0].props.accessibilityState.selected;
    expect(sel('nav-tickets')).toBe(true);
    expect(sel('nav-home')).toBe(false);
  });

  it('pulsar otra pestaña navega; pulsar la activa no', async () => {
    const p = props(0);
    const r = await mount(<Sidebar {...p} />);
    await press(r.root, 'nav-tickets');
    expect(p.navigation.navigate).toHaveBeenCalledWith('tickets');
    p.navigation.navigate.mockClear();
    await press(r.root, 'nav-home');
    expect(p.navigation.navigate).not.toHaveBeenCalled();
  });

  it('respeta preventDefault del evento tabPress', async () => {
    const p = props(0);
    p.navigation.emit.mockReturnValue({ defaultPrevented: true });
    const r = await mount(<Sidebar {...p} />);
    await press(r.root, 'nav-user');
    expect(p.navigation.navigate).not.toHaveBeenCalled();
  });

  it('cerrar sesion llama a supabase.auth.signOut', async () => {
    const r = await mount(<Sidebar {...props()} />);
    await press(r.root, 'nav-logout');
    expect(db.auth.signOut).toHaveBeenCalledTimes(1);
  });

  it('sin empleado no revienta (nombre por defecto)', async () => {
    mockEmployee = null;
    const r = await mount(<Sidebar {...props()} />);
    expect(text(r.root)).toContain('Usuario');
    await act(async () => {});
  });

  it('tambien oculta si las opciones traen href null', async () => {
    const p = props();
    p.descriptors['settings-key'].options = { title: 'Equipo', href: null };
    const r = await mount(<Sidebar {...p} />);
    expect(text(r.root)).not.toContain('Equipo');
  });
});
