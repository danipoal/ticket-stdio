// Variables que utils/supabase.ts lee en el import. Valores falsos: los tests
// nunca hablan con Supabase real (se mockea en cada test).
process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.EXPO_PUBLIC_SUPABASE_KEY = 'test-anon-key';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Sin animaciones en los tests: el anillo/esqueletos en bucle usan el temporizador simulado de React Native y llenan de avisos
// de act(). El componente BootSplash tiene su propio test con animaciones reales (jest.requireActual).
jest.mock('@/hooks/useReducedMotion', () => ({ __esModule: true, default: () => true }));
