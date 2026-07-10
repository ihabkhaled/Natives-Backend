import { NodeEnv } from '@shared/enums';
import { afterEach, describe, expect, it } from 'vitest';

import { appConfig } from './app.config';

const ORIGINAL_NODE_ENV = process.env['NODE_ENV'];
const ORIGINAL_SWAGGER = process.env['ENABLE_SWAGGER'];

function restoreEnvironment(): void {
  process.env['NODE_ENV'] = ORIGINAL_NODE_ENV;
  if (ORIGINAL_SWAGGER === undefined) {
    delete process.env['ENABLE_SWAGGER'];
    return;
  }
  process.env['ENABLE_SWAGGER'] = ORIGINAL_SWAGGER;
}

describe('appConfig', () => {
  afterEach(() => {
    restoreEnvironment();
  });

  it('disables Swagger by default in production', () => {
    process.env['NODE_ENV'] = NodeEnv.Production;
    delete process.env['ENABLE_SWAGGER'];

    expect(appConfig().swaggerEnabled).toBe(false);
  });

  it('allows an explicit Swagger setting', () => {
    process.env['NODE_ENV'] = NodeEnv.Production;
    process.env['ENABLE_SWAGGER'] = 'true';

    expect(appConfig().swaggerEnabled).toBe(true);
  });

  it('rejects a missing NODE_ENV if validation is bypassed', () => {
    delete process.env['NODE_ENV'];

    expect(() => appConfig()).toThrow(
      'Required configuration value is missing: NODE_ENV',
    );
  });
});
