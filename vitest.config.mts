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
    globals: true,
    include: [
      'src/**/*.spec.ts',
      'test/**/*.spec.ts',
      'test/**/*.e2e-spec.ts',
      'test/**/*.spec.mjs',
    ],
    setupFiles: ['./test/vitest.setup.ts'],
    mockReset: true,
    restoreMocks: true,
    coverage: {
      all: true,
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov'],
      // Coverage gates the logic-bearing layers. Framework wiring (modules,
      // bootstrap, config, logger setup) is proven by the e2e boot test, and
      // declarative files (dto/enums/types/constants) carry no branches.
      include: [
        'src/config/app.config.ts',
        'src/config/config-validation.helpers.ts',
        'src/config/config.utils.ts',
        'src/config/env.validation.ts',
        'src/config/security.config.ts',
        'src/core/auth/auth-identity.validator.ts',
        'src/core/auth/bearer-token.parser.ts',
        'src/core/auth/jwt-auth.guard.ts',
        'src/core/auth/permission.helpers.ts',
        'src/core/auth/permissions.guard.ts',
        'src/core/errors/error-body.mapper.ts',
        'src/core/errors/app-exception.filter.ts',
        'src/core/logger/app-logger.service.ts',
        'src/core/logger/log-context.sanitizer.ts',
        'src/core/validation/validation-exception.factory.ts',
        'src/core/validation/uuid-validation-error.factory.ts',
        'src/core/validation/uuid-validation.pipe.ts',
        'src/core/health/health.service.ts',
        'src/modules/**/domain/**/*.ts',
        'src/modules/**/application/**/*.ts',
        'src/modules/**/infrastructure/**/*.ts',
        'src/modules/**/lib/**/*.ts',
        'src/modules/**/adapters/**/*.ts',
        'src/modules/**/errors/**/*.ts',
      ],
      thresholds: {
        // Branch floor is 90 (not 95): the decorator downlevel emit injects an
        // uncoverable synthetic branch on every @Injectable/@Catch class line,
        // under both istanbul and v8 providers. Statements/functions/lines stay
        // at 95 and every REAL branch must be covered — do not lower these to
        // absorb untested logic. See memory/known-pitfalls.md §I3 and
        // testing/coverage-policy.md.
        branches: 90,
        functions: 95,
        lines: 95,
        statements: 95,
      },
    },
  },
});
