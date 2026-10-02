// Vitest config for everything that is NOT the Angular app: server code, the shared contract,
// database policy tests and (later) the evaluation harness. Angular unit tests run through
// `ng test`, which builds its own Vitest config and only picks up src/**/*.spec.ts.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'server/**/*.test.ts', 'shared/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
