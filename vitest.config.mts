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
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
    setupFiles: ['./test/vitest.setup.ts'],
    mockReset: true,
    restoreMocks: true,
    coverage: {
      all: true,
      provider: 'istanbul',
      reporter: ['text', 'json-summary', 'lcov'],
      // Coverage gates the logic-bearing layers. Framework wiring (modules,
      // bootstrap, config, logger setup) is proven by the e2e boot test, and
      // declarative files (dto/enums/types/constants) carry no branches.
      include: [
        'src/core/errors/error-body.mapper.ts',
        'src/core/errors/app-exception.filter.ts',
        'src/core/validation/validation-exception.factory.ts',
        'src/core/health/health.service.ts',
        'src/modules/**/application/**/*.ts',
        'src/modules/**/infrastructure/**/*.ts',
        'src/modules/**/lib/**/*.ts',
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
