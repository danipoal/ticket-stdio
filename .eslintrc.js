// Lint de la app (Expo SDK 52 usa ESLint 8 con configuracion clasica).
module.exports = {
  extends: 'expo',
  ignorePatterns: [
    '/dist/*',
    '/.expo/*',
    '/node_modules/*',
    // codigo generado o que no es de la app
    '/components/ui/*',        // componentes generados por gluestack-ui
    '/public/*',               // landing estatica
    '/supabase/functions/*',   // Edge Functions (Deno)
    '/e2e/*',                  // scripts de Puppeteer (CommonJS en Docker)
    '/scripts/*',
    '/test-utils/*',
  ],
  overrides: [
    {
      // Tests: jest.mock() va antes de los import (babel-jest lo eleva), asi que import/first no aplica; y 'jest' es global
      files: ['**/__tests__/**', '**/*.test.ts', '**/*.test.tsx', 'jest.setup.js'],
      env: { jest: true },
      rules: { 'import/first': 'off' },
    },
  ],
  rules: {
    // Las pantallas leen la sesion/empleado en efectos con dependencias deliberadamente acotadas (ver comentarios eslint-disable)
    'react-hooks/exhaustive-deps': 'warn',
  },
};
