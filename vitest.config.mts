import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

// Path aliases mirror tsconfig.json `paths`. Keep both in sync.
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
      '@app': resolve(import.meta.dirname, 'src'),
      '@config': resolve(import.meta.dirname, 'src/config'),
      '@core': resolve(import.meta.dirname, 'src/core'),
      '@modules': resolve(import.meta.dirname, 'src/modules'),
      '@shared': resolve(import.meta.dirname, 'src/shared'),
    },
  },
  test: {
    clearMocks: true,
    environment: 'node',
    fileParallelism: false,
    globals: false,
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
    mockReset: true,
    restoreMocks: true,
    coverage: {
      all: true,
      provider: 'istanbul',
      reporter: ['text', 'json-summary', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.module.ts',
        'src/**/*.spec.ts',
        'src/main.ts',
        'src/**/*.dto.ts',
        'src/**/index.ts',
        'test/**',
      ],
      thresholds: {
        branches: 95,
        functions: 95,
        lines: 95,
        statements: 95,
      },
    },
  },
});
