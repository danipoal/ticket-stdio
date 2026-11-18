import * as React from 'react';
import { act } from 'react-test-renderer';
import { mount, press, text } from '../test-utils/render';
import { db } from '../test-utils/supabaseMock';

let mockWidth = 1440;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 900, scale: 1, fontScale: 1 }),
}));
jest.mock('@/utils/supabase', () => ({ supabase: require('../test-utils/supabaseMock').db.client }));
let mockAuth: any;
jest.mock('@/context/useAuth', () => () => mockAuth);
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ router: { replace: (...a: any[]) => mockReplace(...a) } }));

import UserScreen from '@/app/(tabs)/user';

const org = { id: 'o1', name: 'Acme S.L.', VAT_number: 'B123', street: 'C/ Mayor 1', city: 'Barcelona', country: 'España' };

describe('UserScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.reset();
    mockWidth = 1440;
    mockAuth = { employee: { id: 'e1', name: 'Ana Pérez', is_admin: false, id_organization: 'o1' }, user: { email: 'ana@demo.test' }, loading: false };
    db.on('Organization', 'select', { data: org });
  });

  it('muestra perfil y organizacion', async () => {
    const r = await mount(<UserScreen />);
    const t = text(r.root);
    expect(t).toContain('Ana Pérez');
    expect(t).toContain('ana@demo.test');
    expect(t).toContain('Empleado');
    expect(t).toContain('Acme S.L.');
    expect(t).toContain('Barcelona');
    expect(t).toContain('B123');
    expect(db.calls[0].filters).toEqual([['id', 'o1']]);
  });

  it('REGRESION: pide columnas explicitas de Organization (select * ya no esta permitido por la base de datos)', async () => {
    await mount(<UserScreen />);
    const orgQuery = db.calls.find((c) => c.table === 'Organization');
    expect(orgQuery).toBeTruthy();
    expect(orgQuery!.select).toBe('id,name,VAT_number,street,city,country');
    expect(orgQuery!.select).not.toContain('*');
    expect(orgQuery!.select).not.toContain('invite_code');
  });

  it('un empleado no ve ni pide el codigo de invitacion', async () => {
    const r = await mount(<UserScreen />);
    expect(db.calls.some((c) => c.table === 'rpc:my_invite_code')).toBe(false);
    expect(r.root.findAll((n) => n.props.testID === 'invite-box')).toHaveLength(0);
  });

  it('un administrador ve el codigo de invitacion de su organizacion y puede copiarlo', async () => {
    mockAuth.employee.is_admin = true;
    db.onRpc('my_invite_code', { data: 'AB12CD34' });
    const writeText = jest.fn().mockResolvedValue(undefined);
    (globalThis as any).navigator = { clipboard: { writeText } };
    const r = await mount(<UserScreen />);
    expect(text(r.root)).toContain('AB12CD34');
    expect(text(r.root)).toContain('Código de invitación');
    await press(r.root, 'invite-copy');
    expect(writeText).toHaveBeenCalledWith('AB12CD34');
    expect(text(r.root)).toContain('Copiado');
    delete (globalThis as any).navigator;
    // al cerrar la pantalla no debe quedar ningun temporizador vivo
    await act(async () => r.unmount());
  });

  it('administrador pero la funcion no devuelve codigo -> no muestra la caja', async () => {
    mockAuth.employee.is_admin = true;
    db.onRpc('my_invite_code', { data: null });
    const r = await mount(<UserScreen />);
    expect(r.root.findAll((n) => n.props.testID === 'invite-box')).toHaveLength(0);
  });

  it('administrador: etiqueta y "Sí"', async () => {
    mockAuth.employee.is_admin = true;
    db.onRpc('my_invite_code', { data: 'AB12CD34' });
    const r = await mount(<UserScreen />);
    expect(text(r.root)).toContain('Administrador');
  });

  it('sin organizacion -> "Sin organización" y no consulta', async () => {
    mockAuth.employee.id_organization = null;
    const r = await mount(<UserScreen />);
    expect(text(r.root)).toContain('Sin organización');
    expect(db.calls).toHaveLength(0);
  });

  it('cargando o sin empleado -> Cargando...', async () => {
    mockAuth = { employee: null, user: null, loading: true };
    const r = await mount(<UserScreen />);
    expect(text(r.root)).toContain('Cargando...');
  });

  it('escritorio: sin boton de cerrar sesion (esta en la barra lateral)', async () => {
    const r = await mount(<UserScreen />);
    expect(r.root.findAll((n) => n.props.testID === 'logout')).toHaveLength(0);
  });

  it('movil: boton de cerrar sesion cierra sesion y va a login', async () => {
    mockWidth = 390;
    const r = await mount(<UserScreen />);
    await press(r.root, 'logout');
    expect(db.auth.signOut).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/auth/login');
  });
});
