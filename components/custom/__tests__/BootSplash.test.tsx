import * as React from 'react';

// Aqui SI se prueban las animaciones reales (el resto de tests las desactivan en jest.setup.js)
jest.mock('@/hooks/useReducedMotion', () => ({ __esModule: true, default: () => false }));
import { act } from 'react-test-renderer';
import { mount, press, text } from '../../../test-utils/render';
import BootSplash, { bootLabel, bootSteps } from '../BootSplash';
import { HOME_ROUTE, LOGIN_ROUTE, PROFILE_ROUTE } from '@/utils/authRouting';

const ids = (r: any) => r.root.findAll((n: any) => typeof n.type === 'string' && n.props.testID).map((n: any) => n.props.testID);
const wait = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

describe('bootLabel', () => {
  it('cada etapa tiene su texto en castellano', () => {
    expect(bootLabel('session')).toBe('Comprobando tu sesión…');
    expect(bootLabel('organization')).toBe('Cargando tu empresa…');
    expect(bootLabel('redirect', HOME_ROUTE)).toBe('Abriendo tu panel…');
    expect(bootLabel('redirect', PROFILE_ROUTE)).toBe('Preparando tu perfil…');
    expect(bootLabel('redirect', LOGIN_ROUTE)).toBe('Un momento…');
    expect(bootLabel('redirect', null)).toBe('Un momento…');
    expect(bootLabel('error')).toBe('No hemos podido cargar tu empresa');
  });
});

describe('bootSteps (Sesión → Empresa → Panel)', () => {
  const states = (stage: any, target?: string | null, hasSession = true) => bootSteps(stage, target, hasSession).map((s) => `${s.key}:${s.state}`);
  it('avanzan con la carga', () => {
    expect(states('session')).toEqual(['session:active', 'organization:pending', 'panel:pending']);
    expect(states('organization')).toEqual(['session:done', 'organization:active', 'panel:pending']);
    expect(states('redirect', HOME_ROUTE)).toEqual(['session:done', 'organization:done', 'panel:active']);
  });
  it('sin ficha de empleado la empresa sigue pendiente (completar perfil)', () => {
    expect(states('redirect', PROFILE_ROUTE)).toEqual(['session:done', 'organization:active', 'panel:pending']);
  });
  it('un fallo marca el paso de la empresa en error', () => {
    expect(states('error')).toEqual(['session:done', 'organization:error', 'panel:pending']);
  });
  it('sin sesion (se va al login) no enseña pasos que no tienen sentido', () => {
    expect(bootSteps('redirect', LOGIN_ROUTE, false)).toEqual([]);
    expect(bootSteps('redirect', LOGIN_ROUTE, true)).not.toEqual([]); // con sesion (p. ej. cerrando) si
  });
});

describe('BootSplash', () => {
  it('muestra marca, estado y los tres pasos; es accesible (progressbar con el texto de estado)', async () => {
    const r = await mount(<BootSplash active stage="organization" />);
    const t = text(r.root);
    expect(t).toContain('Ticket Stdio');
    expect(t).toContain('Cargando tu empresa…');
    for (const s of ['Sesión', 'Empresa', 'Panel']) expect(t).toContain(s);
    const root = r.root.findAll((n: any) => typeof n.type === 'string' && n.props.testID === 'boot-splash')[0];
    expect(root.props.accessibilityRole).toBe('progressbar');
    expect(root.props.accessibilityLabel).toBe('Cargando tu empresa…');
    expect(ids(r)).toEqual(expect.arrayContaining(['boot-step-session', 'boot-step-organization', 'boot-step-panel']));
  });

  it('sin ayuda mientras todo va bien (ni botones ni aviso)', async () => {
    const r = await mount(<BootSplash active stage="session" onRetry={jest.fn()} onSignOut={jest.fn()} />);
    expect(ids(r)).not.toContain('boot-help');
    expect(text(r.root)).not.toContain('Reintentar');
  });

  it('si tarda demasiado explica la situacion y ofrece reintentar y cerrar sesion', async () => {
    const onRetry = jest.fn();
    const onSignOut = jest.fn();
    const r = await mount(<BootSplash active stage="organization" slow onRetry={onRetry} onSignOut={onSignOut} />);
    expect(text(r.root)).toContain('tardando más de lo normal');
    await press(r.root, 'boot-retry');
    await press(r.root, 'boot-signout');
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it('error: mensaje claro, sin indicador de progreso, y las dos salidas', async () => {
    const r = await mount(<BootSplash active stage="error" onRetry={jest.fn()} onSignOut={jest.fn()} />);
    const t = text(r.root);
    expect(t).toContain('No hemos podido cargar tu empresa');
    expect(t).toContain('Tus datos no se han perdido');
    expect(ids(r)).toEqual(expect.arrayContaining(['boot-retry', 'boot-signout']));
    expect(r.root.findAll((n: any) => n.type === 'ActivityIndicator').length).toBe(0);
  });

  it('sin onSignOut no ofrece cerrar sesion (aun no hay sesion)', async () => {
    const r = await mount(<BootSplash active stage="error" onRetry={jest.fn()} />);
    expect(ids(r)).toContain('boot-retry');
    expect(ids(r)).not.toContain('boot-signout');
  });

  it('al dejar de estar activa se desvanece y desaparece del arbol', async () => {
    let r: any;
    await act(async () => { r = require('react-test-renderer').create(<BootSplash active stage="session" />); });
    expect(ids(r)).toContain('boot-splash');
    await act(async () => { r.update(<BootSplash active={false} stage="session" />); });
    await wait(500);
    expect(ids(r)).not.toContain('boot-splash');
    await act(async () => { r.update(<BootSplash active stage="session" />); });
    expect(ids(r)).toContain('boot-splash'); // y vuelve a aparecer si hace falta (otro login)
  });

  it('mientras esta activa bloquea los toques; al desvanecerse deja pasar los toques', async () => {
    let r: any;
    await act(async () => { r = require('react-test-renderer').create(<BootSplash active stage="session" />); });
    const root = () => r.root.findAll((n: any) => typeof n.type === 'string' && n.props.testID === 'boot-splash')[0];
    expect(root().props.pointerEvents).toBe('auto');
    await act(async () => { r.update(<BootSplash active={false} stage="session" />); });
    expect(root().props.pointerEvents).toBe('none');
  });

  it('con movimiento reducido no se anima: se retira al instante y sin anillo', async () => {
    jest.resetModules();
    jest.doMock('@/hooks/useReducedMotion', () => ({ __esModule: true, default: () => true }));
    const Reduced = require('../BootSplash').default;
    const { create } = require('react-test-renderer');
    let r: any;
    await act(async () => { r = create(<Reduced active stage="session" />); });
    await act(async () => { r.update(<Reduced active={false} stage="session" />); });
    expect(ids(r)).not.toContain('boot-splash'); // sin esperar al desvanecimiento
  });
});
