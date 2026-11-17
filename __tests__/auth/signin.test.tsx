import * as React from 'react';
import { mount, press, text, type } from '../../test-utils/render';

const mockSignin = jest.fn();
jest.mock('@/utils/supabase', () => ({ signin: (...a: any[]) => mockSignin(...a), login: jest.fn() }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }));

import Signin from '@/app/auth/signin';

const fill = async (r: any, email: string, password: string) => {
  await type(r.root, 'signin-email', email);
  await type(r.root, 'signin-password', password);
};

describe('pantalla de registro', () => {
  beforeEach(() => jest.clearAllMocks());

  it('vacio: errores y sin llamada', async () => {
    const r = await mount(<Signin />);
    await press(r.root, 'signin-submit');
    expect(mockSignin).not.toHaveBeenCalled();
    expect(text(r.root)).toContain('El email es obligatorio');
    expect(text(r.root)).toContain('La contraseña es obligatoria');
  });

  it('email invalido', async () => {
    const r = await mount(<Signin />);
    await fill(r, 'x@y', 'abcdef');
    await press(r.root, 'signin-submit');
    expect(mockSignin).not.toHaveBeenCalled();
    expect(text(r.root)).toContain('El email no es válido');
  });

  it('contraseña de menos de 6 caracteres se rechaza antes de llamar (regresion)', async () => {
    const r = await mount(<Signin />);
    await fill(r, 'a@b.co', '12345');
    await press(r.root, 'signin-submit');
    expect(mockSignin).not.toHaveBeenCalled();
    expect(text(r.root)).toContain('al menos 6 caracteres');
  });

  it('error del backend se ve en pantalla (antes: Alert.alert, invisible en web)', async () => {
    mockSignin.mockResolvedValue({ ok: false, message: 'Este email ya está registrado' });
    const r = await mount(<Signin />);
    await fill(r, 'a@b.co', 'abcdef');
    await press(r.root, 'signin-submit');
    expect(text(r.root)).toContain('Este email ya está registrado');
  });

  it('registro que pide confirmar el email lo explica', async () => {
    mockSignin.mockResolvedValue({ ok: true, needsConfirmation: true });
    const r = await mount(<Signin />);
    await fill(r, 'a@b.co', 'abcdef');
    await press(r.root, 'signin-submit');
    expect(text(r.root)).toContain('confirma el email');
  });

  it('registro con sesion inmediata no muestra mensajes', async () => {
    mockSignin.mockResolvedValue({ ok: true, needsConfirmation: false });
    const r = await mount(<Signin />);
    await fill(r, 'a@b.co', 'abcdef');
    await press(r.root, 'signin-submit');
    expect(mockSignin).toHaveBeenCalledWith('a@b.co', 'abcdef');
    expect(r.root.findAll((n) => n.props.testID === 'signin-message')).toHaveLength(0);
  });
});
