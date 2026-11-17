import * as React from 'react';
import { mount, press, type } from '../../test-utils/render';
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
const org = { id: 'o1', name: 'Acme', VAT_number: 'B123', street: '', city: '', country: '' };

async function validated(r: any) {
  db.on('Organization', 'select', { data: org });
  await type(r.root, 'profile-code', ' B123 ');
  await press(r.root, 'profile-validate');
}

describe('completeProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.reset();
  });

  it('codigo vacio -> aviso y sin consulta', async () => {
    const r = await mount(<CompleteProfile />);
    await press(r.root, 'profile-validate');
    expect(db.calls).toHaveLength(0);
    expect(toastText()).toContain('Introduce un código de empresa');
  });

  it('codigo desconocido -> aviso', async () => {
    db.on('Organization', 'select', { data: null });
    const r = await mount(<CompleteProfile />);
    await type(r.root, 'profile-code', 'XXX');
    await press(r.root, 'profile-validate');
    expect(toastText()).toContain('No se encontró organización');
  });

  it('el codigo se recorta y se busca por VAT_number', async () => {
    const r = await mount(<CompleteProfile />);
    await validated(r);
    expect(db.calls[0].filters).toEqual([['VAT_number', 'B123']]);
  });

  it('guardar sin nombre avisa y no inserta (regresion: fallaba en silencio)', async () => {
    const r = await mount(<CompleteProfile />);
    await validated(r);
    await type(r.root, 'profile-name', '   ');
    await press(r.root, 'profile-save');
    expect(db.calls.some((c) => c.op === 'insert')).toBe(false);
    expect(toastText()).toContain('Introduce tu nombre');
  });

  it('error al insertar avisa al usuario (regresion: fallaba en silencio)', async () => {
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    db.on('employees', 'insert', { error: { message: 'rls' } });
    const r = await mount(<CompleteProfile />);
    await validated(r);
    await type(r.root, 'profile-name', 'Ana');
    await press(r.root, 'profile-save');
    expect(toastText()).toContain('No se pudo crear tu perfil');
    expect(mockFetchEmployee).not.toHaveBeenCalled();
    err.mockRestore();
  });

  it('exito: inserta empleado no admin y recarga el contexto', async () => {
    db.on('employees', 'insert', { data: { id: 'e1' } });
    const r = await mount(<CompleteProfile />);
    await validated(r);
    await type(r.root, 'profile-name', ' Ana ');
    await press(r.root, 'profile-save');
    const ins = db.calls.find((c) => c.op === 'insert');
    expect(ins?.payload).toEqual([{ name: 'Ana', id_organization: 'o1', id_user: 'u1', is_admin: false }]);
    expect(mockFetchEmployee).toHaveBeenCalledWith('u1');
  });
});
