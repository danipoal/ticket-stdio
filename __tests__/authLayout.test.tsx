import * as React from 'react';
import { mount, text } from '../test-utils/render';

let mockWidth = 1440;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 900, scale: 1, fontScale: 1 }),
}));
jest.mock('expo-router', () => ({ Slot: () => require('react').createElement('Text', null, 'CONTENIDO') }));

import AuthLayout from '@/app/auth/_layout';

describe('AuthLayout', () => {
  it('escritorio: panel de marca a la izquierda y formulario a la derecha', async () => {
    mockWidth = 1440;
    const r = await mount(<AuthLayout />);
    expect(r.root.findAll((n) => n.props.testID === 'auth-brand').length).toBeGreaterThan(0);
    expect(text(r.root)).toContain('Tus gastos de empresa, sin papeleo.');
    expect(JSON.stringify(r.toJSON())).toContain('CONTENIDO');
  });
  it('movil: sin panel de marca', async () => {
    mockWidth = 390;
    const r = await mount(<AuthLayout />);
    expect(r.root.findAll((n) => n.props.testID === 'auth-brand')).toHaveLength(0);
    expect(JSON.stringify(r.toJSON())).toContain('CONTENIDO');
  });
});
