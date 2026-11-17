import * as React from 'react';
import { mount, press, text, type } from '../../test-utils/render';

const mockLogin = jest.fn();
jest.mock('@/utils/supabase', () => ({ login: (...a: any[]) => mockLogin(...a), signin: jest.fn() }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn() }) }));
const mockPush = jest.fn();
const mockShow = jest.fn();
jest.mock('@gluestack-ui/themed', () => ({
  ...jest.requireActual('@gluestack-ui/themed'),
  useToast: () => ({ show: mockShow }),
}));

import Login from '@/app/auth/login';

const toastText = () => {
  const { render } = mockShow.mock.calls[0][0];
  return JSON.stringify(render({ id: '1' }));
};

describe('pantalla de login', () => {
  beforeEach(() => jest.clearAllMocks());

  it('campos vacios: errores y no llama al backend', async () => {
    const r = await mount(<Login />);
    await press(r.root, 'login-submit');
    expect(mockLogin).not.toHaveBeenCalled();
    expect(text(r.root)).toContain('El email es obligatorio');
    expect(text(r.root)).toContain('La contraseña es obligatoria');
  });

  it('email mal formado: no llama al backend', async () => {
    const r = await mount(<Login />);
    await type(r.root, 'login-email', 'no-es-email');
    await type(r.root, 'login-password', 'abc123');
    await press(r.root, 'login-submit');
    expect(mockLogin).not.toHaveBeenCalled();
    expect(text(r.root)).toContain('El email no es válido');
  });

  it('login correcto llama a login con las credenciales y no muestra error', async () => {
    mockLogin.mockResolvedValue({ ok: true, needsConfirmation: false });
    const r = await mount(<Login />);
    await type(r.root, 'login-email', 'a@b.co');
    await type(r.root, 'login-password', 'abc123');
    await press(r.root, 'login-submit');
    expect(mockLogin).toHaveBeenCalledWith('a@b.co', 'abc123');
    expect(mockShow).not.toHaveBeenCalled();
  });

  it('login fallido muestra el mensaje real del error (regresion: toast vacio)', async () => {
    mockLogin.mockResolvedValue({ ok: false, message: 'Email o contraseña incorrectos' });
    const r = await mount(<Login />);
    await type(r.root, 'login-email', 'a@b.co');
    await type(r.root, 'login-password', 'mala');
    await press(r.root, 'login-submit');
    expect(mockShow).toHaveBeenCalledTimes(1);
    expect(toastText()).toContain('Email o contraseña incorrectos');
  });

  it('el boton queda deshabilitado mientras se envia (evita doble envio)', async () => {
    let resolve: (v: any) => void = () => {};
    mockLogin.mockReturnValue(new Promise((res) => (resolve = res)));
    const r = await mount(<Login />);
    await type(r.root, 'login-email', 'a@b.co');
    await type(r.root, 'login-password', 'abc123');
    const btn = () => r.root.findAll((n) => n.props.testID === 'login-submit' && 'disabled' in n.props)[0];
    // dos pulsaciones seguidas
    const { act } = require('react-test-renderer');
    await act(async () => { void r.root.findAll((n) => n.props.testID === 'login-submit' && typeof n.props.onPress === 'function')[0].props.onPress(); });
    await act(async () => { void r.root.findAll((n) => n.props.testID === 'login-submit' && typeof n.props.onPress === 'function')[0].props.onPress(); });
    expect(mockLogin).toHaveBeenCalledTimes(1);
    expect(btn().props.disabled).toBe(true);
    await act(async () => { resolve({ ok: true, needsConfirmation: false }); });
  });

  it('"Registrate" navega a /auth/signin', async () => {
    const r = await mount(<Login />);
    const go = r.root
      .findAll((n) => typeof n.props.onPress === 'function' && n.props.activeOpacity !== undefined)
      .find((n) => !n.props.testID);
    const { act } = require('react-test-renderer');
    await act(async () => { go!.props.onPress(); });
    expect(mockPush).toHaveBeenCalledWith('/auth/signin');
  });
});
