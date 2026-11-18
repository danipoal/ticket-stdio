import * as React from 'react';
import { mount, press, text, type } from '../../test-utils/render';
import { db } from '../../test-utils/supabaseMock';

jest.mock('@/utils/supabase', () => ({ supabase: require('../../test-utils/supabaseMock').db.client }));
const mockFetchEmployee = jest.fn();
jest.mock('@/context/useAuth', () => () => ({
  user: { id: 'u1' },
  employee: null,
  fetchEmployee: mockFetchEmployee,
}));
const mockShow = jest.fn();
jest.mock('@gluestack-ui/themed', () => ({
  ...jest.requireActual('@gluestack-ui/themed'),
  useToast: () => ({ show: mockShow }),
}));

import CompleteProfile from '@/app/auth/completeProfile';

const toastText = (i = 0) => JSON.stringify(mockShow.mock.calls[i][0].render({ id: '1' }));
const rpcCalls = (name: string) => db.calls.filter((c) => c.table === `rpc:${name}`);

async function validated(r: any, code = ' ab12cd34 ') {
  db.onRpc('organization_by_code', { data: [{ id: 1, name: 'Acme Consulting' }] });
  await type(r.root, 'profile-code', code);
  await press(r.root, 'profile-validate');
}

describe('completeProfile (alta por codigo de invitacion)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.reset();
  });

  it('codigo vacio -> aviso y sin llamada', async () => {
    const r = await mount(<CompleteProfile />);
    await press(r.root, 'profile-validate');
    expect(db.calls).toHaveLength(0);
    expect(toastText()).toContain('Introduce un código de empresa');
  });

  it('REGRESION: ya no se lee la tabla Organization (el codigo era el NIF, publico); se usa la funcion RPC', async () => {
    const r = await mount(<CompleteProfile />);
    await validated(r);
    expect(db.calls.some((c) => c.table === 'Organization')).toBe(false);
    expect(rpcCalls('organization_by_code')).toHaveLength(1);
    expect(rpcCalls('organization_by_code')[0].payload).toEqual({ p_code: 'ab12cd34' }); // recortado
  });

  it('codigo desconocido (sin filas) -> aviso y se queda en el paso 1', async () => {
    db.onRpc('organization_by_code', { data: [] });
    const r = await mount(<CompleteProfile />);
    await type(r.root, 'profile-code', 'ZZZZZZZZ');
    await press(r.root, 'profile-validate');
    expect(toastText()).toContain('No se encontró organización');
    expect(r.root.findAll((n) => n.props.testID === 'profile-name')).toHaveLength(0);
  });

  it('error de la funcion -> mensaje claro, sin texto interno', async () => {
    db.onRpc('organization_by_code', { error: { message: 'relation "x" does not exist' } });
    const r = await mount(<CompleteProfile />);
    await type(r.root, 'profile-code', 'AB12CD34');
    await press(r.root, 'profile-validate');
    expect(toastText()).toContain('No se pudo completar el alta');
    expect(toastText()).not.toContain('relation');
  });

  it('codigo valido: muestra a que organizacion se une y pide el nombre', async () => {
    const r = await mount(<CompleteProfile />);
    await validated(r);
    expect(text(r.root)).toContain('Acme Consulting');
    expect(r.root.findAll((n) => n.props.testID === 'profile-name').length).toBeGreaterThan(0);
  });

  it('guardar sin nombre avisa y no llama a join_organization', async () => {
    const r = await mount(<CompleteProfile />);
    await validated(r);
    await type(r.root, 'profile-name', '   ');
    await press(r.root, 'profile-save');
    expect(rpcCalls('join_organization')).toHaveLength(0);
    expect(toastText()).toContain('Introduce tu nombre');
  });

  it('error al unirse avisa al usuario y no recarga el contexto', async () => {
    db.onRpc('join_organization', { error: { message: 'Ya tienes un perfil' } });
    const r = await mount(<CompleteProfile />);
    await validated(r);
    await type(r.root, 'profile-name', 'Ana');
    await press(r.root, 'profile-save');
    expect(toastText()).toContain('Ya tienes un perfil creado');
    expect(mockFetchEmployee).not.toHaveBeenCalled();
  });

  it('exito: llama a join_organization con el codigo y el nombre recortados y recarga el contexto', async () => {
    db.onRpc('join_organization', { data: 'e-new' });
    const r = await mount(<CompleteProfile />);
    await validated(r);
    await type(r.root, 'profile-name', ' Ana ');
    await press(r.root, 'profile-save');
    expect(rpcCalls('join_organization')[0].payload).toEqual({ p_code: 'ab12cd34', p_name: 'Ana' });
    expect(db.calls.some((c) => c.table === 'employees')).toBe(false); // ya no hay INSERT directo
    expect(mockFetchEmployee).toHaveBeenCalledWith('u1');
  });
});
