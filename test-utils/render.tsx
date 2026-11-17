import * as React from 'react';
import { act, create, ReactTestInstance } from 'react-test-renderer';
import { GluestackUIProvider } from '@gluestack-ui/themed';
import { config } from '@gluestack-ui/config';

export const flush = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

export async function mount(ui: React.ReactElement) {
  let r: any;
  await act(async () => {
    r = create(<GluestackUIProvider config={config}>{ui}</GluestackUIProvider>);
  });
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
