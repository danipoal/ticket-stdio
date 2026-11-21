import * as React from 'react';
import { act, create, ReactTestInstance } from 'react-test-renderer';
import { GluestackUIProvider } from '@gluestack-ui/themed';
import { config } from '@gluestack-ui/config';

// Varias vueltas del bucle de eventos: con la maquina cargada (CI, suite en paralelo) una sola no basta
// para que terminen las promesas encadenadas (consulta -> setState -> nueva consulta).
export const flush = async () => {
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
};

// Arboles montados por los tests. Se desmontan al terminar cada test: si no, sus efectos (temporizadores de AuthProvider, bucles
// de animacion de BootSplash...) siguen vivos y, cuando saltan, el error cae en OTRO test que corre en ese momento (fallos intermitentes).
const mounted: any[] = [];
export function track<T extends { unmount: () => void }>(r: T): T {
  mounted.push(r);
  return r;
}
export function unmountAll() {
  for (const r of mounted.splice(0)) {
    try {
      act(() => r.unmount());
    } catch {
      /* ya desmontado */
    }
  }
}
if (typeof afterEach === 'function') afterEach(() => unmountAll());

export async function mount(ui: React.ReactElement) {
  let r: any;
  await act(async () => {
    r = create(<GluestackUIProvider config={config}>{ui}</GluestackUIProvider>);
  });
  track(r);
  await flush();
  return r as ReturnType<typeof create>;
}

/** Texto visible (hojas de string) de un arbol renderizado. */
export const text = (root: ReactTestInstance) =>
  root
    .findAll((n) => typeof n.type === 'string')
    .flatMap((n) => n.children.filter((c) => typeof c === 'string'))
    .join(' ');

const find = (root: ReactTestInstance, id: string, prop: string) =>
  root.findAll((n) => n.props.testID === id && typeof n.props[prop] === 'function')[0];

export async function press(root: ReactTestInstance, id: string) {
  const n = find(root, id, 'onPress');
  if (!n) throw new Error(`No hay elemento pulsable con testID=${id}`);
  await act(async () => {
    await n.props.onPress();
  });
  await flush();
}

export async function type(root: ReactTestInstance, id: string, value: string) {
  const n = find(root, id, 'onChangeText');
  if (!n) throw new Error(`No hay input con testID=${id}`);
  await act(async () => {
    n.props.onChangeText(value);
  });
}
