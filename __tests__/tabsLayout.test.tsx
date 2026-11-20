import * as React from 'react';
import { mount } from '../test-utils/render';

let mockWidth = 1440;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 900, scale: 1, fontScale: 1 }),
}));
let mockEmployee: any = { is_admin: false };
jest.mock('@/context/useAuth', () => () => ({ employee: mockEmployee, user: null }));
jest.mock('@/components/custom/Sidebar', () => () => null);

const captured: { tabsProps?: any; screens: Record<string, any> } = { screens: {} };

// Declaraciones de funcion (se elevan): asi la fabrica de jest.mock puede usarlas
// sin acceder a variables aun sin inicializar.
function mockTabs(props: any) {
  captured.tabsProps = props;
  return props.children ?? null;
}
function mockScreen(props: any) {
  captured.screens[props.name] = props.options;
  return null;
}
jest.mock('expo-router', () => {
  const Tabs: any = (p: any) => mockTabs(p);
  Tabs.Screen = (p: any) => mockScreen(p);
  return { Tabs };
});

import TabLayout from '@/app/(tabs)/_layout';

describe('TabLayout', () => {
  beforeEach(() => {
    captured.screens = {};
    captured.tabsProps = undefined;
    mockWidth = 1440;
    mockEmployee = { is_admin: false };
  });

  it('escritorio: barra lateral propia, tabs a la izquierda y sin cabecera nativa', async () => {
    await mount(<TabLayout />);
    expect(typeof captured.tabsProps.tabBar).toBe('function');
    expect(captured.tabsProps.screenOptions.tabBarPosition).toBe('left');
    expect(captured.tabsProps.screenOptions.headerShown).toBe(false);
  });

  it('movil: barra inferior por defecto y con cabecera', async () => {
    mockWidth = 390;
    await mount(<TabLayout />);
    expect(captured.tabsProps.tabBar).toBeUndefined();
    expect(captured.tabsProps.screenOptions.tabBarPosition).toBe('bottom');
    expect(captured.tabsProps.screenOptions.headerShown).toBe(true);
  });

  it('la pestaña Equipo solo existe para administradores', async () => {
    await mount(<TabLayout />);
    expect(captured.screens.settings.href).toBeNull();
    mockEmployee = { is_admin: true };
    await mount(<TabLayout />);
    expect(captured.screens.settings.href).toBeUndefined();
  });

  it('la pestaña Aprobaciones solo existe para administradores', async () => {
    await mount(<TabLayout />);
    expect(captured.screens.approvals.href).toBeNull();
    mockEmployee = { is_admin: true };
    await mount(<TabLayout />);
    expect(captured.screens.approvals.href).toBeUndefined();
  });

  it('la pestaña Suscripcion solo existe para administradores (empleados nunca ven ni pagan)', async () => {
    await mount(<TabLayout />);
    expect(captured.screens.subscription.href).toBeNull();
    expect(captured.screens.subscription.title).toBe('Suscripción');
    mockEmployee = { is_admin: true };
    await mount(<TabLayout />);
    expect(captured.screens.subscription.href).toBeUndefined();
  });

  it('las 6 pantallas estan registradas con titulo en castellano', async () => {
    await mount(<TabLayout />);
    expect(Object.keys(captured.screens).sort()).toEqual(['approvals', 'home', 'settings', 'subscription', 'tickets', 'user']);
    expect(captured.screens.approvals.title).toBe('Aprobaciones');
    expect(captured.screens.home.title).toBe('Inicio');
    expect(captured.screens.settings.title).toBe('Equipo');
  });
});
